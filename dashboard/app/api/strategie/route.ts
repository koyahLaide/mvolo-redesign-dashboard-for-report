export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import pool from '../../../lib/db';

export async function GET() {
  try {
    const cogsPath = path.join(process.cwd(), 'data', 'products-cogs.json');
    const cogsData = JSON.parse(fs.readFileSync(cogsPath, 'utf-8'));
    const cogsMap: Record<string, any> = {};
    cogsData.products.forEach((p: any) => { cogsMap[p.sku] = p; });

    // 1. Bundle pairs
    let bundlePairs: any[] = [];
    try {
      const bundleResult = await pool.query(`
        SELECT bp.sku_a, bp.sku_b, bp.samen_gekocht, bp.cross_sell_freq, bp.gem_dagen_cross,
          oi_a.title as naam_a, oi_b.title as naam_b
        FROM bundle_pairs bp
        LEFT JOIN (SELECT sku, MIN(title) as title FROM order_items WHERE sku != '' GROUP BY sku) oi_a ON oi_a.sku = bp.sku_a
        LEFT JOIN (SELECT sku, MIN(title) as title FROM order_items WHERE sku != '' GROUP BY sku) oi_b ON oi_b.sku = bp.sku_b
        ORDER BY (bp.samen_gekocht * 2 + bp.cross_sell_freq) DESC
        LIMIT 20
      `);
      bundlePairs = bundleResult.rows.map((r: any) => ({
        ...r,
        naam_a: r.naam_a?.substring(0, 40) ?? r.sku_a,
        naam_b: r.naam_b?.substring(0, 40) ?? r.sku_b,
        cogs_a: cogsMap[r.sku_a]?.cogs_sea ?? null,
        cogs_b: cogsMap[r.sku_b]?.cogs_sea ?? null,
      }));
    } catch { bundlePairs = []; }

    // 2. Seizoensgewichten
    let seasonWeights: any[] = [];
    try {
      const seasonResult = await pool.query(`SELECT month, avg_orders, avg_revenue, weight FROM season_weights ORDER BY month`);
      seasonWeights = seasonResult.rows;
    } catch { seasonWeights = []; }

    // 3. Predictive reorder
    const currentMonth = new Date().getMonth() + 1;
    const nextMonth    = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextWeight   = seasonWeights.find((s: any) => parseInt(s.month) === nextMonth)?.weight ?? 1.0;
    const currentWeight = seasonWeights.find((s: any) => parseInt(s.month) === currentMonth)?.weight ?? 1.0;

    const velocityResult = await pool.query(`
      SELECT sku, SUM(quantity) * 1.0 / 30 as daily
      FROM order_items WHERE order_date >= CURRENT_DATE - INTERVAL '30 days' AND sku != ''
      GROUP BY sku
    `);
    const velocity: Record<string, number> = {};
    velocityResult.rows.forEach((r: any) => { velocity[r.sku] = parseFloat(r.daily); });

    const shopifyRes = await fetch(
      `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/products.json?limit=250&fields=id,title,variants`,
      { headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_TOKEN! } }
    );
    const shopifyData = await shopifyRes.json();
    const inventory: Record<string, { title: string; stock: number; price: number }> = {};
    for (const p of shopifyData.products ?? []) {
      for (const v of p.variants ?? []) {
        if (v.sku) inventory[String(v.sku)] = { title: p.title, stock: v.inventory_quantity, price: parseFloat(v.price) };
      }
    }

    const { lead_times, safety_stock_days } = cogsData;
    const sea_lead = lead_times.production_days + lead_times.sea_days + safety_stock_days;

    const predictiveReorder: any[] = [];
    for (const p of cogsData.products) {
      const inv = inventory[p.sku];
      if (!inv) continue;
      const stock = inv.stock;
      const vel = velocity[p.sku] || 0;
      if (vel === 0) continue;

      const adjustedVel = vel * parseFloat(nextWeight);
      const days_left = Math.round(stock / vel);
      const days_left_adjusted = Math.round(stock / adjustedVel);
      const reorder_qty_normal = Math.max(0, Math.ceil(vel * 90) - stock);
      const reorder_qty_seasonal = Math.max(0, Math.ceil(adjustedVel * 90) - stock);
      const extra_for_season = Math.max(0, reorder_qty_seasonal - reorder_qty_normal);

      if (days_left < sea_lead + 30 || extra_for_season > 0) {
        predictiveReorder.push({
          name: p.name, sku: p.sku, stock,
          velocity_30d: Math.round(vel * 100) / 100,
          next_month_weight: parseFloat(nextWeight),
          adjusted_velocity: Math.round(adjustedVel * 100) / 100,
          days_left, days_left_adjusted, reorder_qty_normal, reorder_qty_seasonal, extra_for_season,
          cogs_sea: p.cogs_sea,
          total_cost_normal: Math.round(reorder_qty_normal * p.cogs_sea),
          total_cost_seasonal: Math.round(reorder_qty_seasonal * p.cogs_sea),
          urgency: stock <= 0 ? 'KRITIEK' : days_left_adjusted < sea_lead ? 'SEIZOEN URGENT' : 'PLAN',
        });
      }
    }
    predictiveReorder.sort((a, b) => {
      const o: Record<string, number> = { KRITIEK: 0, 'SEIZOEN URGENT': 1, PLAN: 2 };
      return (o[a.urgency] ?? 9) - (o[b.urgency] ?? 9);
    });

    // 4. Contribution margin per kanaal
    const channelResult = await pool.query(`
      SELECT o.channel,
        COUNT(DISTINCT o.id) as orders,
        ROUND(SUM(o.total_price)::numeric, 2) as revenue,
        ROUND(AVG(o.total_price)::numeric, 2) as aov
      FROM orders o
      WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY o.channel ORDER BY revenue DESC
    `);
    const channels = channelResult.rows;

    const skuCogsResult = await pool.query(`
      SELECT o.channel, oi.sku, oi.price, SUM(oi.quantity) as qty,
        ROUND(SUM(oi.price * oi.quantity)::numeric, 2) as revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.sku != '' AND oi.price > 0 AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY o.channel, oi.sku, oi.price
    `);

    const channelCogs: Record<string, { revenue: number; cogs: number }> = {};
    skuCogsResult.rows.forEach((r: any) => {
      const p = cogsMap[r.sku];
      if (!p?.cogs_sea) return;
      if (!channelCogs[r.channel]) channelCogs[r.channel] = { revenue: 0, cogs: 0 };
      channelCogs[r.channel].revenue += parseFloat(r.revenue);
      channelCogs[r.channel].cogs += p.cogs_sea * parseInt(r.qty);
    });

    const estimatedCac: Record<string, number> = {
      meta_ads: 25, awin_affiliate: 0, google_ads: 20,
      organic_search: 0, direct: 0, email: 0, organic_social: 0,
    };

    const contributionMargin = channels.map((ch: any) => {
      const cogs = channelCogs[ch.channel];
      const grossProfit = cogs ? Math.round(cogs.revenue - cogs.cogs) : null;
      const grossMarginPct = cogs && cogs.revenue > 0 ? Math.round(((cogs.revenue - cogs.cogs) / cogs.revenue) * 100) : null;
      const estCac = estimatedCac[ch.channel] ?? 0;
      const totalCac = estCac * parseInt(ch.orders);
      const contribution = grossProfit !== null ? grossProfit - totalCac : null;
      const contributionPct = cogs && cogs.revenue > 0 ? Math.round(((contribution ?? 0) / cogs.revenue) * 100) : null;
      return {
        channel: ch.channel, orders: parseInt(ch.orders),
        revenue: parseFloat(ch.revenue), aov: parseFloat(ch.aov),
        gross_profit: grossProfit, gross_margin_pct: grossMarginPct,
        est_cac: estCac, total_cac: totalCac, contribution, contribution_pct: contributionPct,
      };
    });

    // 5. Cross-sell aanbevelingen
    const crossSellRecs: any[] = bundlePairs
      .filter((p: any) => p.cross_sell_freq >= 1 || p.samen_gekocht >= 2)
      .slice(0, 10)
      .map((p: any) => {
        const cogB = cogsMap[p.sku_b];
        const invA = inventory[p.sku_a];
        const invB = inventory[p.sku_b];
        return {
          ...p,
          prijs_a: invA?.price ?? null,
          prijs_b: invB?.price ?? null,
          stock_b: invB?.stock ?? null,
          margin_b: cogB?.cogs_sea && invB?.price ? Math.round(((invB.price - cogB.cogs_sea) / invB.price) * 100) : null,
          trigger: p.cross_sell_freq > 0 ? `Email na ${p.gem_dagen_cross ?? 14} dagen` : 'Bundel aanbeveling',
        };
      });

    return NextResponse.json({
      bundlePairs, seasonWeights, predictiveReorder, contributionMargin, crossSellRecs,
      nextMonth, nextMonthWeight: parseFloat(nextWeight), currentMonthWeight: parseFloat(currentWeight),
    });

  } catch (err: any) {
    console.error('Strategie API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
