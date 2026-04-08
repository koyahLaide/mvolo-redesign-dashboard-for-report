'use strict';
require('dotenv').config();
const { initDb } = require('../db/schema');
const db = initDb();

// 1. Seizoenspatroon per maand
console.log('=== OMZET PER MAAND (seizoenspatroon) ===');
const monthly = db.prepare(`
  SELECT strftime('%Y-%m', created_at) as month,
    COUNT(*) as orders,
    ROUND(SUM(total_price), 2) as revenue,
    ROUND(AVG(total_price), 2) as aov
  FROM orders
  GROUP BY month ORDER BY month
`).all();
console.table(monthly);

// 2. Bundle analyse - welke producten worden samen gekocht
console.log('\n=== PRODUCT COMBINATIES (samen gekocht) ===');
const bundles = db.prepare(`
  SELECT a.sku as sku_a, a.title as product_a,
    b.sku as sku_b, b.title as product_b,
    COUNT(*) as samen_gekocht
  FROM order_items a
  JOIN order_items b ON b.order_id = a.order_id 
    AND b.sku > a.sku
    AND a.sku != '' AND b.sku != ''
  GROUP BY a.sku, b.sku
  HAVING samen_gekocht >= 2
  ORDER BY samen_gekocht DESC
  LIMIT 20
`).all();
console.table(bundles);

// 3. Cross-sell window - wat kopen klanten als 2e product
console.log('\n=== CROSS-SELL PATRONEN (2e aankoop na eerste) ===');
const crossSell = db.prepare(`
  SELECT 
    oi1.sku as eerste_product,
    oi1.title as eerste_titel,
    oi2.sku as tweede_product, 
    oi2.title as tweede_titel,
    COUNT(*) as freq,
    ROUND(AVG(julianday(o2.created_at) - julianday(o1.created_at)), 0) as gem_dagen
  FROM orders o1
  JOIN order_items oi1 ON oi1.order_id = o1.id
  JOIN orders o2 ON o2.customer_id = o1.customer_id 
    AND o2.created_at > o1.created_at
    AND o1.customer_id IS NOT NULL
  JOIN order_items oi2 ON oi2.order_id = o2.id
  WHERE oi1.sku != '' AND oi2.sku != '' AND oi1.sku != oi2.sku
  GROUP BY oi1.sku, oi2.sku
  HAVING freq >= 1
  ORDER BY freq DESC
  LIMIT 20
`).all();
console.table(crossSell);

// 4. Meta ads orders - voor contribution margin berekening  
console.log('\n=== META ADS ORDERS SAMPLE ===');
const metaOrders = db.prepare(`
  SELECT o.id, o.total_price, o.utm_campaign, o.utm_content,
    GROUP_CONCAT(oi.sku) as skus,
    GROUP_CONCAT(oi.price) as prices
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.channel = 'meta_ads'
  GROUP BY o.id
  ORDER BY o.created_at DESC
  LIMIT 10
`).all();
console.table(metaOrders);
