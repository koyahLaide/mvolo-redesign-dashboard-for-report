'use strict';

require('dotenv').config();

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../data/mvolo.db');
const db = new DatabaseSync(DB_PATH, { readonly: true });

const orders = db
  .prepare(`SELECT id, order_number, landing_site, referring_site FROM orders WHERE channel = 'other' ORDER BY id`)
  .all();

console.log(`\n${'═'.repeat(72)}`);
console.log(`  "other" orders: ${orders.length} total`);
console.log(`${'═'.repeat(72)}\n`);

// ── Print each order ──────────────────────────────────────────────────────────
orders.forEach((o) => {
  console.log(`  #${o.order_number}`);
  console.log(`    landing_site  : ${o.landing_site ?? '(null)'}`);
  console.log(`    referring_site: ${o.referring_site ?? '(null)'}`);

  if (o.landing_site) {
    try {
      const url = new URL(
        o.landing_site.startsWith('http') ? o.landing_site : `https://x.com${o.landing_site}`
      );
      const utms = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
        .map((k) => ({ k, v: url.searchParams.get(k) }))
        .filter(({ v }) => v);
      if (utms.length) {
        console.log(`    utm params    : ${utms.map(({ k, v }) => `${k}=${v}`).join(' | ')}`);
      }
    } catch {
      // unparseable URL
    }
  }
  console.log();
});

// ── Group by utm_source ───────────────────────────────────────────────────────
const utmSourceCounts = {};
const noUtmWithReferrer = [];
const noUtmNoReferrer = [];

for (const o of orders) {
  let utmSource = null;
  if (o.landing_site) {
    try {
      const url = new URL(
        o.landing_site.startsWith('http') ? o.landing_site : `https://x.com${o.landing_site}`
      );
      utmSource = url.searchParams.get('utm_source');
    } catch { /* skip */ }
  }

  if (utmSource) {
    utmSourceCounts[utmSource] = (utmSourceCounts[utmSource] || 0) + 1;
  } else if (o.referring_site) {
    noUtmWithReferrer.push(o.referring_site);
  } else {
    noUtmNoReferrer.push(o.order_number);
  }
}

// ── Top 10 landing_site patterns ──────────────────────────────────────────────
const landingPatterns = {};
for (const o of orders) {
  if (!o.landing_site) {
    landingPatterns['(no landing_site)'] = (landingPatterns['(no landing_site)'] || 0) + 1;
    continue;
  }
  try {
    const url = new URL(
      o.landing_site.startsWith('http') ? o.landing_site : `https://x.com${o.landing_site}`
    );
    const src = url.searchParams.get('utm_source') || '(no utm_source)';
    const med = url.searchParams.get('utm_medium') || '(no utm_medium)';
    const key = `utm_source=${src}  utm_medium=${med}`;
    landingPatterns[key] = (landingPatterns[key] || 0) + 1;
  } catch {
    landingPatterns['(unparseable URL)'] = (landingPatterns['(unparseable URL)'] || 0) + 1;
  }
}

const top10 = Object.entries(landingPatterns)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

console.log(`${'─'.repeat(72)}`);
console.log('  Top 10 landing_site patronen (utm_source + utm_medium combos)\n');
top10.forEach(([pattern, count], i) => {
  console.log(`  ${String(i + 1).padStart(2)}. ${String(count).padStart(3)}x  ${pattern}`);
});

// ── Referrer breakdown voor orders zonder UTM ─────────────────────────────────
if (noUtmWithReferrer.length > 0) {
  const referrerPatterns = {};
  for (const ref of noUtmWithReferrer) {
    try {
      const host = new URL(ref).hostname.replace(/^www\./, '');
      referrerPatterns[host] = (referrerPatterns[host] || 0) + 1;
    } catch {
      referrerPatterns[ref] = (referrerPatterns[ref] || 0) + 1;
    }
  }
  const sortedRefs = Object.entries(referrerPatterns).sort((a, b) => b[1] - a[1]);

  console.log(`\n${'─'.repeat(72)}`);
  console.log(`  Orders zonder UTM maar MET referring_site (${noUtmWithReferrer.length} stuks)\n`);
  sortedRefs.forEach(([host, count]) => {
    console.log(`    ${String(count).padStart(3)}x  ${host}`);
  });
}

console.log(`\n${'─'.repeat(72)}`);
console.log('  Samenvatting\n');
console.log(`    Met UTM (onbekende source)  : ${Object.values(utmSourceCounts).reduce((a, b) => a + b, 0)} orders`);
if (Object.keys(utmSourceCounts).length) {
  Object.entries(utmSourceCounts).sort((a, b) => b[1] - a[1]).forEach(([src, n]) => {
    console.log(`      utm_source=${src}: ${n}x`);
  });
}
console.log(`    Geen UTM, wel referrer      : ${noUtmWithReferrer.length} orders`);
console.log(`    Geen UTM, geen referrer     : ${noUtmNoReferrer.length} orders`);
console.log(`\n  → Voeg deze utm_source waarden toe aan src/etl/attribution.js\n`);

db.close();
