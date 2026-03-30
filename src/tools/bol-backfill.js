'use strict';

/**
 * bol-backfill.js
 *
 * Fetches all Bol.com orders from the last 90 days and inserts them
 * into the local SQLite database (INSERT OR IGNORE — safe to re-run).
 *
 * Fixes applied vs original connector:
 *   - Uses orderPlacedDateTime (not the non-existent orderDate)
 *   - Uses item.totalPrice when available (already quantity-adjusted)
 *   - Explicit page-size=50
 *   - Prints per-page progress
 *   - Stops when orders older than 90 days are encountered
 *
 * Usage:  node src/tools/bol-backfill.js
 */

require('dotenv').config();

const chalk = require('chalk');
const axios  = require('axios');
const { initDb }      = require('../db/schema');
const { insertOrder } = require('../db/queries');

// ── Bol auth ──────────────────────────────────────────────────────────────────
const TOKEN_URL = 'https://login.bol.com/token';
const BASE_URL  = 'https://api.bol.com/retailer';
const ACCEPT    = 'application/vnd.retailer.v10+json';

let _token    = null;
let _tokenExp = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExp - 10_000) return _token;
  const cid = process.env.BOL_CLIENT_ID;
  const sec  = process.env.BOL_CLIENT_SECRET;
  if (!cid || !sec) throw new Error('BOL_CLIENT_ID / BOL_CLIENT_SECRET not set');
  const creds = Buffer.from(`${cid}:${sec}`).toString('base64');
  const res = await axios.post(
    `${TOKEN_URL}?grant_type=client_credentials`,
    null,
    { headers: { Authorization: `Basic ${creds}`, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  _token    = res.data.access_token;
  _tokenExp = Date.now() + (res.data.expires_in ?? 300) * 1000;
  return _token;
}

async function bolHeaders() {
  const t = await getToken();
  return { Authorization: `Bearer ${t}`, Accept: ACCEPT, 'Content-Type': ACCEPT };
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page) {
  const headers = await bolHeaders();
  const res = await axios.get(`${BASE_URL}/orders`, {
    headers,
    params: { 'fulfilment-method': 'ALL', status: 'ALL', 'page-size': 50, page },
  });
  return res.data.orders ?? [];
}

async function fetchDetail(orderId) {
  const headers = await bolHeaders();
  const res = await axios.get(`${BASE_URL}/orders/${orderId}`, { headers });
  return res.data;
}

function mapBolOrder(detail) {
  const items = detail.orderItems ?? [];

  // Use totalPrice per item (already quantity-adjusted, in euros).
  // Fall back to unitPrice × quantity if totalPrice is absent.
  const totalAmount = items.reduce((sum, item) => {
    const lineTotal = item.totalPrice ?? (parseFloat(item.unitPrice ?? 0) * (item.quantity ?? 1));
    return sum + lineTotal;
  }, 0);

  const shipment = detail.shipmentDetails ?? {};

  // orderPlacedDateTime is the v10 field — orderDate does not exist
  const createdAt = detail.orderPlacedDateTime ?? detail.orderDate ?? new Date().toISOString();

  return {
    id:               `bol_${detail.orderId}`,
    order_number:     String(detail.orderId),
    created_at:       createdAt,
    total_price:      Math.round(totalAmount * 100) / 100,
    financial_status: 'paid',
    landing_site:     null,
    referring_site:   null,
    source_name:      'bol',
    note_attributes:  [],
    line_items:       items.map((item) => ({
      product_id: item.product?.ean ?? null,
      title:      item.product?.title ?? 'Onbekend product',
      price:      parseFloat(item.unitPrice ?? 0),
      quantity:   item.quantity ?? 1,
    })),
    customer_email:   null,
    customer_id:      null,
    marketplace:      'bol',
    shipping_country: shipment.countryCode ?? null,
  };
}

// ── Attribution fixed for all Bol orders ──────────────────────────────────────
const BOL_ATTRIBUTION = {
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const db = initDb();

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('  Mvolo Dashboard — Bol.com Backfill (90d)'));
  console.log(chalk.cyan(`  ${new Date().toLocaleString()}`));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  // Delete all existing Bol orders so we can re-import with correct dates
  const deleted = db.prepare("DELETE FROM orders WHERE marketplace = 'bol'").run();
  console.log(chalk.yellow(`  Verwijderd ${deleted.changes} bestaande Bol orders (datum was onjuist)\n`));

  // cutoff = 90 days ago
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  console.log(chalk.white(`  Ophalen orders vanaf ${cutoffStr} …\n`));

  let page        = 1;
  let totalFound  = 0;
  let totalNew    = 0;
  let totalOld    = 0;
  let stop        = false;

  while (!stop) {
    let summaries;
    try {
      summaries = await fetchPage(page);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) break;
      console.error(chalk.red(`  Bol API fout pagina ${page}: ${err.response?.data?.detail ?? err.message}`));
      break;
    }

    if (!Array.isArray(summaries) || summaries.length === 0) {
      console.log(chalk.gray(`  Pagina ${page}: geen orders meer — klaar`));
      break;
    }

    console.log(chalk.white(`  Pagina ${page}: ${chalk.bold(summaries.length)} orders gevonden`));

    let pageNew = 0;
    let pageSkip = 0;

    for (const summary of summaries) {
      // Use orderPlacedDateTime from summary for early cutoff check
      const orderDate = (summary.orderPlacedDateTime ?? '').slice(0, 10);
      if (orderDate && orderDate < cutoffStr) {
        totalOld++;
        stop = true;
        continue;
      }

      try {
        const detail = await fetchDetail(summary.orderId);
        const order  = mapBolOrder(detail);
        totalFound++;

        // Double-check date from full detail
        if (order.created_at.slice(0, 10) < cutoffStr) {
          totalOld++;
          stop = true;
          continue;
        }

        const inserted = insertOrder(db, order, BOL_ATTRIBUTION, 1);
        if (inserted) {
          pageNew++;
          totalNew++;
          process.stdout.write(chalk.green('✓'));
        } else {
          pageSkip++;
          process.stdout.write(chalk.gray('·'));
        }
      } catch (err) {
        console.warn(chalk.yellow(`\n  Sla over order ${summary.orderId}: ${err.message}`));
      }

      await delay(180);
    }

    process.stdout.write('\n');
    console.log(chalk.gray(`    → nieuw: ${pageNew}, al aanwezig: ${pageSkip}\n`));

    if (!stop && summaries.length < 50) {
      console.log(chalk.gray(`  Pagina ${page}: minder dan 50 orders → laatste pagina`));
      break;
    }

    page++;
    await delay(600);
  }

  const alreadyInDb = totalFound - totalNew;
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold('  Resultaat:'));
  console.log(`  Gevonden (afgelopen 90d)  : ${chalk.bold(totalFound)}`);
  console.log(`  Nieuw opgeslagen          : ${chalk.green.bold(totalNew)}`);
  console.log(`  Al in database            : ${chalk.gray(alreadyInDb)}`);
  console.log(`  Overgeslagen (ouder 90d)  : ${chalk.gray(totalOld)}`);
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  // Verify: show first 5 imported orders
  const sample = db.prepare("SELECT order_number, created_at, total_price FROM orders WHERE marketplace = 'bol' ORDER BY created_at DESC LIMIT 5").all();
  console.log(chalk.white('  Eerste 5 geïmporteerde orders:'));
  for (const r of sample) {
    console.log(`  ${r.order_number}  ${r.created_at.slice(0, 10)}  €${r.total_price}`);
  }

  db.close();
}

run().catch((err) => {
  console.error(chalk.red('\n[bol-backfill] Fatal fout:'), err.message);
  process.exit(1);
});
