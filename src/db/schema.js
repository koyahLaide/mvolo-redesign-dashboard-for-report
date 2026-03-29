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

  _db = db;
  return db;
}

module.exports = { initDb, DB_PATH };
