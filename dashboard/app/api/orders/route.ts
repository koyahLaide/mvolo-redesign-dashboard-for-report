export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import fs from 'fs';
import initSqlJs from 'sql.js';
import path from 'path';
import { DB_PATH } from '../../../lib/db-path';

function rowsToObjects(result: { columns: string[]; values: unknown[][] }): unknown[] {
  return result.values.map((row) =>
    Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
  );
}

function periodWhereClause(period: string): string {
  switch (period) {
    case 'today':   return "AND DATE(created_at) = DATE('now')";
    case 'week':    return "AND created_at >= DATE('now', '-7 days')";
    case 'month':   return "AND created_at >= DATE('now', '-30 days')";
    case 'quarter': {
      const now = new Date();
      const qMonth = Math.floor(now.getMonth() / 3) * 3 + 1;
      const qStart = `${now.getFullYear()}-${String(qMonth).padStart(2, '0')}-01`;
      return `AND created_at >= '${qStart}'`;
    }
    case 'year':    return `AND strftime('%Y', created_at) = '${new Date().getFullYear()}'`;
    default:        return '';
  }
}

export async function GET(request: Request) {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return Response.json({ error: 'Database not found.' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel');
    const period = searchParams.get('period') || 'all';

    if (!channel) {
      return Response.json({ error: 'channel param required' }, { status: 400 });
    }

    const periodClause = periodWhereClause(period);

    const wasmPath = path.join(
      process.cwd(),
      'node_modules',
      'sql.js',
      'dist',
      'sql-wasm.wasm'
    );
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    // ── Migrate: ensure new columns exist (in-memory, safe on old DBs) ──────
    const migrations = [
      'ALTER TABLE orders ADD COLUMN first_touch TEXT',
      'ALTER TABLE orders ADD COLUMN last_touch TEXT',
      'ALTER TABLE orders ADD COLUMN touch_path TEXT',
      'ALTER TABLE orders ADD COLUMN customer_email TEXT',
      'ALTER TABLE orders ADD COLUMN customer_id TEXT',
      'ALTER TABLE orders ADD COLUMN is_new_customer INTEGER',
    ];
    for (const sql of migrations) {
      try { db.run(sql); } catch { /* column already exists */ }
    }

    const result = db.exec(`
      SELECT
        id,
        order_number,
        created_at,
        total_price,
        first_touch,
        last_touch,
        is_new_customer,
        utm_campaign,
        utm_content
      FROM orders
      WHERE channel = '${channel.replace(/'/g, "''")}' ${periodClause}
      ORDER BY created_at DESC
      LIMIT 200
    `);

    const orders = result.length ? rowsToObjects(result[0]) : [];
    db.close();

    return Response.json({ orders });
  } catch (err) {
    console.error('[/api/orders] Error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
