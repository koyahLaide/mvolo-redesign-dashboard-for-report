'use strict';

/**
 * Google Analytics 4 connector
 *
 * Uses the GA4 Data API with a service account to fetch session/traffic data.
 *
 * Required env vars:
 *   GA4_PROPERTY_ID  — numeric GA4 property ID (without "properties/" prefix)
 *   GA4_CLIENT_EMAIL — service account email
 *   GA4_PRIVATE_KEY  — service account private key (PEM, with \n newlines)
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');

function getClient() {
  const clientEmail = process.env.GA4_CLIENT_EMAIL;
  const privateKey  = (process.env.GA4_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  const propertyId  = process.env.GA4_PROPERTY_ID;

  if (!clientEmail || !privateKey || !propertyId) {
    throw new Error('GA4_PROPERTY_ID, GA4_CLIENT_EMAIL and GA4_PRIVATE_KEY must be set in .env');
  }

  const client = new BetaAnalyticsDataClient({
    credentials: { client_email: clientEmail, private_key: privateKey },
  });

  return { client, propertyId };
}

/**
 * Returns YYYY-MM-DD string for n days ago.
 */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetches session + user data per channel group for the last 30 days.
 *
 * @param {{ dateFrom?: string, dateTo?: string }} options
 * @returns {Promise<Array<{
 *   date: string,
 *   channel: string,
 *   sessions: number,
 *   users: number,
 *   newUsers: number,
 *   bounceRate: number,
 *   avgSessionDuration: number,
 * }>>}
 */
async function fetchGA4Sessions({ dateFrom, dateTo } = {}) {
  const { client, propertyId } = getClient();

  const from = dateFrom ?? daysAgo(30);
  const to   = dateTo   ?? daysAgo(0);

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: from, endDate: to }],
    dimensions: [
      { name: 'date' },
      { name: 'sessionDefaultChannelGroup' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    limit: 10000,
  });

  const rows = response.rows ?? [];

  return rows.map((row) => {
    const dims    = row.dimensionValues ?? [];
    const metrics = row.metricValues   ?? [];

    const rawDate = dims[0]?.value ?? '';
    // GA4 returns date as YYYYMMDD — convert to YYYY-MM-DD
    const date = rawDate.length === 8
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : rawDate;

    return {
      date,
      channel:             dims[1]?.value ?? 'unknown',
      sessions:            parseInt(metrics[0]?.value ?? '0', 10),
      users:               parseInt(metrics[1]?.value ?? '0', 10),
      newUsers:            parseInt(metrics[2]?.value ?? '0', 10),
      bounceRate:          parseFloat(metrics[3]?.value ?? '0'),
      avgSessionDuration:  parseFloat(metrics[4]?.value ?? '0'),
    };
  });
}

/**
 * Fetches top landing pages by sessions for the last 30 days.
 *
 * @param {{ dateFrom?: string, dateTo?: string, limit?: number }} options
 * @returns {Promise<Array<{ page: string, sessions: number, users: number, bounceRate: number }>>}
 */
async function fetchGA4TopPages({ dateFrom, dateTo, limit = 25 } = {}) {
  const { client, propertyId } = getClient();

  const from = dateFrom ?? daysAgo(30);
  const to   = dateTo   ?? daysAgo(0);

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: from, endDate: to }],
    dimensions: [{ name: 'landingPage' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'bounceRate' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit,
  });

  return (response.rows ?? []).map((row) => ({
    page:       row.dimensionValues?.[0]?.value ?? '/',
    sessions:   parseInt(row.metricValues?.[0]?.value ?? '0', 10),
    users:      parseInt(row.metricValues?.[1]?.value ?? '0', 10),
    bounceRate: parseFloat(row.metricValues?.[2]?.value ?? '0'),
  }));
}

/**
 * Fetches first-touch vs session-channel combinations for journey analysis.
 * Dimensions: firstUserDefaultChannelGroup × sessionDefaultChannelGroup
 *
 * @param {{ dateFrom?: string, dateTo?: string }} options
 * @returns {Promise<Array<{ date: string, first_channel: string, session_channel: string, sessions: number, users: number }>>}
 */
async function fetchGA4Journeys({ dateFrom, dateTo } = {}) {
  const { client, propertyId } = getClient();

  const from = dateFrom ?? daysAgo(90);
  const to   = dateTo   ?? daysAgo(0);

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: from, endDate: to }],
    dimensions: [
      { name: 'date' },
      { name: 'firstUserDefaultChannelGroup' },
      { name: 'sessionDefaultChannelGroup' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    limit: 50000,
  });

  return (response.rows ?? []).map((row) => {
    const dims    = row.dimensionValues ?? [];
    const metrics = row.metricValues   ?? [];
    const rawDate = dims[0]?.value ?? '';
    const date = rawDate.length === 8
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : rawDate;
    return {
      date,
      first_channel:   dims[1]?.value ?? 'unknown',
      session_channel: dims[2]?.value ?? 'unknown',
      sessions:        parseInt(metrics[0]?.value ?? '0', 10),
      users:           parseInt(metrics[1]?.value ?? '0', 10),
    };
  });
}

/**
 * Categorises a GA4 pagePath into a funnel step.
 * Returns 'homepage' | 'product' | 'cart' | 'checkout' | null (= skip)
 *
 * @param {string} path
 * @returns {string|null}
 */
function classifyFunnelStep(path) {
  if (!path) return null;
  const p = path.toLowerCase().split('?')[0]; // strip query string
  if (/^\/(nl\/|en\/|de\/|eu\/)?$/.test(p) || p === '/') return 'homepage';
  if (/\/products?\//i.test(p))                             return 'product';
  if (/^\/cart/i.test(p) || p === '/winkelmand')           return 'cart';
  if (/\/checkouts?\//i.test(p) || /checkout/i.test(p))    return 'checkout';
  return null;
}

/**
 * Fetches page-level session data and aggregates into funnel steps.
 * Returns one row per (date × step) with session and user counts.
 *
 * @param {{ dateFrom?: string, dateTo?: string }} options
 * @returns {Promise<Array<{ date: string, step: string, sessions: number, users: number }>>}
 */
async function fetchGA4PageFunnel({ dateFrom, dateTo } = {}) {
  const { client, propertyId } = getClient();
  const from = dateFrom ?? daysAgo(30);
  const to   = dateTo   ?? daysAgo(0);

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: from, endDate: to }],
    dimensions: [
      { name: 'date' },
      { name: 'pagePath' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    limit: 50000,
  });

  // Aggregate per (date, step)
  const agg = {};  // key = `${date}|${step}`

  for (const row of (response.rows ?? [])) {
    const dims    = row.dimensionValues ?? [];
    const metrics = row.metricValues   ?? [];
    const rawDate = dims[0]?.value ?? '';
    const date = rawDate.length === 8
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : rawDate;
    const path = dims[1]?.value ?? '/';
    const step = classifyFunnelStep(path);
    if (!step) continue;

    const key = `${date}|${step}`;
    if (!agg[key]) agg[key] = { date, step, sessions: 0, users: 0 };
    agg[key].sessions += parseInt(metrics[0]?.value ?? '0', 10);
    agg[key].users    += parseInt(metrics[1]?.value ?? '0', 10);
  }

  return Object.values(agg);
}

/**
 * Fetches Clarity-related events from GA4.
 * Clarity can forward rage-click and dead-click events to GA4 as custom events.
 * Falls back gracefully if no such events are configured.
 *
 * Event names tried: 'rage_click', 'dead_click', 'clarity_rage_click', 'clarity_dead_click'
 *
 * @param {{ dateFrom?: string, dateTo?: string }} options
 * @returns {Promise<Array<{ date: string, page: string, event_type: string, count: number, channel: string }>>}
 */
async function fetchGA4ClarityEvents({ dateFrom, dateTo } = {}) {
  const { client, propertyId } = getClient();
  const from = dateFrom ?? daysAgo(30);
  const to   = dateTo   ?? daysAgo(0);

  // We request eventName × pagePath × sessionDefaultChannelGroup
  // then filter by known Clarity event names
  const CLARITY_EVENTS = new Set([
    'rage_click', 'dead_click',
    'clarity_rage_click', 'clarity_dead_click',
    'ms_clarity_rage_click', 'ms_clarity_dead_click',
  ]);

  let response;
  try {
    [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: from, endDate: to }],
      dimensions: [
        { name: 'date' },
        { name: 'eventName' },
        { name: 'pagePath' },
        { name: 'sessionDefaultChannelGroup' },
      ],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: [...CLARITY_EVENTS] },
        },
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 5000,
    });
  } catch {
    return []; // no such events configured in GA4
  }

  const rows = [];
  for (const row of (response?.rows ?? [])) {
    const dims    = row.dimensionValues ?? [];
    const metrics = row.metricValues   ?? [];
    const rawDate = dims[0]?.value ?? '';
    const date = rawDate.length === 8
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : rawDate;
    const eventName = dims[1]?.value ?? '';
    // Normalise event type
    const event_type = eventName.toLowerCase().includes('rage') ? 'rage_click'
      : eventName.toLowerCase().includes('dead') ? 'dead_click'
      : eventName.toLowerCase();

    rows.push({
      date,
      event_type,
      page:    dims[2]?.value ?? '/',
      channel: dims[3]?.value ?? 'unknown',
      count:   parseInt(metrics[0]?.value ?? '0', 10),
    });
  }
  return rows;
}

module.exports = { fetchGA4Sessions, fetchGA4TopPages, fetchGA4Journeys, fetchGA4PageFunnel, fetchGA4ClarityEvents };
