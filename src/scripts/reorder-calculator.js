'use strict';

require('dotenv').config();
const axios   = require('axios');
const chalk   = require('chalk');
const path    = require('path');
const { initDb } = require('../db/schema');

const STORE = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_TOKEN;

async function fetchShopifyInventory() {
  const res = await axios.get(
    `https://${STORE}/admin/api/2024-01/products.json?limit=250&fields=id,title,variants`,
    { headers: { 'X-Shopify-Access-Token': TOKEN } }
  );
  const inventory = {};
  for (const product of res.data.products) {
    for (const variant of product.variants) {
      if (variant.sku) {
        inventory[String(variant.sku)] = {
          title: product.title,
          stock: variant.inventory_quantity,
          price: parseFloat(variant.price),
        };
      }
    }
  }
  return inventory;
}

function calcReorderAdvice(product, stock, daily30, daily90, config) {
  const { production_days, sea_days, air_days } = config.lead_times;
  const safety = config.safety_stock_days;
  const velocity = daily30 > 0 ? daily30 : daily90;

  if (velocity === 0) {
    return {
      velocity_30d: daily30, velocity_90d: daily90,
      days_left: stock > 0 ? 999 : 0,
      reorder_point_sea: null, reorder_qty_sea: null,
      reorder_point_air: null, reorder_qty_air: null,
      urgency: stock <= 0 ? 'KRITIEK' : 'GEEN DATA',
      method: null,
    };
  }

  const days_left = velocity > 0 ? Math.round(stock / velocity) : 999;
  const sea_lead = production_days + sea_days + safety;
  const air_lead = production_days + air_days + safety;
  const reorder_point_sea = Math.ceil(velocity * sea_lead);
  const reorder_point_air = Math.ceil(velocity * air_lead);
  const reorder_qty_sea = Math.max(0, Math.ceil(velocity * 90) - stock);
  const reorder_qty_air = Math.max(0, Math.ceil(velocity * 60) - stock);

  let urgency, method;
  if (stock <= 0) {
    urgency = 'KRITIEK';
    method = product.air_allowed ? 'AIR' : 'SEA';
  } else if (days_left < air_lead && product.air_allowed) {
    urgency = 'AIR URGENT';
    method = 'AIR';
  } else if (days_left < sea_lead) {
    urgency = product.air_allowed ? 'BESTEL AIR' : 'BESTEL SEA';
    method = product.air_allowed ? 'AIR' : 'SEA';
  } else if (days_left < sea_lead + 14) {
    urgency = 'BESTEL SEA';
    method = 'SEA';
  } else {
    urgency = 'OK';
    method = 'SEA';
  }

  return { velocity_30d: daily30, velocity_90d: daily90, days_left, reorder_point_sea, reorder_qty_sea, reorder_point_air, reorder_qty_air, urgency, method };
}

async function run() {
  console.log(chalk.cyan('\n  ═══════════════════════════════════════'));
  console.log(chalk.cyan('  📦 MVOLO REORDER CALCULATOR'));
  console.log(chalk.cyan('  ═══════════════════════════════════════\n'));

  const db = initDb();
  const config = require(path.join(process.cwd(), 'data/products-cogs.json'));

  console.log(chalk.gray('  Shopify voorraad ophalen...'));
  const inventory = await fetchShopifyInventory();

  const velocity30 = {};
  const velocity90 = {};

  for (const r of db.prepare(`SELECT sku, SUM(quantity) as sold FROM order_items WHERE order_date >= date('now', '-30 days') AND sku != '' GROUP BY sku`).all()) {
    velocity30[r.sku] = r.sold / 30;
  }
  for (const r of db.prepare(`SELECT sku, SUM(quantity) as sold FROM order_items WHERE order_date >= date('now', '-90 days') AND sku != '' GROUP BY sku`).all()) {
    velocity90[r.sku] = r.sold / 90;
  }

  const results = [];
  for (const product of config.products) {
    const inv = inventory[product.sku];
    if (!inv) continue;
    const stock = inv.stock;
    const daily30 = parseFloat((velocity30[product.sku] || 0).toFixed(3));
    const daily90 = parseFloat((velocity90[product.sku] || 0).toFixed(3));
    const advice = calcReorderAdvice(product, stock, daily30, daily90, config);
    results.push({ name: product.name, sku: product.sku, stock, price: inv.price, cogs_sea: product.cogs_sea, cogs_air: product.cogs_air, air_allowed: product.air_allowed, ...advice });
  }

  const urgencyOrder = { 'KRITIEK': 0, 'AIR URGENT': 1, 'BESTEL AIR': 2, 'BESTEL SEA': 3, 'OK': 4, 'GEEN DATA': 5 };
  results.sort((a, b) => (urgencyOrder[a.urgency] ?? 9) - (urgencyOrder[b.urgency] ?? 9));

  const groups = {
    'KRITIEK':    results.filter(r => r.urgency === 'KRITIEK'),
    'AIR URGENT': results.filter(r => r.urgency === 'AIR URGENT'),
    'BESTEL AIR': results.filter(r => r.urgency === 'BESTEL AIR'),
    'BESTEL SEA': results.filter(r => r.urgency === 'BESTEL SEA'),
    'OK':         results.filter(r => r.urgency === 'OK'),
    'GEEN DATA':  results.filter(r => r.urgency === 'GEEN DATA'),
  };

  const colors = { 'KRITIEK': chalk.red, 'AIR URGENT': chalk.redBright, 'BESTEL AIR': chalk.yellow, 'BESTEL SEA': chalk.blue, 'OK': chalk.green, 'GEEN DATA': chalk.gray };

  for (const [label, items] of Object.entries(groups)) {
    if (items.length === 0) continue;
    const color = colors[label] || chalk.gray;
    console.log(color(`\n  ── ${label} (${items.length}) ──────────────────────────`));
    for (const r of items) {
      const vel = r.velocity_30d > 0 ? r.velocity_30d : r.velocity_90d;
      const daysStr = r.days_left >= 999 ? '∞' : String(r.days_left);
      console.log(color(`  ${r.name.padEnd(28)} `) + chalk.white(`voorraad: ${String(r.stock).padStart(4)} `) + chalk.gray(`vel: ${vel.toFixed(2)}/d `) + chalk.white(`${daysStr.padStart(3)}d over`));
      if (r.urgency !== 'OK' && r.urgency !== 'GEEN DATA' && (r.reorder_qty_sea > 0 || r.reorder_qty_air > 0)) {
        const method = r.method || 'SEA';
        const cogs = method === 'AIR' ? r.cogs_air : r.cogs_sea;
        const qty = method === 'AIR' ? (r.reorder_qty_air || 0) : (r.reorder_qty_sea || 0);
        const totalCost = cogs ? (qty * cogs).toFixed(0) : '?';
        console.log(chalk.gray(`  ${''.padEnd(28)} → bestel ${qty} stuks via ${method}  COGS: €${cogs ?? '?'}  totaal: €${totalCost}`));
      }
    }
  }

  console.log(chalk.cyan('\n  ─────────────────────────────────────'));
  console.log(chalk.white(`  Totaal: ${results.length} producten`));
  console.log(chalk.red(`  Kritiek: ${groups['KRITIEK'].length}`));
  console.log(chalk.yellow(`  Bestel snel (AIR): ${(groups['AIR URGENT'].length + groups['BESTEL AIR'].length)}`));
  console.log(chalk.blue(`  Bestel (SEA): ${groups['BESTEL SEA'].length}`));
  console.log(chalk.green(`  OK: ${groups['OK'].length}`));
  console.log(chalk.cyan('  ─────────────────────────────────────\n'));

  return results;
}

run().catch(err => {
  console.error(chalk.red(`\n  Fatal: ${err.message}`));
  process.exit(1);
});

module.exports = { run };
