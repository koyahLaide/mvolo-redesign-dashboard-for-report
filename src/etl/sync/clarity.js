'use strict';

const { fetchClarityByChannel, fetchClarityByUrl } = require('../../connectors/clarity');
const chalk = require('chalk');

async function syncClarity(pool) {
  if (!process.env.CLARITY_API_TOKEN) throw new Error('CLARITY_API_TOKEN niet ingesteld');

  const insertInsightSql = `
  INSERT INTO clarity_insights (
    fetched_at, num_of_days, metric, dimension_key, dimension_value,
    sessions, subtotal, pages_views, sessions_with_pct, sessions_without_pct
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  ON CONFLICT (fetched_at, metric, dimension_key, dimension_value) DO UPDATE SET
    num_of_days          = EXCLUDED.num_of_days,
    sessions             = EXCLUDED.sessions,
    subtotal             = EXCLUDED.subtotal,
    pages_views          = EXCLUDED.pages_views,
    sessions_with_pct    = EXCLUDED.sessions_with_pct,
    sessions_without_pct = EXCLUDED.sessions_without_pct
`;

  const byChannel = await fetchClarityByChannel(3);
  if (byChannel.length > 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of byChannel) {
        await client.query(insertInsightSql, [
          r.fetched_at,
          r.num_of_days,
          r.metric,
          r.dimension_key,
          r.dimension_value,
          r.sessions,
          r.subtotal,
          r.pages_views,
          r.sessions_with_pct,
          r.sessions_without_pct,
        ]);
      }
      await client.query('COMMIT');
      console.log(
        chalk.white(`  Clarity channel insights stored: ${chalk.bold(byChannel.length)} rows`),
      );
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  const byUrl = await fetchClarityByUrl(3);
  if (byUrl.length > 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of byUrl) {
        await client.query(insertInsightSql, [
          r.fetched_at,
          r.num_of_days,
          r.metric,
          r.dimension_key,
          r.dimension_value,
          r.sessions,
          r.subtotal,
          r.pages_views,
          r.sessions_with_pct,
          r.sessions_without_pct,
        ]);
      }
      await client.query('COMMIT');
      console.log(chalk.white(`  Clarity URL insights stored: ${chalk.bold(byUrl.length)} rows`));
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = { syncClarity };
