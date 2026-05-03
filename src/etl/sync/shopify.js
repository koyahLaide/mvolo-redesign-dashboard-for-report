const { getLastSyncedAt, attributeOrder, checkIsNewCustomer, insertOrder } = require('../../schema/queries.js')
const { fetchOrders }    = require('../../connectors/shopify.js');
const chalk = require('chalk');



async function syncShopify(db) {
    const attributedOrders = [] 
    let ordersNew = 0
    // Determine start date for incremental sync
    const lastSync = getLastSyncedAt(db);
    if (lastSync) {
        console.log(chalk.gray(`  Last successful sync: ${lastSync}`));
        console.log(chalk.gray(`  Fetching orders created after that timestamp...\n`));
    } else {
        console.log(chalk.yellow('  No previous sync found — fetching all orders.\n'));
    }

    const shopifyOrders = await fetchOrders({ createdAtMin: lastSync || undefined });
    console.log(chalk.white(`  Orders fetched from Shopify: ${chalk.bold(shopifyOrders.length)}`));

    for (const order of shopifyOrders) {
        const attribution = attributeOrder(order);
        const isNewCustomer = checkIsNewCustomer(db, order.customer_email);
        const isNew = insertOrder(db, order, attribution, isNewCustomer);
        if (isNew) ordersNew++;
        attributedOrders.push({ ...order, ...attribution });
    }
    return ({length: shopifyOrders.length,
             attributedOrders: attributedOrders,
             ordersNew: ordersNew
    })
}

module.exports = { syncShopify }