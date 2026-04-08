'use strict';

/**
 * sync-cogs-currency.js
 *
 * 1. Haalt actuele USD/EUR koers op via gratis API (open.er-api.com)
 * 2. Herberekent COGS EUR op basis van USD originele inkoopprijzen
 * 3. Slaat bijgewerkte products-cogs.json op op beide locaties
 * 4. Logt koershistorie in de DB
 *
 * Gebruik: node src/scripts/sync-cogs-currency.js
 */

require('dotenv').config();
const axios = require('axios');
const fs    = require('fs');
const path  = require('path');
const chalk = require('chalk');
const { initDb } = require('../db/schema');

const COGS_PATH      = path.join(process.cwd(), 'data', 'products-cogs.json');
const COGS_DASH_PATH = path.join(process.cwd(), 'dashboard', 'data', 'products-cogs.json');

async function getExchangeRate() {
  const res = await axios.get('https://open.er-api.com/v6/latest/USD');
  return res.data.rates.EUR;
}

async function run() {
  console.log(chalk.cyan('\n  [cogs-currency] Syncing COGS met actuele USD/EUR koers...\n'));

  const db = initDb();

  // Maak koershistorie tabel
  db.exec(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT NOT NULL,
      base       TEXT NOT NULL,
      target     TEXT NOT NULL,
      rate       REAL NOT NULL,
      synced_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(date, base, target)
    )
  `);

  // Haal koers op
  console.log(chalk.gray('  USD/EUR koers ophalen...'));
  const eurPerUsd = await getExchangeRate();
  const usdPerEur = Math.round((1 / eurPerUsd) * 10000) / 10000;
  const today = new Date().toISOString().slice(0, 10);

  console.log(chalk.green(`  ✓ 1 USD = ${eurPerUsd.toFixed(4)} EUR`));
  console.log(chalk.green(`  ✓ 1 EUR = ${usdPerEur.toFixed(4)} USD`));

  // Sla koers op in DB
  db.prepare(`
    INSERT INTO exchange_rates (date, base, target, rate)
    VALUES (?, 'USD', 'EUR', ?)
    ON CONFLICT(date, base, target) DO UPDATE SET rate = excluded.rate, synced_at = datetime('now')
  `).run(today, eurPerUsd);

  // Laad COGS file
  const cogsData = JSON.parse(fs.readFileSync(COGS_PATH, 'utf-8'));

  // Voeg USD COGS toe als ze er nog niet in zitten (eenmalige backfill)
  // Gebruik huidige EUR waarden terugrekenen naar USD als referentie
  let added = 0;
  cogsData.products = cogsData.products.map(p => {
    if (!p.cogs_usd_sea && p.cogs_sea) {
      p.cogs_usd_sea = Math.round((p.cogs_sea / eurPerUsd) * 100) / 100;
      added++;
    }
    if (!p.cogs_usd_air && p.cogs_air) {
      p.cogs_usd_air = Math.round((p.cogs_air / eurPerUsd) * 100) / 100;
    }
    return p;
  });
  if (added > 0) console.log(chalk.gray(`  ✓ USD COGS berekend voor ${added} producten`));

  // Herbereken EUR COGS op basis van USD originelen + actuele koers
  let updated = 0;
  const changes = [];
  cogsData.products = cogsData.products.map(p => {
    if (!p.cogs_usd_sea) return p;

    const newCogsSea = Math.round(p.cogs_usd_sea * eurPerUsd * 100) / 100;
    const newCogsAir = p.cogs_usd_air ? Math.round(p.cogs_usd_air * eurPerUsd * 100) / 100 : p.cogs_air;

    const oldSea = p.cogs_sea;
    const diff = Math.round((newCogsSea - oldSea) * 100) / 100;

    if (Math.abs(diff) >= 0.01) {
      changes.push({
        name: p.name,
        old: oldSea,
        new: newCogsSea,
        diff,
        diff_pct: Math.round((diff / oldSea) * 100),
      });
      updated++;
    }

    return { ...p, cogs_sea: newCogsSea, cogs_air: newCogsAir };
  });

  // Voeg metadata toe
  cogsData.last_currency_update = today;
  cogsData.usd_eur_rate = eurPerUsd;

  // Sla op op beide locaties
  const json = JSON.stringify(cogsData, null, 2);
  fs.writeFileSync(COGS_PATH, json);
  if (fs.existsSync(COGS_DASH_PATH)) {
    fs.writeFileSync(COGS_DASH_PATH, json);
    console.log(chalk.green('  ✓ Beide locaties bijgewerkt'));
  } else {
    console.log(chalk.green('  ✓ data/products-cogs.json bijgewerkt'));
  }

  // Toon wijzigingen
  if (changes.length > 0) {
    console.log(chalk.yellow(`\n  ${changes.length} COGS prijzen gewijzigd door koersverandering:`));
    changes.forEach(c => {
      const arrow = c.diff > 0 ? chalk.red(`+€${c.diff} (marge ↓)`) : chalk.green(`€${c.diff} (marge ↑)`);
      console.log(`  ${c.name.padEnd(28)} €${c.old} → €${c.new}  ${arrow}`);
    });
  } else {
    console.log(chalk.green('\n  ✓ COGS ongewijzigd (koers stabiel)'));
  }

  // Toon koershistorie
  const history = db.prepare(`
    SELECT date, rate FROM exchange_rates
    WHERE base = 'USD' AND target = 'EUR'
    ORDER BY date DESC LIMIT 7
  `).all();

  if (history.length > 1) {
    console.log(chalk.cyan('\n  USD/EUR koershistorie (7d):'));
    history.forEach(r => {
      const eur = r.rate.toFixed(4);
      console.log(`  ${r.date}  1 USD = ${eur} EUR`);
    });

    const oldest = history[history.length - 1];
    const change = Math.round(((eurPerUsd - oldest.rate) / oldest.rate) * 10000) / 100;
    console.log(chalk.gray(`\n  Koersverandering (${history.length}d): ${change > 0 ? '+' : ''}${change}%`));
  }

  console.log(chalk.green('\n  ✔ COGS currency sync klaar\n'));
}

run().catch(err => {
  console.error(chalk.red(`  Fatal: ${err.message}`));
  process.exit(1);
});

module.exports = { run };
