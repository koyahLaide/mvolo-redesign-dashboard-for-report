import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';


// ── GET — fetch all panel data for a product ──────────────────────────────────
export async function GET(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('product_id');
  if (!productId) return NextResponse.json({ error: 'product_id is verplicht' }, { status: 400 });

  const [
    { data: contentRows },
    { data: images },
    { data: changelog },
    { data: abAssignments },
    { data: feedConfigs },
    { data: markets },
    { data: rules },
  ] = await Promise.all([
    supabase.from('feed_product_content')
      .select('product_id,language,title,description,description_short,description_long,ai_variants,ai_status,selected_variant_id,approved_at,ctr_14d')
      .eq('product_id', productId),
    supabase.from('image_bank')
      .select('id,filename,storage_url,image_type,is_active,created_at')
      .eq('product_id', productId)
      .order('created_at'),
    supabase.from('feed_changelog')
      .select('id,field,old_value,new_value,source,language,created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase.from('feed_ab_assignments')
      .select('id,test_id,ab_group,value_a,value_b,feed_ab_tests(id,name,field,status,variant_a_label,variant_b_label)')
      .eq('product_id', productId),
    supabase.from('feed_market_configs').select('id,market_id,channel,feed_name,is_active'),
    supabase.from('markets').select('id,code,name,language_code'),
    supabase.from('feed_rules').select('id,name,type,conditions,actions,priority,active').eq('active', true).order('priority'),
  ]);

  // Build content map keyed by language
  const contentMap: Record<string, any> = {};
  for (const c of contentRows ?? []) contentMap[c.language] = c;

  // Evaluate feed status per channel (basic rule engine)
  const feedStatus: { config_id: string; feed_name: string; market_code: string; channel: string; included: boolean; excluded_by?: string }[] = [];
  const { data: product } = await supabase.from('products')
    .select('id,name_nl,ean,sku,category,brand,price_eur,description_nl,active')
    .eq('id', productId).single();

  if (product) {
    const evalCond = (p: any, c: any) => {
      const FMAP: Record<string, string> = { title:'name_nl', name:'name_nl', price:'price_eur', ean:'ean', sku:'sku', category:'category', description:'description_nl', brand:'brand' };
      const val = p[FMAP[c.field] ?? c.field];
      switch (c.operator) {
        case 'contains':     return String(val ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase());
        case 'not_contains': return !String(val ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase());
        case 'equals':       return val == c.value;
        case 'not_equals':   return val != c.value;
        case 'is_empty':     return val === null || val === undefined || val === '' || val === 0;
        case 'is_not_empty': return val !== null && val !== undefined && val !== '' && val !== 0;
        case 'greater_than': return Number(val) > Number(c.value);
        case 'less_than':    return Number(val) < Number(c.value);
        default:             return false;
      }
    };

    const activeRules = (rules ?? []).filter(r => r.active);

    for (const cfg of feedConfigs ?? []) {
      const mkt = (markets ?? []).find(m => m.id === cfg.market_id);
      if (!cfg.is_active) continue;
      const excludingRule = activeRules.find(r => r.type === 'filter' && (r.conditions ?? []).every((c: any) => evalCond(product, c)));
      feedStatus.push({
        config_id: cfg.id,
        feed_name: cfg.feed_name || `${mkt?.code} ${cfg.channel}`,
        market_code: mkt?.code ?? '?',
        channel: cfg.channel,
        included: !excludingRule,
        excluded_by: excludingRule?.name,
      });
    }
  }

  return NextResponse.json({
    content:      contentMap,
    images:       images ?? [],
    changelog:    changelog ?? [],
    feed_status:  feedStatus,
    ab_assignments: (abAssignments ?? []).map(a => ({
      ...a,
      test: (a as any).feed_ab_tests,
    })),
  });
}

// ── POST — save content for a language ───────────────────────────────────────
export async function POST(request: Request) {
  const supabase = getSupabase();
  const body = await request.json().catch(() => null);
  const { product_id, language, title, description_short, description_long, description } = body ?? {};
  if (!product_id || !language) {
    return NextResponse.json({ error: 'product_id en language zijn verplicht' }, { status: 400 });
  }

  // Get current for changelog
  const { data: curr } = await supabase.from('feed_product_content')
    .select('title,description').eq('product_id', product_id).eq('language', language).single();

  const { error } = await supabase.from('feed_product_content').upsert({
    product_id, language,
    ...(title             !== undefined ? { title }             : {}),
    ...(description_short !== undefined ? { description_short } : {}),
    ...(description_long  !== undefined ? { description_long, description: description_long } : {}),
    ...(description       !== undefined ? { description }       : {}),
  }, { onConflict: 'product_id,language' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log changes
  const logs = [];
  if (title !== undefined && title !== curr?.title) {
    logs.push({ product_id, language, field: 'title', old_value: curr?.title ?? null, new_value: title, source: 'manual_edit' });
  }
  if ((description_long || description) !== undefined) {
    const newDesc = description_long ?? description ?? null;
    if (newDesc !== curr?.description) {
      logs.push({ product_id, language, field: 'description', old_value: curr?.description ?? null, new_value: newDesc, source: 'manual_edit' });
    }
  }
  if (logs.length) await supabase.from('feed_changelog').insert(logs);

  return NextResponse.json({ ok: true });
}

// ── PUT — update ai_variants (manual edit/add) ────────────────────────────────
export async function PUT(request: Request) {
  const supabase = getSupabase();
  const body = await request.json().catch(() => null);
  const { product_id, language, ai_variants } = body ?? {};
  if (!product_id || !language || !Array.isArray(ai_variants)) {
    return NextResponse.json({ error: 'product_id, language, ai_variants zijn verplicht' }, { status: 400 });
  }

  const { error } = await supabase.from('feed_product_content').upsert({
    product_id, language, ai_variants,
  }, { onConflict: 'product_id,language' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
