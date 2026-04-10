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

    // ── Haal de meest recente datum op ────────────────────────────────────────
    const latestDateResult = db.exec(`SELECT MAX(date) as d FROM competitor_prices`);
    const latestDate = latestDateResult.length ? rowsToObjects(latestDateResult[0])[0]?.d : null;

    if (!latestDate) {
      db.close();
      return NextResponse.json({ products: [], priceChanges: [], summary: {}, categories: [] });
    }

    // ── Alle huidige competitor prijzen ───────────────────────────────────────
    const productsResult = db.exec(`
      SELECT
        cp.competitor,
        cp.product_name,
        cp.price,
        cp.compare_price,
        cp.category,
        cp.url,
        cp.date,
        cp.prev_price,
        cp.price_change_pct,
        cp.price_changed
      FROM competitor_prices cp
      WHERE cp.date = '${latestDate}'
      ORDER BY cp.category, cp.price ASC
    `);
    const products = productsResult.length ? rowsToObjects(productsResult[0]) : [];

    // ── Mvolo verkoopprijzen per categorie ────────────────────────────────────
    const mvoloResult = db.exec(`
      SELECT oi.title, oi.sku, ROUND(AVG(oi.price), 2) as avg_price, SUM(oi.quantity) as units_sold
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.price > 0 AND oi.sku != ''
        AND o.created_at >= date('now', '-60 days')
      GROUP BY oi.sku
      ORDER BY units_sold DESC
    `);
    const mvoloPrices = mvoloResult.length ? rowsToObjects(mvoloResult[0]) : [];

    // ── Recente prijswijzigingen (laatste 14 dagen) ───────────────────────────
    const changesResult = db.exec(`
      SELECT
        competitor,
        product_name,
        price,
        prev_price,
        price_change_pct,
        category,
        url,
        date
      FROM competitor_prices
      WHERE price_changed = 1
        AND date >= date('${latestDate}', '-14 days')
      ORDER BY ABS(price_change_pct) DESC
      LIMIT 20
    `);
    const priceChanges = changesResult.length ? rowsToObjects(changesResult[0]) : [];

    // ── Prijshistorie per competitor (30d) ────────────────────────────────────
    const historyResult = db.exec(`
      SELECT competitor, category, date, MIN(price) as min_price, AVG(price) as avg_price
      FROM competitor_prices
      WHERE date >= date('${latestDate}', '-30 days')
      GROUP BY competitor, category, date
      ORDER BY date ASC
    `);
    const priceHistory = historyResult.length ? rowsToObjects(historyResult[0]) : [];

    // ── Samenvatting per categorie ────────────────────────────────────────────
    const summaryResult = db.exec(`
      SELECT
        category,
        COUNT(DISTINCT competitor) as competitor_count,
        MIN(price) as min_price,
        MAX(price) as max_price,
        ROUND(AVG(price), 2) as avg_price
      FROM competitor_prices
      WHERE date = '${latestDate}'
      GROUP BY category
      ORDER BY category
    `);
    const categorySummary = summaryResult.length ? rowsToObjects(summaryResult[0]) : [];

    // ── Alert: competitors die goedkoper zijn dan Mvolo ───────────────────────
    const alerts: any[] = [];
    const PRODUCT_CATEGORIES: Record<string, string[]> = {
      led_face_mask:        ['led', 'face', 'mask', 'gezichtsmasker', 'glow'],
      infrared_double_head: ['dubbele kop', 'double head', '507'],
      infrared_single_head: ['enkele kop', 'single head', '506'],
      rlt_panel:            ['rood licht', 'red light', 'panel', 'paneel', 'vt', 'rl'],
      infrared_rugband:     ['rugband', 'belt', 'shield'],
      sauna_blanket:        ['sauna', 'deken', 'blanket'],
      daylight_lamp:        ['daglicht', 'daylight', 'lucent'],
      daylight_glasses:     ['daglichtbril', 'ayo', 'luminette'],
      ems_device:           ['ems', 'gua sha', 'solawave'],
    };

    for (const mvoloProduct of mvoloPrices) {
      const title = (mvoloProduct.title || '').toLowerCase();
      let matchedCat = null;
      for (const [cat, keywords] of Object.entries(PRODUCT_CATEGORIES)) {
        if (keywords.some((k: string) => title.includes(k))) {
          matchedCat = cat;
          break;
        }
      }
      if (!matchedCat) continue;

      const cheaperComps = products
        .filter((p: any) => p.category === matchedCat && p.price < mvoloProduct.avg_price * 0.85)
        .sort((a: any, b: any) => a.price - b.price);

      for (const comp of cheaperComps) {
        const diffPct = Math.round(((comp.price - mvoloProduct.avg_price) / mvoloProduct.avg_price) * 100);
        alerts.push({
          mvolo_product: mvoloProduct.title,
          mvolo_price: mvoloProduct.avg_price,
          competitor: comp.competitor,
          competitor_product: comp.product_name,
          competitor_price: comp.price,
          diff_pct: diffPct,
          category: matchedCat,
          url: comp.url,
        });
      }
    }

    db.close();

    return NextResponse.json({
      products,
      priceChanges,
      priceHistory,
      categorySummary,
      mvoloPrices,
      alerts,
      lastSync: latestDate,
      totalProducts: products.length,
      totalCompetitors: [...new Set(products.map((p: any) => p.competitor))].length,
    });

  } catch (err: any) {
    console.error('Competitor prices API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
