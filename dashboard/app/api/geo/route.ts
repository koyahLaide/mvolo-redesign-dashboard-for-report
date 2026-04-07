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

  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
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

    db.close();

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

    return NextResponse.json({ cities, countries, totals });

  } catch (err: any) {
    console.error('Geo API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
