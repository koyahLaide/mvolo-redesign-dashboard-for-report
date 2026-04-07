'use strict';

/**
 * sync-klaviyo-metrics.js
 *
 * Haalt dagelijkse metrics op van Klaviyo voor de volledige customer journey:
 * - Email funnel: Received → Opened → Clicked → Placed Order
 * - Site journey: Viewed Product → Checkout Started → Placed Order
 * - Forms: Viewed Form → Submitted Form
 * - Subscribers: gegroeid/afgemeld
 *
 * Gebruik: node src/scripts/sync-klaviyo-metrics.js
 */

require('dotenv').config();
const axios   = require('axios');
const chalk   = require('chalk');
const { initDb } = require('../db/schema');

const BASE_URL = 'https://a.klaviyo.com/api';
const API_KEY  = process.env.KLAVIYO_API_KEY;
const REVISION = '2024-02-15';

// Alle journey metrics die we tracken
const JOURNEY_METRICS = {
  // Email funnel
  'received_email':       { id: 'Xug8fR', label: 'Received Email',        category: 'email' },
  'opened_email':         { id: 'VFQeKn', label: 'Opened Email',           category: 'email' },
  'clicked_email':        { id: 'WpuxHp', label: 'Clicked Email',          category: 'email' },
  'unsubscribed_email':   { id: 'UPE9iv', label: 'Unsubscribed Email',     category: 'email' },
  'bounced_email':        { id: 'Y2DUx6', label: 'Bounced Email',          category: 'email' },
  'subscribed_email':     { id: 'SjtJPu', label: 'Subscribed Email',       category: 'email' },

  // Site journey
  'viewed_product':       { id: 'YbUrdS', label: 'Viewed Product',         category: 'site' },
  'added_to_cart':        { id: 'Vcph3H', label: 'Added to Cart',          category: 'site' },
  'checkout_started':     { id: 'RDdVNz', label: 'Checkout Started',       category: 'site' },
  'active_on_site':       { id: 'XWanw7', label: 'Active on Site',         category: 'site' },
  'viewed_page':          { id: 'WBT9CX', label: 'Viewed Page',            category: 'site' },

  // Conversie
  'placed_order':         { id: 'WFG9S3', label: 'Placed Order',           category: 'conversion', has_revenue: true },
  'ordered_product':      { id: 'YgxFzg', label: 'Ordered Product',        category: 'conversion', has_revenue: true },
  'fulfilled_order':      { id: 'VR6Ksa', label: 'Fulfilled Order',        category: 'conversion' },
  'cancelled_order':      { id: 'U4ERVF', label: 'Cancelled Order',        category: 'conversion' },

  // Forms
  'viewed_form':          { id: 'WnBgU6', label: 'Viewed Form',            category: 'forms' },
  'submitted_form':       { id: 'VKAeht', label: 'Submitted Form',         category: 'forms' },
  'closed_form':          { id: 'SaJtgv', label: 'Closed Form',            category: 'forms' },
};

function headers() {
  return {
    Authorization: `Klaviyo-API-Key ${API_KEY}`,
    revision:      REVISION,
    Accept:        'application/json',
    'Content-Type': 'application/json',
  };
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchMetricDaily(metricKey, metricDef, dateFrom, dateTo) {
  const measurements = metricDef.has_revenue
    ? ['count', 'sum_value']
    : ['count'];

  const body = {
    data: {
      type: 'metric-aggregate',
      attributes: {
        metric_id:    metricDef.id,
        measurements,
        interval:     'day',
        page_size:    500,
        filter: [
          `greater-or-equal(datetime,${dateFrom}T00:00:00)`,
          `less-than(datetime,${dateTo}T00:00:00)`,
        ],
      },
    },
  };

  const res = await axios.post(`${BASE_URL}/metric-aggregates/`, body, { headers: headers() });
  const attrs = res.data?.data?.attributes;
  if (!attrs?.data) return [];

  // Response structuur: attrs.dates = ['2026-03-01', ...], attrs.data[0].measurements.count = [31, 17, ...]
  const dates  = attrs.dates ?? [];
  const counts = attrs.data?.[0]?.measurements?.count ?? [];
  const revs   = attrs.data?.[0]?.measurements?.sum_value ?? [];

  return dates.map((date, i) => ({
    metric_name: metricKey,
    metric_id:   metricDef.id,
    date:        date.slice(0, 10),
    count:       counts[i] ?? 0,
    revenue:     revs[i] ?? 0,
  })).filter(r => r.date && r.count > 0);
}

async function run() {
  if (!API_KEY) {
    console.error(chalk.red('  [klaviyo-metrics] KLAVIYO_API_KEY niet ingesteld'));
    process.exit(1);
  }

  console.log(chalk.cyan('\n  [klaviyo-metrics] Syncing journey metrics...'));

  const db = initDb();

  // Zorg dat tabel bestaat
  db.exec(`
    CREATE TABLE IF NOT EXISTS klaviyo_metrics (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_name TEXT NOT NULL,
      metric_id   TEXT NOT NULL,
      date        TEXT NOT NULL,
      count       INTEGER DEFAULT 0,
      revenue     REAL DEFAULT 0,
      synced_at   TEXT DEFAULT (datetime('now')),
      UNIQUE(metric_id, date)
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_klaviyo_metrics_date ON klaviyo_metrics(date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_klaviyo_metrics_name ON klaviyo_metrics(metric_name)');

  // Haal data op voor laatste 90 dagen
  const now      = new Date();
  const dateTo   = now.toISOString().slice(0, 10);
  const dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const upsert = db.prepare(`
    INSERT INTO klaviyo_metrics (metric_name, metric_id, date, count, revenue)
    VALUES (@metric_name, @metric_id, @date, @count, @revenue)
    ON CONFLICT(metric_id, date) DO UPDATE SET
      count     = excluded.count,
      revenue   = excluded.revenue,
      synced_at = datetime('now')
  `);

  const upsertMany = db.transaction(rows => {
    for (const row of rows) upsert.run(row);
  });

  let totalRows = 0;
  let errors    = 0;

  for (const [key, def] of Object.entries(JOURNEY_METRICS)) {
    try {
      const rows = await fetchMetricDaily(key, def, dateFrom, dateTo);
      const nonZero = rows.filter(r => r.count > 0);
      upsertMany(rows);
      totalRows += rows.length;
      console.log(chalk.gray(`  ✓ ${def.label.padEnd(25)} ${nonZero.length} dagen met data`));
    } catch (err) {
      console.warn(chalk.yellow(`  ✗ ${def.label.padEnd(25)} ${err.response?.data?.errors?.[0]?.detail ?? err.message}`));
      errors++;
    }
    await delay(300);
  }

  console.log(chalk.green(`\n  [klaviyo-metrics] Klaar: ${totalRows} rijen, ${errors} errors\n`));

  // Toon samenvatting
  const summary = db.prepare(`
    SELECT metric_name,
           SUM(count) as total,
           ROUND(SUM(revenue), 2) as revenue
    FROM klaviyo_metrics
    WHERE date >= date('now', '-30 days')
    GROUP BY metric_name
    ORDER BY total DESC
  `).all();

  console.log(chalk.cyan('  Laatste 30 dagen:'));
  console.table(summary);
}

run().catch(err => {
  console.error(chalk.red(`  Fatal: ${err.message}`));
  process.exit(1);
});

module.exports = { run, JOURNEY_METRICS };
