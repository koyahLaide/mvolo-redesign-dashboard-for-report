'use strict';

require('dotenv').config();
const Database = require('better-sqlite3');
const { pool } = require('../db/db');
const path = require('path');
const chalk = require('chalk');

const SQLITE_DB_PATH = path.resolve(__dirname, '../../dashboard/data/mvolo.db');

async function migrate() {
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('  Mvolo — Master SQLite to Supabase Migration'));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  const sqlite = new Database(SQLITE_DB_PATH);
  const pg = await pool.connect();

  try {
    // 1. Core Data
    await migrateTable(sqlite, pg, 'orders', [
      'id',
      'order_number',
      'created_at',
      'total_price',
      'profit',
      'profit_margin',
      'cost_of_goods',
      'financial_status',
      'channel',
      'medium',
      'utm_source',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'landing_site',
      'referring_site',
      'source_name',
      'first_touch',
      'last_touch',
      'touch_path',
      'customer_email',
      'customer_id',
      'is_new_customer',
      'days_to_convert',
      'sessions_before_purchase',
      'marketplace',
      'direct_subchannel',
      'shipping_city',
      'shipping_country',
      'device_type',
      'browser_language',
      'synced_at',
    ]);

    await migrateTable(sqlite, pg, 'order_items', [
      'order_id',
      'sku',
      'title',
      'quantity',
      'price',
      'order_date',
      'marketplace',
      'channel',
    ]);

    // 2. Marketing & Spend
    await migrateTable(sqlite, pg, 'ad_spend', [
      'date',
      'channel',
      'campaign_name',
      'adset_name',
      'ad_name',
      'spend',
      'impressions',
      'clicks',
      'purchases',
      'currency',
    ]);

    await migrateTable(sqlite, pg, 'daily_metrics', [
      'date',
      'channel',
      'spend',
      'revenue',
      'profit',
      'orders',
      'new_customers',
      'roas',
      'poas',
      'cac',
    ]);

    // 3. Analytics (GA4, Clarity)
    await migrateTable(sqlite, pg, 'ga4_sessions', [
      'date',
      'channel',
      'sessions',
      'users',
      'new_users',
      'bounce_rate',
      'avg_session_duration',
    ]);

    await migrateTable(sqlite, pg, 'ga4_journeys', [
      'date',
      'first_channel',
      'session_channel',
      'sessions',
      'users',
    ]);

    await migrateTable(sqlite, pg, 'ga4_funnel', ['date', 'step', 'sessions', 'users']);

    await migrateTable(sqlite, pg, 'journey_meta', [
      'date',
      'channel',
      'campaign_name',
      'purchases_1d',
      'purchases_7d',
      'purchases_28d',
      'revenue_1d',
      'revenue_7d',
      'revenue_28d',
    ]);

    await migrateTable(sqlite, pg, 'clarity_insights', [
      'fetched_at',
      'num_of_days',
      'metric',
      'dimension_key',
      'dimension_value',
      'sessions',
      'subtotal',
      'pages_views',
      'sessions_with_pct',
      'sessions_without_pct',
    ]);

    await migrateTable(sqlite, pg, 'clarity_events', [
      'date',
      'page',
      'event_type',
      'count',
      'channel',
    ]);

    await migrateTable(sqlite, pg, 'visitor_sessions', [
      'visitor_id',
      'order_id',
      'session_count',
      'first_touch_date',
      'last_touch_date',
      'days_to_convert',
      'sessions_before_purchase',
      'touch_path',
      'created_at',
      'had_rage_click',
      'had_dead_click',
      'scroll_depth',
      'clarity_session_id',
    ]);

    // 4. CRM (Klaviyo)
    await migrateTable(sqlite, pg, 'klaviyo_campaigns', [
      'id',
      'name',
      'status',
      'sent_at',
      'subject',
      'synced_at',
    ]);

    await migrateTable(sqlite, pg, 'klaviyo_flows', [
      'id',
      'name',
      'status',
      'created',
      'trigger_type',
      'synced_at',
    ]);

    await migrateTable(sqlite, pg, 'klaviyo_metrics', [
      'metric_name',
      'metric_id',
      'date',
      'count',
      'revenue',
      'synced_at',
    ]);

    // 5. Operations & Others
    await migrateTable(sqlite, pg, 'competitor_prices', [
      'competitor',
      'product_name',
      'price',
      'compare_price',
      'category',
      'url',
      'date',
      'prev_price',
      'price_change_pct',
      'price_changed',
      'synced_at',
    ]);

    await migrateTable(sqlite, pg, 'bundle_pairs', [
      'sku_a',
      'sku_b',
      'samen_gekocht',
      'cross_sell_freq',
      'gem_dagen_cross',
      'updated_at',
    ]);

    await migrateTable(sqlite, pg, 'opex', [
      'category',
      'name',
      'amount',
      'frequency',
      'monthly_amount',
      'btw',
      'updated_at',
    ]);

    await migrateTable(sqlite, pg, 'exchange_rates', [
      'date',
      'base',
      'target',
      'rate',
      'synced_at',
    ]);

    await migrateTable(sqlite, pg, 'season_weights', [
      'month',
      'avg_orders',
      'avg_revenue',
      'weight',
      'updated_at',
    ]);

    /* 
    await migrateTable(sqlite, pg, 'sync_log', [
      'synced_at', 'orders_fetched', 'orders_new', 'status', 'error'
    ]);
    */

    console.log(chalk.green.bold('\n  ✔ Full Migration complete!\n'));
  } catch (err) {
    console.error(chalk.red('\n  Migration failed:'), err.message);
    process.exit(1);
  } finally {
    sqlite.close();
    pg.release();
    await pool.end();
  }
}

async function migrateTable(sqlite, pg, tableName, columns) {
  process.stdout.write(chalk.gray(`  Migrating ${tableName.padEnd(20)} ... `));

  let rows = sqlite.prepare(`SELECT * FROM "${tableName}"`).all();
  if (rows.length === 0) {
    console.log(chalk.yellow('Skipped (no data)'));
    return;
  }

  // Deduplicate and aggregate ad_spend (Collapses ~15,000 raw sync rows into ~600 unique ad-days)
  // This prevents double-counting spend in the dashboard if sync scripts were run multiple times.
  if (tableName === 'ad_spend') {
    const uniqueMap = new Map();
    for (const row of rows) {
      const key = `${row.date}|${row.channel}|${row.campaign_name}|${row.adset_name}|${row.ad_name}`;
      if (uniqueMap.has(key)) {
        const existing = uniqueMap.get(key);
        existing.spend += row.spend || 0;
        existing.impressions += row.impressions || 0;
        existing.clicks += row.clicks || 0;
        existing.purchases += row.purchases || 0;
      } else {
        uniqueMap.set(key, { ...row });
      }
    }
    rows = Array.from(uniqueMap.values());
  }

  // 1. Truncate table in Supabase
  await pg.query(`TRUNCATE TABLE "${tableName}" CASCADE`);

  // 2. Build the insert query
  const colNames = columns.map((c) => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    INSERT INTO "${tableName}" (${colNames})
    VALUES (${placeholders})
  `;

  await pg.query('BEGIN');
  try {
    for (const row of rows) {
      const values = columns.map((col) => {
        let val = row[col];
        // Convert SQLite 0/1 to PG booleans for specific columns
        const boolCols = ['is_new_customer', 'had_rage_click', 'had_dead_click', 'price_changed'];
        if (boolCols.includes(col)) {
          return val === null ? null : !!val;
        }
        return val;
      });
      await pg.query(query, values);
    }
    await pg.query('COMMIT');
    console.log(chalk.green(`Replaced with ${rows.length} rows`));
  } catch (err) {
    await pg.query('ROLLBACK');
    throw err;
  }
}

migrate();
