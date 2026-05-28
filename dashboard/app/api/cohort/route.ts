export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

export async function GET() {
  try {
    // 1. Terugkeer rate per kanaal
    const returnRateResult = await pool.query(`
      SELECT first_channel,
        COUNT(*) as eerste_orders,
        SUM(repeat_purchases) as herhaalaankopen,
        ROUND(AVG(repeat_purchases) * 100, 1) as herhaal_rate_pct,
        ROUND(AVG(avg_days_between), 0) as gem_dagen_tussen
      FROM (
        SELECT a.channel as first_channel,
          COUNT(b.id) as repeat_purchases,
          AVG(EXTRACT(EPOCH FROM (b.created_at - a.created_at)) / 86400) as avg_days_between
        FROM orders a
        LEFT JOIN orders b ON b.customer_id = a.customer_id
          AND b.created_at > a.created_at
          AND a.customer_id IS NOT NULL
        GROUP BY a.id, a.channel
      ) sub
      GROUP BY first_channel
      ORDER BY herhaalaankopen DESC
    `);
    const returnRate = returnRateResult.rows;

    // 2. LTV per eerste kanaal
    const ltvResult = await pool.query(`
      SELECT first_channel,
        COUNT(DISTINCT customer_id) as klanten,
        ROUND(AVG(ltv)::numeric, 2) as avg_ltv,
        ROUND(MAX(ltv)::numeric, 2) as max_ltv,
        SUM(total_orders) as total_orders,
        ROUND(AVG(total_orders)::numeric, 2) as avg_orders_per_klant
      FROM (
        SELECT customer_id,
          MIN(channel) as first_channel,
          COUNT(*) as total_orders,
          SUM(total_price) as ltv
        FROM orders
        WHERE customer_id IS NOT NULL
        GROUP BY customer_id
      ) sub
      GROUP BY first_channel
      ORDER BY avg_ltv DESC
    `);
    const ltvByChannel = ltvResult.rows;

    // 3. Winback kandidaten
    const winbackResult = await pool.query(`
      SELECT laatste_kanaal,
        COUNT(*) as klanten,
        ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - laatste_order)) / 86400), 0) as gem_dagen_geleden,
        ROUND(AVG(totaal_ltv)::numeric, 2) as avg_ltv,
        ROUND(SUM(totaal_ltv)::numeric, 2) as totale_ltv,
        SUM(aantal_orders) as total_orders
      FROM (
        SELECT customer_id,
          MAX(created_at) as laatste_order,
          MAX(channel) as laatste_kanaal,
          COUNT(*) as aantal_orders,
          SUM(total_price) as totaal_ltv
        FROM orders
        WHERE customer_id IS NOT NULL
        GROUP BY customer_id
        HAVING EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) / 86400 > 60
      ) sub
      GROUP BY laatste_kanaal
      ORDER BY klanten DESC
    `);
    const winback = winbackResult.rows;

    // 4. Repeat purchase window
    const windowResult = await pool.query(`
      SELECT
        CASE
          WHEN dagen < 30  THEN '0-30 dagen'
          WHEN dagen < 60  THEN '30-60 dagen'
          WHEN dagen < 90  THEN '60-90 dagen'
          WHEN dagen < 180 THEN '90-180 dagen'
          ELSE '180+ dagen'
        END as purchase_window,
        COUNT(*) as klanten
      FROM (
        SELECT a.customer_id,
          MIN(EXTRACT(EPOCH FROM (b.created_at - a.created_at)) / 86400) as dagen
        FROM orders a
        JOIN orders b ON b.customer_id = a.customer_id
          AND b.created_at > a.created_at
          AND a.customer_id IS NOT NULL
        GROUP BY a.customer_id
      ) sub
      GROUP BY purchase_window
      ORDER BY MIN(dagen)
    `);
    const purchaseWindow = windowResult.rows;

    // 5. Site bezoekers (Klaviyo metrics)
    const siteResult = await pool.query(`
      SELECT date,
        SUM(CASE WHEN metric_name='viewed_product'   THEN count ELSE 0 END) as product_views,
        SUM(CASE WHEN metric_name='ordered_product'  THEN count ELSE 0 END) as orders,
        SUM(CASE WHEN metric_name='checkout_started' THEN count ELSE 0 END) as checkouts,
        SUM(CASE WHEN metric_name='added_to_cart'    THEN count ELSE 0 END) as cart_adds
      FROM klaviyo_metrics
      WHERE metric_name IN ('viewed_product','ordered_product','checkout_started','added_to_cart')
        AND date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date ASC
    `);
    const siteJourney = siteResult.rows;

    // 6. Totaal winback waarde
    const winbackTotals = await pool.query(`
      SELECT
        COUNT(DISTINCT customer_id) as total_klanten,
        ROUND(SUM(totaal_ltv)::numeric, 2) as total_ltv,
        ROUND(AVG(totaal_ltv)::numeric, 2) as avg_ltv,
        ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - laatste_order)) / 86400), 0) as gem_dagen_inactief
      FROM (
        SELECT customer_id,
          MAX(created_at) as laatste_order,
          SUM(total_price) as totaal_ltv
        FROM orders
        WHERE customer_id IS NOT NULL
        GROUP BY customer_id
        HAVING EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) / 86400 > 60
      ) sub
    `);
    const winbackTotal = winbackTotals.rows[0] ?? null;

    // 7. Nieuwe klanten per maand
    const newByMonthResult = await pool.query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(CASE WHEN is_new_customer = true  THEN 1 END) as nieuw,
        COUNT(CASE WHEN is_new_customer = false THEN 1 END) as terugkerend
      FROM orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month ASC
    `);
    const newByMonth = newByMonthResult.rows;

    return NextResponse.json({
      returnRate, ltvByChannel, winback, winbackTotal,
      purchaseWindow, siteJourney, newByMonth,
    });

  } catch (err: any) {
    console.error('Cohort API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
