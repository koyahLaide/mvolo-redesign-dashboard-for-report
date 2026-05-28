'use strict';

const { fetchMetaSpend } = require('../../connectors/meta-ads');

async function syncMeta({ from, to } = {}) {
  let metaRows = await fetchMetaSpend({ dateFrom: from, dateTo: to });
  return metaRows;
}

module.exports = { syncMeta };
