'use strict';
require('dotenv').config();
const { initDb } = require('../db/schema');
const db = initDb();
const cogs = require('../../data/products-cogs.json').products;
const cogsMap = {};
cogs.forEach(p => { cogsMap[p.sku] = p; });

const rows = db.prepare(`
  SELECT oi.sku, oi.price, SUM(oi.quantity) as qty,
    COUNT(DISTINCT o.id) as orders,
    GROUP_CONCAT(DISTINCT o.channel) as channels
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.sku != '' AND oi.price > 5
  GROUP BY oi.sku, oi.price
  ORDER BY oi.sku, qty DESC
`).all();

const bysku = {};
rows.forEach(r => {
  if (!bysku[r.sku]) bysku[r.sku] = [];
  bysku[r.sku].push(r);
});

Object.entries(bysku).forEach(([sku, prices]) => {
  if (prices.length < 2) return;
  const p = cogsMap[sku];
  if (!p) return;
  const totalQty = prices.reduce((s, r) => s + r.qty, 0);
  console.log('\n' + p.name + ' (COGS SEA: EUR' + p.cogs_sea + ')');
  prices.forEach(r => {
    const margin = p.cogs_sea ? Math.round(((r.price - p.cogs_sea) / r.price) * 100) : '?';
    const pct = Math.round((r.qty / totalQty) * 100);
    const star = r === prices[0] ? ' <- MEEST VERKOCHT' : '';
    console.log('  EUR' + r.price.toFixed(2) + ' -> ' + r.qty + ' stuks (' + pct + '%) marge ' + margin + '%' + star);
  });
});
