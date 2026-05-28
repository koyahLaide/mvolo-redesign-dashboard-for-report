export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import pool from '../../../lib/db';

function periodWhereClause(period: string, platform: string): string {
  const conditions: string[] = [];

  switch (period) {
    case 'today':   conditions.push("DATE(created_at) = CURRENT_DATE"); break;
    case 'week':    conditions.push("created_at >= CURRENT_DATE - INTERVAL '7 days'"); break;
    case 'month':   conditions.push("created_at >= CURRENT_DATE - INTERVAL '30 days'"); break;
    case 'quarter': {
      const now = new Date();
      const qMonth = Math.floor(now.getMonth() / 3) * 3 + 1;
      const qStart = `${now.getFullYear()}-${String(qMonth).padStart(2, '0')}-01`;
      conditions.push(`created_at >= '${qStart}'`); break;
    }
    case 'year':    conditions.push(`EXTRACT(YEAR FROM created_at) = ${new Date().getFullYear()}`); break;
  }

  if (platform === 'shopify') conditions.push("(marketplace = 'shopify' OR marketplace IS NULL)");
  if (platform === 'bol')     conditions.push("marketplace = 'bol'");

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period   = searchParams.get('period')   || 'all';
    const platform = searchParams.get('platform') || 'all';
    const where = periodWhereClause(period, platform);

    // Totals
    const totalsResult = await pool.query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(total_price) as total_revenue,
        SUM(CASE WHEN is_new_customer = true  THEN 1 ELSE 0 END) as new_customers,
        SUM(CASE WHEN is_new_customer = false THEN 1 ELSE 0 END) as returning_customers
      FROM orders ${where}
    `);
    const totals = totalsResult.rows[0] ?? { total_orders: 0, total_revenue: 0, new_customers: 0, returning_customers: 0 };

    // Per channel
    const channelResult = await pool.query(`
      SELECT channel,
        COUNT(*) as orders,
        ROUND(SUM(total_price)::numeric, 2) as revenue,
        SUM(CASE WHEN is_new_customer = true  THEN 1 ELSE 0 END) as new_customers,
        SUM(CASE WHEN is_new_customer = false THEN 1 ELSE 0 END) as returning_customers
      FROM orders ${where}
      GROUP BY channel
      ORDER BY orders DESC
    `);
    const channelRows = channelResult.rows;

    // Orders per day (last 30d)
    const dailyResult = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as orders, ROUND(SUM(total_price)::numeric, 2) as revenue
      FROM orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Top 5 days by revenue
    const topDaysResult = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as orders, ROUND(SUM(total_price)::numeric, 2) as revenue
      FROM orders ${where}
      GROUP BY DATE(created_at)
      ORDER BY revenue DESC
      LIMIT 5
    `);

    // Orders + revenue per weekday
    const weekdayResult = await pool.query(`
      SELECT EXTRACT(DOW FROM created_at)::text as weekday,
        COUNT(*) as orders, ROUND(SUM(total_price)::numeric, 2) as revenue
      FROM orders ${where}
      GROUP BY EXTRACT(DOW FROM created_at)
      ORDER BY EXTRACT(DOW FROM created_at)
    `);

    // Orders per hour
    const hourResult = await pool.query(`
      SELECT TO_CHAR(created_at, 'HH24') as hour, COUNT(*) as orders
      FROM orders ${where}
      GROUP BY TO_CHAR(created_at, 'HH24')
      ORDER BY hour
    `);

    // Spend / ROAS / POAS / CAC per channel
    const spendChannelResult = await pool.query(`
      SELECT channel,
        ROUND(SUM(spend)::numeric, 2) as spend,
        ROUND(CASE WHEN SUM(spend) > 0 THEN SUM(revenue) / SUM(spend) ELSE 0 END, 2) as roas,
        ROUND(CASE WHEN SUM(spend) > 0 THEN SUM(profit)  / SUM(spend) ELSE 0 END, 2) as poas,
        ROUND(CASE WHEN SUM(new_customers) > 0 THEN SUM(spend) / SUM(new_customers) ELSE 0 END, 2) as cac
      FROM daily_metrics
      GROUP BY channel
      ORDER BY spend DESC
    `);

    // Total spend / ROAS / POAS
    const spendTotResult = await pool.query(`
      SELECT ROUND(SUM(spend)::numeric, 2)   as total_spend,
             ROUND(SUM(revenue)::numeric, 2) as paid_revenue,
             ROUND(SUM(profit)::numeric, 2)  as paid_profit
      FROM daily_metrics
    `);
    const spendTot = spendTotResult.rows[0] ?? { total_spend: 0, paid_revenue: 0, paid_profit: 0 };

    // Top campaigns from ad_spend (last 30d)
    const campaignResult = await pool.query(`
      SELECT channel, campaign_name,
        ROUND(SUM(spend)::numeric, 2) as spend,
        SUM(impressions) as impressions, SUM(clicks) as clicks, SUM(purchases) as purchases
      FROM ad_spend
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY channel, campaign_name
      ORDER BY spend DESC
      LIMIT 20
    `);

    // Campaign breakdown from orders
    const orderCampaignResult = await pool.query(`
      SELECT utm_campaign, channel,
        COUNT(*) as orders,
        ROUND(SUM(total_price)::numeric, 2) as revenue,
        ROUND(AVG(total_price)::numeric, 2) as avg_order_value
      FROM orders
      ${where}
      ${where ? 'AND' : 'WHERE'} utm_campaign IS NOT NULL AND utm_campaign != ''
      GROUP BY utm_campaign, channel
      ORDER BY revenue DESC
      LIMIT 25
    `);

    // Daily spend + revenue + profit (last 30d)
    const dailySpendResult = await pool.query(`
      SELECT date,
        ROUND(SUM(spend)::numeric, 2) as spend,
        ROUND(SUM(revenue)::numeric, 2) as revenue,
        ROUND(SUM(profit)::numeric, 2) as profit
      FROM daily_metrics
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date ASC
    `);

    // GA4: sessions per channel (last 30d)
    const ga4SessionsResult = await pool.query(`
      SELECT channel,
        SUM(sessions) as sessions, SUM(users) as users, SUM(new_users) as new_users,
        ROUND(AVG(bounce_rate)::numeric, 4) as bounce_rate,
        ROUND(AVG(avg_session_duration)::numeric, 1) as avg_session_duration
      FROM ga4_sessions
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY channel
      ORDER BY sessions DESC
    `);

    // GA4: sessions per day (last 30d)
    const ga4DailyResult = await pool.query(`
      SELECT date, SUM(sessions) as sessions, SUM(users) as users
      FROM ga4_sessions
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date ASC
    `);

    // GA4: sessions per day per channel
    const ga4DailyChannelResult = await pool.query(`
      SELECT date, channel, sessions
      FROM ga4_sessions
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY date ASC, sessions DESC
    `);

    // GA4 journeys (last 30d)
    const ga4JourneysResult = await pool.query(`
      SELECT first_channel, session_channel, SUM(sessions) as sessions, SUM(users) as users
      FROM ga4_journeys
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY first_channel, session_channel
      ORDER BY sessions DESC
      LIMIT 30
    `);

    // Meta attribution windows
    const metaWindowResult = await pool.query(`
      SELECT
        SUM(purchases_1d) as total_1d, SUM(purchases_7d) as total_7d, SUM(purchases_28d) as total_28d,
        ROUND(SUM(revenue_1d)::numeric, 2) as rev_1d,
        ROUND(SUM(revenue_7d)::numeric, 2) as rev_7d,
        ROUND(SUM(revenue_28d)::numeric, 2) as rev_28d
      FROM journey_meta
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    `);
    const metaWindows = metaWindowResult.rows[0] ?? { total_1d: 0, total_7d: 0, total_28d: 0, rev_1d: 0, rev_7d: 0, rev_28d: 0 };

    // Repeat purchase analysis
    const repeatPurchaseResult = await pool.query(`
      WITH ordered AS (
        SELECT COALESCE(customer_id, customer_email) AS customer_key,
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
          ROUND((EXTRACT(EPOCH FROM (b.created_at - a.created_at)) / 86400)::numeric, 1) AS days_between
        FROM ordered a
        JOIN ordered b ON a.customer_key = b.customer_key AND b.rn = a.rn + 1
      )
      SELECT first_channel, COUNT(*) AS repeat_purchases,
        ROUND(AVG(days_between)::numeric, 1) AS avg_days_between
      FROM pairs
      GROUP BY first_channel
      ORDER BY repeat_purchases DESC
      LIMIT 10
    `);

    // Return-period histogram
    const returnBucketResult = await pool.query(`
      WITH ordered AS (
        SELECT COALESCE(customer_id, customer_email) AS k, created_at,
          ROW_NUMBER() OVER (PARTITION BY COALESCE(customer_id, customer_email) ORDER BY created_at) AS rn
        FROM orders
        WHERE COALESCE(customer_id, customer_email) IS NOT NULL
          AND COALESCE(customer_id, customer_email) != ''
      ),
      pairs AS (
        SELECT ROUND(EXTRACT(EPOCH FROM (b.created_at - a.created_at)) / 86400) AS days
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

    // Customer loyalty
    const loyaltyResult = await pool.query(`
      SELECT
        SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) AS single_order,
        SUM(CASE WHEN cnt >= 2 THEN 1 ELSE 0 END) AS repeat_customer
      FROM (
        SELECT COALESCE(customer_id, customer_email) AS k, COUNT(*) AS cnt
        FROM orders
        WHERE COALESCE(customer_id, customer_email) IS NOT NULL
          AND COALESCE(customer_id, customer_email) != ''
        GROUP BY k
      ) sub
    `);
    const loyalty = loyaltyResult.rows[0] ?? { single_order: 0, repeat_customer: 0 };

    // PM first vs last touch
    const pmTouchResult = await pool.query(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN first_touch = last_touch OR last_touch IS NULL THEN 1 ELSE 0 END) as single_touch,
        SUM(CASE WHEN first_touch != last_touch AND last_touch IS NOT NULL THEN 1 ELSE 0 END) as multi_touch,
        first_touch, last_touch
      FROM orders
      WHERE first_touch IS NOT NULL
        AND (marketplace = 'shopify' OR marketplace IS NULL)
      GROUP BY first_touch, last_touch
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `);

    const pmTouchSummaryResult = await pool.query(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN first_touch = last_touch OR last_touch IS NULL THEN 1 ELSE 0 END) as single_touch,
        SUM(CASE WHEN first_touch != last_touch AND last_touch IS NOT NULL THEN 1 ELSE 0 END) as multi_touch
      FROM orders
      WHERE first_touch IS NOT NULL
        AND (marketplace = 'shopify' OR marketplace IS NULL)
    `);
    const pmTouchSummary = pmTouchSummaryResult.rows[0] ?? { total: 0, single_touch: 0, multi_touch: 0 };

    // visitor_sessions journey data
    const vsJourneyResult = await pool.query(`
      SELECT channel,
        ROUND(AVG(vs.sessions_before_purchase)::numeric, 1) as avg_sessions,
        ROUND(AVG(vs.days_to_convert)::numeric, 1) as avg_days,
        COUNT(*) as total
      FROM visitor_sessions vs
      JOIN orders o ON vs.order_id = o.id
      WHERE vs.order_id IS NOT NULL
      GROUP BY channel
      ORDER BY total DESC
    `);

    // Direct subchannel breakdown
    const directWhereClause = where
      ? `${where} AND channel = 'direct'`
      : "WHERE channel = 'direct'";
    const directSubResult = await pool.query(`
      SELECT COALESCE(direct_subchannel, 'direct_unknown') as subchannel,
        COUNT(*) as orders, ROUND(SUM(total_price)::numeric, 2) as revenue
      FROM orders ${directWhereClause}
      GROUP BY direct_subchannel
      ORDER BY orders DESC
    `);

    // Recent Orders (last 15)
    const recentOrdersResult = await pool.query(`
      SELECT id, order_number, created_at, total_price, channel, marketplace
      FROM orders
      ORDER BY created_at DESC
      LIMIT 15
    `);

    // Derived values
    const bestChannel = channelRows[0]?.channel ?? '—';
    const totalOrders = parseInt(totals.total_orders) || 0;
    const totalRevenue = parseFloat(totals.total_revenue) || 0;
    const avgOrderValue = totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;
    const totalSpend = parseFloat(spendTot.total_spend) ?? 0;
    const overallRoas = totalSpend > 0 ? Math.round((parseFloat(spendTot.paid_revenue) / totalSpend) * 100) / 100 : 0;
    const overallPoas = totalSpend > 0 ? Math.round((parseFloat(spendTot.paid_profit)  / totalSpend) * 100) / 100 : 0;

    return Response.json({
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgOrderValue,
      bestChannel,
      newCustomers:       parseInt(totals.new_customers) ?? 0,
      returningCustomers: parseInt(totals.returning_customers) ?? 0,
      channels:    channelRows,
      daily:       dailyResult.rows,
      topDays:     topDaysResult.rows,
      byWeekday:   weekdayResult.rows,
      byHour:      hourResult.rows,
      // spend / profitability
      totalSpend,
      overallRoas,
      overallPoas,
      spendByChannel: spendChannelResult.rows,
      campaigns:      campaignResult.rows,
      dailySpend:     dailySpendResult.rows,
      orderCampaigns: orderCampaignResult.rows,
      // customer journey
      journeyByChannel: vsJourneyResult.rows,
      journeyHistogram:  [],
      totalTracked:      0,
      // ga4
      ga4ByChannel:      ga4SessionsResult.rows,
      ga4Daily:          ga4DailyResult.rows,
      ga4DailyByChannel: ga4DailyChannelResult.rows,
      ga4Journeys:       ga4JourneysResult.rows,
      returnBuckets:     returnBucketResult.rows,
      loyalty,
      // journey reconstruction
      metaWindows,
      repeatPurchases: repeatPurchaseResult.rows,
      pmTouchSummary,
      pmTouchRows:     pmTouchResult.rows,
      vsJourneyByChannel: vsJourneyResult.rows,
      directSubchannels:  directSubResult.rows,
      recentOrders:       recentOrdersResult.rows,
    });
  } catch (err) {
    console.error('[/api/stats] Error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
