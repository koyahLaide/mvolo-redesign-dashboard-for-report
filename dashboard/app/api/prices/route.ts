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

    // 1. Marge per kanaal
    const channelResult = await pool.query(`
      SELECT
        o.channel,
        COUNT(DISTINCT o.id) as orders,
        ROUND(SUM(o.total_price)::numeric, 2) as revenue,
        ROUND(AVG(o.total_price)::numeric, 2) as aov,
        COUNT(DISTINCT oi.sku) as unique_skus,
        ROUND(SUM(oi.price * oi.quantity)::numeric, 2) as item_revenue
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.channel
      ORDER BY revenue DESC
    `);
    const channels = channelResult.rows;

    const skuCogsResult = await pool.query(`
      SELECT o.channel, oi.sku, oi.price, SUM(oi.quantity) as qty,
        ROUND(SUM(oi.price * oi.quantity)::numeric, 2) as revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.sku != '' AND oi.price > 0
      GROUP BY o.channel, oi.sku, oi.price
    `);

    const channelMarginsByChannel: Record<string, { revenue: number; cogs: number; qty: number }> = {};
    skuCogsResult.rows.forEach((r: any) => {
      const p = cogsMap[r.sku];
      if (!p || !p.cogs_sea) return;
      if (!channelMarginsByChannel[r.channel]) channelMarginsByChannel[r.channel] = { revenue: 0, cogs: 0, qty: 0 };
      channelMarginsByChannel[r.channel].revenue += parseFloat(r.revenue);
      channelMarginsByChannel[r.channel].cogs    += p.cogs_sea * parseInt(r.qty);
      channelMarginsByChannel[r.channel].qty     += parseInt(r.qty);
    });

    const channelWithMargin = channels.map((ch: any) => {
      const m = channelMarginsByChannel[ch.channel];
      const gross_profit = m ? Math.round(m.revenue - m.cogs) : null;
      const margin_pct   = m && m.revenue > 0 ? Math.round(((m.revenue - m.cogs) / m.revenue) * 100) : null;
      return { ...ch, gross_profit, margin_pct };
    });

    // Shopify inventory
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

    // 2. Prijs × volume per SKU
    const priceResult = await pool.query(`
      SELECT oi.sku, oi.price, SUM(oi.quantity) as qty,
        COUNT(DISTINCT o.id) as orders,
        string_agg(DISTINCT o.channel, ',') as channels
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.sku != '' AND oi.price > 5
      GROUP BY oi.sku, oi.price
      ORDER BY oi.sku, qty DESC
    `);
    const priceRows = priceResult.rows;

    const bysku: Record<string, any[]> = {};
    priceRows.forEach((r: any) => {
      if (!bysku[r.sku]) bysku[r.sku] = [];
      bysku[r.sku].push(r);
    });

    const priceAnalysis: any[] = [];
    Object.entries(bysku).forEach(([sku, prices]) => {
      const p = cogsMap[sku];
      if (!p) return;

      const totalQty = prices.reduce((s, r: any) => s + parseInt(r.qty), 0);
      const totalRevenue = prices.reduce((s, r: any) => s + parseFloat(r.price) * parseInt(r.qty), 0);
      const maxPrice = Math.max(...prices.map((r: any) => parseFloat(r.price)));
      const minPrice = Math.min(...prices.map((r: any) => parseFloat(r.price)));
      const bestVolume = prices[0];

      const scored = prices.map((r: any) => ({
        ...r,
        margin_pct: p.cogs_sea ? Math.round(((parseFloat(r.price) - p.cogs_sea) / parseFloat(r.price)) * 100) : null,
        pct_of_volume: Math.round((parseInt(r.qty) / totalQty) * 100),
        revenue_contribution: Math.round((parseFloat(r.price) * parseInt(r.qty) / totalRevenue) * 100),
        score: p.cogs_sea ? Math.round((parseInt(r.qty) / totalQty) * ((parseFloat(r.price) - p.cogs_sea) / parseFloat(r.price)) * 100) : 0,
      }));

      const optimal = [...scored].sort((a, b) => b.score - a.score)[0];
      scored.sort((a, b) => parseInt(b.qty) - parseInt(a.qty));

      let testAdvice = null;
      if (prices.length >= 2 && p.cogs_sea) {
        const currentBestMargin = Math.round(((parseFloat(bestVolume.price) - p.cogs_sea) / parseFloat(bestVolume.price)) * 100);
        const higherPrices = prices.filter((r: any) => parseFloat(r.price) > parseFloat(bestVolume.price) && parseInt(r.qty) >= 1);
        if (higherPrices.length > 0) {
          const nextPrice = parseFloat(higherPrices[0].price);
          const testPrice = Math.round((parseFloat(bestVolume.price) + nextPrice) / 2);
          testAdvice = {
            current_price: parseFloat(bestVolume.price), current_margin: currentBestMargin,
            test_price: testPrice,
            projected_margin: Math.round(((testPrice - p.cogs_sea) / testPrice) * 100),
            reason: `€${nextPrice} heeft ook ${higherPrices[0].qty} verkopen — test €${testPrice} als sweet spot`,
          };
        }
      }

      const bestVolMargin = p.cogs_sea ? Math.round(((parseFloat(bestVolume.price) - p.cogs_sea) / parseFloat(bestVolume.price)) * 100) : null;
      const alert = bestVolMargin !== null && bestVolMargin < 30 ? 'LAGE MARGE' :
                    bestVolMargin !== null && bestVolMargin < 50 ? 'MARGE VERBETERING MOGELIJK' : null;

      priceAnalysis.push({
        name: p.name, sku, stock: inventory[sku] ?? null, cogs_sea: p.cogs_sea, cogs_air: p.cogs_air,
        total_qty: totalQty, price_points: scored,
        best_volume_price: parseFloat(bestVolume.price), best_volume_margin: bestVolMargin,
        optimal_price: optimal?.price, optimal_score: optimal?.score,
        min_price: minPrice, max_price: maxPrice, price_range: Math.round(maxPrice - minPrice),
        test_advice: testAdvice, alert,
      });
    });

    priceAnalysis.sort((a, b) => b.total_qty - a.total_qty);

    // 3. Top producten per kanaal
    const topByChannelResult = await pool.query(`
      SELECT o.channel, oi.sku, oi.title, SUM(oi.quantity) as qty,
        ROUND(SUM(oi.price * oi.quantity)::numeric, 2) as revenue,
        ROUND(AVG(oi.price)::numeric, 2) as avg_price
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.sku != '' AND oi.price > 0
      GROUP BY o.channel, oi.sku, oi.title
      ORDER BY o.channel, qty DESC
    `);

    const channelProducts: Record<string, any[]> = {};
    topByChannelResult.rows.forEach((r: any) => {
      if (!channelProducts[r.channel]) channelProducts[r.channel] = [];
      if (channelProducts[r.channel].length < 5) {
        const p = cogsMap[r.sku];
        channelProducts[r.channel].push({
          ...r,
          margin_pct: p?.cogs_sea ? Math.round(((parseFloat(r.avg_price) - p.cogs_sea) / parseFloat(r.avg_price)) * 100) : null,
        });
      }
    });

    return NextResponse.json({ channelWithMargin, priceAnalysis, channelProducts });

  } catch (err: any) {
    console.error('Prices API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
