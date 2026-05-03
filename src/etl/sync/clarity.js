'use strict';

const { fetchClarityByChannel, fetchClarityByUrl } = require('../../connectors/clarity');
const chalk = require('chalk');

async function syncClarity(db) {
  if (!process.env.CLARITY_API_TOKEN) throw new Error('CLARITY_API_TOKEN niet ingesteld');

  const insertInsight = db.prepare(`
    INSERT OR REPLACE INTO clarity_insights
        (fetched_at, num_of_days, metric, dimension_key, dimension_value,
        sessions, subtotal, pages_views, sessions_with_pct, sessions_without_pct)
    VALUES
        (@fetched_at, @num_of_days, @metric, @dimension_key, @dimension_value,
        @sessions, @subtotal, @pages_views, @sessions_with_pct, @sessions_without_pct)
    `);

  const byChannel = await fetchClarityByChannel(3);
  if (byChannel.length > 0) {
    const upsertMany = db.transaction((rows) => {
      for (const r of rows) insertInsight.run(r);
    });
    upsertMany(byChannel);
    console.log(
      chalk.white(`  Clarity channel insights stored: ${chalk.bold(byChannel.length)} rows`),
    );
  }

  const byUrl = await fetchClarityByUrl(3);
  if (byUrl.length > 0) {
    const upsertMany = db.transaction((rows) => {
      for (const r of rows) insertInsight.run(r);
    });
    upsertMany(byUrl);
    console.log(chalk.white(`  Clarity URL insights stored: ${chalk.bold(byUrl.length)} rows`));
  }
}

module.exports = { syncClarity };
