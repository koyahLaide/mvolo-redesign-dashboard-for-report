'use strict';
require('dotenv').config();
const axios = require('axios');
const chalk = require('chalk');
const { initDb } = require('../db/schema');

const delay = ms => new Promise(r => setTimeout(r, ms));

// Alle competitors met Shopify JSON endpoint
const COMPETITORS = [
  // NL markt
  { name: 'Liroma', url: 'https://liroma.nl/products.json', pages: 3 },
  { name: 'Vitalwave', url: 'https://www.vitalwave.nl/products.json', pages: 3 },
  { name: 'Nuvibody', url: 'https://nuvibody.com/products.json', pages: 3 },
  { name: 'Loptimize', url: 'https://www.loptimize.nl/products.json', pages: 2 },
  { name: 'Be-Lume', url: 'https://be-lume.com/products.json', pages: 2 },
  // EU/International
  { name: 'Panacea', url: 'https://panacearedlight.com/products.json', pages: 3 },
  { name: 'Platinum', url: 'https://platinumtherapylights.eu/products.json', pages: 3 },
  { name: 'Rojo', url: 'https://rojolighttherapy.eu/products.json', pages: 2 },
  { name: 'Hooga', url: 'https://hoogahealth.com/products.json', pages: 3 },
  { name: 'MitoRed', url: 'https://mitoredlight.com/products.json', pages: 3 },
  { name: 'Amarapure', url: 'https://amarapure.com/products.json', pages: 2 },
  { name: 'Dayon', url: 'https://www.dayon.com/products.json', pages: 2 },
  { name: 'Solawave', url: 'https://www.solawave.co/products.json', pages: 2 },
  { name: 'Blockbluelight', url: 'https://www.blockbluelight.com/products.json', pages: 2 },
];

// Product matching op naam + min prijs
const PRODUCT_MATCHING = [
  {
    category: 'led_face_mask',
    keywords: ['led', 'face mask', 'facial mask', 'gezichtsmasker', 'glow', 'face shield', 'led masker', 'lichttherapie masker', 'light mask', 'face panel'],
    exclude: ['bril', 'losse lamp', 'standaard', 'accessoire', 'glasses', 'goggles'],
    min_price: 50,
  },
  {
    category: 'infrared_double_head',
    keywords: ['dubbele kop', 'double head', 'twin head', '507', 'dual head', 'double lamp'],
    exclude: ['losse lamp', 'accessoire', 'rugband', 'bril', 'enkele', 'single'],
    min_price: 80,
  },
  {
    category: 'infrared_single_head',
    keywords: ['enkele kop', 'single head', '506', 'infraroodlamp', 'infrarood lamp', 'infrared lamp', 'il 50', 'il 60', 'heat lamp', 'warmtelamp'],
    exclude: ['losse lamp', 'accessoire', 'rugband', 'bril', 'dubbele', 'double', 'panel', 'paneel'],
    min_price: 40,
  },
  {
    category: 'rlt_panel',
    keywords: ['rood licht', 'red light', 'rl60', 'rl120', 'rl240', 'rl300', 'rl600', 'primeforce', 'panel', 'paneel', 'lite 300', 'core 300', 'vt200', 'vt300', 'vt600', 'vt1200', 'vt2000', 'biomax', 'pro300', 'pro600', 'therapy light panel', 'red panel', 'rlt panel', 'photobiomodulation panel'],
    exclude: ['rugband', 'masker', 'bril', 'losse', 'accessoire', 'face mask', 'sauna'],
    min_price: 100,
  },
  {
    category: 'infrared_rugband',
    keywords: ['rugband', 'rug band', 'back band', 'back belt', 'shield', 'heatpulse', 'back wrap', 'lumbar'],
    exclude: ['losse', 'accessoire'],
    min_price: 60,
  },
  {
    category: 'sauna_blanket',
    keywords: ['sauna', 'deken', 'blanket', 'infrared blanket', 'sauna wrap', 'body wrap'],
    exclude: [],
    min_price: 80,
  },
  {
    category: 'daylight_lamp',
    keywords: ['daglicht', 'daylight lamp', 'lichttherapie lamp', 'tl 30', 'tl 35', 'tl 45', 'tl 70', 'tl 90', 'tl 95', 'sad lamp', 'light therapy lamp', 'wake up light', 'lucent'],
    exclude: ['rood licht', 'red light', 'infrarood', 'led masker', 'bril', 'glasses', 'panel'],
    min_price: 20,
  },
  {
    category: 'daylight_glasses',
    keywords: ['daglichtbril', 'daylight glasses', 'lichttherapiebril', 'ayo', 'luminette', 'light glasses', 'therapy glasses', 'wearable light'],
    exclude: ['losse', 'standaard', 'safety', 'goggles', 'veiligheidsbril'],
    min_price: 50,
  },
  {
    category: 'ems_device',
    keywords: ['ems', 'gua sha', 'massager', 'face sculptor', 'microcurrent', 'face lift', 'toning device', 'solawave'],
    exclude: ['panel', 'lamp'],
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
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PriceBot/1.0)', Accept: 'application/json' },
        timeout: 12000,
      });
      const items = res.data?.products ?? [];
      if (!items.length) break;
      let found = 0;
      for (const p of items) {
        const variant = p.variants?.[0];
        if (!variant?.price) continue;
        const price = parseFloat(variant.price);
        const category = matchProduct(p.title, price);
        if (price > 0 && category) {
          products.push({
            competitor: competitor.name,
            product_name: p.title.substring(0, 120),
            price,
            compare_price: parseFloat(variant.compare_at_price || '0') || null,
            category,
            url: new URL(competitor.url).origin + '/products/' + p.handle,
          });
          found++;
        }
      }
      if (items.length < 250) break;
      await delay(400);
    } catch (err) {
      const status = err.response?.status;
      if (status !== 404 && status !== 403) {
        console.warn(chalk.yellow('  ✗ ' + competitor.name + ' p' + page + ': ' + err.message));
      }
      break;
    }
  }
  return products;
}

async function run() {
  console.log(chalk.cyan('\n  [competitor-prices] Syncing ' + COMPETITORS.length + ' competitors...\n'));
  const db = initDb();

  /*
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
  db.exec('CREATE INDEX IF NOT EXISTS idx_comp_date ON competitor_prices(date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_comp_cat ON competitor_prices(category)');
  */
  const today = new Date().toISOString().slice(0, 10);
  const upsert = db.prepare(`
    INSERT INTO competitor_prices (competitor, product_name, price, compare_price, category, url, date)
    VALUES (@competitor, @product_name, @price, @compare_price, @category, @url, @date)
    ON CONFLICT(competitor, product_name, date) DO UPDATE SET
      price = excluded.price, synced_at = datetime('now')
  `);
  const insertAll = db.transaction(rows => rows.forEach(r => upsert.run(r)));

  let allProducts = [];
  const results = {};

  for (const competitor of COMPETITORS) {
    const products = await fetchProducts(competitor);
    const rows = products.map(p => ({ ...p, date: today }));
    if (rows.length) insertAll(rows);
    allProducts = allProducts.concat(rows);
    results[competitor.name] = rows.length;
    const status = rows.length > 0 ? chalk.green('✓ ' + rows.length + ' producten') : chalk.gray('- geen matches');
    console.log('  ' + competitor.name.padEnd(14) + status);
    await delay(800);
  }


  // ── Detecteer prijswijzigingen t.o.v. gisteren ──────────────────────────
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const yesterdayPrices = db.prepare(`
    SELECT competitor, product_name, price FROM competitor_prices WHERE date = ?
  `).all(yesterday);

  const yesterdayMap = {};
  yesterdayPrices.forEach(p => {
    yesterdayMap[p.competitor + '::' + p.product_name] = p.price;
  });

  let changesDetected = 0;
  for (const row of allProducts) {
    const key = row.competitor + '::' + row.product_name;
    const prevPrice = yesterdayMap[key];
    if (!prevPrice) continue;
    const changePct = ((row.price - prevPrice) / prevPrice) * 100;
    if (Math.abs(changePct) >= 2) {
      db.prepare(`
        UPDATE competitor_prices SET
          prev_price = ?, price_change_pct = ?, price_changed = 1
        WHERE competitor = ? AND product_name = ? AND date = ?
      `).run(prevPrice, Math.round(changePct * 10) / 10, row.competitor, row.product_name, today);
      changesDetected++;
      console.log(chalk.yellow('  PRIJS WIJZIGING: ' + row.competitor + ' - ' + row.product_name.substring(0, 30) + ' €' + prevPrice + ' → €' + row.price + ' (' + (changePct > 0 ? '+' : '') + Math.round(changePct) + '%)'));
    }
  }
  if (changesDetected > 0) {
    console.log(chalk.yellow('\n  ' + changesDetected + ' prijswijzigingen gedetecteerd'));
  }

  // Vergelijk met Mvolo verkoopprijzen
  const mvoloPrices = db.prepare(`
    SELECT oi.title, oi.sku, AVG(oi.price) as avg_price, COUNT(*) as sales
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.price > 0 AND oi.sku != ''
      AND o.created_at >= date('now', '-60 days')
    GROUP BY oi.sku
    ORDER BY sales DESC
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
    const mvoloAvg = Math.round(mvoloProds.reduce((s, p) => s + p.avg_price, 0) / mvoloProds.length);
    const compPrices = allProducts.filter(p => p.category === category);
    if (!compPrices.length) continue;

    const byComp = {};
    compPrices.forEach(p => {
      if (!byComp[p.competitor] || p.price < byComp[p.competitor].price) {
        byComp[p.competitor] = p;
      }
    });

    console.log(chalk.white('\n  ' + category.replace(/_/g, ' ').toUpperCase() + ' (Mvolo €' + mvoloAvg + ')'));

    for (const [comp, data] of Object.entries(byComp)) {
      const diff = Math.round(((data.price - mvoloAvg) / mvoloAvg) * 100);
      const label = ('  ' + comp).padEnd(18) + '€' + data.price;
      const badge = ' (' + (diff > 0 ? '+' : '') + diff + '%)';
      if (diff < -15) console.log(chalk.red(label + badge + '  ← GOEDKOPER'));
      else if (diff < 0) console.log(chalk.yellow(label + badge));
      else console.log(chalk.green(label + badge));
    }
  }

  console.log(chalk.green('\n  ✔ Klaar: ' + allProducts.length + ' producten van ' + Object.keys(results).filter(k => results[k] > 0).length + ' competitors\n'));
}

run().catch(err => {
  console.error(chalk.red('\n  Fatal: ' + err.message));
  process.exit(1);
});

module.exports = { run };
