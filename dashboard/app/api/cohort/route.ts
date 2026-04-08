export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { DB_PATH } from '../../../lib/db-path';

function rowsToObjects(result: any) {
  if (!result || !result.columns) return [];
  return result.values.map((row: any[]) =>
    Object.fromEntries(result.columns.map((col: string, i: number) => [col, row[i]]))
  );
}

export async function GET() {
  try {
    const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const db = new SQL.Database(fs.readFileSync(DB_PATH));

    // ── 1. Terugkeer rate per kanaal ─────────────────────────────────────────
    const returnRateResult = db.exec(`
      SELECT first_channel,
        COUNT(*) as eerste_orders,
        SUM(repeat_purchases) as herhaalaankopen,
        ROUND(AVG(repeat_purchases) * 100, 1) as herhaal_rate_pct,
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
    `);
    const returnRate = returnRateResult.length ? rowsToObjects(returnRateResult[0]) : [];

    // ── 2. LTV per eerste kanaal ──────────────────────────────────────────────
    const ltvResult = db.exec(`
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
    `);
    const ltvByChannel = ltvResult.length ? rowsToObjects(ltvResult[0]) : [];

    // ── 3. Winback kandidaten ─────────────────────────────────────────────────
    const winbackResult = db.exec(`
      SELECT laatste_kanaal,
        COUNT(*) as klanten,
        ROUND(AVG(julianday('now') - julianday(laatste_order)), 0) as gem_dagen_geleden,
        ROUND(AVG(totaal_ltv), 2) as avg_ltv,
        ROUND(SUM(totaal_ltv), 2) as totale_ltv,
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
        HAVING julianday('now') - julianday(MAX(created_at)) > 60
      )
      GROUP BY laatste_kanaal
      ORDER BY klanten DESC
    `);
    const winback = winbackResult.length ? rowsToObjects(winbackResult[0]) : [];

    // ── 4. Repeat purchase window ─────────────────────────────────────────────
    const windowResult = db.exec(`
      SELECT
        CASE
          WHEN dagen < 30  THEN '0-30 dagen'
          WHEN dagen < 60  THEN '30-60 dagen'
          WHEN dagen < 90  THEN '60-90 dagen'
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
    `);
    const purchaseWindow = windowResult.length ? rowsToObjects(windowResult[0]) : [];

    // ── 5. Site bezoekers zonder aankoop (Klaviyo) ────────────────────────────
    const siteResult = db.exec(`
      SELECT date,
        SUM(CASE WHEN metric_name='viewed_product'   THEN count ELSE 0 END) as product_views,
        SUM(CASE WHEN metric_name='ordered_product'  THEN count ELSE 0 END) as orders,
        SUM(CASE WHEN metric_name='checkout_started' THEN count ELSE 0 END) as checkouts,
        SUM(CASE WHEN metric_name='added_to_cart'    THEN count ELSE 0 END) as cart_adds
      FROM klaviyo_metrics
      WHERE metric_name IN ('viewed_product','ordered_product','checkout_started','added_to_cart')
        AND date >= date('now', '-30 days')
      GROUP BY date
      ORDER BY date ASC
    `);
    const siteJourney = siteResult.length ? rowsToObjects(siteResult[0]) : [];

    // ── 6. Totaal winback waarde ──────────────────────────────────────────────
    const winbackTotals = db.exec(`
      SELECT
        COUNT(DISTINCT customer_id) as total_klanten,
        ROUND(SUM(totaal_ltv), 2) as total_ltv,
        ROUND(AVG(totaal_ltv), 2) as avg_ltv,
        ROUND(AVG(julianday('now') - julianday(laatste_order)), 0) as gem_dagen_inactief
      FROM (
        SELECT customer_id,
          MAX(created_at) as laatste_order,
          SUM(total_price) as totaal_ltv
        FROM orders
        WHERE customer_id IS NOT NULL
        GROUP BY customer_id
        HAVING julianday('now') - julianday(MAX(created_at)) > 60
      )
    `);
    const winbackTotal = winbackTotals.length ? rowsToObjects(winbackTotals[0])[0] : null;

    // ── 7. Nieuwe klanten per maand ───────────────────────────────────────────
    const newByMonthResult = db.exec(`
      SELECT strftime('%Y-%m', created_at) as month,
        COUNT(CASE WHEN is_new_customer = 1 THEN 1 END) as nieuw,
        COUNT(CASE WHEN is_new_customer = 0 THEN 1 END) as terugkerend
      FROM orders
      WHERE created_at >= date('now', '-12 months')
      GROUP BY month
      ORDER BY month ASC
    `);
    const newByMonth = newByMonthResult.length ? rowsToObjects(newByMonthResult[0]) : [];

    db.close();

    return NextResponse.json({
      returnRate,
      ltvByChannel,
      winback,
      winbackTotal,
      purchaseWindow,
      siteJourney,
      newByMonth,
    });

  } catch (err: any) {
    console.error('Cohort API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
