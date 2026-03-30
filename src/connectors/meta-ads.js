'use strict';

/**
 * Meta Marketing API connector
 *
 * Fetches ad spend, impressions, clicks and purchase conversions
 * from the Meta Marketing API (Graph API v20.0).
 *
 * Required env vars:
 *   META_ACCESS_TOKEN   — long-lived system user access token
 *   META_AD_ACCOUNT_ID  — ad account ID (digits only, without "act_" prefix)
 */

const axios = require('axios');

const BASE = 'https://graph.facebook.com/v20.0';
const TOKEN = process.env.META_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetches ad spend and conversions for a given date range at adset level.
 *
 * @param {string} dateFrom  YYYY-MM-DD
 * @param {string} dateTo    YYYY-MM-DD (inclusive)
 * @returns {Promise<Array>} Normalised rows for the ad_spend table
 */
async function fetchMetaSpend({ dateFrom, dateTo }) {
  if (!TOKEN || !ACCOUNT_ID) {
    throw new Error('META_ACCESS_TOKEN and META_AD_ACCOUNT_ID must be set in .env');
  }

  const rows = [];
  let after = null;

  while (true) {
    const params = {
      access_token:  TOKEN,
      level:         'adset',
      fields:        [
        'campaign_name',
        'adset_name',
        'ad_name',
        'spend',
        'impressions',
        'clicks',
        'actions',
        'date_start',
      ].join(','),
      time_range:    JSON.stringify({ since: dateFrom, until: dateTo }),
      time_increment: 1,          // one row per day
      limit:         500,
      ...(after ? { after } : {}),
    };

    let response;
    try {
      response = await axios.get(`${BASE}/act_${ACCOUNT_ID}/insights`, { params });
    } catch (err) {
      const msg = err.response?.data?.error?.message ?? err.message;
      throw new Error(`Meta API error: ${msg}`);
    }

    const data = response.data.data ?? [];

    for (const row of data) {
      // Extract purchase conversions from the actions array
      const actions = row.actions ?? [];
      const purchases = actions
        .filter((a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase')
        .reduce((sum, a) => sum + Number(a.value ?? 0), 0);

      rows.push({
        date:          row.date_start,
        channel:       'meta_ads',
        campaign_name: row.campaign_name ?? null,
        adset_name:    row.adset_name ?? null,
        ad_name:       row.ad_name ?? null,
        spend:         parseFloat(row.spend ?? 0),
        impressions:   parseInt(row.impressions ?? 0, 10),
        clicks:        parseInt(row.clicks ?? 0, 10),
        purchases:     Math.round(purchases),
        currency:      'EUR',
      });
    }

    const paging = response.data.paging;
    if (paging?.next && paging?.cursors?.after) {
      after = paging.cursors.after;
      await delay(300); // respect rate limits
    } else {
      break;
    }
  }

  return rows;
}

module.exports = { fetchMetaSpend };
