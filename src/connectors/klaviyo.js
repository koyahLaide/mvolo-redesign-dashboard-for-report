'use strict';

/**
 * Klaviyo API v2024-10-15 connector
 *
 * Haalt op:
 *  - Campaign performance (sent, open rate, click rate, revenue)
 *  - Flow performance (revenue per flow)
 *  - Subscriber groei
 *
 * Required env var:
 *   KLAVIYO_API_KEY — Private API Key (read-only: Campaigns, Flows, Metrics, Profiles)
 */

const axios = require('axios');

const BASE_URL = 'https://a.klaviyo.com/api';
const API_KEY  = process.env.KLAVIYO_API_KEY;
const REVISION = '2024-10-15';

function headers() {
  return {
    Authorization: `Klaviyo-API-Key ${API_KEY}`,
    revision:      REVISION,
    Accept:        'application/json',
  };
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch all campaigns (email) with stats from the last 90 days.
 * Returns array of { name, status, sent_at, subject, open_rate, click_rate, revenue }
 */
async function fetchKlaviyoCampaigns() {
  if (!API_KEY) throw new Error('KLAVIYO_API_KEY niet ingesteld');

  const campaigns = [];
  let url = `${BASE_URL}/campaigns/?filter=equals(messages.channel,'email')`;

  while (url) {
    const res = await axios.get(url, { headers: headers() });
    const data = res.data.data ?? [];

    for (const c of data) {
      const attrs = c.attributes ?? {};
      campaigns.push({
        id:         c.id,
        name:       attrs.name ?? null,
        status:     attrs.status ?? null,
        sent_at:    attrs.send_time ?? null,
        subject:    attrs.message?.content?.subject ?? null,
      });
    }

    url = res.data.links?.next ?? null;
    if (url) await delay(300);
  }

  return campaigns;
}

/**
 * Fetch all active flows.
 * Returns array of { id, name, status, created, trigger_type }
 */
async function fetchKlaviyoFlows() {
  if (!API_KEY) throw new Error('KLAVIYO_API_KEY niet ingesteld');

  const flows = [];
  let url = `${BASE_URL}/flows/`;

  while (url) {
    const res = await axios.get(url, { headers: headers() });
    const data = res.data.data ?? [];

    for (const f of data) {
      const attrs = f.attributes ?? {};
      flows.push({
        id:           f.id,
        name:         attrs.name ?? null,
        status:       attrs.status ?? null,
        created:      attrs.created ?? null,
        trigger_type: attrs.trigger_type ?? null,
      });
    }

    url = res.data.links?.next ?? null;
    if (url) await delay(300);
  }

  return flows;
}

/**
 * Fetch aggregate metrics for a date range.
 * metric_id: Klaviyo metric ID for "Placed Order" or "Received Email"
 *
 * Returns total count and revenue (if available).
 */
async function fetchMetricAggregate({ metricId, dateFrom, dateTo }) {
  if (!API_KEY) throw new Error('KLAVIYO_API_KEY niet ingesteld');

  const body = {
    data: {
      type: 'metric-aggregate',
      attributes: {
        metric_id:   metricId,
        measurements: ['count', 'sum_value'],
        interval:    'day',
        page_size:   500,
        filter: [
          `greater-or-equal(datetime,${dateFrom}T00:00:00)`,
          `less-than(datetime,${dateTo}T00:00:00)`,
        ],
      },
    },
  };

  const res = await axios.post(`${BASE_URL}/metric-aggregates/`, body, {
    headers: { ...headers(), 'Content-Type': 'application/json' },
  });

  return res.data?.data?.attributes ?? null;
}

/**
 * Fetch all Klaviyo metrics to find metric IDs.
 * Returns map of { name → id }
 */
async function fetchMetrics() {
  if (!API_KEY) throw new Error('KLAVIYO_API_KEY niet ingesteld');

  const res = await axios.get(`${BASE_URL}/metrics/`, {
    headers: headers(),
  });

  const map = {};
  for (const m of res.data.data ?? []) {
    map[m.attributes.name] = m.id;
  }
  return map;
}

/**
 * Fetch subscriber count (active profiles).
 */
async function fetchSubscriberCount() {
  if (!API_KEY) throw new Error('KLAVIYO_API_KEY niet ingesteld');

  const res = await axios.get(
    `${BASE_URL}/profiles/?filter=equals(subscriptions.email.marketing.can_receive_email_marketing,true)&page[size]=1`,
    { headers: headers() }
  );

  // Klaviyo returns total count in meta
  return res.data?.meta?.total ?? null;
}

/**
 * Main export: fetch all Klaviyo data for the dashboard sync.
 * Returns { campaigns, flows, metrics, subscriberCount }
 */
async function fetchKlaviyoData({ dateFrom, dateTo } = {}) {
  if (!API_KEY) {
    throw new Error('KLAVIYO_API_KEY niet ingesteld');
  }

  const now   = new Date();
  const from  = dateFrom ?? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to    = dateTo   ?? now.toISOString().slice(0, 10);

  const [campaigns, flows, metricsMap] = await Promise.all([
    fetchKlaviyoCampaigns(),
    fetchKlaviyoFlows(),
    fetchMetrics(),
  ]);

  // Fetch revenue from "Placed Order" metric (attributed to email)
  let emailRevenue = null;
  const placedOrderId = metricsMap['Placed Order'];
  if (placedOrderId) {
    try {
      const agg = await fetchMetricAggregate({
        metricId: placedOrderId,
        dateFrom: from,
        dateTo:   to,
      });
      if (agg) {
        const revenueData = agg.data?.find?.(d => d.metric === 'sum_value');
        emailRevenue = revenueData
          ? revenueData.values?.reduce?.((s, v) => s + (v ?? 0), 0) ?? null
          : null;
      }
    } catch (err) {
      console.warn(`  [klaviyo] Revenue fetch overgeslagen: ${err.message}`);
    }
  }

  // Subscriber count
  let subscriberCount = null;
  try {
    subscriberCount = await fetchSubscriberCount();
  } catch (err) {
    console.warn(`  [klaviyo] Subscriber count overgeslagen: ${err.message}`);
  }

  return {
    campaigns,
    flows,
    emailRevenue,
    subscriberCount,
    metricsMap,
    dateFrom: from,
    dateTo:   to,
  };
}

module.exports = {
  fetchKlaviyoData,
  fetchKlaviyoCampaigns,
  fetchKlaviyoFlows,
  fetchMetrics,
  fetchSubscriberCount,
};
