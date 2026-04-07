'use strict';

const axios = require('axios');

const STORE = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_TOKEN;
const API_VERSION = '2024-01';
const BASE_URL = `https://${STORE}/admin/api/${API_VERSION}`;

// Respect Shopify's rate limit: max 2 calls/second for REST
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extracts the subset of order fields we care about.
 * @param {Object} order - Raw Shopify order object
 * @returns {Object}
 */
function mapOrder(order) {
  return {
    id: String(order.id),
    order_number: String(order.order_number),
    created_at: order.created_at,
    total_price: parseFloat(order.total_price),
    financial_status: order.financial_status,
    landing_site: order.landing_site || null,
    referring_site: order.referring_site || null,
    source_name: order.source_name || null,
    note_attributes: order.note_attributes || [],
    line_items: (order.line_items || []).map((li) => ({
      product_id: li.product_id,
      title: li.title,
      price: parseFloat(li.price),
      quantity: li.quantity,
    })),
    customer_email: order.email || order.customer?.email || null,
    customer_id: order.customer?.id ? String(order.customer.id) : null,
    shipping_city: order.shipping_address?.city ?? null,
    shipping_country: order.shipping_address?.country_code ?? null,
  };
}

/**
 * Fetches all orders from Shopify, supporting cursor-based pagination.
 *
 * @param {Object} options
 * @param {string} [options.createdAtMin] - ISO 8601 date string — only fetch orders after this date
 * @returns {Promise<Array>} Flat array of mapped orders
 */
async function fetchOrders({ createdAtMin } = {}) {
  if (!STORE || !TOKEN) {
    throw new Error('SHOPIFY_STORE and SHOPIFY_TOKEN must be set in .env');
  }

  const orders = [];
  let url = `${BASE_URL}/orders.json`;
  let isFirstRequest = true;

  const baseParams = {
    status: 'any',
    limit: 250,
    fields: [
      'id',
      'order_number',
      'created_at',
      'total_price',
      'financial_status',
      'landing_site',
      'referring_site',
      'source_name',
      'note_attributes',
      'line_items',
      'email',
      'shipping_address',
      'customer',
    ].join(','),
  };

  if (createdAtMin) {
    baseParams.created_at_min = createdAtMin;
  }

  let pageInfo = null;

  while (true) {
    // Rate limit: 500 ms between calls = max 2 calls/second
    if (!isFirstRequest) {
      await delay(500);
    }
    isFirstRequest = false;

    const params = pageInfo
      ? { page_info: pageInfo, limit: 250 }
      : baseParams;

    let response;
    try {
      response = await axios.get(url, {
        params,
        headers: {
          'X-Shopify-Access-Token': TOKEN,
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.errors || err.message;
      throw new Error(`Shopify API error ${status}: ${JSON.stringify(msg)}`);
    }

    const batch = response.data.orders || [];
    batch.forEach((o) => orders.push(mapOrder(o)));

    // Parse Link header for cursor-based pagination
    const linkHeader = response.headers['link'] || '';
    const nextMatch = linkHeader.match(/<[^>]+page_info=([^>&"]+)[^>]*>;\s*rel="next"/);

    if (nextMatch) {
      pageInfo = nextMatch[1];
    } else {
      break;
    }
  }

  return orders;
}

module.exports = { fetchOrders };
