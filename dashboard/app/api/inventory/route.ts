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

    // Velocity per SKU
    const vel30Result = db.exec(`
      SELECT sku, SUM(quantity) * 1.0 / 30 as daily
      FROM order_items
      WHERE order_date >= date('now', '-30 days') AND sku != ''
      GROUP BY sku
    `);
    const vel90Result = db.exec(`
      SELECT sku, SUM(quantity) * 1.0 / 90 as daily
      FROM order_items
      WHERE order_date >= date('now', '-90 days') AND sku != ''
      GROUP BY sku
    `);

    const v30: Record<string, number> = {};
    const v90: Record<string, number> = {};
    if (vel30Result.length) rowsToObjects(vel30Result[0]).forEach((r: any) => { v30[r.sku] = r.daily; });
    if (vel90Result.length) rowsToObjects(vel90Result[0]).forEach((r: any) => { v90[r.sku] = r.daily; });

    db.close();

    // Shopify inventory via products-cogs.json
    const cogsPath = path.join(process.cwd(), 'data', 'products-cogs.json');
    const cogsData = JSON.parse(fs.readFileSync(cogsPath, 'utf-8'));

    // Shopify voorraad ophalen
    const inventory: Record<string, { title: string; stock: number; price: number }> = {};
    if (process.env.SHOPIFY_STORE && process.env.SHOPIFY_TOKEN) {
      const shopifyRes = await fetch(
        `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/products.json?limit=250&fields=id,title,variants`,
        { headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_TOKEN } }
      );
      if (shopifyRes.ok) {
        const shopifyData = await shopifyRes.json();
        for (const product of shopifyData.products || []) {
          for (const variant of product.variants || []) {
            if (variant.sku) {
              inventory[String(variant.sku)] = {
                title: product.title,
                stock: variant.inventory_quantity,
                price: parseFloat(variant.price),
              };
            }
          }
        }
      }
    }

    // Bereken reorder advies per product
    const { lead_times, safety_stock_days } = cogsData;
    const sea_lead = lead_times.production_days + lead_times.sea_days + safety_stock_days;
    const air_lead = lead_times.production_days + lead_times.air_days + safety_stock_days;

    const products = cogsData.products
      .map((p: any) => {
        const inv = inventory[p.sku];
        if (!inv) return null;

        const stock    = inv.stock;
        const daily30  = v30[p.sku] || 0;
        const daily90  = v90[p.sku] || 0;
        const velocity = daily30 > 0 ? daily30 : daily90;

        let days_left = velocity > 0 ? Math.round(stock / velocity) : (stock > 0 ? 999 : 0);
        let urgency: string, method: string, reorder_qty: number, cogs: number | null;

        if (velocity === 0) {
          urgency     = stock <= 0 ? 'KRITIEK' : 'GEEN DATA';
          method      = 'SEA';
          reorder_qty = 0;
          cogs        = p.cogs_sea;
        } else if (stock <= 0) {
          urgency     = 'KRITIEK';
          method      = p.air_allowed ? 'AIR' : 'SEA';
          reorder_qty = p.air_allowed ? Math.max(0, Math.ceil(velocity * 60)) : Math.max(0, Math.ceil(velocity * 90));
          cogs        = p.air_allowed ? p.cogs_air : p.cogs_sea;
        } else if (days_left < air_lead && p.air_allowed) {
          urgency     = 'AIR URGENT';
          method      = 'AIR';
          reorder_qty = Math.max(0, Math.ceil(velocity * 60) - stock);
          cogs        = p.cogs_air;
        } else if (days_left < sea_lead) {
          urgency     = p.air_allowed ? 'BESTEL AIR' : 'BESTEL SEA';
          method      = p.air_allowed ? 'AIR' : 'SEA';
          reorder_qty = p.air_allowed ? Math.max(0, Math.ceil(velocity * 60) - stock) : Math.max(0, Math.ceil(velocity * 90) - stock);
          cogs        = p.air_allowed ? p.cogs_air : p.cogs_sea;
        } else if (days_left < sea_lead + 14) {
          urgency     = 'BESTEL SEA';
          method      = 'SEA';
          reorder_qty = Math.max(0, Math.ceil(velocity * 90) - stock);
          cogs        = p.cogs_sea;
        } else {
          urgency     = 'OK';
          method      = 'SEA';
          reorder_qty = 0;
          cogs        = p.cogs_sea;
        }

        const reorder_cost = cogs && reorder_qty > 0 ? Math.round(reorder_qty * cogs) : 0;

        return {
          name:         p.name,
          sku:          p.sku,
          stock,
          price:        inv.price,
          cogs_sea:     p.cogs_sea,
          cogs_air:     p.cogs_air,
          air_allowed:  p.air_allowed,
          velocity_30d: Math.round(daily30 * 100) / 100,
          velocity_90d: Math.round(daily90 * 100) / 100,
          days_left:    days_left > 900 ? null : days_left,
          urgency,
          method,
          reorder_qty,
          reorder_cost,
          sea_lead,
          air_lead,
        };
      })
      .filter(Boolean);

    const urgencyOrder: Record<string, number> = { KRITIEK: 0, 'AIR URGENT': 1, 'BESTEL AIR': 2, 'BESTEL SEA': 3, OK: 4, 'GEEN DATA': 5 };
    products.sort((a: any, b: any) => (urgencyOrder[a.urgency] ?? 9) - (urgencyOrder[b.urgency] ?? 9));

    return NextResponse.json({ products, lead_times, safety_stock_days });

  } catch (err: any) {
    console.error('Inventory API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
