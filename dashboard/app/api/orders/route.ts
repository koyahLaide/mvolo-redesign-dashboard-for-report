export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import pool from '../../../lib/db';

function periodWhereClause(period: string): string {
  switch (period) {
    case 'today':   return "AND DATE(created_at) = CURRENT_DATE";
    case 'week':    return "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
    case 'month':   return "AND created_at >= CURRENT_DATE - INTERVAL '30 days'";
    case 'quarter': {
      const now = new Date();
      const qMonth = Math.floor(now.getMonth() / 3) * 3 + 1;
      const qStart = `${now.getFullYear()}-${String(qMonth).padStart(2, '0')}-01`;
      return `AND created_at >= '${qStart}'`;
    }
    case 'year':    return `AND EXTRACT(YEAR FROM created_at) = ${new Date().getFullYear()}`;
    default:        return '';
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel');
    const period = searchParams.get('period') || 'all';

    if (!channel) {
      return Response.json({ error: 'channel param required' }, { status: 400 });
    }

    const periodClause = periodWhereClause(period);

    const channelClause = channel === 'all' ? '' : 'AND channel = $1';
    const params = channel === 'all' ? [] : [channel];
    const whereBase = periodClause || channelClause ? 'WHERE 1=1' : '';

    const result = await pool.query(`
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
      ${whereBase} ${periodClause} ${channelClause}
      ORDER BY created_at DESC
      LIMIT 200
    `, params);

    return Response.json({ orders: result.rows });
  } catch (err) {
    console.error('[/api/orders] Error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
