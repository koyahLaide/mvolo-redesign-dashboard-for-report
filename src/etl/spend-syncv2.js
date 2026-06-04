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
 * @param {import('pg').Pool} pool
 * @param {Object} [options]
 * @param {string} [options.dateFrom]  YYYY-MM-DD
 * @param {string} [options.dateTo]    YYYY-MM-DD
 */
async function runSpendSync(pool, { dateFrom, dateTo } = {}) {
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
  // Delete existing rows for the date range first to avoid duplicates, wrapped in a Postgres transaction.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`DELETE FROM ad_spend WHERE date >= $1 AND date <= $2`, [from, to]);
    
    if (allSpendRows.length > 0) {
      const CHUNK_SIZE = 1000;
      for (let chunkStart = 0; chunkStart < allSpendRows.length; chunkStart += CHUNK_SIZE) {
        const chunk = allSpendRows.slice(chunkStart, chunkStart + CHUNK_SIZE);
        const values = [];
        const placeholders = [];
        let i = 1;
        
        for (const row of chunk) {
          placeholders.push(
            `($${i}, $${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7}, $${i + 8}, $${i + 9})`
          );
          values.push(
            row.date,
            row.channel,
            row.campaign_name,
            row.adset_name,
            row.ad_name,
            row.spend,
            row.impressions,
            row.clicks,
            row.purchases,
            row.currency
          );
          i += 10;
        }
        
        const insertSql = `
          INSERT INTO ad_spend
            (date, channel, campaign_name, adset_name, ad_name, spend, impressions, clicks, purchases, currency)
          VALUES ${placeholders.join(',')}
        `;
        await client.query(insertSql, values);
      }
    }
    
    await client.query('COMMIT');
    console.log(chalk.green(`  [spend-sync] Inserted ${allSpendRows.length} ad_spend rows`));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // ── 4. Enrich orders with ProfitMetrics pm_* attribution via Shopify ────────
  try {
    const pmResult = await syncProfitMetrics({ db: pool, from: from, to: to });
    console.log(
      chalk.green(
        `  [spend-sync] ProfitMetrics attribution: processed ${pmResult.processed} orders, enriched ${pmResult.enriched}`,
      ),
    );
  } catch (err) {
    console.warn(chalk.yellow(`  [spend-sync] ProfitMetrics enrichment skipped: ${err.message}`));
  }

  // ── 5. Rebuild daily_metrics for the date range ──────────────────────────────
  try {
    const dailyMetrics = await rebuildDailyMetrics({ db: pool, from: from, to: to });
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
  const { pool } = require('../db/db');

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('  Mvolo Dashboard — Spend Sync (Supabase)'));
  console.log(chalk.cyan(`  ${new Date().toLocaleString()}`));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  runSpendSync(pool)
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(chalk.red('\n[spend-sync] Fatal error:'), err.message);
      await pool.end();
      process.exit(1);
    });
}
