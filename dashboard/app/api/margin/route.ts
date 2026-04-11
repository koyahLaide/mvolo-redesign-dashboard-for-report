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

    const cogsPath = path.join(process.cwd(), 'data', 'products-cogs.json');
    const cogsData = JSON.parse(fs.readFileSync(cogsPath, 'utf-8'));
    const cogsMap: Record<string, any> = {};
    cogsData.products.forEach((p: any) => { cogsMap[p.sku] = p; });

    const itemsResult = db.exec(`
      SELECT o.channel, oi.sku, oi.quantity, oi.price,
        strftime('%Y-%m', o.created_at) as month
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at >= date('now', '-7 months')
        AND oi.price > 0 AND oi.sku != ''
    `);
    const items = itemsResult.length ? rowsToObjects(itemsResult[0]) : [];

    const byChannel: Record<string, { revenue: number; cog: number }> = {};
    const byMonth: Record<string, { revenue: number; cog: number }> = {};

    items.forEach((item: any) => {
      const ch = item.channel;
      const mo = item.month;
      const rev = (item.price ?? 0) * (item.quantity ?? 1);
      const cogProduct = cogsMap[item.sku];
      const cog = cogProduct?.cogs_sea ? cogProduct.cogs_sea * (item.quantity ?? 1) : 0;

      if (!byChannel[ch]) byChannel[ch] = { revenue: 0, cog: 0 };
      byChannel[ch].revenue += rev;
      byChannel[ch].cog += cog;

      if (!byMonth[mo]) byMonth[mo] = { revenue: 0, cog: 0 };
      byMonth[mo].revenue += rev;
      byMonth[mo].cog += cog;
    });

    const channelMargins = Object.entries(byChannel)
      .map(([channel, d]: any) => ({
        channel,
        revenue: Math.round(d.revenue),
        cog: Math.round(d.cog),
        gross_profit: Math.round(d.revenue - d.cog),
        margin_pct: d.revenue > 0 ? Math.round((1 - d.cog / d.revenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const monthlyMargins = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]: any) => ({
        month,
        revenue: Math.round(d.revenue),
        cog: Math.round(d.cog),
        gross_profit: Math.round(d.revenue - d.cog),
        margin_pct: d.revenue > 0 ? Math.round((1 - d.cog / d.revenue) * 100) : 0,
      }));

    db.close();

    return NextResponse.json({ channelMargins, monthlyMargins });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
