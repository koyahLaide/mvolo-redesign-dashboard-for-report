import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function csvCell(s: unknown): string {
  const v = String(s ?? '').replace(/"/g, '""');
  return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v}"` : v;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const marketCode = (searchParams.get('market') ?? 'NL').toUpperCase();

  try {
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id,shopify_id')
      .eq('active', true)
      .order('name_nl');
    if (pErr) throw pErr;

    const productIds = (products ?? []).map(p => p.id);
    const { data: labels } = productIds.length
      ? await supabase
          .from('feed_custom_labels')
          .select('product_id,custom_label_0,custom_label_1,custom_label_2,custom_label_3,custom_label_4')
          .in('product_id', productIds)
      : { data: [] };

    const lMap: Record<string, any> = {};
    for (const l of labels ?? []) lMap[l.product_id] = l;

    const headers = 'id,custom_label_0,custom_label_1,custom_label_2,custom_label_3,custom_label_4';
    const rows = (products ?? []).map(p => {
      const l = lMap[p.id] ?? {};
      return [
        p.shopify_id ?? p.id,
        l.custom_label_0 ?? '',
        l.custom_label_1 ?? '',
        l.custom_label_2 ?? '',
        l.custom_label_3 ?? '',
        l.custom_label_4 ?? '',
      ].map(csvCell).join(',');
    });

    return new Response([headers, ...rows].join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `inline; filename="${marketCode}_supplemental.csv"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
