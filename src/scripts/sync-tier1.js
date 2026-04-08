'use strict';
require('dotenv').config();
const { initDb } = require('../db/schema');
const chalk = require('chalk');
const db = initDb();

console.log(chalk.cyan('\n  [tier1] Syncing bundle pairs + seizoensgewichten...\n'));

// ── 1. Bundle pairs tabel ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS bundle_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku_a TEXT NOT NULL,
    sku_b TEXT NOT NULL,
    samen_gekocht INTEGER DEFAULT 0,
    cross_sell_freq INTEGER DEFAULT 0,
    gem_dagen_cross INTEGER,
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(sku_a, sku_b)
  )
`);

// Bundle pairs (samen in zelfde order)
const bundlePairs = db.prepare(`
  SELECT a.sku as sku_a, b.sku as sku_b, COUNT(*) as freq
  FROM order_items a
  JOIN order_items b ON b.order_id = a.order_id AND b.sku > a.sku
    AND a.sku != '' AND b.sku != ''
  GROUP BY a.sku, b.sku
  HAVING freq >= 1
  ORDER BY freq DESC
`).all();

// Cross-sell (opeenvolgende orders)
const crossSell = db.prepare(`
  SELECT oi1.sku as sku_a, oi2.sku as sku_b,
    COUNT(*) as freq,
    ROUND(AVG(julianday(o2.created_at) - julianday(o1.created_at)), 0) as gem_dagen
  FROM orders o1
  JOIN order_items oi1 ON oi1.order_id = o1.id
  JOIN orders o2 ON o2.customer_id = o1.customer_id
    AND o2.created_at > o1.created_at
    AND o1.customer_id IS NOT NULL
  JOIN order_items oi2 ON oi2.order_id = o2.id
  WHERE oi1.sku != '' AND oi2.sku != '' AND oi1.sku != oi2.sku
  GROUP BY oi1.sku, oi2.sku
  HAVING freq >= 1
`).all();

// Bouw cross-sell lookup
const crossMap = {};
crossSell.forEach(r => {
  const key = [r.sku_a, r.sku_b].sort().join('__');
  crossMap[key] = { freq: r.freq, gem_dagen: r.gem_dagen };
});

const upsert = db.prepare(`
  INSERT INTO bundle_pairs (sku_a, sku_b, samen_gekocht, cross_sell_freq, gem_dagen_cross)
  VALUES (@sku_a, @sku_b, @samen_gekocht, @cross_sell_freq, @gem_dagen_cross)
  ON CONFLICT(sku_a, sku_b) DO UPDATE SET
    samen_gekocht = excluded.samen_gekocht,
    cross_sell_freq = excluded.cross_sell_freq,
    gem_dagen_cross = excluded.gem_dagen_cross,
    updated_at = datetime('now')
`);

const insertAll = db.transaction(pairs => {
  pairs.forEach(p => upsert.run(p));
});

const allPairs = bundlePairs.map(p => {
  const key = [p.sku_a, p.sku_b].sort().join('__');
  const cs = crossMap[key] ?? { freq: 0, gem_dagen: null };
  return { sku_a: p.sku_a, sku_b: p.sku_b, samen_gekocht: p.freq, cross_sell_freq: cs.freq, gem_dagen_cross: cs.gem_dagen };
});

insertAll(allPairs);
console.log(chalk.green(`  ✓ ${allPairs.length} bundle pairs opgeslagen`));

// ── 2. Seizoensgewichten tabel ─────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS season_weights (
    month INTEGER NOT NULL,
    avg_orders REAL DEFAULT 0,
    avg_revenue REAL DEFAULT 0,
    weight REAL DEFAULT 1.0,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (month)
  )
`);

// Bereken gemiddelde per maand over alle jaren (alleen maanden met data)
const monthlyAvg = db.prepare(`
  SELECT month,
    ROUND(AVG(monthly_orders), 2) as avg_orders,
    ROUND(AVG(monthly_revenue), 2) as avg_revenue
  FROM (
    SELECT strftime('%Y-%m', created_at) as ym,
      CAST(strftime('%m', created_at) AS INTEGER) as month,
      COUNT(*) as monthly_orders,
      SUM(total_price) as monthly_revenue
    FROM orders
    GROUP BY ym
  )
  GROUP BY month
  ORDER BY month
`).all();

// Bereken overall gemiddelde voor normalisatie
const overallAvg = monthlyAvg.reduce((s, r) => s + r.avg_revenue, 0) / monthlyAvg.length;

const upsertSeason = db.prepare(`
  INSERT INTO season_weights (month, avg_orders, avg_revenue, weight)
  VALUES (@month, @avg_orders, @avg_revenue, @weight)
  ON CONFLICT(month) DO UPDATE SET
    avg_orders = excluded.avg_orders,
    avg_revenue = excluded.avg_revenue,
    weight = excluded.weight,
    updated_at = datetime('now')
`);

const insertSeasons = db.transaction(rows => {
  rows.forEach(r => upsertSeason.run({
    month: r.month,
    avg_orders: r.avg_orders,
    avg_revenue: r.avg_revenue,
    weight: overallAvg > 0 ? Math.round((r.avg_revenue / overallAvg) * 100) / 100 : 1.0,
  }));
});

insertSeasons(monthlyAvg);
console.log(chalk.green(`  ✓ ${monthlyAvg.length} seizoensgewichten opgeslagen`));

// Toon gewichten
const weights = db.prepare('SELECT month, avg_revenue, weight FROM season_weights ORDER BY month').all();
const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
console.log(chalk.cyan('\n  Seizoensgewichten:'));
weights.forEach(w => {
  const bar = '█'.repeat(Math.round(w.weight * 5));
  const flag = w.weight > 1.5 ? ' 🔥 PIEK' : w.weight < 0.5 ? ' ❄ DAL' : '';
  console.log(`  ${months[w.month].padEnd(4)} ${w.weight.toFixed(2)}x  ${bar}${flag}`);
});

console.log(chalk.green('\n  ✔ Tier 1 sync klaar\n'));
