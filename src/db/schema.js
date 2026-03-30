'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

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

  const db = new DatabaseSync(DB_PATH);

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
  ];
  for (const sql of migrationColumns) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  _db = db;
  return db;
}

module.exports = { initDb, DB_PATH };
