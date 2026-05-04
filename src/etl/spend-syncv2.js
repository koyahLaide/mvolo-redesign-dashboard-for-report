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

const { syncGoogle } = require('./spend-sync/google-ads');
const { syncMeta } = require('./spend-sync/meta-ads');
const { syncProfitMetrics } = require('./spend-sync/profitmetrics');
const { rebuildDailyMetrics } = require('./spend-sync/daily-metrics');

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
  const to = dateTo ?? daysAgo(0);
  let allSpendRows = [];

  console.log(chalk.cyan(`  [spend-sync] Syncing ${from} → ${to}`));

  // ── 1. Fetch ad spend from Meta ──────────────────────────────────────────────
  try {
    let metaRows = await syncMeta({ from: from, to: to });
    allSpendRows.push(...metaRows);
    console.log(chalk.green(`  [spend-sync] Meta: ${metaRows.length} rows`));
  } catch (err) {
    console.warn(chalk.yellow(`  [spend-sync] Meta skipped: ${err.message}`));
  }

  // ── 2. Fetch ad spend from Google Ads ────────────────────────────────────────
  try {
    let googleRows = await syncGoogle({ from: from, to: to });
    allSpendRows.push(...googleRows);
    console.log(chalk.green(`  [spend-sync] Google Ads: ${googleRows.length} rows`));
  } catch (err) {
    console.warn(chalk.yellow(`  [spend-sync] Google Ads skipped: ${err.message}`));
  }

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

  // ── 4. Enrich orders with ProfitMetrics pm_* attribution via Shopify ────────
  try {
    const pmResult = await syncProfitMetrics({ db: db, from: from, to: to });
    console.log(
      chalk.green(
        `  [spend-sync] ProfitMetrics attribution: processed ${pmResult.processed} orders, enriched ${pmResult.enriched}`,
      ),
    );
  } catch (err) {
    console.warn(chalk.yellow(`  [spend-sync] ProfitMetrics enrichment skipped: ${err.message}`));
  }

  // ── 5. Rebuild daily_metrics for the date range ──────────────────────────────
  // Aggregate spend per date+channel from ad_spend
  try {
    const dailyMetrics = await rebuildDailyMetrics({ db: db, from: from, to: to });
    console.log(chalk.green(`  [spend-sync] Upserted ${dailyMetrics.upserted} metrics`));
  } catch (err) {
    console.warn(chalk.yellow(`  [spend-sync] Daily Metrics upsert skipped: ${err.message}`));
  }
  console.log(chalk.bold.green(`  [spend-sync] Done ✓`));
}
module.exports = { runSpendSync };

// ── CLI entry point ───────────────────────────────────────────────────────────
if (require.main === module) {
  require('dotenv').config();
  const { initDb } = require('../db/schema');
  const db = initDb();

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('  Mvolo Dashboard — Spend Sync'));
  console.log(chalk.cyan(`  ${new Date().toLocaleString()}`));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  runSpendSync(db)
    .then(() => {
      db.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error(chalk.red('\n[spend-sync] Fatal error:'), err.message);
      db.close();
      process.exit(1);
    });
}
