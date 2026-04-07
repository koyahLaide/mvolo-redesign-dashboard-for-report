'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.resolve(__dirname, '../../data');
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

    CREATE TABLE IF NOT EXISTS klaviyo_flows (
      id           TEXT PRIMARY KEY,
      name         TEXT,
      status       TEXT,
      created      TEXT,
      trigger_type TEXT,
      synced_at    TEXT
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
  ];
  for (const sql of migrationColumns) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  _db = db;
  return db;
}

module.exports = { initDb, DB_PATH };
