'use strict';
const {
  fetchGA4Sessions,
  fetchGA4Journeys,
  fetchGA4PageFunnel,
  fetchGA4ClarityEvents,
} = require('../../connectors/ga4');
const chalk = require('chalk');

async function syncGa4(pool) {
  const ga4DateFrom = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  })();
  const ga4DateTo = new Date().toISOString().slice(0, 10);

  // Sessions per day × channel
  try {
    const ga4Sessions = await fetchGA4Sessions({ dateFrom: ga4DateFrom, dateTo: ga4DateTo });
    console.log(chalk.white(`  GA4 sessions fetched: ${chalk.bold(ga4Sessions.length)} rows`));

    const insertSessSql = `
        INSERT INTO ga4_sessions
        (date, channel, sessions, users, new_users, bounce_rate, avg_session_duration)
        VALUES
        ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (date, channel) DO UPDATE SET
        sessions = EXCLUDED.sessions,
        users = EXCLUDED.users,
        new_users = EXCLUDED.new_users,
        bounce_rate = EXCLUDED.bounce_rate,
        avg_session_duration = EXCLUDED.avg_session_duration
    `;
    if (ga4Sessions.length > 0) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM ga4_sessions WHERE date >= $1 AND date <= $2`, [
          ga4DateFrom,
          ga4DateTo,
        ]);
        for (const row of ga4Sessions) {
          await client.query(insertSessSql, [
            row.date,
            row.channel,
            row.sessions,
            row.users,
            row.newUsers,
            Math.round(row.bounceRate * 10000) / 10000,
            Math.round(row.avgSessionDuration * 100) / 100,
          ]);
        }
        await client.query('COMMIT');
        console.log(chalk.white(`  GA4 sessions stored: ${chalk.bold(ga4Sessions.length)} rows`));
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  } catch (err) {
    console.warn(chalk.yellow(`  GA4 sessions sync skipped: ${err.message}`));
  }

  // Journey: first-touch × session-channel
  try {
    const ga4Journeys = await fetchGA4Journeys({ dateFrom: ga4DateFrom, dateTo: ga4DateTo });
    console.log(chalk.white(`  GA4 journeys fetched: ${chalk.bold(ga4Journeys.length)} rows`));

    const insertJourneySql = `
        INSERT INTO ga4_journeys
        (date, first_channel, session_channel, sessions, users)
        VALUES
        ($1, $2, $3, $4, $5) ON CONFLICT (date, first_channel, session_channel) DO UPDATE SET
        sessions = EXCLUDED.sessions,
        users = EXCLUDED.users
    `;

    if (ga4Journeys.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM ga4_journeys WHERE date >= $1 AND date <= $2`, [
          ga4DateFrom,
          ga4DateTo,
        ]);

        for (const row of ga4Journeys) {
          await client.query(insertJourneySql, [
            row.date,
            row.first_channel,
            row.session_channel,
            row.sessions,
            row.users,
          ]);
        }
        await client.query('COMMIT');
        console.log(chalk.white(`  GA4 journeys stored: ${chalk.bold(ga4Journeys.length)} rows`));
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  } catch (err) {
    console.warn(chalk.yellow(`  GA4 journeys sync skipped: ${err.message}`));
  }

  // Funnel: page-level sessions per funnel step

  try {
    const ga4Funnels = await fetchGA4PageFunnel({ dateFrom: ga4DateFrom, dateTo: ga4DateTo });
    console.log(chalk.white(`  GA4 funnels fetched: ${chalk.bold(ga4Funnels.length)} rows`));

    const insertFunnelSql =
      'INSERT INTO ga4_funnel (date, step, sessions, users) VALUES ($1, $2, $3, $4) ON CONFLICT (date, step) DO UPDATE SET sessions = EXCLUDED.sessions, users = EXCLUDED.users';

    if (ga4Funnels.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM ga4_funnel WHERE date >= $1 AND date <= $2`, [
          ga4DateFrom,
          ga4DateTo,
        ]);
        for (const row of ga4Funnels) {
          await client.query(insertFunnelSql, [row.date, row.step, row.sessions, row.users]);
        }
        await client.query('COMMIT');
        console.log(chalk.white(`  GA4 funnel rows stored: ${chalk.bold(ga4Funnels.length)}`));
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  } catch (err) {
    console.warn(chalk.yellow(`  GA4 funnel sync skipped: ${err.message}`));
  }

  // Clarity events from GA4 (rage clicks, dead clicks)

  try {
    const ga4Clarities = await fetchGA4ClarityEvents({ dateFrom: ga4DateFrom, dateTo: ga4DateTo });
    console.log(chalk.white(`  GA4 clarities fetched: ${chalk.bold(ga4Clarities.length)} rows`));
    const insertClaritySql =
      'INSERT INTO clarity_events (date, page, event_type, count, channel) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (date, page, event_type) DO UPDATE SET count = EXCLUDED.count, channel = EXCLUDED.channel';
    if (ga4Clarities.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM clarity_events WHERE date >= $1 AND date <= $2`, [
          ga4DateFrom,
          ga4DateTo,
        ]);
        for (const row of ga4Clarities) {
          await client.query(insertClaritySql, [
            row.date,
            row.page,
            row.event_type,
            row.count,
            row.channel,
          ]);
        }
        await client.query('COMMIT');
        console.log(chalk.white(`  Clarity events stored: ${chalk.bold(ga4Clarities.length)} rows`));
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      await pool.query(
        `
        UPDATE visitor_sessions
        SET had_rage_click = TRUE
        WHERE order_id IN (
            SELECT o.id FROM orders o
            WHERE DATE(o.created_at) IN (
            SELECT DISTINCT date FROM clarity_events WHERE event_type = 'rage_click'
            )
        )
        `,
      );

      await pool.query(
        `
        UPDATE visitor_sessions
        SET had_dead_click = TRUE
        WHERE order_id IN (
            SELECT o.id FROM orders o
            WHERE DATE(o.created_at) IN (
            SELECT DISTINCT date FROM clarity_events WHERE event_type = 'dead_click'
            )
        )
        `,
      );
    }
  } catch (err) {
    console.warn(chalk.yellow(`  Clarity events sync skipped: ${err.message}`));
  }
}

module.exports = { syncGa4 };
