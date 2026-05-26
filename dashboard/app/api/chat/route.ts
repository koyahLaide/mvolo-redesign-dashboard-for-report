export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  // Strip UTF-8 BOM (U+FEFF) that Windows tools can silently inject into env vars
  const rawKey = process.env.ANTHROPIC_API_KEY ?? '';
  const apiKey = rawKey.charCodeAt(0) === 0xFEFF ? rawKey.slice(1).trim() : rawKey.trim();

  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set in environment variables' },
      { status: 500 }
    );
  }

  try {
    const { message, dashboardContext } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `You are an AI assistant for the Mvolo Attribution Dashboard. You help users understand their dashboard data. You can answer questions about orders, revenue, customer journeys, geo data, attribution, inventory, email campaigns, pricing, cohort analysis, strategy, finance, competitor prices, and SEO performance.

Here is the current dashboard data context:
${dashboardContext}

FORMATTING RULES — follow these exactly:
- Never use markdown: no **, no *, no #, no backticks, no underscores for formatting
- Use plain text only
- For bullet points use "•" followed by a space
- Separate sections with a blank line
- Keep responses short and direct — 2-4 lines for simple questions, up to 8 lines for detailed ones
- Always reference specific numbers from the context when available
- Format currency as € with Dutch number formatting (e.g. €184.320)
- If you don't have data for something, say so honestly in one sentence
- Respond in English, use Dutch only for specific metric names (e.g. ROAS, POAS)`,
      messages: [{ role: 'user', content: message }],
    });

    const reply =
      response.content[0]?.type === 'text'
        ? response.content[0].text
        : 'Sorry, I could not generate a response.';

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('[/api/chat]', error?.status, error?.message);
    const msg =
      error?.status === 401
        ? 'Invalid ANTHROPIC_API_KEY — check your environment variables'
        : error?.message ?? 'Unknown error';
    return NextResponse.json({ error: msg }, { status: error?.status ?? 500 });
  }
}
