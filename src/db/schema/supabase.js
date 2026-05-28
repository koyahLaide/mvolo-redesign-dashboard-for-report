'use strict';

const orders = require('./orders');
const marketing = require('./marketing');
const analytics = require('./analytics');
const integrations = require('./integrations');
const system = require('./system');

// Combines all modular SQL strings into one migration script
module.exports = [
  orders,
  marketing,
  analytics,
  integrations,
  system
].join('\n');