'use strict';

const chalk = require('chalk');
const { initDb } = require('../db/schema');
const { getLastSyncedAt, insertOrder, logSync, checkIsNewCustomer } = require('../db/queries');
const { fetchOrders }   = require('../connectors/shopify');
const { fetchBolOrders } = require('../connectors/bol');
const { attributeOrder, summarizeAttribution } = require('./attribution');

/**
 * Runs a full ETL cycle:
 *  1. Fetch orders from Shopify (incremental if a previous sync exists)
 *  2. Attribute each order to a marketing channel
 *  3. Persist new orders to SQLite
 *  4. Log the result and print a formatted summary
 */
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
    // Determine start date for incremental sync
    const lastSync = getLastSyncedAt(db);
    if (lastSync) {
      console.log(chalk.gray(`  Last successful sync: ${lastSync}`));
      console.log(chalk.gray(`  Fetching orders created after that timestamp...\n`));
    } else {
      console.log(chalk.yellow('  No previous sync found — fetching all orders.\n'));
    }

    // ── Shopify ────────────────────────────────────────────────────────────────
    const shopifyOrders = await fetchOrders({ createdAtMin: lastSync || undefined });
    ordersFetched += shopifyOrders.length;
    console.log(chalk.white(`  Orders fetched from Shopify: ${chalk.bold(shopifyOrders.length)}`));

    for (const order of shopifyOrders) {
      const attribution = attributeOrder(order);
      const isNewCustomer = checkIsNewCustomer(db, order.customer_email);
      const isNew = insertOrder(db, order, attribution, isNewCustomer);
      if (isNew) ordersNew++;
      attributedOrders.push({ ...order, ...attribution });
    }

    // ── Bol.com ────────────────────────────────────────────────────────────────
    let bolFetched = 0;
    let bolNew = 0;
    try {
      const bolOrders = await fetchBolOrders();
      bolFetched = bolOrders.length;
      console.log(chalk.white(`  Orders fetched from Bol.com: ${chalk.bold(bolFetched)}`));

      const bolAttribution = {
        channel:      'bol_marketplace',
        medium:       'marketplace',
        utm_source:   'bol',
        utm_campaign: null,
        utm_content:  null,
        utm_term:     null,
        first_touch:  'bol_marketplace',
        last_touch:   'bol_marketplace',
        touch_path:   JSON.stringify(['bol_marketplace']),
      };

      for (const order of bolOrders) {
        const isNew = insertOrder(db, order, bolAttribution, 1);
        if (isNew) { bolNew++; ordersNew++; }
        attributedOrders.push({ ...order, ...bolAttribution });
      }

      ordersFetched += bolFetched;
    } catch (err) {
      console.warn(chalk.yellow(`  Bol.com sync skipped: ${err.message}`));
    }

    console.log('');

    // Summarise by channel
    const summary = summarizeAttribution(attributedOrders);

    // Log to sync_log
    logSync(db, { syncedAt, ordersFetched, ordersNew, status: 'success' });

    // ── Print summary ──────────────────────────────────────────────
    console.log(chalk.green.bold('  ✔ Sync complete\n'));
    console.log(chalk.white(`  ${'Total orders fetched'.padEnd(30)} ${chalk.bold(ordersFetched)}`));
    console.log(chalk.white(`  ${'New orders saved'.padEnd(30)} ${chalk.bold(ordersNew)}`));
    console.log(chalk.white(`  ${'Already in DB (skipped)'.padEnd(30)} ${chalk.bold(ordersFetched - ordersNew)}\n`));

    if (Object.keys(summary).length > 0) {
      console.log(chalk.white.bold('  Channel breakdown:'));
      const total = attributedOrders.length || 1;

      const channelColors = {
        meta_ads:       chalk.magenta,
        google_search:  chalk.blue,
        google_shopping: chalk.cyan,
        awin_affiliate: chalk.yellow,
        email:          chalk.green,
        organic_search: chalk.greenBright,
        organic_social: chalk.magentaBright,
        direct:         chalk.white,
        other:          chalk.gray,
      };

      for (const [channel, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
        const pct = ((count / total) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(count / total * 20));
        const color = channelColors[channel] || chalk.white;
        console.log(
          `  ${color(channel.padEnd(20))}  ${String(count).padStart(4)} orders  ${chalk.gray(pct.padStart(5) + '%')}  ${color(bar)}`
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
