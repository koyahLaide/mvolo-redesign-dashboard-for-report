export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? '30';

  function periodToDays(p: string): number | null {
    switch (p) {
      case 'today':   return 1;
      case 'week':    return 7;
      case 'month':   return 30;
      case 'quarter': return 90;
      case 'year':    return 365;
      case 'all':     return null;
      default: { const n = parseInt(p); return isNaN(n) ? null : n; }
    }
  }

  try {
    const days = periodToDays(period);
    const dateFilter = days === null
      ? ''
      : `AND DATE(created_at) >= CURRENT_DATE - INTERVAL '${days} days'`;

    const assistedResult = await pool.query(`
      SELECT
        first_touch                           AS assisting_channel,
        channel                               AS converting_channel,
        COUNT(*)                              AS assisted_orders,
        ROUND(SUM(total_price)::numeric, 2)   AS assisted_revenue,
        ROUND(AVG(total_price)::numeric, 2)   AS avg_order_value
      FROM orders
      WHERE first_touch IS NOT NULL
        AND first_touch != channel
        ${dateFilter}
      GROUP BY first_touch, channel
      ORDER BY assisted_orders DESC
      LIMIT 30
    `);

    const byChannelResult = await pool.query(`
      SELECT
        first_touch                           AS assisting_channel,
        COUNT(*)                              AS total_assisted,
        ROUND(SUM(total_price)::numeric, 2)   AS total_revenue,
        COUNT(DISTINCT channel)               AS converting_channels
      FROM orders
      WHERE first_touch IS NOT NULL
        AND first_touch != channel
        ${dateFilter}
      GROUP BY first_touch
      ORDER BY total_assisted DESC
    `);

    const touchSummaryResult = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN first_touch != channel THEN 1 ELSE 0 END) AS multi_touch,
        SUM(CASE WHEN first_touch = channel OR first_touch IS NULL THEN 1 ELSE 0 END) AS single_touch
      FROM orders
      WHERE 1=1 ${dateFilter}
    `);

    const pathsResult = await pool.query(`
      SELECT
        first_touch || ' → ' || channel AS path,
        first_touch,
        channel,
        COUNT(*) AS orders,
        ROUND(SUM(total_price)::numeric, 2) AS revenue
      FROM orders
      WHERE first_touch IS NOT NULL
        AND first_touch != channel
        ${dateFilter}
      GROUP BY first_touch, channel
      ORDER BY orders DESC
      LIMIT 10
    `);

    const heatmapResult = await pool.query(`
      SELECT
        first_touch,
        channel AS last_touch,
        COUNT(*) AS orders,
        ROUND(SUM(total_price)::numeric, 0) AS revenue
      FROM orders
      WHERE first_touch IS NOT NULL ${dateFilter}
      GROUP BY first_touch, channel
      ORDER BY orders DESC
    `);

    return NextResponse.json({
      assisted:     assistedResult.rows,
      byChannel:    byChannelResult.rows,
      touchSummary: touchSummaryResult.rows[0] ?? null,
      paths:        pathsResult.rows,
      heatmap:      heatmapResult.rows,
    });

  } catch (err: any) {
    console.error('Assisted API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
