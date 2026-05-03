'use strict';

const chalk = require('chalk');
const { initDb } = require('../db/schema');
const { logSync } = require('../db/queries');
const { summarizeAttribution } = require('./attribution');

// Imports all sync per api
const { syncBol } = require('./sync/bol');
const { syncClarity } = require('./sync/clarity');
const { syncKlaviyo } = require('./sync/klaviyo');
const { syncGa4 } = require('./sync/ga4');
const { syncShopify } = require('./sync/shopify');

async function runSync() {
  const syncedAt = new Date().toISOString();
  const db = initDb();

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('  Mvolo Dashboard — Sync started'));
  console.log(chalk.cyan(`  ${new Date().toLocaleString()}`));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  let ordersFetched = 0;
  let ordersNew = 0;
  const attributedOrders = [];

  try {
    //Shopify Sync
    const shopifyInfo = await syncShopify(db);
    ordersFetched += shopifyInfo.length;
    ordersNew += shopifyInfo.ordersNew;
    attributedOrders.push(...shopifyInfo.attributedOrders);

    // Bol Sync
    const bolInfo = await syncBol(db);
    ordersFetched += bolInfo.length;
    ordersNew += bolInfo.ordersNew;
    attributedOrders.push(...bolInfo.attributedOrders);

    //Ga4 Sync
    await syncGa4(db);
    //Clarity Sync
    await syncClarity(db);

    //Klaviyo Sync
    await syncKlaviyo(db, syncedAt);

    // Summarise by channel
    const summary = summarizeAttribution(attributedOrders);

    // Log to sync_log
    logSync(db, { syncedAt, ordersFetched, ordersNew, status: 'success' });

    // ── Print summary ──────────────────────────────────────────────
    console.log(chalk.green.bold('  ✔ Sync complete\n'));
    console.log(chalk.white(`  ${'Total orders fetched'.padEnd(30)} ${chalk.bold(ordersFetched)}`));
    console.log(chalk.white(`  ${'New orders saved'.padEnd(30)} ${chalk.bold(ordersNew)}`));
    console.log(
      chalk.white(
        `  ${'Already in DB (skipped)'.padEnd(30)} ${chalk.bold(ordersFetched - ordersNew)}\n`,
      ),
    );

    if (Object.keys(summary).length > 0) {
      console.log(chalk.white.bold('  Channel breakdown:'));
      const total = attributedOrders.length || 1;

      const channelColors = {
        meta_ads: chalk.magenta,
        google_search: chalk.blue,
        google_shopping: chalk.cyan,
        awin_affiliate: chalk.yellow,
        ascendia_affiliate: chalk.yellowBright,
        email: chalk.green,
        organic_search: chalk.greenBright,
        organic_social: chalk.magentaBright,
        bol_marketplace: chalk.blueBright,
        direct: chalk.white,
        ai_referral: chalk.cyanBright,
        other: chalk.gray,
      };

      for (const [channel, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
        const pct = ((count / total) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round((count / total) * 20));
        const color = channelColors[channel] || chalk.white;
        console.log(
          `  ${color(channel.padEnd(22))}  ${String(count).padStart(4)} orders  ${chalk.gray(pct.padStart(5) + '%')}  ${color(bar)}`,
        );
      }
    }

    console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  } catch (err) {
    logSync(db, { syncedAt, ordersFetched, ordersNew, status: 'error', error: err.message });
    console.error(chalk.red(`\n  ✖ Sync failed: ${err.message}\n`));
    throw err;
  }
}

module.exports = { runSync };
