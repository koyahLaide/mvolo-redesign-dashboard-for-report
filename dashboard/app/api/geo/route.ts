export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? 'all';

  try {
    const dateFilter = period === 'all'
      ? ''
      : `AND DATE(created_at) >= CURRENT_DATE - INTERVAL '${parseInt(period)} days'`;

    const citiesResult = await pool.query(`
      SELECT
        shipping_city    AS city,
        shipping_country AS country,
        COUNT(*)         AS orders,
        SUM(total_price) AS revenue,
        AVG(total_price) AS avg_order_value
      FROM orders
      WHERE shipping_city IS NOT NULL ${dateFilter}
      GROUP BY shipping_city, shipping_country
      ORDER BY orders DESC
      LIMIT 100
    `);

    const countriesResult = await pool.query(`
      SELECT
        shipping_country,
        COUNT(*)         AS orders,
        SUM(total_price) AS revenue
      FROM orders
      WHERE shipping_country IS NOT NULL ${dateFilter}
      GROUP BY shipping_country
      ORDER BY orders DESC
    `);

    const totalsResult = await pool.query(`
      SELECT
        COUNT(*) AS total_orders,
        COUNT(shipping_city) AS orders_with_city,
        SUM(total_price) AS total_revenue
      FROM orders
      WHERE 1=1 ${dateFilter}
    `);

    const visitorGeoResult = await pool.query(`
      SELECT o.shipping_country as country,
        COUNT(DISTINCT vs.visitor_id) as visitors,
        COUNT(DISTINCT o.id) as orders,
        ROUND(AVG(vs.session_count)::numeric, 1) as avg_sessions,
        ROUND(AVG(vs.sessions_before_purchase)::numeric, 1) as avg_sessions_before_purchase,
        SUM(CASE WHEN vs.had_rage_click THEN 1 ELSE 0 END) as rage_clicks,
        SUM(CASE WHEN vs.had_dead_click THEN 1 ELSE 0 END) as dead_clicks
      FROM visitor_sessions vs
      JOIN orders o ON o.id = vs.order_id
      WHERE o.shipping_country IS NOT NULL
      GROUP BY o.shipping_country
      ORDER BY visitors DESC
    `);

    const sessionStatsResult = await pool.query(`
      SELECT
        COUNT(*) as total_sessions,
        COUNT(DISTINCT visitor_id) as unique_visitors,
        ROUND(AVG(session_count)::numeric, 1) as avg_sessions,
        ROUND(AVG(sessions_before_purchase)::numeric, 1) as avg_sessions_before_purchase,
        MAX(session_count) as max_sessions,
        SUM(CASE WHEN had_rage_click THEN 1 ELSE 0 END) as total_rage_clicks,
        SUM(CASE WHEN had_dead_click THEN 1 ELSE 0 END) as total_dead_clicks
      FROM visitor_sessions
    `);

    const returnVisitsResult = await pool.query(`
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

    return NextResponse.json({
      cities:       citiesResult.rows,
      countries:    countriesResult.rows,
      totals:       totalsResult.rows[0] ?? { total_orders: 0, orders_with_city: 0, total_revenue: 0 },
      visitorGeo:   visitorGeoResult.rows,
      sessionStats: sessionStatsResult.rows[0] ?? null,
      returnVisits: returnVisitsResult.rows,
    });

  } catch (err: any) {
    console.error('Geo API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
