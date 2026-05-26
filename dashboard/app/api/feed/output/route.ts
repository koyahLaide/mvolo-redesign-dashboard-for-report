import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Condition = { field: string; operator: string; value?: string | number };
type Rule = {
  id: string; name: string; type: 'filter' | 'transform';
  scope: 'master' | 'partner'; channel: string | null;
  conditions: Condition[]; actions: Record<string, any>;
  priority: number; active: boolean;
};

const FIELD_MAP: Record<string, string> = {
  title: 'name_nl', name: 'name_nl', price: 'price_eur',
  ean: 'ean', sku: 'sku', category: 'category',
  description: 'description_nl', brand: 'brand',
};

function evalCondition(product: Record<string, any>, c: Condition): boolean {
  const key = FIELD_MAP[c.field] ?? c.field;
  const val = product[key];
  switch (c.operator) {
    case 'contains':       return String(val ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase());
    case 'not_contains':   return !String(val ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase());
    case 'equals':         return val == c.value;
    case 'not_equals':     return val != c.value;
    case 'is_empty':       return val === null || val === undefined || val === '' || val === 0;
    case 'is_not_empty':   return val !== null && val !== undefined && val !== '' && val !== 0;
    case 'greater_than':   return Number(val) > Number(c.value);
    case 'less_than':      return Number(val) < Number(c.value);
    default:               return false;
  }
}

function applyTransformAction(out: Record<string, any>, actions: Record<string, any>): Record<string, any> {
  const p = { ...out };
  const at = actions.action_type;

  if (at === 'find_replace' || (!at && !actions.set_field)) {
    const field = FIELD_MAP[actions.field] ?? actions.field;
    if (field && p[field] != null) {
      const src = String(p[field]);
      const find = actions.find ?? '';
      const repl = actions.replace ?? '';
      p[field] = actions.use_regex
        ? (() => { try { return src.replace(new RegExp(find, 'gi'), repl); } catch { return src; } })()
        : src.split(find).join(repl);
    }
  } else if (at === 'prepend_if_missing') {
    const field = FIELD_MAP[actions.field] ?? actions.field;
    if (field) {
      const cur = String(p[field] ?? '');
      const pfx = String(actions.value ?? '');
      if (!cur.toLowerCase().startsWith(pfx.toLowerCase())) p[field] = pfx + cur;
    }
  } else if (at === 'append_if_missing') {
    const field = FIELD_MAP[actions.field] ?? actions.field;
    if (field) {
      const cur = String(p[field] ?? '');
      const sfx = String(actions.value ?? '');
      if (!cur.toLowerCase().endsWith(sfx.toLowerCase())) p[field] = cur + sfx;
    }
  } else if (at === 'copy_field') {
    const from = FIELD_MAP[actions.from_field] ?? actions.from_field;
    const to   = FIELD_MAP[actions.to_field]   ?? actions.to_field;
    if (from && to) p[to] = p[from];
  } else {
    // Legacy: { set_field, value } OR { action_type: 'set_field', set_field, value }
    const { set_field, value } = actions;
    if (set_field && value !== undefined) p[FIELD_MAP[set_field] ?? set_field] = value;
  }
  return p;
}

function applyRules(products: Record<string, any>[], rules: Rule[], channel?: string): Record<string, any>[] {
  // Master rules first (apply to all channels), then partner rules for this channel
  const active = [...rules]
    .filter(r => r.active)
    .filter(r => r.scope !== 'partner' || !channel || r.channel === channel)
    .sort((a, b) => {
      if ((a.scope ?? 'master') !== (b.scope ?? 'master')) return (a.scope ?? 'master') === 'master' ? -1 : 1;
      return a.priority - b.priority;
    });

  return products
    .filter(p => !active.some(r => r.type === 'filter' && (r.conditions ?? []).every(c => evalCondition(p, c))))
    .map(p => {
      let out = { ...p };
      for (const r of active) {
        if (r.type === 'transform' && (r.conditions ?? []).every(c => evalCondition(out, c))) {
          out = applyTransformAction(out, r.actions ?? {});
        }
      }
      return out;
    });
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function csvCell(s: unknown): string {
  const v = String(s ?? '').replace(/"/g, '""');
  return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v}"` : v;
}

function buildGoogleXml(products: Record<string, any>[], market: Record<string, any>): string {
  const items = products.map(p => {
    const title = p._title ?? p.name_nl ?? '';
    // Google Shopping: prefer short description for snippet, fall back to long
    const desc  = ((p._description_short || p._description || p.description_nl) ?? '').substring(0, 5000);
    const price = p.price_eur != null ? `${Number(p.price_eur).toFixed(2)} EUR` : '';
    const sale  = p.sale_price_eur != null && p.sale_price_eur > 0 ? `${Number(p.sale_price_eur).toFixed(2)} EUR` : '';
    const extra = (Array.isArray(p.additional_images) ? p.additional_images : []).slice(0, 9)
      .map((img: string) => `      <g:additional_image_link>${esc(img)}</g:additional_image_link>`)
      .join('\n');
    return [
      '    <item>',
      `      <g:id>${esc(p.shopify_id ?? p.id)}</g:id>`,
      `      <g:title>${esc(title)}</g:title>`,
      `      <g:description>${esc(desc)}</g:description>`,
      `      <g:link>${esc(p._url ?? p.product_url ?? '')}</g:link>`,
      p.image_url ? `      <g:image_link>${esc(p.image_url)}</g:image_link>` : '',
      extra,
      '      <g:availability>in stock</g:availability>',
      '      <g:condition>new</g:condition>',
      price ? `      <g:price>${esc(price)}</g:price>` : '',
      sale  ? `      <g:sale_price>${esc(sale)}</g:sale_price>` : '',
      `      <g:brand>${esc(p.brand ?? 'Mvolo')}</g:brand>`,
      p.ean  ? `      <g:gtin>${esc(p.ean)}</g:gtin>` : '',
      p.sku  ? `      <g:mpn>${esc(p.sku)}</g:mpn>` : '',
      p.category ? `      <g:google_product_category>${esc(p.category)}</g:google_product_category>` : '',
      p.category ? `      <g:product_type>${esc(p.category)}</g:product_type>` : '',
      '    </item>',
    ].filter(Boolean).join('\n');
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>${esc('Mvolo - ' + market.name)}</title>
    <link>https://mvolo.nl</link>
    <description>Mvolo Google Shopping feed – ${esc(market.name)}</description>
${items}
  </channel>
</rss>`;
}

function buildMetaCsv(products: Record<string, any>[]): string {
  const headers = ['id','title','description','availability','condition','price','link','image_link','additional_image_link','brand','gtin','mpn'];
  const rows = products.map(p => [
    p.shopify_id ?? p.id,
    csvCell(p._title ?? p.name_nl),
    csvCell((p._description ?? p.description_nl ?? '').substring(0, 9999)),
    'in stock',
    'new',
    p.price_eur != null ? `${Number(p.price_eur).toFixed(2)} EUR` : '',
    p._url ?? p.product_url ?? '',
    p.image_url ?? '',
    (Array.isArray(p.additional_images) ? p.additional_images[0] : '') ?? '',
    p.brand ?? 'Mvolo',
    p.ean ?? '',
    p.sku ?? '',
  ].map(csvCell).join(','));
  return [headers.join(','), ...rows].join('\n');
}

function buildAwinCsv(products: Record<string, any>[]): string {
  const headers = ['aw_deep_link','product_name','aw_product_id','merchant_product_id','ean','description','category','merchant_image_url','search_price','merchant_category','brand_name'];
  const rows = products.map(p => [
    p._url ?? p.product_url ?? '',
    csvCell(p._title ?? p.name_nl),
    p.shopify_id ?? p.id,
    p.sku ?? p.shopify_id ?? p.id,
    p.ean ?? '',
    csvCell((p._description ?? p.description_nl ?? '').substring(0, 4999)),
    p.category ?? '',
    p.image_url ?? '',
    p.price_eur != null ? Number(p.price_eur).toFixed(2) : '',
    p.category ?? '',
    p.brand ?? 'Mvolo',
  ].map(csvCell).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const marketCode = (searchParams.get('market') ?? 'NL').toUpperCase();
  const channel    = (searchParams.get('channel') ?? 'google').toLowerCase();
  const isPreview  = searchParams.get('preview') === 'true';

  try {
    // 1. Market
    const { data: market, error: mErr } = await supabase
      .from('markets').select('id,code,name,language,language_code,storefront_domain,status')
      .eq('code', marketCode).single();
    if (mErr || !market) {
      return NextResponse.json({ error: `Markt '${marketCode}' niet gevonden` }, { status: 404 });
    }

    // 2. Feed config
    const { data: config, error: cfgErr } = await supabase
      .from('feed_market_configs')
      .select('id,channel,feed_name,is_active')
      .eq('market_id', market.id).eq('channel', channel).single();
    if (cfgErr || !config) {
      console.error('[Feed Output] config error:', cfgErr?.message);
      return NextResponse.json({ error: `Geen feed config voor ${marketCode}/${channel}` }, { status: 404 });
    }

    // 3. Products
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id,shopify_id,shopify_handle,ean,sku,name_nl,description_nl,category,brand,price_eur,sale_price_eur,image_url,additional_images,active')
      .eq('active', true).order('name_nl');
    if (pErr) throw pErr;

    // 4. Localized content
    const lang = market.language_code ?? 'nl';
    const { data: content } = await supabase
      .from('feed_product_content')
      .select('product_id,language,title,description,description_short,description_long,product_url')
      .eq('language', lang);
    const contentMap: Record<string, { title?: string; description?: string; description_short?: string; description_long?: string; product_url?: string }> = {};
    for (const c of content ?? []) contentMap[c.product_id] = c;

    // 5. Enrich with localized fields + per-market URL
    const domain = market.storefront_domain;
    const enriched = (products ?? []).map(p => {
      const c = contentMap[p.id];
      return {
        ...p,
        _title:             c?.title             || p.name_nl,
        _description:       c?.description_long  || c?.description || p.description_nl,
        _description_short: c?.description_short || null,
        _url: domain && p.shopify_handle
          ? `https://${domain}/products/${p.shopify_handle}`
          : (c?.product_url ?? null),
      };
    });

    // 6. Rules
    const { data: rules } = await supabase
      .from('feed_rules').select('id,name,type,scope,channel,conditions,actions,priority,active').order('priority');

    // 7. Apply active A/B test assignments
    const productIds = enriched.map(p => p.id);
    const { data: abAssignments } = await supabase
      .from('feed_ab_assignments')
      .select('product_id,ab_group,value_a,value_b,feed_ab_tests(field,status)')
      .in('product_id', productIds);

    const abMap: Record<string, { group: string; value_a: string | null; value_b: string | null; field: string }> = {};
    for (const a of abAssignments ?? []) {
      const test = (a as any).feed_ab_tests;
      if (test?.status === 'active') {
        abMap[a.product_id] = { group: a.ab_group, value_a: a.value_a, value_b: a.value_b, field: test.field };
      }
    }

    const enrichedWithAb = enriched.map(p => {
      const ab = abMap[p.id];
      if (!ab) return p;
      const val = ab.group === 'A' ? ab.value_a : ab.value_b;
      if (!val) return p;
      if (ab.field === 'title')       return { ...p, _title: val };
      if (ab.field === 'description') return { ...p, _description: val, _description_short: null };
      if (ab.field === 'image')       return { ...p, image_url: val };
      return p;
    });

    // 8. Apply rules (master first, then partner rules for this channel)
    const filtered = applyRules(enrichedWithAb, (rules ?? []) as Rule[], channel);

    // 9. Mark fetch time (not for previews)
    if (!isPreview) {
      await supabase.from('feed_market_configs')
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', config.id);
    }

    // 10. Preview response
    if (isPreview) {
      return NextResponse.json({
        market: marketCode, channel,
        total_before_rules: enriched.length,
        total_after_rules: filtered.length,
        excluded: enriched.length - filtered.length,
        products: filtered.slice(0, 5).map(p => ({
          id: p.shopify_id ?? p.id,
          title: p._title,
          price: p.price_eur,
          ean: p.ean,
          sku: p.sku,
          image: p.image_url,
        })),
      });
    }

    // 11. Full feed
    if (channel === 'google') {
      return new Response(buildGoogleXml(filtered, market), {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Disposition': `inline; filename="${marketCode}_google_shopping.xml"`,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    if (channel === 'meta') {
      return new Response(buildMetaCsv(filtered), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${marketCode}_meta_catalog.csv"`,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    if (channel === 'awin') {
      return new Response(buildAwinCsv(filtered), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${marketCode}_awin.csv"`,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    return NextResponse.json({ error: `Onbekend kanaal: ${channel}` }, { status: 400 });

  } catch (err: any) {
    console.error('[Feed Output]', err);
    return NextResponse.json({ error: err.message ?? 'Feed generatie mislukt' }, { status: 500 });
  }
}
