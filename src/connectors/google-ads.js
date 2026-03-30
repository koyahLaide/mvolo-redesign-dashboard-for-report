'use strict';

/**
 * Google Ads API connector — REST (GAQL) with OAuth2 token refresh.
 *
 * Uses the Google Ads REST API v18 directly (no protobuf dependency).
 * Refreshes the access token on each call to avoid stale tokens.
 *
 * Required env vars:
 *   GOOGLE_ADS_DEVELOPER_TOKEN   — from Google Ads API Centre
 *   GOOGLE_ADS_CUSTOMER_ID       — 10-digit customer ID (no dashes)
 *   GOOGLE_ADS_CLIENT_ID         — OAuth2 client ID
 *   GOOGLE_ADS_CLIENT_SECRET     — OAuth2 client secret
 *   GOOGLE_ADS_REFRESH_TOKEN     — long-lived refresh token
 */

const axios = require('axios');

const API_VERSION  = 'v18';
const TOKEN_URL    = 'https://oauth2.googleapis.com/token';
const ADS_BASE     = `https://googleads.googleapis.com/${API_VERSION}`;

const DEV_TOKEN    = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CUSTOMER_ID  = (process.env.GOOGLE_ADS_CUSTOMER_ID ?? '').replace(/-/g, '');
const CLIENT_ID    = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;

/**
 * Obtains a fresh OAuth2 access token using the stored refresh token.
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  const res = await axios.post(TOKEN_URL, null, {
    params: {
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type:    'refresh_token',
    },
  });
  return res.data.access_token;
}

/**
 * Executes a GAQL query via the searchStream endpoint.
 * Returns all result rows across pages.
 *
 * @param {string} accessToken
 * @param {string} query  GAQL query string
 * @returns {Promise<Array>}
 */
async function runQuery(accessToken, query) {
  const url = `${ADS_BASE}/customers/${CUSTOMER_ID}/googleAds:searchStream`;
  const headers = {
    Authorization:              `Bearer ${accessToken}`,
    'developer-token':          DEV_TOKEN,
    'Content-Type':             'application/json',
  };

  const results = [];
  let pageToken = null;

  do {
    const body = { query, ...(pageToken ? { pageToken } : {}) };
    const res = await axios.post(url, body, { headers });

    // searchStream returns a newline-delimited JSON stream
    const lines = String(res.data).trim().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const batch = JSON.parse(line);
        for (const result of batch.results ?? []) {
          results.push(result);
        }
        pageToken = batch.nextPageToken ?? null;
      } catch { /* skip malformed lines */ }
    }
  } while (pageToken);

  return results;
}

/**
 * Fetches campaign-level ad spend and conversions for a date range.
 *
 * @param {string} dateFrom  YYYY-MM-DD
 * @param {string} dateTo    YYYY-MM-DD
 * @returns {Promise<Array>} Normalised rows for the ad_spend table
 */
async function fetchGoogleSpend({ dateFrom, dateTo }) {
  if (!DEV_TOKEN || !CUSTOMER_ID || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error('All GOOGLE_ADS_* environment variables must be set in .env');
  }

  const accessToken = await getAccessToken();

  const query = `
    SELECT
      campaign.name,
      ad_group.name,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      segments.date
    FROM ad_group
    WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
      AND campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
      AND metrics.cost_micros > 0
    ORDER BY segments.date ASC
  `;

  let raw;
  try {
    raw = await runQuery(accessToken, query);
  } catch (err) {
    const msg = err.response?.data?.error?.message ?? err.message;
    throw new Error(`Google Ads API error: ${msg}`);
  }

  // Aggregate by date + campaign (sum ad group rows into campaign rows)
  const map = new Map();

  for (const row of raw) {
    const date         = row.segments?.date;
    const campaignName = row.campaign?.name ?? null;
    const adGroupName  = row.adGroup?.name ?? null;
    const spendMicros  = Number(row.metrics?.costMicros ?? 0);
    const impressions  = Number(row.metrics?.impressions ?? 0);
    const clicks       = Number(row.metrics?.clicks ?? 0);
    const conversions  = Number(row.metrics?.conversions ?? 0);

    // Determine sub-channel from campaign name heuristics
    const nameLC = (campaignName ?? '').toLowerCase();
    let channel = 'google_search';
    if (nameLC.includes('shopping') || nameLC.includes('pmax')) channel = 'google_shopping';

    const key = `${date}__${campaignName}__${adGroupName}`;
    if (!map.has(key)) {
      map.set(key, {
        date,
        channel,
        campaign_name: campaignName,
        adset_name:    adGroupName,
        ad_name:       null,
        spend:         0,
        impressions:   0,
        clicks:        0,
        purchases:     0,
        currency:      'EUR',
      });
    }

    const entry = map.get(key);
    entry.spend       += spendMicros / 1_000_000;  // micros → euros
    entry.impressions += impressions;
    entry.clicks      += clicks;
    entry.purchases   += Math.round(conversions);
  }

  return Array.from(map.values()).map((r) => ({
    ...r,
    spend: Math.round(r.spend * 100) / 100,
  }));
}

module.exports = { fetchGoogleSpend };
