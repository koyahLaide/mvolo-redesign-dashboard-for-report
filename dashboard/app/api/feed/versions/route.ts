import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';


// ── GET — list versions ───────────────────────────────────────────────────────
export async function GET(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const marketCode = searchParams.get('market')?.toUpperCase();
  const channel    = searchParams.get('channel')?.toLowerCase();

  let query = supabase
    .from('feed_versions')
    .select('id,channel,version_number,product_count,note,created_at,market_id,markets(code,name)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (marketCode) {
    const { data: market } = await supabase.from('markets').select('id').eq('code', marketCode).single();
    if (market) query = (query as any).eq('market_id', market.id);
  }
  if (channel) query = (query as any).eq('channel', channel);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ versions: data ?? [] });
}

// ── POST — create snapshot OR rollback ───────────────────────────────────────
export async function POST(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'rollback') {
    const versionId = searchParams.get('version_id');
    if (!versionId) return NextResponse.json({ error: 'version_id is verplicht' }, { status: 400 });
    return handleRollback(versionId);
  }

  const body = await request.json().catch(() => null);
  if (!body?.market || !body?.channel) {
    return NextResponse.json({ error: 'market en channel zijn verplicht' }, { status: 400 });
  }
  return handleCreateVersion(String(body.market).toUpperCase(), String(body.channel).toLowerCase(), body.note ?? null);
}

// ── Create version snapshot ───────────────────────────────────────────────────
async function handleCreateVersion(marketCode: string, channel: string, note: string | null) {
  const supabase = getSupabase();
  const { data: market } = await supabase
    .from('markets').select('id,code,name,language_code,storefront_domain').eq('code', marketCode).single();
  if (!market) return NextResponse.json({ error: `Markt ${marketCode} niet gevonden` }, { status: 404 });

  const lang = market.language_code ?? 'nl';

  const [{ data: products }, { data: contents }] = await Promise.all([
    supabase.from('products').select('id,shopify_id,shopify_handle,name_nl,ean,sku,price_eur,category').eq('active', true).order('name_nl'),
    supabase.from('feed_product_content').select('product_id,title,description,description_short,description_long,product_url,ai_status,selected_variant_id').eq('language', lang),
  ]);

  const contentMap: Record<string, any> = {};
  for (const c of contents ?? []) contentMap[c.product_id] = c;

  const snapshot = {
    market: marketCode, channel, language: lang,
    captured_at: new Date().toISOString(),
    products: (products ?? []).map(p => ({
      product_id:       p.id,
      shopify_handle:   p.shopify_handle,
      name_nl:          p.name_nl,
      ean:              p.ean,
      price_eur:        p.price_eur,
      title:            contentMap[p.id]?.title ?? p.name_nl,
      description:      contentMap[p.id]?.description ?? null,
      description_short:contentMap[p.id]?.description_short ?? null,
      description_long: contentMap[p.id]?.description_long ?? null,
      product_url:      market.storefront_domain && p.shopify_handle
        ? `https://${market.storefront_domain}/products/${p.shopify_handle}`
        : contentMap[p.id]?.product_url ?? null,
      ai_status:        contentMap[p.id]?.ai_status ?? 'none',
    })),
  };

  // Next version number
  const { count } = await supabase.from('feed_versions')
    .select('*', { count: 'exact', head: true }).eq('market_id', market.id).eq('channel', channel);

  const { data: version, error } = await supabase.from('feed_versions').insert({
    market_id:      market.id,
    channel,
    version_number: (count ?? 0) + 1,
    product_count:  (products ?? []).length,
    snapshot,
    note,
  }).select('id,version_number').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    version_id:     version?.id,
    version_number: version?.version_number,
    product_count:  (products ?? []).length,
    market: marketCode, channel,
  });
}

// ── Rollback to version ───────────────────────────────────────────────────────
async function handleRollback(versionId: string) {
  const supabase = getSupabase();
  const { data: version, error: vErr } = await supabase
    .from('feed_versions')
    .select('id,version_number,snapshot,market_id,markets(code,language_code)')
    .eq('id', versionId).single();

  if (vErr || !version) return NextResponse.json({ error: 'Versie niet gevonden' }, { status: 404 });

  const snap = version.snapshot as any;
  const lang = (version.markets as any)?.language_code ?? snap.language ?? 'nl';
  const snapshotProducts: any[] = snap.products ?? [];

  let restored = 0;
  const errors: string[] = [];

  for (const p of snapshotProducts) {
    if (!p.title) continue;
    try {
      // Get current state for changelog
      const { data: curr } = await supabase.from('feed_product_content')
        .select('title').eq('product_id', p.product_id).eq('language', lang).single();

      const { error: upErr } = await supabase.from('feed_product_content').upsert({
        product_id:        p.product_id,
        language:          lang,
        title:             p.title,
        description:       p.description ?? null,
        description_short: p.description_short ?? null,
        description_long:  p.description_long ?? null,
        ai_status:         'rollback',
      }, { onConflict: 'product_id,language' });

      if (upErr) { errors.push(`${p.product_id}: ${upErr.message}`); continue; }

      await supabase.from('feed_changelog').insert({
        product_id: p.product_id,
        language:   lang,
        field:      'title',
        old_value:  curr?.title ?? null,
        new_value:  p.title,
        source:     `rollback_v${version.version_number}`,
      });

      restored++;
    } catch (e: any) { errors.push(e.message); }
  }

  return NextResponse.json({
    restored, total: snapshotProducts.length,
    version_number: version.version_number,
    errors: errors.length ? errors : undefined,
  });
}
