export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import pool from '@/lib/db';

// CORS — tracker.js draait op mvolo.nl
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { visitor_id, order_id, session_history } = body;

    if (!visitor_id || !Array.isArray(session_history) || session_history.length === 0) {
      return Response.json({ ok: false, error: 'invalid payload' }, { status: 400, headers: CORS });
    }

    const sorted    = [...session_history].sort((a: any, b: any) => a.ts.localeCompare(b.ts));
    const first     = sorted[0];
    const last      = sorted[sorted.length - 1];

    const msPerDay      = 86_400_000;
    const daysToConvert = first.ts && last.ts
      ? Math.round((new Date(last.ts).getTime() - new Date(first.ts).getTime()) / msPerDay * 10) / 10
      : 0;

    const touchPath: string[] = [];
    for (const s of sorted) {
      const src = s.src || (s.ref ? 'referral' : 'direct');
      if (touchPath[touchPath.length - 1] !== src) touchPath.push(src);
    }

    await pool.query(
      `INSERT INTO visitor_sessions
         (visitor_id, order_id, session_count, first_touch_date, last_touch_date, days_to_convert, touch_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        visitor_id,
        order_id ?? null,
        session_history.length,
        first.ts.slice(0, 10),
        last.ts.slice(0, 10),
        daysToConvert,
        JSON.stringify(touchPath),
      ]
    );

    return Response.json({ ok: true }, { headers: CORS });

  } catch (err) {
    console.error('[/api/track] Error:', err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: CORS }
    );
  }
}
