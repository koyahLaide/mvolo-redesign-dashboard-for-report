export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import fs from 'fs';
import initSqlJs from 'sql.js';
import path from 'path';
import { DB_PATH } from '../../../lib/db-path';

interface ChannelStat {
  channel: string;
  orders: number;
  revenue: number;
  new_customers: number;
  returning_customers: number;
}

interface DayStat {
  date: string;
  orders: number;
  revenue: number;
}

interface WeekdayStat {
  weekday: string;
  orders: number;
  revenue: number;
}

interface HourStat {
  hour: string;
  orders: number;
}

interface SpendChannelStat {
  channel: string;
  spend: number;
  roas: number;
  poas: number;
  cac: number;
}

interface CampaignStat {
  channel: string;
  campaign_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
}

interface DailySpendStat {
  date: string;
  spend: number;
  revenue: number;
  profit: number;
}

function rowsToObjects(result: { columns: string[]; values: unknown[][] }): unknown[] {
  return result.values.map((row) =>
    Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
  );
}

function periodWhereClause(period: string, platform: string): string {
  const conditions: string[] = [];

  switch (period) {
    case 'today':   conditions.push("DATE(created_at) = DATE('now')"); break;
    case 'week':    conditions.push("created_at >= DATE('now', '-7 days')"); break;
    case 'month':   conditions.push("created_at >= DATE('now', '-30 days')"); break;
    case 'quarter': {
      const now = new Date();
      const qMonth = Math.floor(now.getMonth() / 3) * 3 + 1;
      const qStart = `${now.getFullYear()}-${String(qMonth).padStart(2, '0')}-01`;
      conditions.push(`created_at >= '${qStart}'`); break;
    }
    case 'year':    conditions.push(`strftime('%Y', created_at) = '${new Date().getFullYear()}'`); break;
  }

  if (platform === 'shopify') conditions.push("(marketplace = 'shopify' OR marketplace IS NULL)");
  if (platform === 'bol')     conditions.push("marketplace = 'bol'");

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

export async function GET(request: Request) {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return Response.json(
        { error: `Database not found at ${DB_PATH}. Run npm start in the root project first.` },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period   = searchParams.get('period')   || 'all';
    const platform = searchParams.get('platform') || 'all';
    const where = periodWhereClause(period, platform);

    const wasmPath = path.join(
      process.cwd(),
      'node_modules',
      'sql.js',
      'dist',
      'sql-wasm.wasm'
    );
    const SQL = await initSqlJs({
      locateFile: () => wasmPath,
    });
    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    // ── Migrate: ensure new columns/tables exist (in-memory, safe on old DBs) ──
    const migrations = [
      `CREATE TABLE IF NOT EXISTS ga4_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL, channel TEXT NOT NULL,
        sessions INTEGER DEFAULT 0, users INTEGER DEFAULT 0,
        new_users INTEGER DEFAULT 0, bounce_rate REAL DEFAULT 0,
        avg_session_duration REAL DEFAULT 0, UNIQUE(date, channel)
      )`,
      `CREATE TABLE IF NOT EXISTS ga4_journeys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL, first_channel TEXT NOT NULL, session_channel TEXT NOT NULL,
        sessions INTEGER DEFAULT 0, users INTEGER DEFAULT 0,
        UNIQUE(date, first_channel, session_channel)
      )`,
      'ALTER TABLE orders ADD COLUMN first_touch TEXT',
      'ALTER TABLE orders ADD COLUMN last_touch TEXT',
      'ALTER TABLE orders ADD COLUMN touch_path TEXT',
      'ALTER TABLE orders ADD COLUMN customer_email TEXT',
      'ALTER TABLE orders ADD COLUMN customer_id TEXT',
      'ALTER TABLE orders ADD COLUMN is_new_customer INTEGER',
      "ALTER TABLE orders ADD COLUMN marketplace TEXT DEFAULT 'shopify'",
      'ALTER TABLE orders ADD COLUMN profit REAL',
      'ALTER TABLE orders ADD COLUMN profit_margin REAL',
      'ALTER TABLE orders ADD COLUMN cost_of_goods REAL',
      `CREATE TABLE IF NOT EXISTS ad_spend (
        id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, channel TEXT,
        campaign_name TEXT, adset_name TEXT, ad_name TEXT,
        spend REAL DEFAULT 0, impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0, purchases INTEGER DEFAULT 0, currency TEXT DEFAULT 'EUR'
      )`,
      `CREATE TABLE IF NOT EXISTS daily_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, channel TEXT,
        spend REAL DEFAULT 0, revenue REAL DEFAULT 0, profit REAL DEFAULT 0,
        orders INTEGER DEFAULT 0, new_customers INTEGER DEFAULT 0,
        roas REAL DEFAULT 0, poas REAL DEFAULT 0, cac REAL DEFAULT 0,
        UNIQUE(date, channel)
      )`,
      'ALTER TABLE orders ADD COLUMN direct_subchannel TEXT',
    ];
    for (const sql of migrations) {
      try { db.run(sql); } catch { /* already exists */ }
    }

    // ── Totals ──────────────────────────────────────────────────────────────
    const totalsResult = db.exec(
      `SELECT
        COUNT(*) as total_orders,
        SUM(total_price) as total_revenue,
        SUM(CASE WHEN is_new_customer = 1 THEN 1 ELSE 0 END) as new_customers,
        SUM(CASE WHEN is_new_customer = 0 THEN 1 ELSE 0 END) as returning_customers
       FROM orders ${where}`
    );
    const totals = rowsToObjects(totalsResult[0])[0] as {
      total_orders: number;
      total_revenue: number;
      new_customers: number;
      returning_customers: number;
    };

    // ── Per channel ─────────────────────────────────────────────────────────
    const channelResult = db.exec(`
      SELECT
        channel,
        COUNT(*) as orders,
        ROUND(SUM(total_price), 2) as revenue,
        SUM(CASE WHEN is_new_customer = 1 THEN 1 ELSE 0 END) as new_customers,
        SUM(CASE WHEN is_new_customer = 0 THEN 1 ELSE 0 END) as returning_customers
      FROM orders ${where}
      GROUP BY channel
      ORDER BY orders DESC
    `);
    const channelRows: ChannelStat[] = channelResult.length
      ? (rowsToObjects(channelResult[0]) as ChannelStat[])
      : [];

    // ── Orders per day — last 30 days ────────────────────────────────────────
    const dailyResult = db.exec(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as orders,
        ROUND(SUM(total_price), 2) as revenue
      FROM orders
      WHERE created_at >= DATE('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    const dailyRows: DayStat[] = dailyResult.length
      ? (rowsToObjects(dailyResult[0]) as DayStat[])
      : [];

    // ── Top 5 days by revenue ────────────────────────────────────────────────
    const topDaysResult = db.exec(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as orders,
        ROUND(SUM(total_price), 2) as revenue
      FROM orders ${where}
      GROUP BY DATE(created_at)
      ORDER BY revenue DESC
      LIMIT 5
    `);
    const topDays: DayStat[] = topDaysResult.length
      ? (rowsToObjects(topDaysResult[0]) as DayStat[])
      : [];

    // ── Orders + revenue per weekday (0=Sun … 6=Sat) ────────────────────────
    const weekdayResult = db.exec(`
      SELECT
        strftime('%w', created_at) as weekday,
        COUNT(*) as orders,
        ROUND(SUM(total_price), 2) as revenue
      FROM orders ${where}
      GROUP BY weekday
      ORDER BY weekday
    `);
    const byWeekday: WeekdayStat[] = weekdayResult.length
      ? (rowsToObjects(weekdayResult[0]) as WeekdayStat[])
      : [];

    // ── Orders per hour of day ───────────────────────────────────────────────
    const hourResult = db.exec(`
      SELECT
        strftime('%H', created_at) as hour,
        COUNT(*) as orders
      FROM orders ${where}
      GROUP BY hour
      ORDER BY hour
    `);
    const byHour: HourStat[] = hourResult.length
      ? (rowsToObjects(hourResult[0]) as HourStat[])
      : [];

    // ── Spend / ROAS / POAS / CAC per channel (from daily_metrics) ──────────
    const spendChannelResult = db.exec(`
      SELECT
        channel,
        ROUND(SUM(spend), 2)   as spend,
        ROUND(CASE WHEN SUM(spend) > 0 THEN SUM(revenue) / SUM(spend) ELSE 0 END, 2) as roas,
        ROUND(CASE WHEN SUM(spend) > 0 THEN SUM(profit)  / SUM(spend) ELSE 0 END, 2) as poas,
        ROUND(CASE WHEN SUM(new_customers) > 0 THEN SUM(spend) / SUM(new_customers) ELSE 0 END, 2) as cac
      FROM daily_metrics
      GROUP BY channel
      ORDER BY spend DESC
    `);
    const spendByChannel: SpendChannelStat[] = spendChannelResult.length
      ? (rowsToObjects(spendChannelResult[0]) as SpendChannelStat[])
      : [];

    // ── Total spend / ROAS / POAS ────────────────────────────────────────────
    const spendTotResult = db.exec(`
      SELECT
        ROUND(SUM(spend), 2)   as total_spend,
        ROUND(SUM(revenue), 2) as paid_revenue,
        ROUND(SUM(profit), 2)  as paid_profit
      FROM daily_metrics
    `);
    const spendTot = spendTotResult.length
      ? (rowsToObjects(spendTotResult[0])[0] as { total_spend: number; paid_revenue: number; paid_profit: number })
      : { total_spend: 0, paid_revenue: 0, paid_profit: 0 };

    // ── Top campaigns from ad_spend (last 30 days) ───────────────────────────
    const campaignResult = db.exec(`
      SELECT
        channel,
        campaign_name,
        ROUND(SUM(spend), 2)    as spend,
        SUM(impressions)        as impressions,
        SUM(clicks)             as clicks,
        SUM(purchases)          as purchases
      FROM ad_spend
      WHERE date >= DATE('now', '-30 days')
      GROUP BY channel, campaign_name
      ORDER BY spend DESC
      LIMIT 20
    `);
    const campaigns: CampaignStat[] = campaignResult.length
      ? (rowsToObjects(campaignResult[0]) as CampaignStat[])
      : [];

    // ── Campaign breakdown from orders (utm_campaign) ─────────────────────────
    const orderCampaignResult = db.exec(`
      SELECT
        utm_campaign,
        channel,
        COUNT(*)                           as orders,
        ROUND(SUM(total_price), 2)         as revenue,
        ROUND(AVG(total_price), 2)         as avg_order_value
      FROM orders
      ${where}
      ${where ? 'AND' : 'WHERE'} utm_campaign IS NOT NULL AND utm_campaign != ''
      GROUP BY utm_campaign, channel
      ORDER BY revenue DESC
      LIMIT 25
    `);
    const orderCampaigns: { utm_campaign: string; channel: string; orders: number; revenue: number; avg_order_value: number }[] =
      orderCampaignResult.length ? (rowsToObjects(orderCampaignResult[0]) as { utm_campaign: string; channel: string; orders: number; revenue: number; avg_order_value: number }[]) : [];

    // ── Daily spend + revenue + profit (last 30 days) ────────────────────────
    const dailySpendResult = db.exec(`
      SELECT
        date,
        ROUND(SUM(spend), 2)   as spend,
        ROUND(SUM(revenue), 2) as revenue,
        ROUND(SUM(profit), 2)  as profit
      FROM daily_metrics
      WHERE date >= DATE('now', '-30 days')
      GROUP BY date
      ORDER BY date ASC
    `);
    const dailySpend: DailySpendStat[] = dailySpendResult.length
      ? (rowsToObjects(dailySpendResult[0]) as DailySpendStat[])
      : [];

    // ── GA4: sessions per channel (last 30 days) ─────────────────────────────
    const ga4SessionsResult = db.exec(`
      SELECT
        channel,
        SUM(sessions)                                   as sessions,
        SUM(users)                                      as users,
        SUM(new_users)                                  as new_users,
        ROUND(AVG(bounce_rate), 4)                      as bounce_rate,
        ROUND(AVG(avg_session_duration), 1)             as avg_session_duration
      FROM ga4_sessions
      WHERE date >= DATE('now', '-30 days')
      GROUP BY channel
      ORDER BY sessions DESC
    `);
    const ga4ByChannel: { channel: string; sessions: number; users: number; new_users: number; bounce_rate: number; avg_session_duration: number }[] =
      ga4SessionsResult.length ? (rowsToObjects(ga4SessionsResult[0]) as { channel: string; sessions: number; users: number; new_users: number; bounce_rate: number; avg_session_duration: number }[]) : [];

    // ── GA4: sessions per day (last 30 days, all channels combined) ───────────
    const ga4DailyResult = db.exec(`
      SELECT date, SUM(sessions) as sessions, SUM(users) as users
      FROM ga4_sessions
      WHERE date >= DATE('now', '-30 days')
      GROUP BY date
      ORDER BY date ASC
    `);
    const ga4Daily: { date: string; sessions: number; users: number }[] =
      ga4DailyResult.length ? (rowsToObjects(ga4DailyResult[0]) as { date: string; sessions: number; users: number }[]) : [];

    // ── GA4: sessions per day per channel (for line chart) ────────────────────
    const ga4DailyChannelResult = db.exec(`
      SELECT date, channel, sessions
      FROM ga4_sessions
      WHERE date >= DATE('now', '-30 days')
      ORDER BY date ASC, sessions DESC
    `);
    const ga4DailyByChannel: { date: string; channel: string; sessions: number }[] =
      ga4DailyChannelResult.length ? (rowsToObjects(ga4DailyChannelResult[0]) as { date: string; channel: string; sessions: number }[]) : [];

    // ── GA4: top landing pages ─────────────────────────────────────────────────
    // (stored inline from a separate future sync — for now we query journeys)
    // ── GA4: first-touch vs session-channel journeys ──────────────────────────
    const ga4JourneysResult = db.exec(`
      SELECT
        first_channel,
        session_channel,
        SUM(sessions) as sessions,
        SUM(users)    as users
      FROM ga4_journeys
      WHERE date >= DATE('now', '-30 days')
      GROUP BY first_channel, session_channel
      ORDER BY sessions DESC
      LIMIT 30
    `);
    const ga4Journeys: { first_channel: string; session_channel: string; sessions: number; users: number }[] =
      ga4JourneysResult.length ? (rowsToObjects(ga4JourneysResult[0]) as { first_channel: string; session_channel: string; sessions: number; users: number }[]) : [];

    // ── Meta attribution windows (from journey_meta) ────────────────────────
    const migrations2 = [
      `CREATE TABLE IF NOT EXISTS journey_meta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL, channel TEXT NOT NULL, campaign_name TEXT,
        purchases_1d INTEGER DEFAULT 0, purchases_7d INTEGER DEFAULT 0, purchases_28d INTEGER DEFAULT 0,
        revenue_1d REAL DEFAULT 0, revenue_7d REAL DEFAULT 0, revenue_28d REAL DEFAULT 0,
        UNIQUE(date, channel, campaign_name)
      )`,
    ];
    for (const sql of migrations2) { try { db.run(sql); } catch { /* already exists */ } }

    const metaWindowResult = db.exec(`
      SELECT
        SUM(purchases_1d)                                            as total_1d,
        SUM(purchases_7d)                                            as total_7d,
        SUM(purchases_28d)                                           as total_28d,
        ROUND(SUM(revenue_1d), 2)                                    as rev_1d,
        ROUND(SUM(revenue_7d), 2)                                    as rev_7d,
        ROUND(SUM(revenue_28d), 2)                                   as rev_28d
      FROM journey_meta
      WHERE date >= DATE('now', '-30 days')
    `);
    const metaWindows = metaWindowResult.length
      ? (rowsToObjects(metaWindowResult[0])[0] as { total_1d: number; total_7d: number; total_28d: number; rev_1d: number; rev_7d: number; rev_28d: number })
      : { total_1d: 0, total_7d: 0, total_28d: 0, rev_1d: 0, rev_7d: 0, rev_28d: 0 };

    // ── Repeat purchase analysis ──────────────────────────────────────────────
    const repeatPurchaseResult = db.exec(`
      WITH ordered AS (
        SELECT
          COALESCE(customer_id, customer_email) AS customer_key,
          channel, created_at,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(customer_id, customer_email)
            ORDER BY created_at
          ) AS rn
        FROM orders
        WHERE COALESCE(customer_id, customer_email) IS NOT NULL
          AND COALESCE(customer_id, customer_email) != ''
      ),
      pairs AS (
        SELECT a.channel AS first_channel,
          ROUND((julianday(b.created_at) - julianday(a.created_at)), 1) AS days_between
        FROM ordered a
        JOIN ordered b ON a.customer_key = b.customer_key AND b.rn = a.rn + 1
      )
      SELECT first_channel, COUNT(*) AS repeat_purchases,
        ROUND(AVG(days_between), 1) AS avg_days_between
      FROM pairs
      GROUP BY first_channel
      ORDER BY repeat_purchases DESC
      LIMIT 10
    `);
    const repeatPurchases: { first_channel: string; repeat_purchases: number; avg_days_between: number }[] =
      repeatPurchaseResult.length ? (rowsToObjects(repeatPurchaseResult[0]) as { first_channel: string; repeat_purchases: number; avg_days_between: number }[]) : [];

    // ── Return-period histogram (days between 1st and 2nd purchase) ──────────
    const returnBucketResult = db.exec(`
      WITH ordered AS (
        SELECT COALESCE(customer_id, customer_email) AS k, created_at,
          ROW_NUMBER() OVER (PARTITION BY COALESCE(customer_id, customer_email) ORDER BY created_at) AS rn
        FROM orders
        WHERE COALESCE(customer_id, customer_email) IS NOT NULL
          AND COALESCE(customer_id, customer_email) != ''
      ),
      pairs AS (
        SELECT ROUND(julianday(b.created_at) - julianday(a.created_at)) AS days
        FROM ordered a JOIN ordered b ON a.k = b.k AND b.rn = a.rn + 1
      )
      SELECT
        CASE WHEN days <= 30 THEN '0–30 dagen'
             WHEN days <= 60 THEN '31–60 dagen'
             WHEN days <= 90 THEN '61–90 dagen'
             ELSE '90+ dagen' END AS bucket,
        COUNT(*) AS count
      FROM pairs
      GROUP BY bucket
      ORDER BY MIN(days)
    `);
    const returnBuckets: { bucket: string; count: number }[] =
      returnBucketResult.length ? (rowsToObjects(returnBucketResult[0]) as { bucket: string; count: number }[]) : [];

    // ── Customer loyalty: unique customers with 1 vs 2+ orders ───────────────
    const loyaltyResult = db.exec(`
      SELECT
        SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) AS single_order,
        SUM(CASE WHEN cnt >= 2 THEN 1 ELSE 0 END) AS repeat_customer
      FROM (
        SELECT COALESCE(customer_id, customer_email) AS k, COUNT(*) AS cnt
        FROM orders
        WHERE COALESCE(customer_id, customer_email) IS NOT NULL
          AND COALESCE(customer_id, customer_email) != ''
        GROUP BY k
      )
    `);
    const loyalty = loyaltyResult.length
      ? (rowsToObjects(loyaltyResult[0])[0] as { single_order: number; repeat_customer: number })
      : { single_order: 0, repeat_customer: 0 };

    // ── PM first vs last touch comparison ────────────────────────────────────
    const pmTouchResult = db.exec(`
      SELECT
        COUNT(*)                                                              as total,
        SUM(CASE WHEN first_touch = last_touch OR last_touch IS NULL THEN 1 ELSE 0 END) as single_touch,
        SUM(CASE WHEN first_touch != last_touch AND last_touch IS NOT NULL THEN 1 ELSE 0 END) as multi_touch,
        first_touch,
        last_touch
      FROM orders
      WHERE first_touch IS NOT NULL
        AND (marketplace = 'shopify' OR marketplace IS NULL)
      GROUP BY first_touch, last_touch
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `);
    const pmTouchRows: { total: number; single_touch: number; multi_touch: number; first_touch: string; last_touch: string }[] =
      pmTouchResult.length ? (rowsToObjects(pmTouchResult[0]) as { total: number; single_touch: number; multi_touch: number; first_touch: string; last_touch: string }[]) : [];

    const pmTouchSummaryResult = db.exec(`
      SELECT
        COUNT(*)                                                                     as total,
        SUM(CASE WHEN first_touch = last_touch OR last_touch IS NULL THEN 1 ELSE 0 END) as single_touch,
        SUM(CASE WHEN first_touch != last_touch AND last_touch IS NOT NULL THEN 1 ELSE 0 END) as multi_touch
      FROM orders
      WHERE first_touch IS NOT NULL
        AND (marketplace = 'shopify' OR marketplace IS NULL)
    `);
    const pmTouchSummary = pmTouchSummaryResult.length
      ? (rowsToObjects(pmTouchSummaryResult[0])[0] as { total: number; single_touch: number; multi_touch: number })
      : { total: 0, single_touch: 0, multi_touch: 0 };

    // ── PM visitor_sessions journey data ──────────────────────────────────────
    const vsJourneyResult = db.exec(`
      SELECT
        channel,
        ROUND(AVG(vs.sessions_before_purchase), 1) as avg_sessions,
        ROUND(AVG(vs.days_to_convert), 1)          as avg_days,
        COUNT(*)                                    as total
      FROM visitor_sessions vs
      JOIN orders o ON vs.order_id = o.id
      WHERE vs.order_id IS NOT NULL
      GROUP BY channel
      ORDER BY total DESC
    `);
    const vsJourneyByChannel: { channel: string; avg_sessions: number; avg_days: number; total: number }[] =
      vsJourneyResult.length ? (rowsToObjects(vsJourneyResult[0]) as { channel: string; avg_sessions: number; avg_days: number; total: number }[]) : [];

    // ── Direct subchannel breakdown ──────────────────────────────────────────
    const directWhere = where
      ? `${where} AND channel = 'direct'`
      : "WHERE channel = 'direct'";
    const directSubResult = db.exec(`
      SELECT
        COALESCE(direct_subchannel, 'direct_unknown') as subchannel,
        COUNT(*) as orders,
        ROUND(SUM(total_price), 2) as revenue
      FROM orders
      ${directWhere}
      GROUP BY direct_subchannel
      ORDER BY orders DESC
    `);
    const directSubchannels: { subchannel: string; orders: number; revenue: number }[] =
      directSubResult.length
        ? (rowsToObjects(directSubResult[0]) as { subchannel: string; orders: number; revenue: number }[])
        : [];

    // ── Recent Orders (last 15) ──────────────────────────────────────────────
    const recentOrdersResult = db.exec(`
      SELECT
        id, order_number, created_at, total_price, channel, marketplace
      FROM orders
      ORDER BY created_at DESC
      LIMIT 15
    `);
    const recentOrders = recentOrdersResult.length
      ? rowsToObjects(recentOrdersResult[0]) as { id: string; order_number: string; created_at: string; total_price: number; channel: string; marketplace: string }[]
      : [];

    db.close();

    // ── Customer Journey stats (from /tmp sessions DB) ───────────────────────
    interface JourneyChannelStat {
      channel: string;
      avg_sessions: number;
      avg_days: number;
      total: number;
    }
    interface JourneyBucket {
      bucket: string;
      count: number;
    }

    let journeyByChannel: JourneyChannelStat[] = [];
    let journeyHistogram: JourneyBucket[] = [];
    let totalTracked = 0;

    try {
      const SESSIONS_DB_PATH = '/tmp/mvolo_sessions.db';
      if (fs.existsSync(SESSIONS_DB_PATH)) {
        const sdb = new SQL.Database(fs.readFileSync(SESSIONS_DB_PATH));

        // Match sessions to orders by order_id to get channel
        const jResult = sdb.exec(`
          SELECT
            o.channel,
            ROUND(AVG(vs.sessions_before_purchase), 1) as avg_sessions,
            ROUND(AVG(vs.days_to_convert), 1)          as avg_days,
            COUNT(*)                                    as total
          FROM visitor_sessions vs
          JOIN (
            SELECT id, channel FROM (
              SELECT id, channel FROM orders
            )
          ) o ON vs.order_id = o.id
          WHERE vs.order_id IS NOT NULL AND vs.order_id != ''
          GROUP BY o.channel
          ORDER BY total DESC
        `);
        if (jResult.length) {
          journeyByChannel = rowsToObjects(jResult[0]) as JourneyChannelStat[];
        }

        // Session count histogram
        const hResult = sdb.exec(`
          SELECT
            CASE
              WHEN sessions_before_purchase = 1             THEN '1 sessie'
              WHEN sessions_before_purchase BETWEEN 2 AND 3 THEN '2–3 sessies'
              WHEN sessions_before_purchase BETWEEN 4 AND 7 THEN '4–7 sessies'
              ELSE '8+ sessies'
            END as bucket,
            COUNT(*) as count
          FROM visitor_sessions
          WHERE order_id IS NOT NULL AND order_id != ''
          GROUP BY bucket
          ORDER BY MIN(sessions_before_purchase)
        `);
        if (hResult.length) {
          journeyHistogram = rowsToObjects(hResult[0]) as JourneyBucket[];
        }

        const totResult = sdb.exec(`SELECT COUNT(*) as c FROM visitor_sessions WHERE order_id IS NOT NULL AND order_id != ''`);
        if (totResult.length) totalTracked = (rowsToObjects(totResult[0])[0] as { c: number }).c;

        sdb.close();
      }
    } catch { /* sessions DB not available — no journey data yet */ }

    const bestChannel = channelRows[0]?.channel ?? '—';
    const avgOrderValue =
      totals.total_orders > 0
        ? Math.round((totals.total_revenue / totals.total_orders) * 100) / 100
        : 0;

    const totalSpend = spendTot.total_spend ?? 0;
    const overallRoas = totalSpend > 0
      ? Math.round((spendTot.paid_revenue / totalSpend) * 100) / 100 : 0;
    const overallPoas = totalSpend > 0
      ? Math.round((spendTot.paid_profit / totalSpend) * 100) / 100 : 0;

    return Response.json({
      totalOrders: totals.total_orders,
      totalRevenue: Math.round(totals.total_revenue * 100) / 100,
      avgOrderValue,
      bestChannel,
      newCustomers: totals.new_customers ?? 0,
      returningCustomers: totals.returning_customers ?? 0,
      channels: channelRows,
      daily: dailyRows,
      topDays,
      byWeekday,
      byHour,
      // spend / profitability
      totalSpend,
      overallRoas,
      overallPoas,
      spendByChannel,
      campaigns,
      dailySpend,
      orderCampaigns,
      // customer journey (tracker.js sessions)
      journeyByChannel,
      journeyHistogram,
      totalTracked,
      // ga4
      ga4ByChannel,
      ga4Daily,
      ga4DailyByChannel,
      ga4Journeys,
      returnBuckets,
      loyalty,
      // journey reconstruction
      metaWindows,
      repeatPurchases,
      pmTouchSummary,
      pmTouchRows,
      vsJourneyByChannel,
      directSubchannels,
      recentOrders,
    });
  } catch (err) {
    console.error('[/api/stats] Error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
