'use strict';

const { fetchGoogleSpend } = require('../../connectors/google-ads');

async function syncGoogle({ from, to } = {}) {
  let googleRows = await fetchGoogleSpend({ dateFrom: from, dateTo: to });
  return googleRows;
}

module.exports = { syncGoogle };
