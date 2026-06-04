const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, '../data/mvolo.db');
const db = new Database(dbPath);

console.log('\n--- FINDING DUPLICATE ORDER NUMBERS ---');
const duplicates = db.prepare(`
  SELECT order_number, COUNT(*) as count, GROUP_CONCAT(id) as ids
  FROM orders
  WHERE order_number IS NOT NULL AND order_number != ''
  GROUP BY order_number
  HAVING count > 1
`).all();

if (duplicates.length === 0) {
  console.log('No duplicates found by order_number.');
} else {
  console.log(`Found ${duplicates.length} duplicate order numbers.`);
  console.log(JSON.stringify(duplicates.slice(0, 5), null, 2));
}

console.log('\n--- FINDING DUPLICATE IDs (SHOULD BE 0) ---');
const duplicateIds = db.prepare(`
  SELECT id, COUNT(*) as count
  FROM orders
  GROUP BY id
  HAVING count > 1
`).all();
console.log(`Duplicate IDs: ${duplicateIds.length}`);
