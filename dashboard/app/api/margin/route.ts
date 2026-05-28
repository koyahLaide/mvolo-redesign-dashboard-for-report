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

    const itemsResult = await pool.query(`
      SELECT o.channel, oi.sku, oi.quantity, oi.price,
        TO_CHAR(o.created_at, 'YYYY-MM') as month
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at >= CURRENT_DATE - INTERVAL '7 months'
        AND oi.price > 0 AND oi.sku != ''
    `);
    const items = itemsResult.rows;

    const byChannel: Record<string, { revenue: number; cog: number }> = {};
    const byMonth: Record<string, { revenue: number; cog: number }> = {};

    items.forEach((item: any) => {
      const ch  = item.channel;
      const mo  = item.month;
      const rev = (parseFloat(item.price) ?? 0) * (parseInt(item.quantity) ?? 1);
      const cogProduct = cogsMap[item.sku];
      const cog = cogProduct?.cogs_sea ? cogProduct.cogs_sea * (parseInt(item.quantity) ?? 1) : 0;

      if (!byChannel[ch]) byChannel[ch] = { revenue: 0, cog: 0 };
      byChannel[ch].revenue += rev;
      byChannel[ch].cog += cog;

      if (!byMonth[mo]) byMonth[mo] = { revenue: 0, cog: 0 };
      byMonth[mo].revenue += rev;
      byMonth[mo].cog += cog;
    });

    const channelMargins = Object.entries(byChannel)
      .map(([channel, d]) => ({
        channel,
        revenue:      Math.round(d.revenue),
        cog:          Math.round(d.cog),
        gross_profit: Math.round(d.revenue - d.cog),
        margin_pct:   d.revenue > 0 ? Math.round((1 - d.cog / d.revenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const monthlyMargins = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month,
        revenue:      Math.round(d.revenue),
        cog:          Math.round(d.cog),
        gross_profit: Math.round(d.revenue - d.cog),
        margin_pct:   d.revenue > 0 ? Math.round((1 - d.cog / d.revenue) * 100) : 0,
      }));

    return NextResponse.json({ channelMargins, monthlyMargins });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
