export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import fs from 'fs';
import initSqlJs from 'sql.js';
import path from 'path';
import { DB_PATH } from '../../../../lib/db-path';
const PAGE_SIZE = 50;

const ALLOWED_SORT_COLS = new Set([
  'order_number', 'created_at', 'total_price', 'channel',
  'first_touch', 'last_touch', 'utm_campaign', 'utm_content', 'utm_term', 'is_new_customer', 'marketplace',
]);

function rowsToObjects(result: { columns: string[]; values: unknown[][] }): unknown[] {
  return result.values.map((row) =>
    Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
  );
}

export async function GET(request: Request) {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return Response.json({ error: 'Database not found.' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const search   = (searchParams.get('search') ?? '').trim();
    const sortRaw  = searchParams.get('sort') ?? 'created_at';
    const dir      = searchParams.get('dir') === 'asc' ? 'ASC' : 'DESC';
    const sort     = ALLOWED_SORT_COLS.has(sortRaw) ? sortRaw : 'created_at';
    const platform = searchParams.get('platform') ?? 'all';
    const offset   = (page - 1) * PAGE_SIZE;

    const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const db = new SQL.Database(fs.readFileSync(DB_PATH));

    // Migrate
    const migrations = [
      'ALTER TABLE orders ADD COLUMN first_touch TEXT',
      'ALTER TABLE orders ADD COLUMN last_touch TEXT',
      'ALTER TABLE orders ADD COLUMN customer_email TEXT',
      'ALTER TABLE orders ADD COLUMN customer_id TEXT',
      'ALTER TABLE orders ADD COLUMN is_new_customer INTEGER',
      "ALTER TABLE orders ADD COLUMN marketplace TEXT DEFAULT 'shopify'",
    ];
    for (const sql of migrations) {
      try { db.run(sql); } catch { /* already exists */ }
    }

    // Build WHERE clause from search + platform filter
    const conditions: string[] = [];
    if (search) {
      const s = search.replace(/'/g, "''");
      conditions.push(`(order_number LIKE '%${s}%' OR channel LIKE '%${s}%' OR utm_campaign LIKE '%${s}%')`);
    }
    if (platform === 'shopify') conditions.push(`(marketplace = 'shopify' OR marketplace IS NULL)`);
    if (platform === 'bol')     conditions.push(`marketplace = 'bol'`);
    const searchClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count
    const countResult = db.exec(`SELECT COUNT(*) as total FROM orders ${searchClause}`);
    const total = countResult.length
      ? (rowsToObjects(countResult[0])[0] as { total: number }).total
      : 0;

    // Paginated rows
    const rowResult = db.exec(`
      SELECT
        id, order_number, created_at, total_price,
        channel, first_touch, last_touch,
        utm_campaign, utm_content, utm_term, is_new_customer, marketplace
      FROM orders ${searchClause}
      ORDER BY ${sort} ${dir}
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `);
    const orders = rowResult.length ? rowsToObjects(rowResult[0]) : [];

    db.close();

    return Response.json({
      orders,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (err) {
    console.error('[/api/orders/all] Error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
