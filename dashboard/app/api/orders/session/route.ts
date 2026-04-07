export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { DB_PATH } from '../../../../lib/db-path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const order_id = searchParams.get('order_id');

  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  }

  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  try {
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    const result = db.exec(`
      SELECT
        visitor_id, order_id, session_count,
        first_touch_date, last_touch_date, days_to_convert,
        touch_path, session_history, received_at
      FROM visitor_sessions
      WHERE order_id = ?
      LIMIT 1
    `, [order_id]);

    db.close();

    if (!result.length || !result[0].values.length) {
      return NextResponse.json({ session: null });
    }

    const { columns, values } = result[0];
    const session = Object.fromEntries(columns.map((col, i) => [col, values[0][i]]));

    return NextResponse.json({ session });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
