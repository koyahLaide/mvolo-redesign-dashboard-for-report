import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Condition = { field: string; operator: string; value?: string | number };
type Rule = {
  id: string; name: string; type: 'filter' | 'transform';
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

function applyRules(products: Record<string, any>[], rules: Rule[]): Record<string, any>[] {
  const active = [...rules].filter(r => r.active).sort((a, b) => a.priority - b.priority);
  return products
    .filter(p => !active.some(r => r.type === 'filter' && (r.conditions ?? []).every(c => evalCondition(p, c))))
    .map(p => {
      let out = { ...p };
      for (const r of active) {
        if (r.type === 'transform' && (r.conditions ?? []).every(c => evalCondition(out, c))) {
          const { set_field, value } = r.actions ?? {};
          if (set_field && value !== undefined) out[set_field] = value;
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
    const desc  = (p._description ?? p.description_nl ?? '').substring(0, 5000);
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
      .select('product_id,language,title,description,product_url')
      .eq('language', lang);
    const contentMap: Record<string, { title?: string; description?: string; product_url?: string }> = {};
    for (const c of content ?? []) contentMap[c.product_id] = c;

    // 5. Enrich with localized fields + per-market URL
    const domain = market.storefront_domain;
    const enriched = (products ?? []).map(p => ({
      ...p,
      _title:       contentMap[p.id]?.title       || p.name_nl,
      _description: contentMap[p.id]?.description || p.description_nl,
      _url:         domain && p.shopify_handle
        ? `https://${domain}/products/${p.shopify_handle}`
        : (contentMap[p.id]?.product_url ?? null),
    }));

    // 6. Rules
    const { data: rules } = await supabase
      .from('feed_rules').select('id,name,type,conditions,actions,priority,active').order('priority');

    // 7. Apply rules
    const filtered = applyRules(enriched, (rules ?? []) as Rule[]);

    // 8. Mark fetch time (not for previews)
    if (!isPreview) {
      await supabase.from('feed_market_configs')
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', config.id);
    }

    // 9. Preview response
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

    // 10. Full feed
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
