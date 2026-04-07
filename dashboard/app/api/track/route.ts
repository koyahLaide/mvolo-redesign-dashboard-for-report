export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/track
 *
 * Receives visitor session history from tracker.js on order completion.
 * Stores in a SQLite sessions DB in /tmp (persists within a warm Vercel instance).
 *
 * Body: { visitor_id: string, order_id: string | null, session_history: SessionEntry[] }
 *
 * Architecture note: /tmp is not shared between Vercel function instances.
 * Data here is best-effort. For persistent storage, migrate to Vercel Postgres / Turso.
 */

import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

const SESSIONS_DB_PATH = '/tmp/mvolo_sessions.db';
const WASM_PATH = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

interface SessionEntry {
  ts: string;
  p: string;
  ref: string | null;
  src: string | null;
  med: string | null;
  cmp: string | null;
  cnt: string | null;
  trm: string | null;
}

interface TrackPayload {
  visitor_id: string;
  order_id: string | null;
  session_history: SessionEntry[];
}

// CORS headers — tracker.js runs on mvolo.nl
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
    const body = await request.json() as TrackPayload;
    const { visitor_id, order_id, session_history } = body;

    if (!visitor_id || !Array.isArray(session_history) || session_history.length === 0) {
      return Response.json({ ok: false, error: 'invalid payload' }, { status: 400, headers: CORS });
    }

    // ── Init sessions DB ───────────────────────────────────────────────────────
    const SQL = await initSqlJs({ locateFile: () => WASM_PATH });

    let db: InstanceType<typeof SQL.Database>;
    if (fs.existsSync(SESSIONS_DB_PATH)) {
      db = new SQL.Database(fs.readFileSync(SESSIONS_DB_PATH));
    } else {
      db = new SQL.Database();
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS visitor_sessions (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_id               TEXT NOT NULL,
        order_id                 TEXT,
        session_count            INTEGER DEFAULT 0,
        first_touch_date         TEXT,
        last_touch_date          TEXT,
        days_to_convert          REAL,
        sessions_before_purchase INTEGER,
        touch_path               TEXT,
        created_at               TEXT DEFAULT (datetime('now'))
      )
    `);

    // ── Derive metrics ─────────────────────────────────────────────────────────
    const sorted    = [...session_history].sort((a, b) => a.ts.localeCompare(b.ts));
    const first     = sorted[0];
    const last      = sorted[sorted.length - 1];
    const firstDate = first.ts.slice(0, 10);
    const lastDate  = last.ts.slice(0, 10);

    const msPerDay      = 86_400_000;
    const daysToConvert = first.ts && last.ts
      ? Math.round((new Date(last.ts).getTime() - new Date(first.ts).getTime()) / msPerDay * 10) / 10
      : 0;

    // Build touch path: unique ordered sources
    const touchPath: string[] = [];
    for (const s of sorted) {
      const src = s.src || (s.ref ? 'referral' : 'direct');
      if (touchPath[touchPath.length - 1] !== src) touchPath.push(src);
    }

    db.run(
      `INSERT INTO visitor_sessions
         (visitor_id, order_id, session_count, first_touch_date, last_touch_date,
          days_to_convert, sessions_before_purchase, touch_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        visitor_id,
        order_id ?? null,
        session_history.length,
        firstDate,
        lastDate,
        daysToConvert,
        session_history.length,
        JSON.stringify(touchPath),
      ]
    );

    // ── Persist DB back to /tmp ────────────────────────────────────────────────
    fs.writeFileSync(SESSIONS_DB_PATH, Buffer.from(db.export()));
    db.close();

    return Response.json({ ok: true }, { headers: CORS });
  } catch (err) {
    console.error('[/api/track] Error:', err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: CORS }
    );
  }
}
