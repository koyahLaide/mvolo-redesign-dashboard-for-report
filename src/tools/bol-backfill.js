'use strict';

/**
 * bol-backfill.js
 *
 * Fetches all Bol.com orders from the last 90 days and inserts them
 * into the local SQLite database (INSERT OR IGNORE — safe to re-run).
 *
 * Usage:  node src/tools/bol-backfill.js
 */

require('dotenv').config();

const chalk = require('chalk');
const axios  = require('axios');
const { initDb }     = require('../db/schema');
const { insertOrder } = require('../db/queries');

// ── Bol auth (inline to avoid import side-effects) ────────────────────────────
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
    params: { 'fulfilment-method': 'ALL', status: 'ALL', page },
  });
  return res.data.orders ?? [];
}

async function fetchDetail(orderId) {
  const headers = await bolHeaders();
  const res = await axios.get(`${BASE_URL}/orders/${orderId}`, { headers });
  return res.data;
}

function mapBolOrder(detail) {
  const items       = detail.orderItems ?? [];
  const totalAmount = items.reduce(
    (sum, item) => sum + (parseFloat(item.unitPrice?.amount ?? item.unitPrice ?? 0) * (item.quantity ?? 1)),
    0
  );
  return {
    id:               `bol_${detail.orderId}`,
    order_number:     String(detail.orderId),
    created_at:       detail.orderDate ?? new Date().toISOString(),
    total_price:      Math.round(totalAmount * 100) / 100,
    financial_status: 'paid',
    landing_site:     null,
    referring_site:   null,
    source_name:      'bol',
    note_attributes:  [],
    line_items:       items.map((item) => ({
      product_id: item.product?.ean ?? null,
      title:      item.product?.title ?? 'Onbekend product',
      price:      parseFloat(item.unitPrice?.amount ?? item.unitPrice ?? 0),
      quantity:   item.quantity ?? 1,
    })),
    customer_email: null,
    customer_id:    null,
    marketplace:    'bol',
  };
}

// ── Attribution fixed for all Bol orders ──────────────────────────────────────
const BOL_ATTRIBUTION = {
  channel:    'bol_marketplace',
  medium:     'marketplace',
  utm_source: 'bol',
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

  // cutoff = 90 days ago
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  console.log(chalk.white(`  Fetching orders since ${cutoffStr} …\n`));

  let page       = 1;
  let totalFound = 0;
  let totalNew   = 0;
  let totalSkipOld = 0;
  let stop       = false;

  while (!stop) {
    let summaries;
    try {
      summaries = await fetchPage(page);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) break;
      console.error(chalk.red(`  Bol API error page ${page}: ${err.response?.data?.detail ?? err.message}`));
      break;
    }

    if (!Array.isArray(summaries) || summaries.length === 0) break;

    for (const summary of summaries) {
      // Quick date check on summary before fetching full detail
      const orderDate = summary.orderDate ?? summary.orderPlacedDateTime ?? '';
      if (orderDate && orderDate.slice(0, 10) < cutoffStr) {
        stop = true;
        totalSkipOld++;
        continue;
      }

      try {
        const detail = await fetchDetail(summary.orderId);
        const order  = mapBolOrder(detail);
        totalFound++;

        // Double-check date from full detail
        if (order.created_at.slice(0, 10) < cutoffStr) {
          totalSkipOld++;
          stop = true;
          continue;
        }

        const inserted = insertOrder(db, order, BOL_ATTRIBUTION, 1);
        if (inserted) {
          totalNew++;
          process.stdout.write(chalk.green('.'));
        } else {
          process.stdout.write(chalk.gray('.'));
        }
      } catch (err) {
        console.warn(chalk.yellow(`\n  Skipping order ${summary.orderId}: ${err.message}`));
      }

      await delay(200);
    }

    if (!stop && summaries.length < 50) break; // last page
    process.stdout.write(chalk.cyan(` [p${page}]\n`));
    page++;
    await delay(600);
  }

  process.stdout.write('\n');

  const alreadyInDb = totalFound - totalNew;
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold(`  Resultaat:`));
  console.log(`  Gevonden (afgelopen 90d) : ${chalk.bold(totalFound)}`);
  console.log(`  Nieuw opgeslagen          : ${chalk.green.bold(totalNew)}`);
  console.log(`  Al in database            : ${chalk.gray(alreadyInDb)}`);
  console.log(`  Overgeslagen (ouder 90d)  : ${chalk.gray(totalSkipOld)}`);
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  db.close();
}

run().catch((err) => {
  console.error(chalk.red('\n[bol-backfill] Fatal error:'), err.message);
  process.exit(1);
});
