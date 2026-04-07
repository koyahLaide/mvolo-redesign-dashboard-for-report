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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? '30';

  const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  try {
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    const dateFilter = period === 'all'
      ? ''
      : `AND DATE(created_at) >= DATE('now', '-${parseInt(period)} days')`;

    // Assisted conversions: orders waar first_touch ANDERS is dan last_touch (channel)
    // Toont welke kanalen hebben bijgedragen als first touch aan conversies via andere kanalen
    const assistedResult = db.exec(`
      SELECT
        first_touch                           AS assisting_channel,
        channel                               AS converting_channel,
        COUNT(*)                              AS assisted_orders,
        ROUND(SUM(total_price), 2)            AS assisted_revenue,
        ROUND(AVG(total_price), 2)            AS avg_order_value
      FROM orders
      WHERE first_touch IS NOT NULL
        AND first_touch != channel
        ${dateFilter}
      GROUP BY first_touch, channel
      ORDER BY assisted_orders DESC
      LIMIT 30
    `);

    // Per kanaal: hoeveel orders zijn er assisted (first_touch != channel)
    const byChannelResult = db.exec(`
      SELECT
        first_touch                           AS assisting_channel,
        COUNT(*)                              AS total_assisted,
        ROUND(SUM(total_price), 2)            AS total_revenue,
        COUNT(DISTINCT channel)               AS converting_channels
      FROM orders
      WHERE first_touch IS NOT NULL
        AND first_touch != channel
        ${dateFilter}
      GROUP BY first_touch
      ORDER BY total_assisted DESC
    `);

    // Totaal multi-touch vs single-touch
    const touchSummaryResult = db.exec(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN first_touch != channel THEN 1 ELSE 0 END) AS multi_touch,
        SUM(CASE WHEN first_touch = channel OR first_touch IS NULL THEN 1 ELSE 0 END) AS single_touch
      FROM orders
      WHERE 1=1 ${dateFilter}
    `);

    // Top assisterende paden (first_touch → channel)
    const pathsResult = db.exec(`
      SELECT
        first_touch || ' → ' || channel AS path,
        first_touch,
        channel,
        COUNT(*) AS orders,
        ROUND(SUM(total_price), 2) AS revenue
      FROM orders
      WHERE first_touch IS NOT NULL
        AND first_touch != channel
        ${dateFilter}
      GROUP BY first_touch, channel
      ORDER BY orders DESC
      LIMIT 10
    `);

    db.close();

    const assisted = assistedResult.length ? rowsToObjects(assistedResult[0]) : [];
    const byChannel = byChannelResult.length ? rowsToObjects(byChannelResult[0]) : [];
    const touchSummary = touchSummaryResult.length ? rowsToObjects(touchSummaryResult[0])[0] : null;
    const paths = pathsResult.length ? rowsToObjects(pathsResult[0]) : [];

    return NextResponse.json({ assisted, byChannel, touchSummary, paths });

  } catch (err: any) {
    console.error('Assisted API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
