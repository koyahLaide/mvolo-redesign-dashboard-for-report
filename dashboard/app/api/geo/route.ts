import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'data/mvolo.db');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? '30';

  const db = new Database(DB_PATH, { readonly: true });

  const dateFilter = period === 'all'
    ? ''
    : `AND DATE(created_at) >= DATE('now', '-${parseInt(period)} days')`;

  // Orders per stad
  const cities = db.prepare(`
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
  `).all();

  // Orders per land
  const countries = db.prepare(`
    SELECT
      shipping_country AS country,
      COUNT(*)         AS orders,
      SUM(total_price) AS revenue
    FROM orders
    WHERE shipping_country IS NOT NULL
      ${dateFilter}
    GROUP BY shipping_country
    ORDER BY orders DESC
  `).all();

  // Totaal met city data
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS total_orders,
      COUNT(shipping_city) AS orders_with_city,
      SUM(total_price) AS total_revenue
    FROM orders
    WHERE 1=1 ${dateFilter}
  `).get() as { total_orders: number; orders_with_city: number; total_revenue: number };

  db.close();

  return NextResponse.json({ cities, countries, totals });
}
