export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { DB_PATH } from '../../../../lib/db-path';


function rowsToObjects(result: any): Record<string, any>[] {
  if (!result?.columns) return [];
  return result.values.map((row: any[]) =>
    Object.fromEntries(result.columns.map((col: string, i: number) => [col, row[i]]))
  );
}

// ── GET — list all labels (joined with products) ─────────────────────────────
export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('feed_custom_labels')
    .select('product_id,custom_label_0,custom_label_1,custom_label_2,custom_label_3,custom_label_4,label_0_override,label_1_override,label_2_override,label_3_override,label_4_override,updated_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ labels: data ?? [] });
}

// ── POST — auto-calculate labels from SQLite + COGS data ─────────────────────
export async function POST(request: Request) {
  const supabase = getSupabase();
  const body = await request.json().catch(() => ({}));
  if (body?.action !== 'calculate') {
    return NextResponse.json({ error: 'action=calculate is verplicht' }, { status: 400 });
  }

  // 1. Load SQLite order data
  const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db = new SQL.Database(fs.readFileSync(DB_PATH));

  // Revenue by EAN (all time) + units sold last 30 days
  const revenueResult = db.exec(`
    SELECT sku,
      SUM(price * quantity)                                                         AS total_rev,
      SUM(CASE WHEN order_date >= date('now', '-30 days') THEN quantity ELSE 0 END) AS qty_30d
    FROM order_items
    WHERE sku != ''
    GROUP BY sku
  `);
  const orderMap: Record<string, { total_rev: number; qty_30d: number }> = {};
  for (const row of rowsToObjects(revenueResult[0] ?? null)) {
    orderMap[String(row.sku)] = { total_rev: Number(row.total_rev ?? 0), qty_30d: Number(row.qty_30d ?? 0) };
  }

  // 2. Load COGS data (keyed by sku)
  const cogsPath = path.join(process.cwd(), 'data', 'products-cogs.json');
  let cogsMap: Record<string, any> = {};
  try {
    const cogsData = JSON.parse(fs.readFileSync(cogsPath, 'utf-8'));
    for (const p of cogsData.products ?? []) cogsMap[p.sku] = p;
  } catch { /* COGS data optional */ }

  // 3. Supabase products
  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('id,sku,ean,price_eur')
    .eq('active', true);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // 4. Existing labels (to honour overrides)
  const { data: existing } = await supabase
    .from('feed_custom_labels')
    .select('product_id,custom_label_0,custom_label_1,custom_label_2,custom_label_3,custom_label_4,label_0_override,label_1_override,label_2_override,label_3_override,label_4_override');
  const existMap: Record<string, any> = {};
  for (const e of existing ?? []) existMap[e.product_id] = e;

  // 5. Determine Hero revenue threshold (top 20%)
  const revenues = (products ?? [])
    .map(p => orderMap[p.ean ?? '']?.total_rev ?? 0)
    .sort((a, b) => b - a);
  const heroThreshold = revenues[Math.floor(revenues.length * 0.2)] ?? 1;

  // 6. Calculate labels for each product
  const upserts = (products ?? []).map(p => {
    const o = orderMap[p.ean ?? ''] ?? { total_rev: 0, qty_30d: 0 };
    const cogs = cogsMap[p.sku ?? ''];
    const price = Number(p.price_eur ?? 0);
    const ex = existMap[p.id] ?? {};

    // label_0: performance tier
    let l0 = 'Zombie';
    if (o.qty_30d > 0) {
      if (o.total_rev >= heroThreshold) l0 = 'Hero';
      else if (cogs && price > 0 && price < cogs.cogs_sea) l0 = 'Villain';
      else l0 = 'Sidekick';
    }

    // label_1: price tier
    let l1 = 'Budget';
    if (price >= 500) l1 = 'Ultra';
    else if (price >= 200) l1 = 'Premium';
    else if (price >= 50) l1 = 'Mid';

    // label_2: season — always preserve (manual only; auto defaults to Altijd groen)
    const l2 = ex.label_2_override ? (ex.custom_label_2 ?? 'Altijd groen') : 'Altijd groen';

    // label_3: margin tier from COGS
    let l3 = 'Normale marge';
    if (cogs && price > 0) {
      const m = ((price - cogs.cogs_sea) / price) * 100;
      if (m > 60) l3 = 'Hoge marge >60%';
      else if (m < 30) l3 = 'Lage marge <30%';
    }

    // label_4: strategy derived from tier
    let l4 = 'Maintain';
    if (l0 === 'Hero') l4 = 'Push';
    else if (l0 === 'Zombie' || l0 === 'Villain') l4 = 'Phase out';

    return {
      product_id:       p.id,
      custom_label_0:   ex.label_0_override ? ex.custom_label_0 : l0,
      custom_label_1:   ex.label_1_override ? ex.custom_label_1 : l1,
      custom_label_2:   l2,
      custom_label_3:   ex.label_3_override ? ex.custom_label_3 : l3,
      custom_label_4:   ex.label_4_override ? ex.custom_label_4 : l4,
      label_0_override: ex.label_0_override ?? false,
      label_1_override: ex.label_1_override ?? false,
      label_2_override: ex.label_2_override ?? false,
      label_3_override: ex.label_3_override ?? false,
      label_4_override: ex.label_4_override ?? false,
      updated_at:       new Date().toISOString(),
    };
  });

  // 7. Upsert all
  const { error: uErr } = await supabase
    .from('feed_custom_labels')
    .upsert(upserts, { onConflict: 'product_id' });
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  return NextResponse.json({ calculated: upserts.length, hero_threshold: heroThreshold });
}

// ── PATCH — manual override for a single label ────────────────────────────────
export async function PATCH(request: Request) {
  const supabase = getSupabase();
  const body = await request.json().catch(() => null);
  const { product_id, label_key, value } = body ?? {};
  if (!product_id || !label_key) {
    return NextResponse.json({ error: 'product_id en label_key zijn verplicht' }, { status: 400 });
  }

  const idx = ['custom_label_0','custom_label_1','custom_label_2','custom_label_3','custom_label_4'].indexOf(label_key);
  if (idx === -1) return NextResponse.json({ error: 'Ongeldig label_key' }, { status: 400 });

  const overrideKey = `label_${idx}_override`;
  const patch: Record<string, any> = {
    [label_key]: value ?? null,
    [overrideKey]: value !== null && value !== '',
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('feed_custom_labels')
    .upsert({ product_id, ...patch }, { onConflict: 'product_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
