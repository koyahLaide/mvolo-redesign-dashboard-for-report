'use strict';

/**
 * sync-sessions.js
 *
 * Leest visitor session data van Google Sheet en merged in visitor_sessions tabel.
 * Draait als onderdeel van de GitHub Actions sync.
 *
 * Gebruik: node src/scripts/sync-sessions.js
 */

require('dotenv').config();
const { google }  = require('googleapis');
const chalk       = require('chalk');
const { initDb }  = require('../db/schema');

const SHEET_ID  = '1wKGs1Zfa912D-5jH3HUdPgeynP4hAYCdP4EwQsosf8g';
const TAB_NAME  = 'Sessions';

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GA4_CLIENT_EMAIL,
      private_key:  (process.env.GA4_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function syncSessions() {
  console.log(chalk.cyan('\n  [sessions] Syncing visitor sessions from Google Sheet...'));

  const db = initDb();

  // Zorg dat visitor_sessions tabel bestaat
  db.exec(`
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
      session_history          TEXT,
      received_at              TEXT,
      created_at               TEXT DEFAULT (datetime('now')),
      UNIQUE(visitor_id, order_id)
    )
  `);

  // Voeg session_history en received_at kolom toe als die nog niet bestaan
  for (const sql of [
    'ALTER TABLE visitor_sessions ADD COLUMN session_history TEXT',
    'ALTER TABLE visitor_sessions ADD COLUMN received_at TEXT',
  ]) {
    try { db.exec(sql); } catch { /* bestaat al */ }
  }

  // Lees Sheet
  const sheets = await getSheetsClient();
  let rows;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range:         `${TAB_NAME}!A:I`,
    });
    rows = res.data.values ?? [];
  } catch (err) {
    if (err.message.includes('Unable to parse range')) {
      console.log(chalk.gray('  [sessions] Tab bestaat nog niet — geen sessies om te synchen.'));
      return;
    }
    console.warn(chalk.yellow(`  [sessions] Sheet lezen mislukt: ${err.message}`));
    return;
  }

  if (rows.length <= 1) {
    console.log(chalk.gray('  [sessions] Geen sessie data gevonden in Sheet.'));
    return;
  }

  // Sla header over
  const dataRows = rows.slice(1);

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO visitor_sessions
      (visitor_id, order_id, session_count, first_touch_date, last_touch_date,
       days_to_convert, sessions_before_purchase, touch_path, session_history, received_at)
    VALUES
      (@visitor_id, @order_id, @session_count, @first_touch_date, @last_touch_date,
       @days_to_convert, @session_count, @touch_path, @session_history, @received_at)
  `);

  let inserted = 0;
  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      const [received_at, visitor_id, order_id, session_count,
             first_touch_date, last_touch_date, days_to_convert,
             touch_path, session_history] = row;

      if (!visitor_id) continue;

      upsert.run({
        visitor_id,
        order_id:         order_id || null,
        session_count:    parseInt(session_count) || 0,
        first_touch_date: first_touch_date || null,
        last_touch_date:  last_touch_date || null,
        days_to_convert:  parseFloat(days_to_convert) || 0,
        touch_path:       touch_path || null,
        session_history:  session_history || null,
        received_at:      received_at || null,
      });
      inserted++;
    }
  });

  insertMany(dataRows);
  console.log(chalk.green(`  [sessions] ${inserted} sessies gesyncet naar DB.`));
}

syncSessions().catch(err => {
  console.error(chalk.red(`  [sessions] Fatal: ${err.message}`));
  process.exit(1);
});
