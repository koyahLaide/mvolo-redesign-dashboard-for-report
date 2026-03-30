'use strict';

/**
 * Backfill script — re-attributes all existing orders and corrects is_new_customer,
 * then enriches utm fields via ProfitMetrics pm_* note_attributes from Shopify.
 */

require('dotenv').config();

const chalk = require('chalk');
const { initDb } = require('../db/schema');
const { attributeOrder } = require('../etl/attribution');
const { enrichFromProfitMetrics } = require('../connectors/profitmetrics');

async function run() {
  const db = initDb();

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('  Mvolo Dashboard — Backfill'));
  console.log(chalk.cyan(`  ${new Date().toLocaleString()}`));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  // ── 1. Load all orders ─────────────────────────────────────────────────────
  const orders = db.prepare(`
    SELECT id, order_number, created_at, landing_site, referring_site,
           customer_id, customer_email, is_new_customer
    FROM orders
    ORDER BY created_at ASC
  `).all();

  console.log(chalk.white(`  Orders in database: ${chalk.bold(orders.length)}\n`));

  if (orders.length === 0) {
    console.log(chalk.yellow('  Nothing to backfill.\n'));
    return;
  }

  // ── 2. Compute is_new_customer per customer_id ─────────────────────────────
  const seenCustomers = new Set();
  const newCustomerMap = new Map();

  for (const order of orders) {
    if (!order.customer_id) {
      newCustomerMap.set(order.id, 1);
    } else if (seenCustomers.has(order.customer_id)) {
      newCustomerMap.set(order.id, 0);
    } else {
      seenCustomers.add(order.customer_id);
      newCustomerMap.set(order.id, 1);
    }
  }

  // ── 3. Re-attribute and update in a single transaction ─────────────────────
  const updateStmt = db.prepare(`
    UPDATE orders
    SET channel         = @channel,
        medium          = @medium,
        first_touch     = @first_touch,
        last_touch      = @last_touch,
        touch_path      = @touch_path,
        is_new_customer = @is_new_customer
    WHERE id = @id
  `);

  let updatedAttribution = 0;
  let changedNewCustomer = 0;

  const beforeNew       = orders.filter((o) => o.is_new_customer === 1).length;
  const beforeReturning = orders.filter((o) => o.is_new_customer === 0).length;

  db.exec('BEGIN');
  try {
    for (const order of orders) {
      const attr = attributeOrder({
        landing_site:   order.landing_site,
        referring_site: order.referring_site,
      });
      const isNewCustomer = newCustomerMap.get(order.id) ?? 1;
      updateStmt.run({
        id:              order.id,
        channel:         attr.channel,
        medium:          attr.medium,
        first_touch:     attr.first_touch,
        last_touch:      attr.last_touch,
        touch_path:      attr.touch_path,
        is_new_customer: isNewCustomer,
      });
      updatedAttribution++;
      if (order.is_new_customer !== isNewCustomer) changedNewCustomer++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(chalk.red(`\n  ✖ Backfill failed: ${err.message}\n`));
    process.exit(1);
  }

  // ── 4. ProfitMetrics pm_* enrichment via Shopify API ──────────────────────
  console.log(chalk.white('  ProfitMetrics utm enrichment via Shopify…'));
  try {
    // dateFrom set to well before store launch to capture all orders
    const pmResult = await enrichFromProfitMetrics(db, { dateFrom: '2020-01-01' });
    console.log(chalk.green(
      `  ✔ ProfitMetrics: ${pmResult.processed} orders verwerkt, ${pmResult.enriched} verrijkt met campaign/adset/ad IDs\n`
    ));
  } catch (err) {
    console.warn(chalk.yellow(`  ⚠ ProfitMetrics enrichment overgeslagen: ${err.message}\n`));
  }

  // ── 5. Summary ─────────────────────────────────────────────────────────────
  const afterNew       = [...newCustomerMap.values()].filter((v) => v === 1).length;
  const afterReturning = [...newCustomerMap.values()].filter((v) => v === 0).length;
  const noCustomerId   = orders.filter((o) => !o.customer_id).length;

  console.log(chalk.green.bold('  ✔ Backfill complete\n'));

  console.log(chalk.white.bold('  Attribution'));
  console.log(chalk.white(`  ${'Orders re-attributed'.padEnd(30)} ${chalk.bold(updatedAttribution)}`));

  console.log('');
  console.log(chalk.white.bold('  Klant herkenning'));
  console.log(chalk.white(`  ${'Nieuwe klanten (is_new=1)'.padEnd(30)} ${chalk.bold(afterNew)}  ${chalk.gray(`(was: ${beforeNew})`)}`));
  console.log(chalk.white(`  ${'Terugkerende klanten (=0)'.padEnd(30)} ${chalk.bold(afterReturning)}  ${chalk.gray(`(was: ${beforeReturning})`)}`));
  console.log(chalk.white(`  ${'Onbekend (geen customer_id)'.padEnd(30)} ${chalk.bold(noCustomerId)}`));
  console.log(chalk.white(`  ${'is_new_customer gewijzigd'.padEnd(30)} ${chalk.bold(changedNewCustomer)}`));

  const touchBreakdown = db.prepare(`
    SELECT first_touch, COUNT(*) as cnt FROM orders GROUP BY first_touch ORDER BY cnt DESC
  `).all();

  if (touchBreakdown.length > 0) {
    console.log('');
    console.log(chalk.white.bold('  First touch verdeling (na backfill)'));
    for (const row of touchBreakdown) {
      const pct = ((row.cnt / orders.length) * 100).toFixed(1);
      const bar = '█'.repeat(Math.round((row.cnt / orders.length) * 20));
      console.log(
        `  ${chalk.cyan((row.first_touch || 'unknown').padEnd(22))}  ${String(row.cnt).padStart(4)}  ${chalk.gray(pct.padStart(5) + '%')}  ${chalk.cyan(bar)}`
      );
    }
  }

  // utm_campaign coverage
  const withCampaign = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE utm_campaign IS NOT NULL AND utm_campaign != ''`).get();
  console.log('');
  console.log(chalk.white.bold('  Campaign ID dekking'));
  console.log(chalk.white(`  ${'Orders met utm_campaign'.padEnd(30)} ${chalk.bold(withCampaign.c)} / ${orders.length}`));

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

run().catch((err) => {
  console.error(chalk.red(`\n  Fatal: ${err.message}\n`));
  process.exit(1);
});
