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

    // COGS data
    const cogsPath = path.join(process.cwd(), 'data', 'products-cogs.json');
    const cogsData = JSON.parse(fs.readFileSync(cogsPath, 'utf-8'));
    const cogsMap: Record<string, any> = {};
    cogsData.products.forEach((p: any) => { cogsMap[p.sku] = p; });

    // ── 1. Marge per kanaal ───────────────────────────────────────────────────
    const channelResult = db.exec(`
      SELECT
        o.channel,
        COUNT(DISTINCT o.id) as orders,
        ROUND(SUM(o.total_price), 2) as revenue,
        ROUND(AVG(o.total_price), 2) as aov,
        COUNT(DISTINCT oi.sku) as unique_skus,
        ROUND(SUM(oi.price * oi.quantity), 2) as item_revenue
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.channel
      ORDER BY revenue DESC
    `);
    const channels = channelResult.length ? rowsToObjects(channelResult[0]) : [];

    // Bereken marge per kanaal door COGS te koppelen
    const skuCogsResult = db.exec(`
      SELECT
        o.channel,
        oi.sku,
        oi.price,
        SUM(oi.quantity) as qty,
        ROUND(SUM(oi.price * oi.quantity), 2) as revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.sku != '' AND oi.price > 0
      GROUP BY o.channel, oi.sku, oi.price
    `);
    const skuCogs = skuCogsResult.length ? rowsToObjects(skuCogsResult[0]) : [];

    // Bereken gewogen gemiddelde marge per kanaal
    const channelMargins: Record<string, { revenue: number; cogs: number; qty: number }> = {};
    skuCogs.forEach((r: any) => {
      const p = cogsMap[r.sku];
      if (!p || !p.cogs_sea) return;
      if (!channelMargins[r.channel]) channelMargins[r.channel] = { revenue: 0, cogs: 0, qty: 0 };
      channelMargins[r.channel].revenue += r.revenue;
      channelMargins[r.channel].cogs += p.cogs_sea * r.qty;
      channelMargins[r.channel].qty += r.qty;
    });

    const channelWithMargin = channels.map((ch: any) => {
      const m = channelMargins[ch.channel];
      const gross_profit = m ? Math.round(m.revenue - m.cogs) : null;
      const margin_pct = m && m.revenue > 0 ? Math.round(((m.revenue - m.cogs) / m.revenue) * 100) : null;
      return { ...ch, gross_profit, margin_pct };
    });

    // ── 2. Prijs × volume per SKU ─────────────────────────────────────────────
    const priceResult = db.exec(`
      SELECT
        oi.sku,
        oi.price,
        SUM(oi.quantity) as qty,
        COUNT(DISTINCT o.id) as orders,
        GROUP_CONCAT(DISTINCT o.channel) as channels
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.sku != '' AND oi.price > 5
      GROUP BY oi.sku, oi.price
      ORDER BY oi.sku, qty DESC
    `);
    const priceRows = priceResult.length ? rowsToObjects(priceResult[0]) : [];

    // Groepeer per SKU en bereken statistieken
    const bysku: Record<string, any[]> = {};
    priceRows.forEach((r: any) => {
      if (!bysku[r.sku]) bysku[r.sku] = [];
      bysku[r.sku].push(r);
    });

    const priceAnalysis: any[] = [];
    Object.entries(bysku).forEach(([sku, prices]) => {
      const p = cogsMap[sku];
      if (!p) return;

      const totalQty = prices.reduce((s: number, r: any) => s + r.qty, 0);
      const totalRevenue = prices.reduce((s: number, r: any) => s + r.price * r.qty, 0);
      const maxPrice = Math.max(...prices.map((r: any) => r.price));
      const minPrice = Math.min(...prices.map((r: any) => r.price));
      const bestVolume = prices[0];
      const bestMargin = [...prices].sort((a: any, b: any) => b.price - a.price)[0];

      // Prijs met hoogste volume × marge score
      const scored = prices.map((r: any) => ({
        ...r,
        margin_pct: p.cogs_sea ? Math.round(((r.price - p.cogs_sea) / r.price) * 100) : null,
        pct_of_volume: Math.round((r.qty / totalQty) * 100),
        revenue_contribution: Math.round((r.price * r.qty / totalRevenue) * 100),
        // Score = volume% × marge%
        score: p.cogs_sea ? Math.round((r.qty / totalQty) * ((r.price - p.cogs_sea) / r.price) * 100) : 0,
      }));

      const optimal = scored.sort((a: any, b: any) => b.score - a.score)[0];
      scored.sort((a: any, b: any) => b.qty - a.qty); // reset naar volume sort

      // Prijstest aanbeveling
      let testAdvice = null;
      if (prices.length >= 2 && p.cogs_sea) {
        const currentBestMargin = Math.round(((bestVolume.price - p.cogs_sea) / bestVolume.price) * 100);
        const higherPrices = prices.filter((r: any) => r.price > bestVolume.price && r.qty >= 1);
        if (higherPrices.length > 0) {
          const nextPrice = higherPrices[0].price;
          const nextMargin = Math.round(((nextPrice - p.cogs_sea) / nextPrice) * 100);
          testAdvice = {
            current_price: bestVolume.price,
            current_margin: currentBestMargin,
            test_price: Math.round((bestVolume.price + nextPrice) / 2),
            projected_margin: Math.round(((Math.round((bestVolume.price + nextPrice) / 2) - p.cogs_sea) / Math.round((bestVolume.price + nextPrice) / 2)) * 100),
            reason: `€${nextPrice} heeft ook ${higherPrices[0].qty} verkopen — test €${Math.round((bestVolume.price + nextPrice) / 2)} als sweet spot`,
          };
        }
      }

      // Alarm: lage marge
      const bestVolMargin = p.cogs_sea ? Math.round(((bestVolume.price - p.cogs_sea) / bestVolume.price) * 100) : null;
      const alert = bestVolMargin !== null && bestVolMargin < 30 ? 'LAGE MARGE' :
                    bestVolMargin !== null && bestVolMargin < 50 ? 'MARGE VERBETERING MOGELIJK' : null;

      priceAnalysis.push({
        name: p.name,
        sku,
        cogs_sea: p.cogs_sea,
        cogs_air: p.cogs_air,
        total_qty: totalQty,
        price_points: scored,
        best_volume_price: bestVolume.price,
        best_volume_margin: bestVolMargin,
        optimal_price: optimal?.price,
        optimal_score: optimal?.score,
        min_price: minPrice,
        max_price: maxPrice,
        price_range: Math.round(maxPrice - minPrice),
        test_advice: testAdvice,
        alert,
      });
    });

    priceAnalysis.sort((a: any, b: any) => b.total_qty - a.total_qty);

    // ── 3. Top producten per kanaal ───────────────────────────────────────────
    const topByChannelResult = db.exec(`
      SELECT
        o.channel,
        oi.sku,
        oi.title,
        SUM(oi.quantity) as qty,
        ROUND(SUM(oi.price * oi.quantity), 2) as revenue,
        ROUND(AVG(oi.price), 2) as avg_price
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.sku != '' AND oi.price > 0
      GROUP BY o.channel, oi.sku
      ORDER BY o.channel, qty DESC
    `);
    const topByChannel = topByChannelResult.length ? rowsToObjects(topByChannelResult[0]) : [];

    // Groepeer per kanaal (top 5)
    const channelProducts: Record<string, any[]> = {};
    topByChannel.forEach((r: any) => {
      if (!channelProducts[r.channel]) channelProducts[r.channel] = [];
      if (channelProducts[r.channel].length < 5) {
        const p = cogsMap[r.sku];
        channelProducts[r.channel].push({
          ...r,
          margin_pct: p?.cogs_sea ? Math.round(((r.avg_price - p.cogs_sea) / r.avg_price) * 100) : null,
        });
      }
    });

    db.close();

    return NextResponse.json({
      channels: channelWithMargin,
      priceAnalysis,
      channelProducts,
    });

  } catch (err: any) {
    console.error('Prices API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
