'use strict';

const { getLastSyncedAt, checkIsNewCustomer, insertOrder } = require('../../db/queriesv2.js');
const { attributeOrder } = require('../attribution');

const { fetchOrders } = require('../../connectors/shopify.js');
const chalk = require('chalk');

async function syncShopify(pool) {
  const attributedOrders = [];
  let ordersNew = 0;
  // Determine start date for incremental sync
  const lastSync = await getLastSyncedAt(pool);
  if (lastSync) {
    console.log(chalk.gray(`  Last successful sync: ${lastSync}`));
    console.log(chalk.gray(`  Fetching orders created after that timestamp...\n`));
  } else {
    console.log(chalk.yellow('  No previous sync found — fetching all orders.\n'));
  }

  const orders = await fetchOrders({ createdAtMin: lastSync || undefined });
  console.log(chalk.white(`  Orders fetched from Shopify: ${chalk.bold(orders.length)}`));

  for (const order of orders) {
    const attribution = attributeOrder(order);
    const isNewCustomer = await checkIsNewCustomer(pool, order.customer_email);
    const isNew = await insertOrder(pool, order, attribution, isNewCustomer);
    if (isNew) ordersNew++;
    attributedOrders.push({ ...order, ...attribution });
  }
  return { length: orders.length, attributedOrders: attributedOrders, ordersNew: ordersNew };
}

module.exports = { syncShopify };
