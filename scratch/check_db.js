const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, '../data/mvolo.db');
const db = new Database(dbPath);

console.log('\n--- LAST 5 SYNC LOGS ---');
const logs = db.prepare('SELECT * FROM sync_log ORDER BY id DESC LIMIT 5').all();
console.log(JSON.stringify(logs, null, 2));

console.log('\n--- ORDER COUNTS ---');
const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
const shopifyOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE marketplace = 'shopify' OR marketplace IS NULL").get().count;
const bolOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE marketplace = 'bol'").get().count;

console.log(`Total orders:    ${totalOrders}`);
console.log(`Shopify orders:  ${shopifyOrders}`);
console.log(`Bol.com orders:  ${bolOrders}`);

console.log('\n--- RECENT ORDERS ---');
const orders = db.prepare('SELECT id, order_number, created_at, marketplace FROM orders ORDER BY created_at DESC LIMIT 5').all();
console.log(JSON.stringify(orders, null, 2));
