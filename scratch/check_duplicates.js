const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/mvolo.db');
const db = new Database(dbPath);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Mvolo Dashboard — Duplicate Check');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 1. Check for duplicate order_number within the same marketplace
console.log('1. Checking for duplicate order_number within same marketplace...');
const dupsInMarketplace = db.prepare(`
    SELECT order_number, marketplace, COUNT(*) as count
    FROM orders
    GROUP BY order_number, marketplace
    HAVING count > 1
`).all();

if (dupsInMarketplace.length === 0) {
    console.log('   ✅ No duplicates found within same marketplace.\n');
} else {
    console.log(`   ❌ Found ${dupsInMarketplace.length} duplicate order_numbers within same marketplace:`);
    console.table(dupsInMarketplace);
}

// 2. Check for duplicate order_number across different marketplaces (could be valid, but good to know)
console.log('2. Checking for order_number appearing in multiple marketplaces...');
const crossMarketplace = db.prepare(`
    SELECT order_number, COUNT(DISTINCT marketplace) as marketplace_count, GROUP_CONCAT(DISTINCT marketplace) as marketplaces
    FROM orders
    GROUP BY order_number
    HAVING marketplace_count > 1
`).all();

if (crossMarketplace.length === 0) {
    console.log('   ✅ No order_numbers found in multiple marketplaces.\n');
} else {
    console.log(`   ℹ️ Found ${crossMarketplace.length} order_numbers in multiple marketplaces:`);
    console.table(crossMarketplace);
}

// 3. Check for identical orders (same number, date, price, but different IDs)
console.log('3. Checking for identical order content (number, date, price) with different IDs...');
const identicalContent = db.prepare(`
    SELECT order_number, created_at, total_price, COUNT(*) as count
    FROM orders
    GROUP BY order_number, created_at, total_price
    HAVING count > 1
`).all();

if (identicalContent.length === 0) {
    console.log('   ✅ No identical order content found.\n');
} else {
    console.log(`   ❌ Found ${identicalContent.length} sets of orders with identical content:`);
    console.table(identicalContent);
}

// 4. Check for duplicate order items (same order_id and sku)
console.log('4. Checking for duplicate order items (order_id + sku)...');
const itemDups = db.prepare(`
    SELECT order_id, sku, COUNT(*) as count
    FROM order_items
    GROUP BY order_id, sku
    HAVING count > 1
`).all();

if (itemDups.length === 0) {
    console.log('   ✅ No duplicate order items found.\n');
} else {
    console.log(`   ❌ Found ${itemDups.length} duplicate order items:`);
    console.table(itemDups);
}

// 5. Summary of counts
console.log('5. General Stats:');
const stats = db.prepare(`
    SELECT 
        (SELECT COUNT(*) FROM orders) as total_orders,
        (SELECT COUNT(DISTINCT order_number) FROM orders) as unique_order_numbers,
        (SELECT COUNT(*) FROM order_items) as total_items
    FROM orders LIMIT 1
`).get();

console.log(`   Total orders:         ${stats.total_orders}`);
console.log(`   Unique order numbers: ${stats.unique_order_numbers}`);
console.log(`   Total order items:    ${stats.total_items}`);

if (stats.total_orders > stats.unique_order_numbers) {
    console.log(`   ℹ️ Note: There are ${stats.total_orders - stats.unique_order_numbers} more rows than unique order numbers.`);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
