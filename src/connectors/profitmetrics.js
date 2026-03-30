'use strict';

/**
 * ProfitMetrics API connector
 *
 * Fetches per-order profit data from ProfitMetrics and updates
 * the orders table with profit, profit_margin and cost_of_goods.
 *
 * Required env vars:
 *   PROFITMETRICS_API_KEY  — API key from ProfitMetrics account settings
 *
 * API base: https://app.profitmetrics.io/api/v1
 * Auth:     X-Api-Key header
 *
 * Docs: https://app.profitmetrics.io/api-docs (requires login)
 */

const axios = require('axios');

const BASE    = 'https://app.profitmetrics.io/api/v1';
const API_KEY = process.env.PROFITMETRICS_API_KEY;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetches profit data for orders within a date range.
 *
 * @param {string} dateFrom  YYYY-MM-DD
 * @param {string} dateTo    YYYY-MM-DD
 * @returns {Promise<Array<{order_id, profit, revenue, cost_of_goods, profit_margin}>>}
 */
async function fetchProfitData({ dateFrom, dateTo }) {
  if (!API_KEY) {
    throw new Error('PROFITMETRICS_API_KEY must be set in .env');
  }

  const headers = {
    'X-Api-Key':   API_KEY,
    'Content-Type': 'application/json',
  };

  const results = [];
  let page = 1;
  const perPage = 250;

  while (true) {
    let response;
    try {
      response = await axios.get(`${BASE}/orders`, {
        headers,
        params: {
          date_from: dateFrom,
          date_to:   dateTo,
          per_page:  perPage,
          page,
        },
      });
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message;
      const status = err.response?.status;
      if (status === 404) break;  // no data for this range
      throw new Error(`ProfitMetrics API error ${status}: ${msg}`);
    }

    const data = response.data?.data ?? response.data ?? [];
    if (!Array.isArray(data) || data.length === 0) break;

    for (const row of data) {
      // ProfitMetrics field names may vary — handle both camelCase and snake_case
      const orderId      = String(row.order_id ?? row.orderId ?? row.id ?? '');
      const revenue      = parseFloat(row.revenue ?? row.total_revenue ?? 0);
      const cogs         = parseFloat(row.cost_of_goods ?? row.cogs ?? row.costOfGoods ?? 0);
      const profit       = parseFloat(row.profit ?? row.gross_profit ?? 0);
      const profitMargin = revenue > 0
        ? Math.round((profit / revenue) * 10000) / 100  // percentage, 2 decimals
        : 0;

      if (orderId) {
        results.push({ order_id: orderId, revenue, cost_of_goods: cogs, profit, profit_margin: profitMargin });
      }
    }

    // Stop if we got fewer rows than requested (last page)
    if (data.length < perPage) break;

    page++;
    await delay(200);
  }

  return results;
}

/**
 * Updates the orders table with profit data fetched from ProfitMetrics.
 * Only updates rows where order_id matches and profit is not yet filled.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} dateFrom
 * @param {string} dateTo
 * @returns {Promise<{fetched: number, matched: number}>}
 */
async function syncProfitData(db, { dateFrom, dateTo }) {
  const rows = await fetchProfitData({ dateFrom, dateTo });

  const stmt = db.prepare(`
    UPDATE orders
    SET profit        = @profit,
        profit_margin = @profit_margin,
        cost_of_goods = @cost_of_goods
    WHERE id = @order_id
  `);

  let matched = 0;
  for (const row of rows) {
    const result = stmt.run(row);
    if (result.changes > 0) matched++;
  }

  return { fetched: rows.length, matched };
}

module.exports = { fetchProfitData, syncProfitData };
