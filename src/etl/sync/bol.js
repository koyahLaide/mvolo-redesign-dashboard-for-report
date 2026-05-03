const { fetchOrders }    = require('../../connectors/bol.js');
const { insertOrder } = require('../../schema/queries.js')
const { initDb } = require('../db/schema');
db = initDb()

async function syncBol() {
    const bolOrders = await fetchBolOrders();
    console.log(chalk.white(`  Orders fetched from Bol.com: ${chalk.bold(bolFetched)}`));

    const bolAttribution = {
    channel:      'bol_marketplace',
    medium:       'marketplace',
    utm_source:   'bol',
    utm_campaign: null,
    utm_content:  null,
    utm_term:     null,
    first_touch:  'bol_marketplace',
    last_touch:   'bol_marketplace',
    touch_path:   JSON.stringify(['bol_marketplace']),
    };

    for (const order of bolOrders) {
    const isNew = insertOrder(db, order, bolAttribution, 1);
    if (isNew) { bolNew++; ordersNew++; }
    attributedOrders.push({ ...order, ...bolAttribution });
    }

    return bolOrders.length
} 