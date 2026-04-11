'use strict';

/**
 * backfill-order-items.js
 *
 * Vult de order_items tabel met SKU + quantity per order
 * vanuit Shopify (via API) en Bol (via DB line_items).
 *
 * Gebruik: node src/scripts/backfill-order-items.js
 */

require('dotenv').config();
const axios     = require('axios');
const chalk     = require('chalk');

const { initDb } = require('../db/schema');

// Migrations
try { db.prepare("ALTER TABLE order_items ADD COLUMN marketplace TEXT DEFAULT 'shopify'").run(); } catch(e) {}
try { db.prepare("ALTER TABLE order_items ADD COLUMN channel TEXT DEFAULT ''").run(); } catch(e) {}


const STORE   = process.env.SHOPIFY_STORE;
const TOKEN   = process.env.SHOPIFY_TOKEN;
const API_VER = '2024-01';

const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchShopifyOrdersWithItems() {
  const orders = [];
  let url = `https://${STORE}/admin/api/${API_VER}/orders.json`;
  let pageInfo = null;
  let isFirst = true;

  const baseParams = {
    status: 'any',
    limit: 250,
    fields: 'id,order_number,created_at,line_items',
  };

  while (true) {
    if (!isFirst) await delay(500);
    isFirst = false;

    const params = pageInfo ? { page_info: pageInfo, limit: 250 } : baseParams;

    const res = await axios.get(url, {
      params,
      headers: { 'X-Shopify-Access-Token': TOKEN },
    });

    for (const order of res.data.orders) {
      for (const item of order.line_items || []) {
        orders.push({
          order_id:   String(order.id),
          order_date: order.created_at.slice(0, 10),
          marketplace: 'shopify',
          sku:        String(item.sku || item.product_id || ''),
          title:      item.title?.substring(0, 120) || '',
          quantity:   item.quantity || 1,
          price:      parseFloat(item.price) || 0,
        });
      }
    }

    const link = res.headers['link'] || '';
    const next = link.match(/<[^>]+page_info=([^>&"]+)[^>]*>;\s*rel="next"/);
    if (next) { pageInfo = next[1]; } else { break; }
  }

  return orders;
}

async function fetchBolItemsFromDb(db) {
  // Bol orders hebben line_items opgeslagen via fetchBolOrders connector
  // We halen ze direct via de Bol connector opnieuw op
  const { fetchBolOrders } = require('../connectors/bol');
  const bolOrders = await fetchBolOrders();

  const items = [];
  for (const order of bolOrders) {
    for (const item of order.line_items || []) {
      items.push({
        order_id:    order.id,
        order_date:  order.created_at.slice(0, 10),
        marketplace: 'bol',
        sku:         String(item.product_id || ''),
        title:       item.title?.substring(0, 120) || '',
        quantity:    item.quantity || 1,
        price:       parseFloat(item.price) || 0,
      });
    }
  }
  return items;
}

async function run() {
  console.log(chalk.cyan('\n  [order-items] Backfill starten...\n'));
  const db = initDb();

// Zorg dat marketplace en channel kolommen bestaan
try { db.exec("ALTER TABLE order_items ADD COLUMN marketplace TEXT DEFAULT 'shopify'"); } catch {}
try { db.exec("ALTER TABLE order_items ADD COLUMN channel TEXT DEFAULT ''"); } catch {}


  // Zorg dat tabel en index bestaan
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    TEXT NOT NULL,
      order_date  TEXT NOT NULL,
      marketplace TEXT NOT NULL,
      sku         TEXT,
      title       TEXT,
      quantity    INTEGER DEFAULT 1,
      price       REAL,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_order_items_sku  ON order_items(sku)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_order_items_date ON order_items(order_date)');

  // Shopify
  console.log(chalk.gray('  Shopify orders ophalen...'));
  const shopifyItems = await fetchShopifyOrdersWithItems();
  console.log(chalk.gray(`  → ${shopifyItems.length} Shopify line items`));

  // Bol
  console.log(chalk.gray('  Bol orders ophalen...'));
  const bolItems = await fetchBolItemsFromDb(db);
  console.log(chalk.gray(`  → ${bolItems.length} Bol line items`));

  const allItems = [...shopifyItems, ...bolItems];

  // Wis bestaande data en herlaad
  db.exec('DELETE FROM order_items');

  const insert = db.prepare(`
    INSERT INTO order_items (order_id, order_date, marketplace, sku, title, quantity, price)
    VALUES (@order_id, @order_date, @marketplace, @sku, @title, @quantity, @price)
  `);

  const insertMany = db.transaction(items => {
    for (const item of items) insert.run(item);
  });

  insertMany(allItems);

  console.log(chalk.green(`\n  ✔ ${allItems.length} order items opgeslagen in DB\n`));

  // Toon top 10 SKUs
  const top = db.prepare(`
    SELECT sku, title, SUM(quantity) as total_sold,
           ROUND(SUM(quantity) / 90.0, 2) as daily_90d
    FROM order_items
    WHERE sku != '' AND order_date >= date('now', '-90 days')
    GROUP BY sku
    ORDER BY total_sold DESC
    LIMIT 10
  `).all();

  console.log(chalk.cyan('  Top 10 SKUs (laatste 90 dagen):'));
  console.table(top.map(r => ({
    sku: r.sku,
    naam: r.title.substring(0, 30),
    verkocht: r.total_sold,
    per_dag: r.daily_90d,
  })));
}

run().catch(err => {
  console.error(chalk.red(`  Fatal: ${err.message}`));
  process.exit(1);
});
