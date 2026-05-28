'use strict';

const { enrichFromProfitMetrics } = require('../../connectors/profitmetrics');

async function syncProfitMetrics({ db, from, to } = {}) {
  const pmResult = await enrichFromProfitMetrics(db, { dateFrom: from, dateTo: to });
  return { processed: pmResult.processed, enriched: pmResult.enriched };
}

module.exports = { syncProfitMetrics };
