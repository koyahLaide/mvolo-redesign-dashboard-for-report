'use strict';

/**
 * Bol.com Retailer API v10 connector
 *
 * Required env vars:
 *   BOL_CLIENT_ID      — from Bol developer portal
 *   BOL_CLIENT_SECRET  — from Bol developer portal
 *
 * Docs: https://developers.bol.com/retailer/docs/api
 */

const axios = require('axios');

const TOKEN_URL = 'https://login.bol.com/token';
const BASE_URL = 'https://api.bol.com/retailer';
const ACCEPT = 'application/vnd.retailer.v10+json';

const CLIENT_ID = process.env.BOL_CLIENT_ID;
const CLIENT_SECRET = process.env.BOL_CLIENT_SECRET;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ── In-memory token cache ──────────────────────────────────────────────────────
let _token = null;
let _tokenExp = 0; // Unix ms

async function getAccessToken() {
  if (_token && Date.now() < _tokenExp - 10_000) return _token;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('BOL_CLIENT_ID and BOL_CLIENT_SECRET must be set in .env');
  }

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const res = await axios.post(`${TOKEN_URL}?grant_type=client_credentials`, null, {
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  _token = res.data.access_token;
  _tokenExp = Date.now() + (res.data.expires_in ?? 300) * 1000;
  return _token;
}

/**
 * Returns headers for authenticated Bol API requests.
 */
async function authHeaders() {
  const token = await getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: ACCEPT,
    'Content-Type': ACCEPT,
  };
}

/**
 * Fetches a single page of orders from Bol.
 *
 * @param {number} page  1-based page number
 * @returns {Promise<Array>} raw order summaries
 */
async function fetchOrderPage(page) {
  const headers = await authHeaders();
  const res = await axios.get(`${BASE_URL}/orders`, {
    headers,
    params: {
      'fulfilment-method': 'ALL',
      status: 'ALL',
      'page-size': 50,
      page,
    },
  });
  return res.data.orders ?? [];
}

/**
 * Fetches full order detail for one orderId.
 */
async function fetchOrderDetail(orderId) {
  const headers = await authHeaders();
  const res = await axios.get(`${BASE_URL}/orders/${orderId}`, { headers });
  return res.data;
}

/**
 * Maps a full Bol order to our internal format.
 */
function mapBolOrder(detail) {
  const items = detail.orderItems ?? [];

  const totalAmount = items.reduce((sum, item) => {
    const lineTotal = item.totalPrice ?? parseFloat(item.unitPrice ?? 0) * (item.quantity ?? 1);
    return sum + lineTotal;
  }, 0);

  const shipment = detail.shipmentDetails ?? {};

  const createdAt = detail.orderPlacedDateTime ?? detail.orderDate ?? new Date().toISOString();

  return {
    id: `bol_${detail.orderId}`,
    order_number: String(detail.orderId),
    created_at: createdAt,
    total_price: Math.round(totalAmount * 100) / 100,
    financial_status: 'paid',
    landing_site: null,
    referring_site: null,
    source_name: 'bol',
    note_attributes: [],
    line_items: items.map((item) => ({
      product_id: item.product?.ean ?? null,
      title: item.product?.title ?? 'Onbekend product',
      price: parseFloat(item.unitPrice ?? 0),
      quantity: item.quantity ?? 1,
    })),
    customer_email: null,
    customer_id: null,
    marketplace: 'bol',
    shipping_city: shipment.cityName ?? null,
    shipping_country: shipment.countryCode ?? null,
  };
}

/**
 * Fetches all Bol orders and returns them mapped to our internal format.
 * Paginates through all available pages.
 *
 * @returns {Promise<Array>}
 */
async function fetchOrders() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('BOL_CLIENT_ID and BOL_CLIENT_SECRET must be set in .env');
  }

  const allOrders = [];
  let page = 1;

  while (true) {
    let summaries;
    try {
      summaries = await fetchOrderPage(page);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.detail ?? err.message;
      if (status === 404 || summaries?.length === 0) break;
      throw new Error(`Bol API error ${status}: ${msg}`);
    }

    if (!Array.isArray(summaries) || summaries.length === 0) break;

    for (const summary of summaries) {
      try {
        const detail = await fetchOrderDetail(summary.orderId);
        allOrders.push(mapBolOrder(detail));
      } catch (err) {
        console.warn(`  [bol] Skipping order ${summary.orderId}: ${err.message}`);
      }
      await delay(200);
    }

    if (summaries.length < 50) break;
    page++;
    await delay(500);
  }

  return allOrders;
}

const fetchBolOrders = fetchOrders;

module.exports = { fetchOrders, fetchBolOrders };
