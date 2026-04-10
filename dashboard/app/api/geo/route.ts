export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { DB_PATH } from '../../../lib/db-path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? 'all';

  const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  try {
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    const dateFilter = period === 'all'
      ? ''
      : `AND DATE(created_at) >= DATE('now', '-${parseInt(period)} days')`;

    const citiesResult = db.exec(`
      SELECT
        shipping_city    AS city,
        shipping_country AS country,
        COUNT(*)         AS orders,
        SUM(total_price) AS revenue,
        AVG(total_price) AS avg_order_value
      FROM orders
      WHERE shipping_city IS NOT NULL
        ${dateFilter}
      GROUP BY shipping_city, shipping_country
      ORDER BY orders DESC
      LIMIT 100
    `);

    const countriesResult = db.exec(`
      SELECT
        shipping_country AS country,
        COUNT(*)         AS orders,
        SUM(total_price) AS revenue
      FROM orders
      WHERE shipping_country IS NOT NULL
        ${dateFilter}
      GROUP BY shipping_country
      ORDER BY orders DESC
    `);

    const totalsResult = db.exec(`
      SELECT
        COUNT(*) AS total_orders,
        COUNT(shipping_city) AS orders_with_city,
        SUM(total_price) AS total_revenue
      FROM orders
      WHERE 1=1 ${dateFilter}
    `);

    // ── Visitor sessions per land ─────────────────────────────────────────────
    const visitorGeoResult = db.exec(`
      SELECT o.shipping_country as country,
        COUNT(DISTINCT vs.visitor_id) as visitors,
        COUNT(DISTINCT o.id) as orders,
        ROUND(AVG(vs.session_count), 1) as avg_sessions,
        ROUND(AVG(vs.sessions_before_purchase), 1) as avg_sessions_before_purchase,
        SUM(vs.had_rage_click) as rage_clicks,
        SUM(vs.had_dead_click) as dead_clicks
      FROM visitor_sessions vs
      JOIN orders o ON o.id = vs.order_id
      WHERE o.shipping_country IS NOT NULL
      GROUP BY o.shipping_country
      ORDER BY visitors DESC
    `);

    // ── Visitor sessie statistieken ────────────────────────────────────────────
    const sessionStatsResult = db.exec(`
      SELECT
        COUNT(*) as total_sessions,
        COUNT(DISTINCT visitor_id) as unique_visitors,
        ROUND(AVG(session_count), 1) as avg_sessions,
        ROUND(AVG(sessions_before_purchase), 1) as avg_sessions_before_purchase,
        MAX(session_count) as max_sessions,
        SUM(had_rage_click) as total_rage_clicks,
        SUM(had_dead_click) as total_dead_clicks
      FROM visitor_sessions
    `);

    // ── Terugkeer verdeling ────────────────────────────────────────────────────
    const returnVisitsResult = db.exec(`
      SELECT
        CASE
          WHEN session_count = 1 THEN '1 sessie'
          WHEN session_count = 2 THEN '2 sessies'
          WHEN session_count = 3 THEN '3 sessies'
          WHEN session_count <= 5 THEN '4-5 sessies'
          ELSE '6+ sessies'
        END as bucket,
        COUNT(*) as visitors
      FROM visitor_sessions
      GROUP BY bucket
      ORDER BY MIN(session_count)
    `);

    db.close();

    function rowsToObjects(result: any) {
      if (!result || !result.columns) return [];
      return result.values.map((row: any[]) =>
        Object.fromEntries(result.columns.map((col: string, i: number) => [col, row[i]]))
      );
    }
    const toObjects = (result: any[]) => {
      if (!result.length) return [];
      const { columns, values } = result[0];
      return values.map((row: any[]) =>
        Object.fromEntries(columns.map((col: string, i: number) => [col, row[i]]))
      );
    };

    const cities = toObjects(citiesResult);
    const countries = toObjects(countriesResult);
    const totalsArr = toObjects(totalsResult);
    const totals = totalsArr[0] ?? { total_orders: 0, orders_with_city: 0, total_revenue: 0 };

    const visitorGeo = visitorGeoResult.length ? rowsToObjects(visitorGeoResult[0]) : [];
    const sessionStats = sessionStatsResult.length ? rowsToObjects(sessionStatsResult[0])[0] : null;
    const returnVisits = returnVisitsResult.length ? rowsToObjects(returnVisitsResult[0]) : [];
    return NextResponse.json({ cities, countries, totals, visitorGeo, sessionStats, returnVisits });

  } catch (err: any) {
    console.error('Geo API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
