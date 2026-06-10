export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import pool from '../../../lib/db';

function periodClause(period: string): string {
  switch (period) {
    case '7':  return "AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    case '30': return "AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    case '90': return "AND o.created_at >= CURRENT_DATE - INTERVAL '90 days'";
    default:   return '';
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // page sends 'platform', legacy code sent 'channel' — accept both
    const platform = searchParams.get('platform') ?? searchParams.get('channel') ?? 'all';
    const period   = searchParams.get('period') ?? 'all';
    const q        = searchParams.get('q') ?? '';

    const clauses: string[] = [];
    const params: unknown[]  = [];

    const pc = periodClause(period);
    if (pc) clauses.push(pc.replace('AND ', ''));

    if (platform !== 'all') {
      params.push(platform);
      clauses.push(`o.channel = $${params.length}`);
    }

    if (q) {
      params.push(`%${q}%`);
      const idx = params.length;
      clauses.push(`(o.order_number::text ILIKE $${idx} OR o.customer_email ILIKE $${idx})`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const [ordersResult, totalsResult] = await Promise.all([
      pool.query(`
        SELECT
          o.id,
          o.order_number,
          o.created_at,
          o.total_price,
          o.channel,
          o.customer_email,
          o.financial_status,
          o.first_touch,
          o.last_touch,
          o.is_new_customer,
          o.utm_campaign,
          o.utm_content
        FROM orders o
        ${where}
        ORDER BY o.created_at DESC
        LIMIT 500
      `, params),
      pool.query(`
        SELECT
          COUNT(*)                              AS total_orders,
          COALESCE(SUM(o.total_price), 0)       AS total_revenue,
          COALESCE(AVG(o.total_price), 0)       AS avg_order_value,
          COUNT(DISTINCT o.customer_email)      AS unique_customers
        FROM orders o
        ${where}
      `, params),
    ]);

    const t = totalsResult.rows[0];
    return Response.json({
      orders: ordersResult.rows,
      totals: {
        total_orders:     Number(t.total_orders),
        total_revenue:    parseFloat(t.total_revenue),
        avg_order_value:  parseFloat(t.avg_order_value),
        unique_customers: Number(t.unique_customers),
      },
    });
  } catch (err) {
    console.error('[/api/orders]', err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
