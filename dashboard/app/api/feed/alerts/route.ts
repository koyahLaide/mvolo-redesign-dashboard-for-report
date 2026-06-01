import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';


// ── GET — list alerts ─────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const onlyOpen = searchParams.get('open') === 'true';
  const type     = searchParams.get('type');
  const limit    = parseInt(searchParams.get('limit') ?? '50');

  let q = supabase
    .from('feed_alerts')
    .select('id,type,severity,message,product_id,channel,market_id,acknowledged,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (onlyOpen) q = (q as any).eq('acknowledged', false);
  if (type)     q = (q as any).eq('type', type);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with product names
  const productIds = [...new Set((data ?? []).map(a => a.product_id).filter(Boolean))];
  const { data: prods } = productIds.length
    ? await supabase.from('products').select('id,name_nl').in('id', productIds)
    : { data: [] };
  const pm: Record<string, string> = {};
  for (const p of prods ?? []) pm[p.id] = p.name_nl;

  return NextResponse.json({
    alerts: (data ?? []).map(a => ({ ...a, product_name: a.product_id ? (pm[a.product_id] ?? null) : null })),
  });
}

// ── POST — create alert ───────────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = getSupabase();
  const body = await request.json().catch(() => null);
  const { type, severity, message, product_id, channel, market_id } = body ?? {};
  if (!type || !message) {
    return NextResponse.json({ error: 'type en message zijn verplicht' }, { status: 400 });
  }
  const { data, error } = await supabase.from('feed_alerts').insert({
    type,
    severity: severity ?? 'info',
    message,
    product_id:  product_id  ?? null,
    channel:     channel     ?? null,
    market_id:   market_id   ?? null,
    acknowledged: false,
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id, ok: true });
}

// ── PATCH — acknowledge alert(s) ─────────────────────────────────────────────
export async function PATCH(request: Request) {
  const supabase = getSupabase();
  const body = await request.json().catch(() => null);
  const { id, ids, acknowledge_all } = body ?? {};

  if (acknowledge_all) {
    const { error } = await supabase.from('feed_alerts').update({ acknowledged: true }).eq('acknowledged', false);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const targetIds: string[] = id ? [id] : (Array.isArray(ids) ? ids : []);
  if (!targetIds.length) return NextResponse.json({ error: 'id of ids is verplicht' }, { status: 400 });

  const { error } = await supabase.from('feed_alerts').update({ acknowledged: true }).in('id', targetIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, acknowledged: targetIds.length });
}
