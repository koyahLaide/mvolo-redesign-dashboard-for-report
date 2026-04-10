'use strict';
require('dotenv').config();
const axios  = require('axios');
const chalk  = require('chalk');
const { initDb } = require('../db/schema');

const delay = ms => new Promise(r => setTimeout(r, ms));

const COMPETITORS = [
  { name: 'Liroma',   url: 'https://liroma.nl/products.json',           pages: 3 },
  { name: 'AYO',      url: 'https://goayo.nl/products.json',             pages: 2 },
  { name: 'Nuvibody', url: 'https://nuvibody.com/products.json',         pages: 3 },
  { name: 'Panacea',  url: 'https://panacearedlight.com/products.json',  pages: 3 },
];

// Product matching op naam + min prijs om accessoires uit te sluiten
const PRODUCT_MATCHING = [
  {
    category:  'led_face_mask',
    keywords:  ['led', 'face', 'mask', 'gezichtsmasker', 'glow', 'lichttherapie masker'],
    exclude:   ['bril', 'losse', 'standaard', 'accessoire'],
    min_price: 80,
  },
  {
    category:  'infrared_double_head',
    keywords:  ['dubbele kop', 'double head', 'twin head', '507', 'dubbel'],
    exclude:   ['losse lamp', 'accessoire', 'rugband', 'bril', 'enkele'],
    min_price: 100,
  },
  {
    category:  'infrared_single_head',
    keywords:  ['enkele kop', 'single head', '506', 'infraroodlamp', 'infrarood lamp', 'il 50', 'il 60'],
    exclude:   ['losse lamp', 'accessoire', 'rugband', 'bril', 'dubbele', 'double'],
    min_price: 50,
  },
  {
    category:  'rlt_panel',
    keywords:  ['rood licht', 'red light', 'rl60', 'rl120', 'rl240', 'rl300', 'rl600', 'primeforce', 'panel', 'paneel', 'lite 300', 'core 300', 'panacea'],
    exclude:   ['rugband', 'masker', 'bril', 'losse', 'accessoire'],
    min_price: 150,
  },
  {
    category:  'infrared_rugband',
    keywords:  ['rugband', 'rug band', 'back band', 'belt', 'shield', 'heatpulse', 'rugband'],
    exclude:   ['losse', 'accessoire'],
    min_price: 80,
  },
  {
    category:  'sauna_blanket',
    keywords:  ['sauna', 'deken', 'blanket', 'wrap'],
    exclude:   [],
    min_price: 100,
  },
  {
    category:  'daylight_lamp',
    keywords:  ['daglicht', 'daylight', 'lichttherapie lamp', 'tl 30', 'tl 35', 'tl 45', 'tl 70', 'tl 90', 'tl 95', 'tl 100', 'lucent'],
    exclude:   ['rood licht', 'red light', 'infrarood', 'led masker', 'bril', 'glasses'],
    min_price: 20,
  },
  {
    category:  'daylight_glasses',
    keywords:  ['daglichtbril', 'daylight glasses', 'lichttherapiebril', 'ayo', 'luminette'],
    exclude:   ['losse', 'standaard'],
    min_price: 50,
  },
  {
    category:  'ems_device',
    keywords:  ['ems', 'gua sha', 'massager', 'face sculptor', 'gezicht massage', 'microcurrent'],
    exclude:   [],
    min_price: 20,
  },
];

function matchProduct(title, price) {
  const t = (title || '').toLowerCase();
  for (const m of PRODUCT_MATCHING) {
    if (price < m.min_price) continue;
    const hasKeyword = m.keywords.some(k => t.includes(k));
    const hasExclude = m.exclude.some(k => t.includes(k));
    if (hasKeyword && !hasExclude) return m.category;
  }
  return null;
}

async function fetchProducts(competitor) {
  const products = [];
  for (let page = 1; page <= competitor.pages; page++) {
    try {
      const res = await axios.get(competitor.url + '?limit=250&page=' + page, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        timeout: 12000,
      });
      const items = res.data?.products ?? [];
      if (!items.length) break;
      for (const p of items) {
        const variant = p.variants?.[0];
        if (!variant?.price) continue;
        const price = parseFloat(variant.price);
        const category = matchProduct(p.title, price);
        if (price > 0 && category) {
          products.push({
            competitor:    competitor.name,
            product_name:  p.title,
            price,
            compare_price: parseFloat(variant.compare_at_price || '0') || null,
            category,
            url: new URL(competitor.url).origin + '/products/' + p.handle,
          });
        }
      }
      await delay(500);
    } catch (err) {
      console.warn(chalk.yellow('  ✗ ' + competitor.name + ' p' + page + ': ' + err.message));
      break;
    }
  }
  return products;
}

async function run() {
  console.log(chalk.cyan('\n  [competitor-prices] Syncing...\n'));
  const db = initDb();

  db.exec(`CREATE TABLE IF NOT EXISTS competitor_prices (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    competitor    TEXT NOT NULL,
    product_name  TEXT NOT NULL,
    price         REAL NOT NULL,
    compare_price REAL,
    category      TEXT,
    url           TEXT,
    date          TEXT NOT NULL,
    synced_at     TEXT DEFAULT (datetime('now')),
    UNIQUE(competitor, product_name, date)
  )`);

  const today = new Date().toISOString().slice(0, 10);
  const upsert = db.prepare(`
    INSERT INTO competitor_prices (competitor, product_name, price, compare_price, category, url, date)
    VALUES (@competitor, @product_name, @price, @compare_price, @category, @url, @date)
    ON CONFLICT(competitor, product_name, date) DO UPDATE SET
      price = excluded.price, synced_at = datetime('now')
  `);
  const insertAll = db.transaction(rows => rows.forEach(r => upsert.run(r)));

  let allProducts = [];

  for (const competitor of COMPETITORS) {
    console.log(chalk.gray('  Fetching ' + competitor.name + '...'));
    const products = await fetchProducts(competitor);
    const rows = products.map(p => ({ ...p, date: today }));
    if (rows.length) insertAll(rows);
    allProducts = allProducts.concat(rows);
    console.log(chalk.green('  ✓ ' + competitor.name + ': ' + rows.length + ' vergelijkbare producten'));
    await delay(1000);
  }

  // Vergelijk met Mvolo verkoopprijzen
  const mvoloPrices = db.prepare(`
    SELECT oi.title, AVG(oi.price) as avg_price, COUNT(*) as sales
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.price > 0 AND oi.sku != ''
      AND o.created_at >= date('now', '-60 days')
    GROUP BY oi.title
  `).all();

  const mvoloByCat = {};
  mvoloPrices.forEach(p => {
    const cat = matchProduct(p.title, p.avg_price);
    if (!cat) return;
    if (!mvoloByCat[cat]) mvoloByCat[cat] = [];
    mvoloByCat[cat].push(p);
  });

  console.log(chalk.cyan('\n  ── CONCURRENT ANALYSE ─────────────────────────────'));

  for (const [category, mvoloProds] of Object.entries(mvoloByCat)) {
    const mvoloAvg = mvoloProds.reduce((s, p) => s + p.avg_price, 0) / mvoloProds.length;
    const compPrices = allProducts.filter(p => p.category === category);
    if (!compPrices.length) continue;

    const byComp = {};
    compPrices.forEach(p => {
      if (!byComp[p.competitor] || p.price < byComp[p.competitor].price) {
        byComp[p.competitor] = p;
      }
    });

    console.log(chalk.white('\n  ' + category.toUpperCase()));
    console.log(chalk.gray('  Mvolo: €' + Math.round(mvoloAvg)));

    for (const [comp, data] of Object.entries(byComp)) {
      const diff = Math.round(((data.price - mvoloAvg) / mvoloAvg) * 100);
      const label = comp + ': €' + data.price + ' (' + (diff > 0 ? '+' : '') + diff + '%)';
      if (diff < -10) console.log(chalk.red('  ' + label + ' ← GOEDKOPER'));
      else if (diff < 0) console.log(chalk.yellow('  ' + label));
      else console.log(chalk.green('  ' + label + ' (Mvolo goedkoper)'));
    }
  }

  console.log(chalk.green('\n  ✔ Klaar: ' + allProducts.length + ' producten gemonitord\n'));
}

run().catch(err => {
  console.error(chalk.red('\n  Fatal: ' + err.message));
  process.exit(1);
});

module.exports = { run };
