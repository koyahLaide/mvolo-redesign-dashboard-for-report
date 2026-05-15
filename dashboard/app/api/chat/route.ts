export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set in .env.local' },
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

Rules:
- Be concise and direct
- Use Dutch for labels/terms but respond in English
- Reference specific numbers when available
- If you don't have data for something, say so honestly
- Format numbers with proper currency (€) and percentages
- Keep responses short — 2-3 sentences max unless asked for detail`,
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
        ? 'Invalid ANTHROPIC_API_KEY — check your .env.local'
        : error?.message ?? 'Unknown error';
    return NextResponse.json({ error: msg }, { status: error?.status ?? 500 });
  }
}
