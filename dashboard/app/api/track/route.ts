export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/track
 *
 * Ontvangt visitor session history van tracker.js bij order completion.
 * Schrijft naar Google Sheet als tussenliggende opslag.
 * GitHub Actions sync leest de Sheet en merged in de hoofd DB.
 *
 * Body: { visitor_id, order_id, session_history }
 */

import { google } from 'googleapis';

const SHEET_ID  = '1wKGs1Zfa912D-5jH3HUdPgeynP4hAYCdP4EwQsosf8g';
const TAB_NAME  = 'Sessions';

// CORS — tracker.js draait op mvolo.nl
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GA4_CLIENT_EMAIL,
      private_key:  (process.env.GA4_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { visitor_id, order_id, session_history } = body;

    if (!visitor_id || !Array.isArray(session_history) || session_history.length === 0) {
      return Response.json({ ok: false, error: 'invalid payload' }, { status: 400, headers: CORS });
    }

    // ── Verwerk sessie data ────────────────────────────────────────────────────
    const sorted    = [...session_history].sort((a: any, b: any) => a.ts.localeCompare(b.ts));
    const first     = sorted[0];
    const last      = sorted[sorted.length - 1];

    const msPerDay      = 86_400_000;
    const daysToConvert = first.ts && last.ts
      ? Math.round((new Date(last.ts).getTime() - new Date(first.ts).getTime()) / msPerDay * 10) / 10
      : 0;

    // Touch path: unieke ordered sources
    const touchPath: string[] = [];
    for (const s of sorted) {
      const src = s.src || (s.ref ? 'referral' : 'direct');
      if (touchPath[touchPath.length - 1] !== src) touchPath.push(src);
    }

    // Volledige session history als JSON voor analyse
    const sessionJson = JSON.stringify(session_history);

    // ── Schrijf naar Google Sheet ──────────────────────────────────────────────
    const sheets = await getSheetsClient();

    // Zorg dat de header rij bestaat
    await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range:         `${TAB_NAME}!A1`,
    }).catch(async () => {
      // Tab bestaat nog niet — maak header aan
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range:         `${TAB_NAME}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'received_at', 'visitor_id', 'order_id', 'session_count',
            'first_touch_date', 'last_touch_date', 'days_to_convert',
            'touch_path', 'session_history'
          ]],
        },
      });
    });

    // Voeg rij toe
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range:         `${TAB_NAME}!A:I`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          new Date().toISOString(),
          visitor_id,
          order_id ?? '',
          session_history.length,
          first.ts.slice(0, 10),
          last.ts.slice(0, 10),
          daysToConvert,
          JSON.stringify(touchPath),
          sessionJson,
        ]],
      },
    });

    return Response.json({ ok: true }, { headers: CORS });

  } catch (err) {
    console.error('[/api/track] Error:', err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: CORS }
    );
  }
}
