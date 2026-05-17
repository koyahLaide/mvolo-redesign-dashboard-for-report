'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.resolve(__dirname, '../../dashboard/data'); // old path: ../data/
const DB_PATH = path.join(DATA_DIR, 'mvolo.db');

let _db = null;

/**
 * Initialises the SQLite database, creates tables if they don't exist yet,
 * and returns the db instance. Subsequent calls return the cached instance.
 *
 * @returns {DatabaseSync}
 */
function initDb() {
  if (_db) return _db;

  // Ensure data/ directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.exec('PRAGMA journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id               TEXT PRIMARY KEY,
      order_number     TEXT,
      created_at       TEXT,
      total_price      REAL,
      financial_status TEXT,
      channel          TEXT,
      medium           TEXT,
      utm_source       TEXT,
      utm_campaign     TEXT,
      utm_content      TEXT,
      utm_term         TEXT,
      landing_site     TEXT,
      referring_site   TEXT,
      source_name      TEXT,
      synced_at        TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      synced_at      TEXT,
      orders_fetched INTEGER,
      orders_new     INTEGER,
      status         TEXT,
      error          TEXT
    );
  `);

  // ad_spend: one row per date × channel × campaign × adset
  db.exec(`
    CREATE TABLE IF NOT EXISTS ad_spend (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      date          TEXT NOT NULL,
      channel       TEXT NOT NULL,
      campaign_name TEXT,
      adset_name    TEXT,
      ad_name       TEXT,
      spend         REAL DEFAULT 0,
      impressions   INTEGER DEFAULT 0,
      clicks        INTEGER DEFAULT 0,
      purchases     INTEGER DEFAULT 0,
      currency      TEXT DEFAULT 'EUR'
    );

    CREATE TABLE IF NOT EXISTS visitor_sessions (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id               TEXT NOT NULL,
      order_id                 TEXT,
      session_count            INTEGER DEFAULT 0,
      first_touch_date         TEXT,
      last_touch_date          TEXT,
      days_to_convert          REAL,
      sessions_before_purchase INTEGER,
      touch_path               TEXT,
      created_at               TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ga4_sessions (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      date                 TEXT NOT NULL,
      channel              TEXT NOT NULL,
      sessions             INTEGER DEFAULT 0,
      users                INTEGER DEFAULT 0,
      new_users            INTEGER DEFAULT 0,
      bounce_rate          REAL DEFAULT 0,
      avg_session_duration REAL DEFAULT 0,
      UNIQUE(date, channel)
    );

    CREATE TABLE IF NOT EXISTS ga4_journeys (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      date             TEXT NOT NULL,
      first_channel    TEXT NOT NULL,
      session_channel  TEXT NOT NULL,
      sessions         INTEGER DEFAULT 0,
      users            INTEGER DEFAULT 0,
      UNIQUE(date, first_channel, session_channel)
    );

    CREATE TABLE IF NOT EXISTS journey_meta (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      date          TEXT NOT NULL,
      channel       TEXT NOT NULL,
      campaign_name TEXT,
      purchases_1d  INTEGER DEFAULT 0,
      purchases_7d  INTEGER DEFAULT 0,
      purchases_28d INTEGER DEFAULT 0,
      revenue_1d    REAL DEFAULT 0,
      revenue_7d    REAL DEFAULT 0,
      revenue_28d   REAL DEFAULT 0,
      UNIQUE(date, channel, campaign_name)
    );

    CREATE TABLE IF NOT EXISTS daily_metrics (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      date           TEXT NOT NULL,
      channel        TEXT NOT NULL,
      spend          REAL DEFAULT 0,
      revenue        REAL DEFAULT 0,
      profit         REAL DEFAULT 0,
      orders         INTEGER DEFAULT 0,
      new_customers  INTEGER DEFAULT 0,
      roas           REAL DEFAULT 0,
      poas           REAL DEFAULT 0,
      cac            REAL DEFAULT 0,
      UNIQUE(date, channel)
    );

    CREATE TABLE IF NOT EXISTS ga4_funnel (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      date     TEXT NOT NULL,
      step     TEXT NOT NULL,
      sessions INTEGER DEFAULT 0,
      users    INTEGER DEFAULT 0,
      UNIQUE(date, step)
    );

    CREATE TABLE IF NOT EXISTS clarity_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT NOT NULL,
      page       TEXT NOT NULL,
      event_type TEXT NOT NULL,
      count      INTEGER DEFAULT 0,
      channel    TEXT,
      UNIQUE(date, page, event_type)
    );

    CREATE TABLE IF NOT EXISTS clarity_insights (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      fetched_at           TEXT NOT NULL,
      num_of_days          INTEGER NOT NULL,
      metric               TEXT NOT NULL,
      dimension_key        TEXT NOT NULL,
      dimension_value      TEXT NOT NULL,
      sessions             INTEGER DEFAULT 0,
      subtotal             REAL DEFAULT 0,
      pages_views          INTEGER DEFAULT 0,
      sessions_with_pct    REAL DEFAULT 0,
      sessions_without_pct REAL DEFAULT 0,
      UNIQUE(fetched_at, metric, dimension_key, dimension_value)
    );

    CREATE TABLE IF NOT EXISTS klaviyo_campaigns (
      id        TEXT PRIMARY KEY,
      name      TEXT,
      status    TEXT,
      sent_at   TEXT,
      subject   TEXT,
      synced_at TEXT
    );


    CREATE TABLE IF NOT EXISTS order_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    TEXT NOT NULL,
      sku         TEXT DEFAULT '',
      title       TEXT,
      quantity    INTEGER DEFAULT 1,
      price       REAL DEFAULT 0,
      order_date  TEXT,
      UNIQUE(order_id, sku)
    );
    CREATE TABLE IF NOT EXISTS klaviyo_metrics (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_name TEXT NOT NULL,
      metric_id   TEXT NOT NULL,
      date        TEXT NOT NULL,
      count       INTEGER DEFAULT 0,
      revenue     REAL DEFAULT 0,
      synced_at   TEXT DEFAULT (datetime('now')),
      UNIQUE(metric_id, date)
    );
    CREATE TABLE IF NOT EXISTS bundle_pairs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      sku_a           TEXT NOT NULL,
      sku_b           TEXT NOT NULL,
      samen_gekocht   INTEGER DEFAULT 0,
      cross_sell_freq INTEGER DEFAULT 0,
      gem_dagen_cross INTEGER,
      updated_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(sku_a, sku_b)
    );
    CREATE TABLE IF NOT EXISTS season_weights (
      month       INTEGER NOT NULL,
      avg_orders  REAL DEFAULT 0,
      avg_revenue REAL DEFAULT 0,
      weight      REAL DEFAULT 1.0,
      updated_at  TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (month)
    );
    CREATE TABLE IF NOT EXISTS opex (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      category       TEXT NOT NULL,
      name           TEXT NOT NULL,
      amount         REAL NOT NULL,
      frequency      TEXT NOT NULL DEFAULT 'monthly',
      monthly_amount REAL NOT NULL,
      btw            REAL DEFAULT 0,
      updated_at     TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      date      TEXT NOT NULL,
      base      TEXT NOT NULL,
      target    TEXT NOT NULL,
      rate      REAL NOT NULL,
      synced_at TEXT DEFAULT (datetime('now')),
      UNIQUE(date, base, target)
    );
    CREATE TABLE IF NOT EXISTS klaviyo_flows (
      id           TEXT PRIMARY KEY,
      name         TEXT,
      status       TEXT,
      created      TEXT,
      trigger_type TEXT,
      synced_at    TEXT
    );
    CREATE TABLE IF NOT EXISTS competitor_prices (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor       TEXT NOT NULL,
      product_name     TEXT NOT NULL,
      price            REAL NOT NULL,
      compare_price    REAL,
      category         TEXT,
      url              TEXT,
      date             TEXT NOT NULL,
      prev_price       REAL,
      price_change_pct REAL,
      price_changed    INTEGER DEFAULT 0,
      synced_at        TEXT DEFAULT (datetime('now')),
      UNIQUE(competitor, product_name, date)
    );
  `);

  // Migrate: add new columns if they don't exist yet (SQLite has no ADD COLUMN IF NOT EXISTS)
  const migrationColumns = [
    'ALTER TABLE orders ADD COLUMN first_touch TEXT',
    'ALTER TABLE orders ADD COLUMN last_touch TEXT',
    'ALTER TABLE orders ADD COLUMN touch_path TEXT',
    'ALTER TABLE orders ADD COLUMN customer_email TEXT',
    'ALTER TABLE orders ADD COLUMN customer_id TEXT',
    'ALTER TABLE orders ADD COLUMN is_new_customer INTEGER',
    'ALTER TABLE orders ADD COLUMN profit REAL',
    'ALTER TABLE orders ADD COLUMN profit_margin REAL',
    'ALTER TABLE orders ADD COLUMN cost_of_goods REAL',
    'ALTER TABLE orders ADD COLUMN days_to_convert REAL',
    'ALTER TABLE orders ADD COLUMN sessions_before_purchase INTEGER',
    "ALTER TABLE orders ADD COLUMN marketplace TEXT DEFAULT 'shopify'",
    'ALTER TABLE orders ADD COLUMN direct_subchannel TEXT',
    'ALTER TABLE orders ADD COLUMN shipping_city TEXT',
    'ALTER TABLE orders ADD COLUMN shipping_country TEXT',
    'ALTER TABLE orders ADD COLUMN device_type TEXT',
    'ALTER TABLE orders ADD COLUMN browser_language TEXT',
    // visitor_sessions clarity enrichment
    'ALTER TABLE visitor_sessions ADD COLUMN had_rage_click INTEGER DEFAULT 0',
    'ALTER TABLE visitor_sessions ADD COLUMN had_dead_click INTEGER DEFAULT 0',
    'ALTER TABLE visitor_sessions ADD COLUMN scroll_depth REAL DEFAULT 0',
    'ALTER TABLE visitor_sessions ADD COLUMN clarity_session_id TEXT',
    "ALTER TABLE order_items ADD COLUMN marketplace TEXT DEFAULT 'shopify'",
    "ALTER TABLE order_items ADD COLUMN channel TEXT DEFAULT ''",
    /*
    'ALTER TABLE competitor_prices ADD COLUMN prev_price REAL',
    'ALTER TABLE competitor_prices ADD COLUMN price_change_pct REAL',
    'ALTER TABLE competitor_prices ADD COLUMN price_changed INTEGER DEFAULT 0',
    */
  ];
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_klaviyo_metrics_date ON klaviyo_metrics(date)`);
  } catch {}
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_klaviyo_metrics_name ON klaviyo_metrics(metric_name)`);
  } catch {}
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`);
  } catch {}
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_order_items_sku ON order_items(sku)`);
  } catch {}
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_order_items_date ON order_items(order_date)`);
  } catch {}
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_comp_date ON competitor_prices(date)`);
  } catch {}
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_comp_cat  ON competitor_prices(category)`);
  } catch {}
  for (const sql of migrationColumns) {
    try {
      db.exec(sql);
    } catch {
      /* column already exists */
    }
  }

  _db = db;
  return db;
}

module.exports = { initDb, DB_PATH };
