'use strict';

require('dotenv').config();
const Database = require('better-sqlite3');
const { pool } = require('../db/db');
const path = require('path');
const chalk = require('chalk');

const SQLITE_DB_PATH = path.resolve(__dirname, '../../data/mvolo.db');

async function migrate() {
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('  Mvolo — SQLite to Supabase Migration'));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  const sqlite = new Database(SQLITE_DB_PATH);
  const pg = await pool.connect();

  try {
    // 1. Migrate Orders
    await migrateTable(sqlite, pg, 'orders', [
      'id', 'order_number', 'created_at', 'total_price', 'profit', 'profit_margin',
      'cost_of_goods', 'financial_status', 'channel', 'medium', 'utm_source',
      'utm_campaign', 'utm_content', 'utm_term', 'landing_site', 'referring_site',
      'source_name', 'first_touch', 'last_touch', 'touch_path', 'customer_email',
      'customer_id', 'is_new_customer', 'days_to_convert', 'sessions_before_purchase',
      'marketplace', 'direct_subchannel', 'shipping_city', 'shipping_country',
      'device_type', 'browser_language', 'synced_at'
    ]);

    // 2. Migrate Order Items
    await migrateTable(sqlite, pg, 'order_items', [
      'order_id', 'sku', 'title', 'quantity', 'price', 'order_date', 'marketplace', 'channel'
    ]);

    // 3. Migrate Ad Spend
    await migrateTable(sqlite, pg, 'ad_spend', [
      'date', 'channel', 'campaign_name', 'adset_name', 'ad_name', 'spend',
      'impressions', 'clicks', 'purchases', 'currency'
    ]);

    // 4. Migrate GA4 Sessions
    await migrateTable(sqlite, pg, 'ga4_sessions', [
      'date', 'channel', 'sessions', 'users', 'new_users', 'bounce_rate', 'avg_session_duration'
    ]);

    // 5. Migrate GA4 Journeys
    await migrateTable(sqlite, pg, 'ga4_journeys', [
      'date', 'first_channel', 'session_channel', 'sessions', 'users'
    ]);

    // 6. Migrate Klaviyo Campaigns
    await migrateTable(sqlite, pg, 'klaviyo_campaigns', [
      'id', 'name', 'status', 'sent_at', 'subject', 'synced_at'
    ]);

    // 7. Migrate Klaviyo Flows
    await migrateTable(sqlite, pg, 'klaviyo_flows', [
      'id', 'name', 'status', 'created', 'trigger_type', 'synced_at'
    ]);

    console.log(chalk.green.bold('\n  ✔ Migration complete!\n'));

  } catch (err) {
    console.error(chalk.red(`\n  ✖ Migration failed: ${err.message}`));
  } finally {
    sqlite.close();
    pg.release();
    await pool.end();
  }
}

async function migrateTable(sqlite, pg, tableName, columns) {
  process.stdout.write(chalk.gray(`  Migrating ${tableName.padEnd(20)} ... `));
  
  const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
  if (rows.length === 0) {
    console.log(chalk.yellow('Skipped (no data)'));
    return;
  }

  // Build the bulk insert query
  const colNames = columns.join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    INSERT INTO ${tableName} (${colNames})
    VALUES (${placeholders})
    ON CONFLICT DO NOTHING
  `;

  // Use a transaction for speed
  await pg.query('BEGIN');
  try {
    for (const row of rows) {
      const values = columns.map(col => {
        let val = row[col];
        // SQLite booleans are 0/1, PG expects boolean
        if (col === 'is_new_customer' || col === 'had_rage_click' || col === 'had_dead_click') {
          return !!val;
        }
        return val;
      });
      await pg.query(query, values);
    }
    await pg.query('COMMIT');
    console.log(chalk.green(`${rows.length} rows`));
  } catch (err) {
    await pg.query('ROLLBACK');
    throw err;
  }
}

migrate();
