'use strict';

const chalk = require('chalk');
const { initDb } = require('../db/schema');
const { getLastSyncedAt, insertOrder, logSync, checkIsNewCustomer } = require('../db/queries');
const { fetchOrders }    = require('../connectors/shopify');
const { fetchBolOrders } = require('../connectors/bol');
const { fetchGA4Sessions, fetchGA4TopPages, fetchGA4Journeys, fetchGA4PageFunnel, fetchGA4ClarityEvents } = require('../connectors/ga4');
const { attributeOrder, summarizeAttribution } = require('./attribution');

/**
 * Runs a full ETL cycle:
 *  1. Fetch orders from Shopify (incremental if a previous sync exists)
 *  2. Attribute each order to a marketing channel
 *  3. Persist new orders to SQLite
 *  4. Log the result and print a formatted summary
 */
async function runSync() {
  const syncedAt = new Date().toISOString();
  const db = initDb();

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('  Mvolo Dashboard — Sync started'));
  console.log(chalk.cyan(`  ${new Date().toLocaleString()}`));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  let ordersFetched = 0;
  let ordersNew = 0;
  const attributedOrders = [];

  try {
    // Determine start date for incremental sync
    const lastSync = getLastSyncedAt(db);
    if (lastSync) {
      console.log(chalk.gray(`  Last successful sync: ${lastSync}`));
      console.log(chalk.gray(`  Fetching orders created after that timestamp...\n`));
    } else {
      console.log(chalk.yellow('  No previous sync found — fetching all orders.\n'));
    }

    // ── Shopify ────────────────────────────────────────────────────────────────
    const shopifyOrders = await fetchOrders({ createdAtMin: lastSync || undefined });
    ordersFetched += shopifyOrders.length;
    console.log(chalk.white(`  Orders fetched from Shopify: ${chalk.bold(shopifyOrders.length)}`));

    for (const order of shopifyOrders) {
      const attribution = attributeOrder(order);
      const isNewCustomer = checkIsNewCustomer(db, order.customer_email);
      const isNew = insertOrder(db, order, attribution, isNewCustomer);
      if (isNew) ordersNew++;
      attributedOrders.push({ ...order, ...attribution });
    }

    // ── Bol.com ────────────────────────────────────────────────────────────────
    let bolFetched = 0;
    let bolNew = 0;
    try {
      const bolOrders = await fetchBolOrders();
      bolFetched = bolOrders.length;
      console.log(chalk.white(`  Orders fetched from Bol.com: ${chalk.bold(bolFetched)}`));

      const bolAttribution = {
        channel:      'bol_marketplace',
        medium:       'marketplace',
        utm_source:   'bol',
        utm_campaign: null,
        utm_content:  null,
        utm_term:     null,
        first_touch:  'bol_marketplace',
        last_touch:   'bol_marketplace',
        touch_path:   JSON.stringify(['bol_marketplace']),
      };

      for (const order of bolOrders) {
        const isNew = insertOrder(db, order, bolAttribution, 1);
        if (isNew) { bolNew++; ordersNew++; }
        attributedOrders.push({ ...order, ...bolAttribution });
      }

      ordersFetched += bolFetched;
    } catch (err) {
      console.warn(chalk.yellow(`  Bol.com sync skipped: ${err.message}`));
    }

    // ── GA4 ───────────────────────────────────────────────────────────────────
    try {
      const ga4DateFrom = (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); })();
      const ga4DateTo   = new Date().toISOString().slice(0, 10);

      // Sessions per day × channel
      const ga4Sessions = await fetchGA4Sessions({ dateFrom: ga4DateFrom, dateTo: ga4DateTo });
      console.log(chalk.white(`  GA4 sessions fetched: ${chalk.bold(ga4Sessions.length)} rows`));

      if (ga4Sessions.length > 0) {
        db.prepare(`DELETE FROM ga4_sessions WHERE date >= ? AND date <= ?`).run(ga4DateFrom, ga4DateTo);
        const insertSess = db.prepare(`
          INSERT OR REPLACE INTO ga4_sessions
            (date, channel, sessions, users, new_users, bounce_rate, avg_session_duration)
          VALUES
            (@date, @channel, @sessions, @users, @new_users, @bounce_rate, @avg_session_duration)
        `);
        for (const row of ga4Sessions) {
          insertSess.run({
            date:                 row.date,
            channel:              row.channel,
            sessions:             row.sessions,
            users:                row.users,
            new_users:            row.newUsers,
            bounce_rate:          Math.round(row.bounceRate * 10000) / 10000,
            avg_session_duration: Math.round(row.avgSessionDuration * 100) / 100,
          });
        }
      }

      // Journey: first-touch × session-channel
      const ga4Journeys = await fetchGA4Journeys({ dateFrom: ga4DateFrom, dateTo: ga4DateTo });
      console.log(chalk.white(`  GA4 journeys fetched: ${chalk.bold(ga4Journeys.length)} rows`));

      if (ga4Journeys.length > 0) {
        db.prepare(`DELETE FROM ga4_journeys WHERE date >= ? AND date <= ?`).run(ga4DateFrom, ga4DateTo);
        const insertJourney = db.prepare(`
          INSERT OR REPLACE INTO ga4_journeys
            (date, first_channel, session_channel, sessions, users)
          VALUES
            (@date, @first_channel, @session_channel, @sessions, @users)
        `);
        for (const row of ga4Journeys) insertJourney.run(row);
      }

      // Funnel: page-level sessions per funnel step
      try {
        const funnelRows = await fetchGA4PageFunnel({ dateFrom: ga4DateFrom, dateTo: ga4DateTo });
        if (funnelRows.length > 0) {
          db.prepare(`DELETE FROM ga4_funnel WHERE date >= ? AND date <= ?`).run(ga4DateFrom, ga4DateTo);
          const insertFunnel = db.prepare(`
            INSERT OR REPLACE INTO ga4_funnel (date, step, sessions, users)
            VALUES (@date, @step, @sessions, @users)
          `);
          for (const row of funnelRows) insertFunnel.run(row);
          console.log(chalk.white(`  GA4 funnel rows stored: ${chalk.bold(funnelRows.length)}`));
        }
      } catch (err) {
        console.warn(chalk.yellow(`  GA4 funnel sync skipped: ${err.message}`));
      }

      // Clarity events from GA4 (rage clicks, dead clicks)
      try {
        const clarityRows = await fetchGA4ClarityEvents({ dateFrom: ga4DateFrom, dateTo: ga4DateTo });
        if (clarityRows.length > 0) {
          db.prepare(`DELETE FROM clarity_events WHERE date >= ? AND date <= ?`).run(ga4DateFrom, ga4DateTo);
          const insertClarity = db.prepare(`
            INSERT OR REPLACE INTO clarity_events (date, page, event_type, count, channel)
            VALUES (@date, @page, @event_type, @count, @channel)
          `);
          for (const row of clarityRows) insertClarity.run(row);
          console.log(chalk.white(`  Clarity events stored: ${chalk.bold(clarityRows.length)}`));

          // Mark visitor_sessions with rage/dead click flags based on date+channel match
          db.prepare(`
            UPDATE visitor_sessions
            SET had_rage_click = 1
            WHERE order_id IN (
              SELECT o.id FROM orders o
              WHERE DATE(o.created_at) IN (
                SELECT DISTINCT date FROM clarity_events WHERE event_type = 'rage_click'
              )
            )
          `).run();

          db.prepare(`
            UPDATE visitor_sessions
            SET had_dead_click = 1
            WHERE order_id IN (
              SELECT o.id FROM orders o
              WHERE DATE(o.created_at) IN (
                SELECT DISTINCT date FROM clarity_events WHERE event_type = 'dead_click'
              )
            )
          `).run();
        }
      } catch (err) {
        console.warn(chalk.yellow(`  Clarity events sync skipped: ${err.message}`));
      }

    } catch (err) {
      console.warn(chalk.yellow(`  GA4 sync skipped: ${err.message}`));
    }

    console.log('');

    // Summarise by channel
    const summary = summarizeAttribution(attributedOrders);

    // Log to sync_log
    logSync(db, { syncedAt, ordersFetched, ordersNew, status: 'success' });

    // ── Print summary ──────────────────────────────────────────────
    console.log(chalk.green.bold('  ✔ Sync complete\n'));
    console.log(chalk.white(`  ${'Total orders fetched'.padEnd(30)} ${chalk.bold(ordersFetched)}`));
    console.log(chalk.white(`  ${'New orders saved'.padEnd(30)} ${chalk.bold(ordersNew)}`));
    console.log(chalk.white(`  ${'Already in DB (skipped)'.padEnd(30)} ${chalk.bold(ordersFetched - ordersNew)}\n`));

    if (Object.keys(summary).length > 0) {
      console.log(chalk.white.bold('  Channel breakdown:'));
      const total = attributedOrders.length || 1;

      const channelColors = {
        meta_ads:       chalk.magenta,
        google_search:  chalk.blue,
        google_shopping: chalk.cyan,
        awin_affiliate: chalk.yellow,
        email:          chalk.green,
        organic_search: chalk.greenBright,
        organic_social: chalk.magentaBright,
        direct:         chalk.white,
        other:          chalk.gray,
      };

      for (const [channel, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
        const pct = ((count / total) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(count / total * 20));
        const color = channelColors[channel] || chalk.white;
        console.log(
          `  ${color(channel.padEnd(20))}  ${String(count).padStart(4)} orders  ${chalk.gray(pct.padStart(5) + '%')}  ${color(bar)}`
        );
      }
    }

    console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  } catch (err) {
    logSync(db, { syncedAt, ordersFetched, ordersNew, status: 'error', error: err.message });
    console.error(chalk.red(`\n  ✖ Sync failed: ${err.message}\n`));
    throw err;
  }
}

module.exports = { runSync };
