'use strict';
require('dotenv').config();
const axios  = require('axios');
const chalk  = require('chalk');
const { initDb } = require('../db/schema');

const CLIENT_ID     = process.env.BOL_ADVERTISING_CLIENT_ID;
const CLIENT_SECRET = process.env.BOL_ADVERTISING_CLIENT_SECRET;
const TOKEN_URL     = 'https://login.bol.com/token?grant_type=client_credentials';
const CAMPAIGN_BASE = 'https://api.bol.com/advertiser/sponsored-products';
const ACCEPT        = 'application/vnd.advertiser.v11+json';
const delay = ms => new Promise(r => setTimeout(r, ms));

async function getToken() {
  const res = await axios.post(TOKEN_URL, null, {
    auth: { username: CLIENT_ID, password: CLIENT_SECRET },
    headers: { Accept: 'application/json' },
  });
  return res.data.access_token;
}
function apiHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: ACCEPT, 'Content-Type': ACCEPT };
}
async function run() {
  if (!CLIENT_ID || !CLIENT_SECRET) { console.error('Credentials ontbreken'); process.exit(1); }
  console.log('\n  [bol-advertising] Start...');
  const db = initDb();
  db.exec(`CREATE TABLE IF NOT EXISTS ad_spend (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, channel TEXT NOT NULL, campaign_name TEXT,
    adset_name TEXT DEFAULT '', ad_name TEXT DEFAULT '',
    spend REAL DEFAULT 0, impressions INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0,
    purchases INTEGER DEFAULT 0, revenue REAL DEFAULT 0, currency TEXT DEFAULT 'EUR',
    UNIQUE(date, channel, campaign_name, adset_name, ad_name)
  )`);
  const token = await getToken();
  console.log('  Token OK');
  const now = new Date();
  const periodEnd   = new Date(now - 86400000).toISOString().slice(0,10);
  const periodStart = new Date(now - 30*86400000).toISOString().slice(0,10);
  // Stap 1: Advertiser performance (totaal)
  try {
    const res = await axios.get(`${CAMPAIGN_BASE}/performance/advertiser`, {
      headers: apiHeaders(token),
      params: { 'period-start-date': periodStart, 'period-end-date': periodEnd },
    });
    console.log('  Advertiser perf OK:', JSON.stringify(res.data).substring(0,300));
  } catch(e) { console.log('  Advertiser perf fout:', e.response?.status, e.response?.data?.detail ?? e.message); }
  await delay(400);
  // Stap 2: Campaigns via POST
  try {
    const res = await axios.post(`${CAMPAIGN_BASE}/campaigns`, { page: 1, pageSize: 50 }, { headers: apiHeaders(token) });
    console.log('  Campaigns OK:', res.data?.campaigns?.length, 'campaigns');
    console.log('  Eerste:', JSON.stringify(res.data?.campaigns?.[0]).substring(0,150));
  } catch(e) { console.log('  Campaigns fout:', e.response?.status, e.response?.data?.detail ?? e.message); }
  await delay(400);
  // Stap 3: Campaign performance GET
  try {
    const res = await axios.get(`${CAMPAIGN_BASE}/performance`, {
      headers: apiHeaders(token),
      params: { 'period-start-date': periodStart, 'period-end-date': periodEnd, 'entity-type': 'CAMPAIGN' },
    });
    console.log('  Campaign perf OK, keys:', Object.keys(res.data ?? {}).join(', '));
    console.log('  Data:', JSON.stringify(res.data).substring(0,400));
  } catch(e) { console.log('  Campaign perf fout:', e.response?.status, e.response?.data?.detail ?? e.message); }
}
run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
