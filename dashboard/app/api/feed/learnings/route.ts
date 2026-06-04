import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';


const SELECT = 'id,test_id,category,learning,impact_pct,confidence,applies_to_channels,applies_to_markets,applies_to_categories,is_active,created_at';

// ── GET — list learnings ──────────────────────────────────────────────────────
export async function GET(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const category  = searchParams.get('category');
  const channel   = searchParams.get('channel');
  const market    = searchParams.get('market');
  const onlyActive = searchParams.get('active') !== 'false';

  let q = supabase.from('feed_learnings').select(SELECT).order('created_at', { ascending: false });
  if (onlyActive) q = (q as any).eq('is_active', true);
  if (category)   q = (q as any).eq('category', category);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let learnings = data ?? [];
  if (channel) learnings = learnings.filter(l => !l.applies_to_channels?.length || l.applies_to_channels.includes(channel));
  if (market)  learnings = learnings.filter(l => !l.applies_to_markets?.length  || l.applies_to_markets.includes(market));

  return NextResponse.json({ learnings });
}

// ── POST — create learning manually ──────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = getSupabase();
  const body = await request.json().catch(() => null);
  const { category, learning, impact_pct, confidence, applies_to_channels, applies_to_markets, applies_to_categories, test_id } = body ?? {};
  if (!category || !learning) return NextResponse.json({ error: 'category en learning zijn verplicht' }, { status: 400 });

  const { data, error } = await supabase.from('feed_learnings').insert({
    test_id: test_id ?? null,
    category,
    learning,
    impact_pct: impact_pct ?? null,
    confidence: confidence ?? 'medium',
    applies_to_channels: applies_to_channels ?? [],
    applies_to_markets: applies_to_markets ?? [],
    applies_to_categories: applies_to_categories ?? [],
    is_active: true,
  }).select(SELECT).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ learning: data }, { status: 201 });
}

// ── PATCH — toggle is_active or update ───────────────────────────────────────
export async function PATCH(request: Request) {
  const supabase = getSupabase();
  const body = await request.json().catch(() => null);
  const { id, is_active, learning, impact_pct, confidence } = body ?? {};
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });

  const patch: Record<string, any> = {};
  if (is_active !== undefined) patch.is_active = is_active;
  if (learning  !== undefined) patch.learning   = learning;
  if (impact_pct !== undefined) patch.impact_pct = impact_pct;
  if (confidence !== undefined) patch.confidence = confidence;

  const { data, error } = await supabase.from('feed_learnings').update(patch).eq('id', id).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ learning: data });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  const supabase = getSupabase();
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });
  const { error } = await supabase.from('feed_learnings').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
