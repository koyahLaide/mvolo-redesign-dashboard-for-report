'use strict';

const { fetchOrders } = require('../../connectors/bol.js');
const { insertOrder } = require('../../db/queriesv2.js');
const chalk = require('chalk');

async function syncBol(pool) {
  const orders = await fetchOrders();
  console.log(chalk.white(`  Orders fetched from Bol.com: ${chalk.bold(orders.length)}`));
  let ordersNew = 0;
  const attributedOrders = [];
  const bolAttribution = {
    channel: 'bol_marketplace',
    medium: 'marketplace',
    utm_source: 'bol',
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    first_touch: 'bol_marketplace',
    last_touch: 'bol_marketplace',
    touch_path: JSON.stringify(['bol_marketplace']),
  };

  for (const order of orders) {
    const isNew = insertOrder(pool, order, bolAttribution, 1);
    if (isNew) ordersNew++;
    attributedOrders.push({ ...order, ...bolAttribution });
  }

  return { length: orders.length, attributedOrders: attributedOrders, ordersNew: ordersNew };
}

module.exports = { syncBol };
