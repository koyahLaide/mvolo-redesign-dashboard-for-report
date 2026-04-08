export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { DB_PATH } from '../../../lib/db-path';

function rowsToObjects(result: any) {
  if (!result || !result.columns) return [];
  return result.values.map((row: any[]) =>
    Object.fromEntries(result.columns.map((col: string, i: number) => [col, row[i]]))
  );
}

export async function GET() {
  try {
    const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const db = new SQL.Database(fs.readFileSync(DB_PATH));

    // ── Week-over-week ────────────────────────────────────────────────────────
    const wowResult = db.exec(`
      SELECT
        ROUND(SUM(CASE WHEN created_at >= date('now','-7 days')  THEN total_price ELSE 0 END), 2) as this_week_rev,
        ROUND(SUM(CASE WHEN created_at >= date('now','-14 days') AND created_at < date('now','-7 days') THEN total_price ELSE 0 END), 2) as last_week_rev,
        SUM(CASE WHEN created_at >= date('now','-7 days')  THEN 1 ELSE 0 END) as this_week_orders,
        SUM(CASE WHEN created_at >= date('now','-14 days') AND created_at < date('now','-7 days') THEN 1 ELSE 0 END) as last_week_orders
      FROM orders
    `);
    const wow = wowResult.length ? rowsToObjects(wowResult[0])[0] : null;
    const revChange = wow && wow.last_week_rev > 0
      ? Math.round(((wow.this_week_rev - wow.last_week_rev) / wow.last_week_rev) * 100)
      : null;
    const orderChange = wow && wow.last_week_orders > 0
      ? Math.round(((wow.this_week_orders - wow.last_week_orders) / wow.last_week_orders) * 100)
      : null;

    // ── Vandaag vs gisteren ───────────────────────────────────────────────────
    const todayResult = db.exec(`
      SELECT
        ROUND(SUM(CASE WHEN DATE(created_at) = DATE('now') THEN total_price ELSE 0 END), 2) as today_rev,
        SUM(CASE WHEN DATE(created_at) = DATE('now') THEN 1 ELSE 0 END) as today_orders,
        ROUND(SUM(CASE WHEN DATE(created_at) = DATE('now','-1 day') THEN total_price ELSE 0 END), 2) as yesterday_rev,
        SUM(CASE WHEN DATE(created_at) = DATE('now','-1 day') THEN 1 ELSE 0 END) as yesterday_orders
      FROM orders
    `);
    const today = todayResult.length ? rowsToObjects(todayResult[0])[0] : null;

    // ── Kritieke voorraad ─────────────────────────────────────────────────────
    const cogsPath = path.join(process.cwd(), 'data', 'products-cogs.json');
    const cogsData = JSON.parse(fs.readFileSync(cogsPath, 'utf-8'));

    const shopifyRes = await fetch(
      `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/products.json?limit=250&fields=id,title,variants`,
      { headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_TOKEN! } }
    );
    const shopifyData = await shopifyRes.json();
    const inventory: Record<string, { title: string; stock: number }> = {};
    for (const p of shopifyData.products ?? []) {
      for (const v of p.variants ?? []) {
        if (v.sku) inventory[String(v.sku)] = { title: p.title, stock: v.inventory_quantity };
      }
    }

    const velocityResult = db.exec(`
      SELECT sku, SUM(quantity) * 1.0 / 30 as daily
      FROM order_items WHERE order_date >= date('now','-30 days') AND sku != ''
      GROUP BY sku
    `);
    const velocity: Record<string, number> = {};
    if (velocityResult.length) rowsToObjects(velocityResult[0]).forEach((r: any) => { velocity[r.sku] = r.daily; });

    const { lead_times, safety_stock_days } = cogsData;
    const sea_lead = lead_times.production_days + lead_times.sea_days + safety_stock_days;

    const criticalProducts: any[] = [];
    for (const p of cogsData.products) {
      const inv = inventory[p.sku];
      if (!inv) continue;
      const stock = inv.stock;
      const vel = velocity[p.sku] || 0;
      const days_left = vel > 0 ? Math.round(stock / vel) : (stock > 0 ? 999 : 0);
      if (stock <= 0 || (vel > 0 && days_left < sea_lead)) {
        criticalProducts.push({
          name: p.name,
          sku: p.sku,
          stock,
          days_left: days_left > 900 ? null : days_left,
          urgency: stock <= 0 ? 'KRITIEK' : days_left < 30 ? 'URGENT' : 'BESTEL',
        });
      }
    }
    criticalProducts.sort((a, b) => (a.stock < b.stock ? -1 : 1));

    // ── Kanaal anomalie (deze week vs vorige week per kanaal) ─────────────────
    const channelWowResult = db.exec(`
      SELECT channel,
        SUM(CASE WHEN created_at >= date('now','-7 days') THEN 1 ELSE 0 END) as this_week,
        SUM(CASE WHEN created_at >= date('now','-14 days') AND created_at < date('now','-7 days') THEN 1 ELSE 0 END) as last_week
      FROM orders
      GROUP BY channel
      HAVING last_week > 0 OR this_week > 0
      ORDER BY last_week DESC
    `);
    const channelWow = channelWowResult.length ? rowsToObjects(channelWowResult[0]).map((r: any) => ({
      channel: r.channel,
      this_week: r.this_week,
      last_week: r.last_week,
      change_pct: r.last_week > 0 ? Math.round(((r.this_week - r.last_week) / r.last_week) * 100) : null,
    })) : [];

    // ── Email timing aanbeveling ──────────────────────────────────────────────
    let emailAdvice: any = null;
    try {
      const reportPath = path.join(process.cwd(), 'data', 'email-timing-report.json');
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      const best = report.dow_stats?.[0];
      emailAdvice = best ? {
        best_day:         best.dag,
        best_times:       report.recommendations?.best_times ?? ['16:00–18:00'],
        rev_per_email:    best.rev_per_email,
        best_campaign_type: report.recommendations?.best_campaign_type,
      } : null;
    } catch { emailAdvice = null; }

    // ── Meest verkochte SKU vandaag ───────────────────────────────────────────
    const todaySkuResult = db.exec(`
      SELECT oi.sku, oi.title, SUM(oi.quantity) as qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE DATE(o.created_at) = DATE('now') AND oi.sku != ''
      GROUP BY oi.sku ORDER BY qty DESC LIMIT 3
    `);
    const todaySkus = todaySkuResult.length ? rowsToObjects(todaySkuResult[0]) : [];

    db.close();

    return NextResponse.json({
      wow: {
        this_week_rev:    wow?.this_week_rev    ?? 0,
        last_week_rev:    wow?.last_week_rev    ?? 0,
        this_week_orders: wow?.this_week_orders ?? 0,
        last_week_orders: wow?.last_week_orders ?? 0,
        rev_change_pct:   revChange,
        order_change_pct: orderChange,
      },
      today: {
        revenue: today?.today_rev    ?? 0,
        orders:  today?.today_orders ?? 0,
        yesterday_revenue: today?.yesterday_rev    ?? 0,
        yesterday_orders:  today?.yesterday_orders ?? 0,
      },
      critical_products: criticalProducts.slice(0, 5),
      channel_wow:       channelWow,
      email_advice:      emailAdvice,
      today_skus:        todaySkus,
    });

  } catch (err: any) {
    console.error('Actions API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
