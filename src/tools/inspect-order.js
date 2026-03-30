'use strict';

require('dotenv').config();

const axios = require('axios');

const STORE       = process.env.SHOPIFY_STORE;
const TOKEN       = process.env.SHOPIFY_TOKEN;
const API_VERSION = '2024-01';
const BASE_URL    = `https://${STORE}/admin/api/${API_VERSION}`;

const ORDER_NUMBER = process.argv[2] ?? '1557';

const headers = {
  'X-Shopify-Access-Token': TOKEN,
  'Content-Type': 'application/json',
};

async function main() {
  if (!STORE || !TOKEN) {
    console.error('SHOPIFY_STORE and SHOPIFY_TOKEN must be set in .env');
    process.exit(1);
  }

  console.log(`\nFetching order #${ORDER_NUMBER} from ${STORE}...\n`);

  // 1. Find the order by order_number
  const searchRes = await axios.get(`${BASE_URL}/orders.json`, {
    headers,
    params: { name: `#${ORDER_NUMBER}`, status: 'any', limit: 1 },
  });

  const orders = searchRes.data.orders ?? [];
  if (orders.length === 0) {
    console.error(`Order #${ORDER_NUMBER} not found.`);
    process.exit(1);
  }

  const order = orders[0];
  const orderId = order.id;

  // 2. Fetch full order with all fields
  const fullRes = await axios.get(`${BASE_URL}/orders/${orderId}.json`, { headers });
  const full = fullRes.data.order;

  // 3. Fetch metafields
  let metafields = [];
  try {
    const mfRes = await axios.get(`${BASE_URL}/orders/${orderId}/metafields.json`, { headers });
    metafields = mfRes.data.metafields ?? [];
  } catch (err) {
    console.warn(`  (metafields fetch failed: ${err.message})`);
  }

  // ── Print results ────────────────────────────────────────────────────────────

  console.log('═'.repeat(60));
  console.log(`ORDER #${full.order_number}  (id: ${full.id})`);
  console.log(`Created:  ${full.created_at}`);
  console.log(`Total:    €${full.total_price}`);
  console.log(`Status:   ${full.financial_status}`);
  console.log(`Source:   ${full.source_name}`);
  console.log(`Landing:  ${full.landing_site}`);
  console.log(`Referrer: ${full.referring_site}`);
  console.log('═'.repeat(60));

  console.log('\n── note_attributes ─────────────────────────────────────────');
  if (full.note_attributes?.length > 0) {
    full.note_attributes.forEach((a) => console.log(`  ${a.name}: ${a.value}`));
  } else {
    console.log('  (none)');
  }

  console.log('\n── tags ────────────────────────────────────────────────────');
  console.log(' ', full.tags || '(none)');

  console.log('\n── note ────────────────────────────────────────────────────');
  console.log(' ', full.note || '(none)');

  console.log('\n── metafields ──────────────────────────────────────────────');
  if (metafields.length > 0) {
    metafields.forEach((m) =>
      console.log(`  [${m.namespace}] ${m.key} (${m.type}): ${m.value}`)
    );
  } else {
    console.log('  (none)');
  }

  console.log('\n── line_items ──────────────────────────────────────────────');
  (full.line_items ?? []).forEach((li) => {
    console.log(`  ${li.title} × ${li.quantity} @ €${li.price}`);
  });

  console.log('\n── customer ────────────────────────────────────────────────');
  const c = full.customer;
  if (c) {
    console.log(`  id:     ${c.id}`);
    console.log(`  email:  ${c.email}`);
    console.log(`  orders: ${c.orders_count}`);
  } else {
    console.log('  (no customer)');
  }

  console.log('\n── raw (full order JSON) ───────────────────────────────────');
  console.log(JSON.stringify(full, null, 2));
}

main().catch((err) => {
  console.error('\nError:', err.response?.data ?? err.message);
  process.exit(1);
});
