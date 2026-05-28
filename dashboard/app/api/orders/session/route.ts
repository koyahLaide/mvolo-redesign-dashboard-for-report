export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const order_id = searchParams.get('order_id');

  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  }

  try {
    const result = await pool.query(`
      SELECT
        visitor_id, order_id, session_count,
        first_touch_date, last_touch_date, days_to_convert,
        touch_path, clarity_session_id, created_at
      FROM visitor_sessions
      WHERE order_id = $1
      LIMIT 1
    `, [order_id]);

    const session = result.rows[0] ?? null;
    return NextResponse.json({ session });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
