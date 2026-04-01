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
 * Fetches session + user data per channel group for the last 365 days,
 * plus conversion event counts (purchase, begin_checkout, add_to_cart).
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
 *   purchases: number,
 *   begin_checkouts: number,
 *   add_to_carts: number,
 * }>>}
 */
async function fetchGA4Sessions({ dateFrom, dateTo } = {}) {
  const { client, propertyId } = getClient();

  const from = dateFrom ?? daysAgo(365);
  const to   = dateTo   ?? daysAgo(0);

  // ── Call 1: sessions per day × channel ────────────────────────────────────
  const [sessResp] = await client.runReport({
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
    limit: 50000,
  });

  // ── Call 2: conversion events per day × channel ───────────────────────────
  const CONV_EVENTS = ['purchase', 'begin_checkout', 'add_to_cart'];
  const eventMap = {};  // `${date}|${channel}|${eventName}` → count

  try {
    const [evtResp] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: from, endDate: to }],
      dimensions: [
        { name: 'date' },
        { name: 'sessionDefaultChannelGroup' },
        { name: 'eventName' },
      ],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: CONV_EVENTS },
        },
      },
      limit: 50000,
    });

    for (const row of (evtResp.rows ?? [])) {
      const d = row.dimensionValues ?? [];
      const rawDate = d[0]?.value ?? '';
      const date = rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;
      const key = `${date}|${d[1]?.value ?? 'unknown'}|${d[2]?.value ?? ''}`;
      eventMap[key] = parseInt(row.metricValues?.[0]?.value ?? '0', 10);
    }
  } catch (err) {
    // Conversion events may not exist yet — non-fatal
    console.warn(`  [ga4] conversion events skipped: ${err.message}`);
  }

  // ── Merge ─────────────────────────────────────────────────────────────────
  return (sessResp.rows ?? []).map((row) => {
    const dims    = row.dimensionValues ?? [];
    const metrics = row.metricValues   ?? [];
    const rawDate = dims[0]?.value ?? '';
    const date = rawDate.length === 8
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : rawDate;
    const channel = dims[1]?.value ?? 'unknown';
    const prefix  = `${date}|${channel}|`;

    return {
      date,
      channel,
      sessions:           parseInt(metrics[0]?.value ?? '0', 10),
      users:              parseInt(metrics[1]?.value ?? '0', 10),
      newUsers:           parseInt(metrics[2]?.value ?? '0', 10),
      bounceRate:         parseFloat(metrics[3]?.value ?? '0'),
      avgSessionDuration: parseFloat(metrics[4]?.value ?? '0'),
      purchases:          eventMap[`${prefix}purchase`]       ?? 0,
      begin_checkouts:    eventMap[`${prefix}begin_checkout`] ?? 0,
      add_to_carts:       eventMap[`${prefix}add_to_cart`]    ?? 0,
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

  const from = dateFrom ?? daysAgo(365);
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

  const from = dateFrom ?? daysAgo(365);
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
  const from = dateFrom ?? daysAgo(365);
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
 * Fetches ALL event names from GA4 (no filter) and logs them — useful for
 * discovering the exact names Clarity uses when forwarding events.
 *
 * @param {{ dateFrom?: string, dateTo?: string }} options
 * @returns {Promise<Array<{ eventName: string, count: number }>>}
 */
async function fetchAllEventNames({ dateFrom, dateTo } = {}) {
  const { client, propertyId } = getClient();
  const from = dateFrom ?? daysAgo(365);
  const to   = dateTo   ?? daysAgo(0);

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: from, endDate: to }],
    dimensions: [{ name: 'eventName' }],
    metrics:    [{ name: 'eventCount' }],
    orderBys:   [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 200,
  });

  const results = (response.rows ?? []).map((row) => ({
    eventName: row.dimensionValues?.[0]?.value ?? '',
    count:     parseInt(row.metricValues?.[0]?.value ?? '0', 10),
  }));

  // ── Log alle unieke event namen ───────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  GA4 event namen (${from} → ${to})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const r of results) {
    console.log(`  ${r.eventName.padEnd(45)} ${String(r.count).padStart(8)}`);
  }
  console.log(`  Totaal: ${results.length} unieke event namen`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return results;
}

/**
 * Fetches Clarity-related events from GA4.
 * First logs ALL event names so you can see what Clarity is actually sending.
 * Then filters to known Clarity rage/dead-click event name patterns.
 *
 * @param {{ dateFrom?: string, dateTo?: string }} options
 * @returns {Promise<Array<{ date: string, page: string, event_type: string, count: number, channel: string }>>}
 */
async function fetchClarityEvents({ dateFrom, dateTo } = {}) {
  const { client, propertyId } = getClient();
  const from = dateFrom ?? daysAgo(365);
  const to   = dateTo   ?? daysAgo(0);

  // ── Stap 1: log alle event namen zodat we de exacte Clarity namen zien ────
  let allEventNames = [];
  try {
    allEventNames = await fetchAllEventNames({ dateFrom: from, dateTo: to });
  } catch (err) {
    console.warn(`  [ga4] fetchAllEventNames mislukt: ${err.message}`);
  }

  // ── Stap 2: bepaal welke event namen Clarity-gerelateerd zijn ─────────────
  // Standaard Clarity event namen + alles dat 'clarity', 'rage', 'dead' bevat
  const KNOWN_CLARITY = new Set([
    'rage_click', 'dead_click',
    'clarity_rage_click', 'clarity_dead_click',
    'ms_clarity_rage_click', 'ms_clarity_dead_click',
  ]);

  const clarityNames = allEventNames
    .map((r) => r.eventName)
    .filter((n) => {
      const lower = n.toLowerCase();
      return KNOWN_CLARITY.has(lower)
        || lower.includes('clarity')
        || lower.includes('rage')
        || lower.includes('dead_click');
    });

  if (clarityNames.length === 0) {
    console.log('  [ga4] Geen Clarity event namen gevonden in GA4.');
    console.log('  → Zorg dat Clarity events naar GA4 worden gestuurd of pas KNOWN_CLARITY aan.\n');
    return [];
  }

  console.log(`  [ga4] Clarity event namen gevonden: ${clarityNames.join(', ')}\n`);

  // ── Stap 3: haal gefilterde events op ────────────────────────────────────
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
          inListFilter: { values: clarityNames },
        },
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 10000,
    });
  } catch (err) {
    console.warn(`  [ga4] Clarity events query mislukt: ${err.message}`);
    return [];
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

module.exports = {
  fetchGA4Sessions,
  fetchGA4TopPages,
  fetchGA4Journeys,
  fetchGA4PageFunnel,
  fetchClarityEvents,
  fetchAllEventNames,
  // backwards-compat alias used in sync.js
  fetchGA4ClarityEvents: fetchClarityEvents,
};
