'use strict';

/**
 * sync-bol-advertising.js
 *
 * Haalt Bol.com Advertising spend data op via de Advertising API v11
 * en slaat het op in de ad_spend tabel.
 *
 * Vereiste env vars:
 *   BOL_ADVERTISING_CLIENT_ID     — aparte credentials voor Advertising API
 *   BOL_ADVERTISING_CLIENT_SECRET
 *
 * Gebruik: node src/scripts/sync-bol-advertising.js
 */

require('dotenv').config();
const axios   = require('axios');
const chalk   = require('chalk');
const { initDb } = require('../db/schema');

const CLIENT_ID     = process.env.BOL_ADVERTISING_CLIENT_ID;
const CLIENT_SECRET = process.env.BOL_ADVERTISING_CLIENT_SECRET;

const TOKEN_URL     = 'https://login.bol.com/token';
const API_BASE      = 'https://api.bol.com/advertiser';
const API_VERSION   = 'application/vnd.advertiser.v11+json';

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Auth ────────────────────────────────────────────────────────────────────
async function getToken() {
  const res = await axios.post(
    `${TOKEN_URL}?grant_type=client_credentials`,
    null,
    {
      auth: { username: CLIENT_ID, password: CLIENT_SECRET },
      headers: { 'Accept': 'application/json' },
    }
  );
  return res.data.access_token;
}

function apiHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept:        API_VERSION,
    'Content-Type': API_VERSION,
  };
}

// ── Haal campaigns op ────────────────────────────────────────────────────────
async function getCampaigns(token) {
  const campaigns = [];
  let page = 1;

  while (true) {
    const res = await axios.post(
      `${API_BASE}/sponsored-products/campaigns`,
      { page, pageSize: 100 },
      { headers: apiHeaders(token) }
    );
    const data = res.data?.campaigns ?? [];
    campaigns.push(...data);
    if (data.length < 100) break;
    page++;
    await delay(300);
  }
  return campaigns;
}

// ── Haal performance metrics op per campaign ─────────────────────────────────
async function getCampaignMetrics(token, campaignIds, dateFrom, dateTo) {
  if (!campaignIds.length) return [];

  const res = await axios.post(
    `${API_BASE}/sponsored-products/reports/campaigns`,
    {
      campaignIds,
      dateFrom,
      dateTo,
      metrics: ['spend', 'impressions', 'clicks', 'orders', 'revenue'],
      groupBy:  ['campaign', 'date'],
    },
    { headers: apiHeaders(token) }
  );
  return res.data?.reports ?? [];
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error(chalk.red('  BOL_ADVERTISING_CLIENT_ID / BOL_ADVERTISING_CLIENT_SECRET niet ingesteld'));
    process.exit(1);
  }

  console.log(chalk.cyan('\n  [bol-advertising] Syncing Bol Advertising spend...\n'));

  const db = initDb();

  // Zorg dat ad_spend tabel bestaat
  db.exec(`
    CREATE TABLE IF NOT EXISTS ad_spend (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      date          TEXT NOT NULL,
      channel       TEXT NOT NULL,
      campaign_name TEXT,
      adset_name    TEXT,
      ad_name       TEXT,
      spend         REAL DEFAULT 0,
      impressions   INTEGER DEFAULT 0,
      clicks        INTEGER DEFAULT 0,
      purchases     INTEGER DEFAULT 0,
      revenue       REAL DEFAULT 0,
      currency      TEXT DEFAULT 'EUR',
      UNIQUE(date, channel, campaign_name, adset_name, ad_name)
    )
  `);

  // Datum range: laatste 30 dagen
  const now      = new Date();
  const dateTo   = now.toISOString().slice(0, 10);
  const dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Token ophalen
  console.log(chalk.gray('  Token ophalen...'));
  const token = await getToken();
  console.log(chalk.green('  ✓ Token OK'));

  // Campaigns ophalen
  console.log(chalk.gray('  Campaigns ophalen...'));
  const campaigns = await getCampaigns(token);
  console.log(chalk.green(`  ✓ ${campaigns.length} campaigns gevonden`));

  if (!campaigns.length) {
    console.log(chalk.yellow('  Geen campaigns gevonden'));
    return;
  }

  // Performance per campaign ophalen
  console.log(chalk.gray('  Performance metrics ophalen...'));
  const campaignIds = campaigns.map(c => c.campaignId);

  // Batch van max 50 campaigns per request
  const batchSize = 50;
  const allReports = [];
  for (let i = 0; i < campaignIds.length; i += batchSize) {
    const batch = campaignIds.slice(i, i + batchSize);
    try {
      const reports = await getCampaignMetrics(token, batch, dateFrom, dateTo);
      allReports.push(...reports);
    } catch (err) {
      console.warn(chalk.yellow(`  ✗ Batch ${i}-${i+batchSize}: ${err.response?.data?.detail ?? err.message}`));
    }
    await delay(500);
  }

  console.log(chalk.green(`  ✓ ${allReports.length} rapport rijen opgehaald`));

  // Sla op in DB
  const campaignMap = Object.fromEntries(campaigns.map(c => [c.campaignId, c.name]));

  const upsert = db.prepare(`
    INSERT INTO ad_spend (date, channel, campaign_name, spend, impressions, clicks, purchases, revenue, currency)
    VALUES (@date, @channel, @campaign_name, @spend, @impressions, @clicks, @purchases, @revenue, @currency)
    ON CONFLICT(date, channel, campaign_name, adset_name, ad_name) DO UPDATE SET
      spend       = excluded.spend,
      impressions = excluded.impressions,
      clicks      = excluded.clicks,
      purchases   = excluded.purchases,
      revenue     = excluded.revenue
  `);

  const insertAll = db.transaction(rows => {
    rows.forEach(r => upsert.run(r));
  });

  const rows = allReports.map(r => ({
    date:          r.date ?? r.reportDate ?? dateFrom,
    channel:       'bol_ads',
    campaign_name: campaignMap[r.campaignId] ?? String(r.campaignId),
    spend:         r.spend ?? 0,
    impressions:   r.impressions ?? 0,
    clicks:        r.clicks ?? 0,
    purchases:     r.orders ?? 0,
    revenue:       r.revenue ?? 0,
    currency:      'EUR',
  }));

  insertAll(rows);

  // Toon samenvatting
  const totals = db.prepare(`
    SELECT
      ROUND(SUM(spend), 2) as total_spend,
      SUM(impressions)     as impressions,
      SUM(clicks)          as clicks,
      SUM(purchases)       as orders
    FROM ad_spend
    WHERE channel = 'bol_ads'
    AND date >= date('now', '-30 days')
  `).get();

  console.log(chalk.cyan('\n  Bol Advertising 30d samenvatting:'));
  console.log(`  Spend:       €${totals.total_spend}`);
  console.log(`  Impressions: ${totals.impressions?.toLocaleString()}`);
  console.log(`  Clicks:      ${totals.clicks?.toLocaleString()}`);
  console.log(`  Orders:      ${totals.orders}`);
  if (totals.total_spend > 0 && totals.orders > 0) {
    const cpa = Math.round(totals.total_spend / totals.orders);
    console.log(`  CPA:         €${cpa}`);
  }

  console.log(chalk.green(`\n  ✔ ${rows.length} rijen opgeslagen\n`));
}

run().catch(err => {
  console.error(chalk.red(`\n  Fatal: ${err.response?.data?.detail ?? err.message}`));
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});

module.exports = { run };
