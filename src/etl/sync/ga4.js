'use strict';
const { fetchGA4Sessions, fetchGA4Journeys, fetchGA4PageFunnel, fetchGA4ClarityEvents } = require('../../connectors/ga4');
const chalk = require('chalk');

async function syncGa4(db) {
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

}

module.exports = { syncGa4 };