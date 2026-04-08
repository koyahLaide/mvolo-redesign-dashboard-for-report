'use strict';
require('dotenv').config();
const { initDb } = require('../db/schema');
const db = initDb();

// 1. Terugkeer rate per kanaal
console.log('=== TERUGKEER RATE PER KANAAL ===');
const returnRate = db.prepare(`
  SELECT 
    first_channel,
    COUNT(*) as eerste_orders,
    SUM(repeat_purchases) as herhaalaankopen,
    ROUND(AVG(repeat_purchases), 2) as gem_herhaalaankopen,
    ROUND(AVG(avg_days_between), 0) as gem_dagen_tussen
  FROM (
    SELECT a.channel as first_channel,
      COUNT(b.id) as repeat_purchases,
      AVG(julianday(b.created_at) - julianday(a.created_at)) as avg_days_between
    FROM orders a
    LEFT JOIN orders b ON b.customer_id = a.customer_id 
      AND b.created_at > a.created_at
      AND a.customer_id IS NOT NULL
    GROUP BY a.id, a.channel
  )
  GROUP BY first_channel
  ORDER BY herhaalaankopen DESC
`).all();
console.table(returnRate);

// 2. LTV per eerste kanaal
console.log('\n=== LTV PER EERSTE KANAAL ===');
const ltv = db.prepare(`
  SELECT first_channel,
    COUNT(DISTINCT customer_id) as klanten,
    ROUND(AVG(ltv), 2) as avg_ltv,
    ROUND(MAX(ltv), 2) as max_ltv,
    SUM(total_orders) as total_orders,
    ROUND(AVG(total_orders), 2) as avg_orders_per_klant
  FROM (
    SELECT customer_id,
      MIN(channel) as first_channel,
      COUNT(*) as total_orders,
      SUM(total_price) as ltv
    FROM orders
    WHERE customer_id IS NOT NULL
    GROUP BY customer_id
  )
  GROUP BY first_channel
  ORDER BY avg_ltv DESC
`).all();
console.table(ltv);

// 3. Winback kandidaten - klanten die lang niet hebben gekocht
console.log('\n=== WINBACK KANDIDATEN (>60 dagen geen aankoop) ===');
const winback = db.prepare(`
  SELECT 
    channel as laatste_kanaal,
    COUNT(*) as klanten,
    ROUND(AVG(julianday('now') - julianday(laatste_order)), 0) as gem_dagen_geleden,
    ROUND(AVG(totaal_ltv), 2) as avg_ltv,
    ROUND(SUM(totaal_ltv), 2) as totale_ltv
  FROM (
    SELECT customer_id,
      MAX(created_at) as laatste_order,
      MAX(channel) as channel,
      COUNT(*) as aantal_orders,
      SUM(total_price) as totaal_ltv
    FROM orders
    WHERE customer_id IS NOT NULL
    GROUP BY customer_id
    HAVING julianday('now') - julianday(MAX(created_at)) > 60
  )
  GROUP BY channel
  ORDER BY klanten DESC
`).all();
console.table(winback);

// 4. Klanten die terugkomen op site (viewed_product) maar niet kopen
console.log('\n=== SITE BEZOEKERS ZONDER AANKOOP (Klaviyo viewed_product trend) ===');
const siteNoOrder = db.prepare(`
  SELECT date,
    SUM(CASE WHEN metric_name='viewed_product' THEN count ELSE 0 END) as product_views,
    SUM(CASE WHEN metric_name='ordered_product' THEN count ELSE 0 END) as orders,
    SUM(CASE WHEN metric_name='checkout_started' THEN count ELSE 0 END) as checkouts
  FROM klaviyo_metrics
  WHERE metric_name IN ('viewed_product','ordered_product','checkout_started')
  AND date >= date('now', '-30 days')
  GROUP BY date
  ORDER BY product_views DESC
  LIMIT 10
`).all();
console.table(siteNoOrder);

// 5. Repeat purchase window analyse
console.log('\n=== HOEVEEL DAGEN TUSSEN EERSTE EN TWEEDE AANKOOP ===');
const purchaseWindow = db.prepare(`
  SELECT 
    CASE 
      WHEN dagen < 30 THEN '0-30 dagen'
      WHEN dagen < 60 THEN '30-60 dagen'
      WHEN dagen < 90 THEN '60-90 dagen'
      WHEN dagen < 180 THEN '90-180 dagen'
      ELSE '180+ dagen'
    END as window,
    COUNT(*) as klanten
  FROM (
    SELECT a.customer_id,
      MIN(julianday(b.created_at) - julianday(a.created_at)) as dagen
    FROM orders a
    JOIN orders b ON b.customer_id = a.customer_id 
      AND b.created_at > a.created_at
      AND a.customer_id IS NOT NULL
    GROUP BY a.customer_id
  )
  GROUP BY window
  ORDER BY MIN(dagen)
`).all();
console.table(purchaseWindow);
