import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';


const SELECT = 'id,market_id,channel,feed_name,is_active,last_fetched_at';

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('feed_market_configs')
    .select(SELECT)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configs: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  const body = await request.json().catch(() => null);
  const { market_id, channel, feed_name, is_active, language, product_ids, overwrite } = body ?? {};
  if (!market_id || !channel) {
    return NextResponse.json({ error: 'market_id en channel zijn verplicht' }, { status: 400 });
  }

  const effectiveFeedName = feed_name || channel;

  // Check for duplicate (market_id + channel + feed_name)
  const { data: existing } = await supabase
    .from('feed_market_configs')
    .select(SELECT)
    .eq('market_id', market_id)
    .eq('channel', channel)
    .eq('feed_name', effectiveFeedName)
    .maybeSingle();

  if (existing && !overwrite) {
    return NextResponse.json({ error: 'Deze feed bestaat al', duplicate: true }, { status: 409 });
  }

  let data: any;

  if (existing && overwrite) {
    // Update the existing record
    const { data: updated, error: upErr } = await supabase
      .from('feed_market_configs')
      .update({ is_active: is_active ?? existing.is_active })
      .eq('id', existing.id)
      .select(SELECT)
      .single();
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    data = updated;

    // Replace product selection
    if (Array.isArray(product_ids)) {
      await supabase.from('feed_config_products').delete().eq('feed_config_id', existing.id);
      if (product_ids.length > 0) {
        const rows = product_ids.map((pid: string) => ({ feed_config_id: existing.id, product_id: pid }));
        const { error: pErr } = await supabase.from('feed_config_products').insert(rows);
        if (pErr) console.error('[Feed Configs] product insert error:', pErr.message);
      }
    }

    return NextResponse.json({ config: { ...data, product_count: product_ids?.length ?? 0 } }, { status: 200 });
  }

  // Fresh insert
  const { data: inserted, error } = await supabase
    .from('feed_market_configs')
    .insert({ market_id, channel, feed_name: effectiveFeedName, is_active: is_active ?? true })
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  data = inserted;

  // Insert product selection (if provided and not "all products")
  let product_count = 0;
  if (Array.isArray(product_ids) && product_ids.length > 0) {
    const rows = product_ids.map((pid: string) => ({ feed_config_id: data.id, product_id: pid }));
    const { error: pErr } = await supabase.from('feed_config_products').insert(rows);
    if (pErr) console.error('[Feed Configs] product insert error:', pErr.message);
    product_count = product_ids.length;
  }

  return NextResponse.json({ config: { ...data, product_count } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const supabase = getSupabase();
  const body = await request.json().catch(() => null);
  const { id, feed_name, is_active, channel } = body ?? {};
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });

  const patch: Record<string, any> = {};
  if (feed_name  !== undefined) patch.feed_name  = feed_name;
  if (is_active  !== undefined) patch.is_active  = is_active;
  if (channel    !== undefined) patch.channel    = channel;

  const { data, error } = await supabase
    .from('feed_market_configs')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}

export async function DELETE(request: Request) {
  const supabase = getSupabase();
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });
  const { error } = await supabase.from('feed_market_configs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
