export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import initSqlJs from 'sql.js';
import path from 'path';
import { DB_PATH } from '../../../lib/db-path';

function rowsToObjects(result: { columns: string[]; values: unknown[][] }): Record<string, unknown>[] {
  return result.values.map((row) =>
    Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
  );
}

export async function GET(request: Request) {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return NextResponse.json({ error: 'Database not found.' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const period   = searchParams.get('period')   || 'all';
    const platform = searchParams.get('platform') || 'all';
    const q        = searchParams.get('q')        || '';

    const conditions: string[] = [];

    // Period: numeric = days back, 'all' = no filter
    const periodDays = parseInt(period);
    if (!isNaN(periodDays)) {
      conditions.push(`created_at >= date('now', '-${periodDays} days')`);
    }

    // Platform
    if (platform === 'bol') {
      conditions.push(`channel = 'bol_marketplace'`);
    } else if (platform === 'shopify') {
      conditions.push(`channel != 'bol_marketplace'`);
    }

    // Search
    if (q) {
      const safe = q.replace(/'/g, "''");
      conditions.push(`(order_number LIKE '%${safe}%' OR customer_email LIKE '%${safe}%')`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const db = new SQL.Database(fs.readFileSync(DB_PATH));

    // Ensure optional columns exist
    const migrations = [
      'ALTER TABLE orders ADD COLUMN first_touch TEXT',
      'ALTER TABLE orders ADD COLUMN last_touch TEXT',
      'ALTER TABLE orders ADD COLUMN touch_path TEXT',
      'ALTER TABLE orders ADD COLUMN customer_email TEXT',
      'ALTER TABLE orders ADD COLUMN customer_id TEXT',
      'ALTER TABLE orders ADD COLUMN is_new_customer INTEGER',
    ];
    for (const sql of migrations) {
      try { db.run(sql); } catch { /* already exists */ }
    }

    const result = db.exec(`
      SELECT
        id,
        order_number,
        created_at,
        total_price                                                         AS total,
        channel,
        customer_email                                                      AS email,
        financial_status,
        fulfillment_status,
        COALESCE(fulfillment_status, financial_status)                      AS status,
        CASE WHEN channel = 'bol_marketplace' THEN 'bol' ELSE 'shopify' END AS platform
      FROM orders
      ${where}
      ORDER BY created_at DESC
      LIMIT 200
    `);

    const orders = result.length ? rowsToObjects(result[0] as { columns: string[]; values: unknown[][] }) : [];

    const totalsResult = db.exec(`
      SELECT
        COUNT(*)                            AS total_orders,
        ROUND(SUM(total_price), 2)          AS total_revenue,
        ROUND(AVG(total_price), 2)          AS avg_order_value,
        COUNT(DISTINCT customer_email)      AS unique_customers
      FROM orders
      ${where}
    `);

    const totals = totalsResult.length
      ? (rowsToObjects(totalsResult[0] as { columns: string[]; values: unknown[][] })[0] ?? {})
      : {};

    db.close();

    return NextResponse.json({ orders, totals });
  } catch (err) {
    console.error('[/api/orders] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
