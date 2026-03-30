'use strict';

/**
 * spend-sync.js
 *
 * Fetches ad spend from Meta Ads + Google Ads, profit data from ProfitMetrics,
 * and rolls up per-day/channel ROAS, POAS and CAC into daily_metrics.
 *
 * Run manually:  npm run spend-sync
 * Cron:          daily at 02:00 from src/index.js
 */

const chalk = require('chalk');
const { fetchMetaSpend }    = require('../connectors/meta-ads');
const { fetchGoogleSpend }  = require('../connectors/google-ads');
const { syncProfitData }    = require('../connectors/profitmetrics');

/**
 * Returns YYYY-MM-DD string for n days ago.
 */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Upserts rows into ad_spend and recalculates daily_metrics.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} dateFrom  YYYY-MM-DD
 * @param {string} dateTo    YYYY-MM-DD
 */
async function runSpendSync(db, { dateFrom, dateTo } = {}) {
  const from = dateFrom ?? daysAgo(30);
  const to   = dateTo   ?? daysAgo(0);

  console.log(chalk.cyan(`  [spend-sync] Syncing ${from} → ${to}`));

  // ── 1. Fetch ad spend from Meta ──────────────────────────────────────────────
  let metaRows = [];
  try {
    metaRows = await fetchMetaSpend({ dateFrom: from, dateTo: to });
    console.log(chalk.green(`  [spend-sync] Meta: ${metaRows.length} rows`));
  } catch (err) {
    console.warn(chalk.yellow(`  [spend-sync] Meta skipped: ${err.message}`));
  }

  // ── 2. Fetch ad spend from Google Ads ────────────────────────────────────────
  let googleRows = [];
  try {
    googleRows = await fetchGoogleSpend({ dateFrom: from, dateTo: to });
    console.log(chalk.green(`  [spend-sync] Google Ads: ${googleRows.length} rows`));
  } catch (err) {
    console.warn(chalk.yellow(`  [spend-sync] Google Ads skipped: ${err.message}`));
  }

  const allSpendRows = [...metaRows, ...googleRows];

  // ── 3. Upsert into ad_spend ──────────────────────────────────────────────────
  // Delete existing rows for the date range first to avoid duplicates
  db.prepare(`DELETE FROM ad_spend WHERE date >= ? AND date <= ?`).run(from, to);

  const insertSpend = db.prepare(`
    INSERT INTO ad_spend
      (date, channel, campaign_name, adset_name, ad_name, spend, impressions, clicks, purchases, currency)
    VALUES
      (@date, @channel, @campaign_name, @adset_name, @ad_name, @spend, @impressions, @clicks, @purchases, @currency)
  `);

  for (const row of allSpendRows) {
    insertSpend.run(row);
  }
  console.log(chalk.green(`  [spend-sync] Inserted ${allSpendRows.length} ad_spend rows`));

  // ── 4. Sync ProfitMetrics profit data onto orders ────────────────────────────
  try {
    const pmResult = await syncProfitData(db, { dateFrom: from, dateTo: to });
    console.log(chalk.green(`  [spend-sync] ProfitMetrics: fetched ${pmResult.fetched}, matched ${pmResult.matched} orders`));
  } catch (err) {
    console.warn(chalk.yellow(`  [spend-sync] ProfitMetrics skipped: ${err.message}`));
  }

  // ── 5. Rebuild daily_metrics for the date range ──────────────────────────────
  // Aggregate spend per date+channel from ad_spend
  const spendAgg = db.prepare(`
    SELECT date, channel, ROUND(SUM(spend), 2) as spend
    FROM ad_spend
    WHERE date >= ? AND date <= ?
    GROUP BY date, channel
  `).all(from, to);

  // Aggregate orders per date+channel from orders
  const ordersAgg = db.prepare(`
    SELECT
      DATE(created_at) as date,
      channel,
      COUNT(*)                                                      as orders,
      ROUND(SUM(total_price), 2)                                    as revenue,
      ROUND(SUM(COALESCE(profit, 0)), 2)                            as profit,
      SUM(CASE WHEN is_new_customer = 1 THEN 1 ELSE 0 END)          as new_customers
    FROM orders
    WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
    GROUP BY DATE(created_at), channel
  `).all(from, to);

  // Build a map: "date__channel" → metrics
  const metricsMap = new Map();

  for (const row of spendAgg) {
    const key = `${row.date}__${row.channel}`;
    metricsMap.set(key, {
      date:          row.date,
      channel:       row.channel,
      spend:         row.spend,
      revenue:       0,
      profit:        0,
      orders:        0,
      new_customers: 0,
    });
  }

  for (const row of ordersAgg) {
    const key = `${row.date}__${row.channel}`;
    if (!metricsMap.has(key)) {
      metricsMap.set(key, {
        date:          row.date,
        channel:       row.channel,
        spend:         0,
        revenue:       row.revenue,
        profit:        row.profit,
        orders:        row.orders,
        new_customers: row.new_customers,
      });
    } else {
      const entry = metricsMap.get(key);
      entry.revenue       = row.revenue;
      entry.profit        = row.profit;
      entry.orders        = row.orders;
      entry.new_customers = row.new_customers;
    }
  }

  const upsertMetrics = db.prepare(`
    INSERT INTO daily_metrics
      (date, channel, spend, revenue, profit, orders, new_customers, roas, poas, cac)
    VALUES
      (@date, @channel, @spend, @revenue, @profit, @orders, @new_customers, @roas, @poas, @cac)
    ON CONFLICT(date, channel) DO UPDATE SET
      spend         = excluded.spend,
      revenue       = excluded.revenue,
      profit        = excluded.profit,
      orders        = excluded.orders,
      new_customers = excluded.new_customers,
      roas          = excluded.roas,
      poas          = excluded.poas,
      cac           = excluded.cac
  `);

  let metricsUpserted = 0;
  for (const m of metricsMap.values()) {
    const roas = m.spend > 0 ? Math.round((m.revenue / m.spend) * 100) / 100 : 0;
    const poas = m.spend > 0 ? Math.round((m.profit  / m.spend) * 100) / 100 : 0;
    const cac  = m.new_customers > 0 ? Math.round((m.spend / m.new_customers) * 100) / 100 : 0;
    upsertMetrics.run({ ...m, roas, poas, cac });
    metricsUpserted++;
  }

  console.log(chalk.green(`  [spend-sync] daily_metrics upserted: ${metricsUpserted} rows`));
  console.log(chalk.bold.green(`  [spend-sync] Done ✓`));
}

module.exports = { runSpendSync };
