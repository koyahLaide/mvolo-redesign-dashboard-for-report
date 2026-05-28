export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import pool from '../../../lib/db';

interface FunnelStep {
  step:          string;
  sessions:      number;
  orders?:       number;
  dropoff_pct:   number | null;
  cr_pct?:       number | null;
  rage_clicks:   number;
  dead_clicks:   number;
}

interface RagePage {
  page:        string;
  rage_clicks: number;
  dead_clicks: number;
  channel:     string | null;
}

interface FrustrationChannel {
  channel:          string;
  rage_clicks:      number;
  dead_clicks:      number;
  sessions:         number;
  frustration_rate: number;
}

async function callClaude(prompt: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { content?: { type: string; text: string }[] };
    return data.content?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') ?? '30', 10);

    const dateFilter = `date >= CURRENT_DATE - INTERVAL '${days} days'`;

    // Funnel steps from GA4
    const STEP_ORDER = ['homepage', 'product', 'cart', 'checkout'];
    const funnelResult = await pool.query(`
      SELECT step, SUM(sessions) as sessions, SUM(users) as users
      FROM ga4_funnel
      WHERE ${dateFilter}
      GROUP BY step
    `);
    const funnelMap: Record<string, number> = {};
    for (const row of funnelResult.rows) {
      funnelMap[row.step] = parseInt(row.sessions) ?? 0;
    }

    // Orders as final step
    const ordersResult = await pool.query(`
      SELECT COUNT(*) as cnt FROM orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
        AND (marketplace = 'shopify' OR marketplace IS NULL)
    `);
    const orderCount = parseInt(ordersResult.rows[0]?.cnt ?? '0');

    // Clarity events aggregated
    const clarityTotResult = await pool.query(`
      SELECT event_type, SUM(count) as total
      FROM clarity_events
      WHERE ${dateFilter}
      GROUP BY event_type
    `);
    const clarityTot: Record<string, number> = {};
    for (const row of clarityTotResult.rows) {
      clarityTot[row.event_type] = parseInt(row.total) ?? 0;
    }

    // Clarity by funnel step
    const clarityByStepResult = await pool.query(`
      SELECT
        event_type,
        CASE
          WHEN page = '/' OR page LIKE '/nl/%' OR page LIKE '/en/%' THEN 'homepage'
          WHEN page LIKE '/products/%' OR page LIKE '/product/%'     THEN 'product'
          WHEN page LIKE '/cart%' OR page = '/winkelmand'            THEN 'cart'
          WHEN page LIKE '%checkout%'                                THEN 'checkout'
          ELSE 'other'
        END as step,
        SUM(count) as total
      FROM clarity_events
      WHERE ${dateFilter}
      GROUP BY event_type, step
    `);
    const clarityByStep: Record<string, Record<string, number>> = {};
    for (const row of clarityByStepResult.rows) {
      if (!clarityByStep[row.step]) clarityByStep[row.step] = {};
      clarityByStep[row.step][row.event_type] = parseInt(row.total) ?? 0;
    }

    // Build funnel array
    const funnel: FunnelStep[] = [];
    let prevSessions: number | null = null;
    for (const step of STEP_ORDER) {
      const sessions = funnelMap[step] ?? 0;
      const dropoff_pct = prevSessions && prevSessions > 0 && sessions > 0
        ? Math.round(((prevSessions - sessions) / prevSessions) * 100)
        : null;
      const stepClarity = clarityByStep[step] ?? {};
      funnel.push({ step, sessions, dropoff_pct, rage_clicks: stepClarity.rage_click ?? 0, dead_clicks: stepClarity.dead_click ?? 0 });
      if (sessions > 0) prevSessions = sessions;
    }
    const lastFunnelSessions = funnelMap.checkout || funnelMap.cart || funnelMap.product || funnelMap.homepage || null;
    funnel.push({
      step: 'besteld', orders: orderCount, sessions: orderCount, dropoff_pct: null,
      cr_pct: lastFunnelSessions && lastFunnelSessions > 0
        ? Math.round((orderCount / lastFunnelSessions) * 1000) / 10 : null,
      rage_clicks: 0, dead_clicks: 0,
    });

    // Top rage/dead click pages
    const topRageResult = await pool.query(`
      SELECT page,
        SUM(CASE WHEN event_type = 'rage_click' THEN count ELSE 0 END) as rage_clicks,
        SUM(CASE WHEN event_type = 'dead_click' THEN count ELSE 0 END) as dead_clicks,
        channel
      FROM clarity_events
      WHERE ${dateFilter}
      GROUP BY page, channel
      ORDER BY rage_clicks DESC, dead_clicks DESC
      LIMIT 10
    `);
    const topRagePages: RagePage[] = topRageResult.rows as unknown as RagePage[];

    // Frustration by channel
    const frustrationResult = await pool.query(`
      SELECT channel,
        SUM(CASE WHEN event_type = 'rage_click' THEN count ELSE 0 END) as rage_clicks,
        SUM(CASE WHEN event_type = 'dead_click' THEN count ELSE 0 END) as dead_clicks,
        COUNT(DISTINCT date || '_' || page) as touchpoints
      FROM clarity_events
      WHERE ${dateFilter} AND channel IS NOT NULL
      GROUP BY channel
      ORDER BY rage_clicks DESC
      LIMIT 8
    `);
    const frustrationByChannel: FrustrationChannel[] = frustrationResult.rows as unknown as FrustrationChannel[];

    // Claude AI analyse
    const hasData = funnel.some((s) => s.sessions > 0);
    let aiInsight: string | null = null;
    if (hasData) {
      const funnelText = funnel.map((s) => {
        if (s.step === 'besteld') return `Besteld: ${s.orders} orders${s.cr_pct !== null && s.cr_pct !== undefined ? ` (CR: ${s.cr_pct}%)` : ''}`;
        const drop = s.dropoff_pct !== null ? ` (-${s.dropoff_pct}% drop-off)` : '';
        const issues = [
          s.rage_clicks > 0 ? `${s.rage_clicks} rage clicks` : '',
          s.dead_clicks > 0 ? `${s.dead_clicks} dead clicks` : '',
        ].filter(Boolean).join(', ');
        return `${s.step}: ${s.sessions} sessies${drop}${issues ? ` [${issues}]` : ''}`;
      }).join('\n');
      const topRageText = topRagePages.slice(0, 3).map((r) => `${r.page}: ${r.rage_clicks} rage, ${r.dead_clicks} dead`).join('; ') || 'geen data';
      const prompt = `Analyseer deze funnel data voor Mvolo (lichttherapie webshop Nederland).

Funnel (afgelopen ${days} dagen):
${funnelText}

Top frustratiepagina's:
${topRageText}

Geef 3 concrete CRO verbeteringen die direct impact hebben op conversie.
Schrijf in het Nederlands, max 200 woorden, directe taal zonder inleiding.`;
      aiInsight = await callClaude(prompt);
    }

    return Response.json({
      funnel, topRagePages, frustrationByChannel,
      clarityTotals: { rage_clicks: clarityTot.rage_click ?? 0, dead_clicks: clarityTot.dead_click ?? 0 },
      hasData, aiInsight, period: days,
    });

  } catch (err) {
    console.error('[/api/funnel] Error:', err);
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
