export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import pool from '../../../../lib/db';

const PAGE_SIZE = 50;

const ALLOWED_SORT_COLS = new Set([
  'order_number', 'created_at', 'total_price', 'channel',
  'first_touch', 'last_touch', 'utm_campaign', 'utm_content', 'utm_term', 'is_new_customer', 'marketplace',
]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const search   = (searchParams.get('search') ?? '').trim();
    const sortRaw  = searchParams.get('sort') ?? 'created_at';
    const dir      = searchParams.get('dir') === 'asc' ? 'ASC' : 'DESC';
    const sort     = ALLOWED_SORT_COLS.has(sortRaw) ? sortRaw : 'created_at';
    const platform = searchParams.get('platform') ?? 'all';
    const offset   = (page - 1) * PAGE_SIZE;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(order_number ILIKE $${params.length} OR channel ILIKE $${params.length} OR utm_campaign ILIKE $${params.length})`
      );
    }
    if (platform === 'shopify') conditions.push(`(marketplace = 'shopify' OR marketplace IS NULL)`);
    if (platform === 'bol')     conditions.push(`marketplace = 'bol'`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM orders ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    // Paginated rows — append LIMIT/OFFSET params
    params.push(PAGE_SIZE, offset);
    const rowResult = await pool.query(`
      SELECT
        id, order_number, created_at, total_price,
        channel, first_touch, last_touch,
        utm_campaign, utm_content, utm_term, is_new_customer, marketplace,
        device_type, browser_language
      FROM orders ${whereClause}
      ORDER BY ${sort} ${dir}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    return Response.json({
      orders: rowResult.rows,
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
