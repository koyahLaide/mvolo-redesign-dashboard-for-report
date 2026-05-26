import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ── Statistical significance: z-test for two proportions ─────────────────────
function normCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return z > 0 ? 1 - p : p;
}

function zTest(impA: number, clkA: number, impB: number, clkB: number) {
  const MIN_IMP = 100;
  if (impA < MIN_IMP || impB < MIN_IMP) {
    return { z: 0, p_value: 1, significant: false, ctrA: impA > 0 ? clkA / impA : 0, ctrB: impB > 0 ? clkB / impB : 0, needs_more_data: true };
  }
  const ctrA = clkA / impA;
  const ctrB = clkB / impB;
  const pooled = (clkA + clkB) / (impA + impB);
  if (pooled === 0 || pooled === 1) return { z: 0, p_value: 1, significant: false, ctrA, ctrB, needs_more_data: false };
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / impA + 1 / impB));
  if (se === 0) return { z: 0, p_value: 1, significant: false, ctrA, ctrB, needs_more_data: false };
  const z = Math.abs(ctrA - ctrB) / se;
  const p = 2 * (1 - normCDF(z));
  return { z: +z.toFixed(4), p_value: +p.toFixed(4), significant: z >= 1.96, ctrA: +ctrA.toFixed(4), ctrB: +ctrB.toFixed(4), needs_more_data: false };
}

function aggregateMetrics(rows: any[], testId: string) {
  const m = { A: { impressions: 0, clicks: 0, conversions: 0, revenue: 0 }, B: { impressions: 0, clicks: 0, conversions: 0, revenue: 0 } };
  for (const r of rows) {
    if (r.test_id !== testId) continue;
    const g = r.ab_group === 'A' ? 'A' : 'B';
    m[g].impressions  += r.impressions  ?? 0;
    m[g].clicks       += r.clicks       ?? 0;
    m[g].conversions  += r.conversions  ?? 0;
    m[g].revenue      += Number(r.revenue ?? 0);
  }
  return m;
}

// ── GET — list tests or single test ──────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const testId = searchParams.get('test_id');

  if (testId) {
    const [{ data: test }, { data: assignments }, { data: metrics }] = await Promise.all([
      supabase.from('feed_ab_tests')
        .select('id,name,field,language,channel,market_id,status,started_at,ended_at,winner,confidence,variant_a_label,variant_b_label,created_at')
        .eq('id', testId).single(),
      supabase.from('feed_ab_assignments').select('id,product_id,ab_group,value_a,value_b').eq('test_id', testId),
      supabase.from('feed_ab_daily_metrics').select('ab_group,date,impressions,clicks,conversions,revenue').eq('test_id', testId).order('date'),
    ]);
    if (!test) return NextResponse.json({ error: 'Test niet gevonden' }, { status: 404 });

    const productIds = (assignments ?? []).map(a => a.product_id);
    const { data: products } = await supabase.from('products').select('id,name_nl,image_url').in('id', productIds);
    const pm: Record<string, any> = {};
    for (const p of products ?? []) pm[p.id] = p;

    const m = { A: { impressions:0,clicks:0,conversions:0,revenue:0 }, B: { impressions:0,clicks:0,conversions:0,revenue:0 } };
    for (const r of metrics ?? []) {
      const g = r.ab_group === 'A' ? 'A' : 'B';
      m[g].impressions += r.impressions ?? 0; m[g].clicks += r.clicks ?? 0;
      m[g].conversions += r.conversions ?? 0; m[g].revenue += Number(r.revenue ?? 0);
    }
    const sig = zTest(m.A.impressions, m.A.clicks, m.B.impressions, m.B.clicks);

    return NextResponse.json({
      test, assignments: (assignments ?? []).map(a => ({ ...a, product: pm[a.product_id] ?? null })),
      metrics: { A: m.A, B: m.B }, daily: metrics ?? [], significance: sig,
    });
  }

  // List all
  const { data: tests, error } = await supabase
    .from('feed_ab_tests')
    .select('id,name,field,language,channel,status,started_at,ended_at,winner,confidence,variant_a_label,variant_b_label,created_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (tests ?? []).map(t => t.id);
  const { data: allMetrics } = ids.length
    ? await supabase.from('feed_ab_daily_metrics').select('test_id,ab_group,impressions,clicks,conversions,revenue').in('test_id', ids)
    : { data: [] };

  const { data: counts } = ids.length
    ? await supabase.from('feed_ab_assignments').select('test_id').in('test_id', ids)
    : { data: [] };
  const countMap: Record<string, number> = {};
  for (const c of counts ?? []) countMap[c.test_id] = (countMap[c.test_id] ?? 0) + 1;

  const enriched = (tests ?? []).map(t => {
    const m = aggregateMetrics(allMetrics ?? [], t.id);
    const sig = zTest(m.A.impressions, m.A.clicks, m.B.impressions, m.B.clicks);
    // Alert: test running > 14 days with no significance
    const daysRunning = t.started_at ? Math.floor((Date.now() - new Date(t.started_at).getTime()) / 86400000) : 0;
    const stale = t.status === 'active' && daysRunning > 14 && !sig.significant;
    return { ...t, metrics: m, significance: sig, product_count: countMap[t.id] ?? 0, days_running: daysRunning, stale };
  });

  return NextResponse.json({ tests: enriched });
}

// ── POST — create test or add metrics ────────────────────────────────────────
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'metrics') {
    const body = await request.json().catch(() => null);
    const { test_id, ab_group, date, impressions, clicks, conversions, revenue } = body ?? {};
    if (!test_id || !ab_group || !date) {
      return NextResponse.json({ error: 'test_id, ab_group, date zijn verplicht' }, { status: 400 });
    }
    const { data, error } = await supabase.from('feed_ab_daily_metrics').upsert({
      test_id, ab_group, date,
      impressions: impressions ?? 0,
      clicks: clicks ?? 0,
      conversions: conversions ?? 0,
      revenue: revenue ?? 0,
    }, { onConflict: 'test_id,ab_group,date' }).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id });
  }

  // Create test
  const body = await request.json().catch(() => null);
  const { name, field, channel, language, product_ids, market_id, variant_a_label, variant_b_label } = body ?? {};
  if (!name || !field || !Array.isArray(product_ids) || !product_ids.length) {
    return NextResponse.json({ error: 'name, field en product_ids zijn verplicht' }, { status: 400 });
  }

  const { data: test, error: tErr } = await supabase.from('feed_ab_tests').insert({
    name, field,
    channel: channel ?? null,
    language: language ?? 'nl',
    market_id: market_id ?? null,
    status: 'draft',
    variant_a_label: variant_a_label ?? 'Variant A (huidig)',
    variant_b_label: variant_b_label ?? 'Variant B (nieuw)',
  }).select('id,name').single();
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  const lang = language ?? 'nl';
  const [{ data: products }, { data: contents }, imageFetch] = await Promise.all([
    supabase.from('products').select('id,image_url,name_nl').in('id', product_ids),
    supabase.from('feed_product_content').select('product_id,title,description,description_long,ai_variants').eq('language', lang).in('product_id', product_ids),
    field === 'image'
      ? supabase.from('image_bank').select('product_id,storage_url').in('product_id', product_ids).eq('is_active', true).order('created_at')
      : Promise.resolve({ data: [] }),
  ]);

  const contentMap: Record<string, any> = {};
  for (const c of contents ?? []) contentMap[c.product_id] = c;
  const imageMap: Record<string, string> = {};
  for (const img of (imageFetch.data ?? []) as any[]) {
    if (!imageMap[img.product_id]) imageMap[img.product_id] = img.storage_url;
  }

  // Shuffle product_ids for unbiased 50/50 split
  const shuffled = [...product_ids].sort(() => Math.random() - 0.5);
  const assignments = shuffled.map((pid: string, i: number) => {
    const c = contentMap[pid];
    const p = (products ?? []).find(pr => pr.id === pid);
    const ab_group = i < Math.floor(shuffled.length / 2) ? 'A' : 'B';
    let value_a: string | null = null;
    let value_b: string | null = null;

    if (field === 'title') {
      value_a = c?.title ?? p?.name_nl ?? null;
      const ai = (c?.ai_variants as any[] ?? []);
      value_b = ai.find((v: any) => v.compliance === 'green')?.title ?? ai[0]?.title ?? value_a;
    } else if (field === 'description') {
      value_a = c?.description ?? null;
      const ai = (c?.ai_variants as any[] ?? []);
      value_b = ai.find((v: any) => v.compliance === 'green')?.description_long ?? ai[0]?.description_long ?? value_a;
    } else if (field === 'image') {
      value_a = p?.image_url ?? null;
      value_b = imageMap[pid] ?? value_a;
    }

    return { test_id: test!.id, product_id: pid, ab_group, value_a, value_b };
  });

  const { error: aErr } = await supabase.from('feed_ab_assignments').insert(assignments);
  if (aErr) {
    await supabase.from('feed_ab_tests').delete().eq('id', test!.id);
    return NextResponse.json({ error: aErr.message }, { status: 500 });
  }

  return NextResponse.json({ test_id: test!.id, test_name: test!.name, assignments: assignments.length, group_a: assignments.filter(a => a.ab_group === 'A').length, group_b: assignments.filter(a => a.ab_group === 'B').length });
}

// ── PATCH — update test status / declare winner / apply winner ───────────────
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const { id, action, winner } = body ?? {};
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });

  if (action === 'start') {
    const { error } = await supabase.from('feed_ab_tests').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'stop') {
    const { error } = await supabase.from('feed_ab_tests').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'declare_winner') {
    if (!winner || !['A', 'B'].includes(winner)) {
      return NextResponse.json({ error: 'winner moet A of B zijn' }, { status: 400 });
    }
    const { error } = await supabase.from('feed_ab_tests').update({ status: 'ended', ended_at: new Date().toISOString(), winner }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, winner });
  }

  if (action === 'apply_winner') {
    const { data: test } = await supabase.from('feed_ab_tests').select('field,language,winner').eq('id', id).single();
    if (!test?.winner) return NextResponse.json({ error: 'Geen winnaar bepaald voor deze test' }, { status: 400 });

    const { data: assignments } = await supabase.from('feed_ab_assignments').select('product_id,value_a,value_b').eq('test_id', id);
    const lang = test.language ?? 'nl';
    let applied = 0;
    const errors: string[] = [];

    for (const a of assignments ?? []) {
      const winValue = test.winner === 'A' ? a.value_a : a.value_b;
      if (!winValue) continue;
      try {
        const update: Record<string, any> = {};
        if (test.field === 'title') update.title = winValue;
        else if (test.field === 'description') { update.description = winValue; update.description_long = winValue; }
        else if (test.field === 'image') {
          await supabase.from('products').update({ image_url: winValue }).eq('id', a.product_id);
          applied++; continue;
        }
        await supabase.from('feed_product_content').upsert({ product_id: a.product_id, language: lang, ...update }, { onConflict: 'product_id,language' });
        await supabase.from('feed_changelog').insert({ product_id: a.product_id, language: lang, field: test.field, new_value: winValue, source: `ab_winner_${test.winner}` });
        applied++;
      } catch (e: any) { errors.push(`${a.product_id}: ${e.message}`); }
    }

    return NextResponse.json({ applied, total: assignments?.length ?? 0, errors: errors.length ? errors : undefined });
  }

  return NextResponse.json({ error: `Onbekende actie: ${action}` }, { status: 400 });
}

// ── DELETE — remove test ──────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });
  await supabase.from('feed_ab_assignments').delete().eq('test_id', id);
  await supabase.from('feed_ab_daily_metrics').delete().eq('test_id', id);
  const { error } = await supabase.from('feed_ab_tests').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
