import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';


type ReviewItem = { product_id: string; language: string; variant_id?: string };

// ── POST — approve / reject ───────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = getSupabase();
  const body = await request.json().catch(() => null);
  if (!body?.action || !Array.isArray(body?.items) || !body.items.length) {
    return NextResponse.json({ error: 'action en items zijn verplicht' }, { status: 400 });
  }
  if (!['approve', 'reject'].includes(body.action)) {
    return NextResponse.json({ error: 'action moet approve of reject zijn' }, { status: 400 });
  }

  const { action, items }: { action: 'approve' | 'reject'; items: ReviewItem[] } = body;
  let processed = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const { data: content, error: cErr } = await supabase
        .from('feed_product_content')
        .select('id,title,description,description_short,description_long,ai_variants,ai_status')
        .eq('product_id', item.product_id)
        .eq('language', item.language)
        .single();

      if (cErr || !content) { errors.push(`${item.product_id}/${item.language}: niet gevonden`); continue; }

      if (action === 'approve') {
        const variants = (content.ai_variants as any[]) ?? [];
        const variant  = item.variant_id
          ? variants.find(v => v.id === item.variant_id)
          : (variants.find(v => v.compliance === 'green') ?? variants[0]);

        if (!variant) { errors.push(`${item.product_id}: variant ${item.variant_id ?? 'default'} niet gevonden`); continue; }

        const oldTitle = content.title;
        const oldDesc  = content.description;

        await supabase.from('feed_product_content').update({
          title:               variant.title,
          description:         variant.description_long ?? variant.description ?? null,
          description_short:   variant.description_short ?? null,
          description_long:    variant.description_long  ?? null,
          ai_status:           'approved',
          selected_variant_id: variant.id,
          approved_at:         new Date().toISOString(),
        }).eq('id', content.id);

        // Log both field changes in one insert batch
        await supabase.from('feed_changelog').insert([
          { product_id: item.product_id, language: item.language, field: 'title',       old_value: oldTitle, new_value: variant.title,                               source: 'ai_approve' },
          { product_id: item.product_id, language: item.language, field: 'description', old_value: oldDesc,  new_value: variant.description_long ?? variant.description ?? null, source: 'ai_approve' },
        ]);
      } else {
        await supabase.from('feed_product_content')
          .update({ ai_status: 'rejected' }).eq('id', content.id);

        await supabase.from('feed_changelog').insert({
          product_id: item.product_id,
          language:   item.language,
          field:      'ai_status',
          old_value:  'pending',
          new_value:  'rejected',
          source:     'ai_reject',
        });
      }

      processed++;
    } catch (e: any) {
      errors.push(`${item.product_id}: ${e.message}`);
    }
  }

  return NextResponse.json({ action, processed, total: items.length, errors: errors.length ? errors : undefined });
}

// ── GET — review queue / changelog ───────────────────────────────────────────
export async function GET(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const language = searchParams.get('language') ?? 'nl';
  const status   = searchParams.get('status')   ?? 'pending';
  const action   = searchParams.get('action');

  // Changelog mode
  if (action === 'changelog') {
    const { data } = await supabase
      .from('feed_changelog')
      .select('id,field,old_value,new_value,source,language,created_at,product_id')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data?.length) return NextResponse.json({ entries: [] });

    const productIds = [...new Set(data.map(e => e.product_id).filter(Boolean))];
    const { data: prods } = await supabase
      .from('products').select('id,name_nl').in('id', productIds);
    const pm: Record<string, string> = {};
    for (const p of prods ?? []) pm[p.id] = p.name_nl;

    return NextResponse.json({
      entries: data.map(e => ({ ...e, product_name: e.product_id ? (pm[e.product_id] ?? null) : null })),
    });
  }

  // Review queue mode
  const { data: contents, error } = await supabase
    .from('feed_product_content')
    .select('id,product_id,language,title,description,description_short,description_long,ai_variants,ai_status,selected_variant_id,channel_optimized_for,season,ctr_14d,approved_at')
    .eq('language', language)
    .eq('ai_status', status)
    .order('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!contents?.length) return NextResponse.json({ items: [] });

  const productIds = [...new Set(contents.map(c => c.product_id))];
  const { data: products } = await supabase
    .from('products').select('id,name_nl,image_url,category,price_eur,shopify_handle')
    .in('id', productIds);
  const pm: Record<string, any> = {};
  for (const p of products ?? []) pm[p.id] = p;

  return NextResponse.json({
    items: contents.map(c => ({ ...c, product: pm[c.product_id] ?? null })),
  });
}
