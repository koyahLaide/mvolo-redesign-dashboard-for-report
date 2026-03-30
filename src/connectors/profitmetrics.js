'use strict';

/**
 * ProfitMetrics connector (via Shopify)
 *
 * ProfitMetrics does NOT expose a public REST API for profit data.
 * Instead, it writes attribution data to Shopify orders as:
 *   - note_attributes with pm_* prefix (pm_cmp, pm_trm, pm_cnt, pm_src, pm_med, pm_lp)
 *   - metafield namespace "profitmetrics", key "attribution" (JSON with first_touch, last_touch, touches)
 *
 * This connector:
 *   1. Reads pm_* note_attributes from orders already fetched by the Shopify connector
 *   2. Uses them to enrich utm_campaign / utm_content / utm_term in the DB with
 *      the exact campaign/adset/ad IDs that ProfitMetrics tracked
 *   3. Optionally fetches the profitmetrics.attribution metafield per order
 *      for deeper first/last touch enrichment
 *
 * NOTE: Profit / COGS / margin data is NOT available via Shopify.
 *       It lives only in the ProfitMetrics backend (inaccessible without their REST API).
 */

const axios = require('axios');

const STORE       = process.env.SHOPIFY_STORE;
const TOKEN       = process.env.SHOPIFY_TOKEN;
const API_VERSION = '2024-01';
const BASE_URL    = `https://${STORE}/admin/api/${API_VERSION}`;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Extracts pm_* attribution fields from a note_attributes array.
 * Returns null if no pm_* fields are present.
 *
 * @param {Array<{name: string, value: string}>} noteAttributes
 * @returns {{ utm_campaign, utm_content, utm_term, utm_source, utm_medium, landing_page } | null}
 */
function extractPmFields(noteAttributes) {
  if (!Array.isArray(noteAttributes) || noteAttributes.length === 0) return null;

  const map = {};
  for (const { name, value } of noteAttributes) {
    map[name] = value;
  }

  if (!map.pm_src && !map.pm_cmp) return null;  // no ProfitMetrics data

  return {
    utm_source:   map.pm_src  ?? null,
    utm_medium:   map.pm_med  ?? null,
    utm_campaign: map.pm_cmp  ?? null,
    utm_content:  map.pm_cnt  ?? null,
    utm_term:     map.pm_trm  ?? null,
    landing_page: map.pm_lp   ?? null,
  };
}

/**
 * Fetches the profitmetrics.attribution metafield for a single Shopify order.
 * Returns the parsed JSON value, or null if not present.
 *
 * @param {string} orderId  Shopify order ID (numeric string)
 * @returns {Promise<Object|null>}
 */
async function fetchPmMetafield(orderId) {
  try {
    const res = await axios.get(`${BASE_URL}/orders/${orderId}/metafields.json`, {
      headers: { 'X-Shopify-Access-Token': TOKEN },
      params:  { namespace: 'profitmetrics', key: 'attribution' },
    });
    const mf = (res.data.metafields ?? []).find(
      (m) => m.namespace === 'profitmetrics' && m.key === 'attribution'
    );
    if (!mf) return null;
    return typeof mf.value === 'string' ? JSON.parse(mf.value) : mf.value;
  } catch {
    return null;
  }
}

/**
 * Enriches orders in the DB using ProfitMetrics attribution data from Shopify.
 *
 * Two sources are used:
 *  - pm_* note_attributes already stored in the DB (fast, no extra API calls)
 *  - profitmetrics.attribution metafield (optional, requires one API call per order)
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {Object} options
 * @param {boolean} [options.fetchMetafields=false]  Set true to fetch metafields per order (slow)
 * @param {string}  [options.dateFrom]  YYYY-MM-DD — only process orders on/after this date
 * @param {string}  [options.dateTo]    YYYY-MM-DD — only process orders on/before this date
 * @returns {Promise<{processed: number, enriched: number}>}
 */
async function enrichFromProfitMetrics(db, { fetchMetafields = false, dateFrom, dateTo } = {}) {
  if (!STORE || !TOKEN) {
    throw new Error('SHOPIFY_STORE and SHOPIFY_TOKEN must be set in .env');
  }

  // Pull orders from DB that have note_attributes stored
  // We stored note_attributes in the sync via the Shopify connector —
  // but the DB column doesn't store them.  For pm_* enrichment without
  // extra API calls we need to re-fetch from Shopify.
  //
  // Strategy: fetch orders from Shopify for the date range, extract pm_* fields,
  // update matching DB rows.

  const dateFilter = [];
  if (dateFrom) dateFilter.push(`created_at_min=${dateFrom}T00:00:00Z`);
  if (dateTo)   dateFilter.push(`created_at_max=${dateTo}T23:59:59Z`);

  const baseParams = {
    status:  'any',
    limit:   250,
    fields:  'id,order_number,note_attributes',
    ...(dateFrom && { created_at_min: `${dateFrom}T00:00:00Z` }),
    ...(dateTo   && { created_at_max: `${dateTo}T23:59:59Z` }),
  };

  const headers = { 'X-Shopify-Access-Token': TOKEN };

  const updateStmt = db.prepare(`
    UPDATE orders
    SET
      utm_source   = COALESCE(@utm_source,   utm_source),
      medium       = COALESCE(@utm_medium,   medium),
      utm_campaign = COALESCE(@utm_campaign, utm_campaign),
      utm_content  = COALESCE(@utm_content,  utm_content),
      utm_term     = COALESCE(@utm_term,     utm_term)
    WHERE id = @id
  `);

  let processed = 0;
  let enriched  = 0;
  let pageInfo  = null;
  let first     = true;

  while (true) {
    if (!first) await delay(500);
    first = false;

    const params = pageInfo ? { page_info: pageInfo, limit: 250 } : baseParams;
    const res = await axios.get(`${BASE_URL}/orders.json`, { headers, params });
    const orders = res.data.orders ?? [];

    for (const order of orders) {
      processed++;
      const pm = extractPmFields(order.note_attributes);

      if (pm) {
        const { landing_page: _lp, ...pmFields } = pm;
      const result = updateStmt.run({ id: String(order.id), ...pmFields });
        if (result.changes > 0) enriched++;
      }

      // Optional: fetch metafield for deeper touch data
      if (fetchMetafields) {
        const attr = await fetchPmMetafield(String(order.id));
        if (attr?.first_touch?.utm) {
          const utms = attr.first_touch.utm;
          db.prepare(`
            UPDATE orders
            SET
              utm_campaign = COALESCE(@utm_campaign, utm_campaign),
              utm_content  = COALESCE(@utm_content,  utm_content),
              utm_term     = COALESCE(@utm_term,     utm_term)
            WHERE id = @id AND (utm_campaign IS NULL OR utm_campaign = '')
          `).run({
            id:           String(order.id),
            utm_campaign: utms.utm_campaign ?? utms.utm_id ?? null,
            utm_content:  utms.utm_content  ?? null,
            utm_term:     utms.utm_term     ?? null,
          });
        }
        await delay(300);
      }
    }

    const link = res.headers['link'] ?? '';
    const next = link.match(/<[^>]+page_info=([^>&"]+)[^>]*>;\s*rel="next"/);
    if (next) {
      pageInfo = next[1];
    } else {
      break;
    }
  }

  return { processed, enriched };
}

module.exports = { enrichFromProfitMetrics, extractPmFields };
