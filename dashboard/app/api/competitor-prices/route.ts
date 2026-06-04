export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

export async function GET() {
  try {
    // Most recent date
    const latestDateResult = await pool.query(`SELECT MAX(date) as d FROM competitor_prices`);
    const latestDate: string | null = latestDateResult.rows[0]?.d
      ? String(latestDateResult.rows[0].d).slice(0, 10)
      : null;

    if (!latestDate) {
      return NextResponse.json({ products: [], priceChanges: [], summary: {}, categories: [] });
    }

    // Current competitor prices
    const productsResult = await pool.query(`
      SELECT cp.competitor, cp.product_name, cp.price, cp.compare_price,
        cp.category, cp.url, cp.date, cp.prev_price, cp.price_change_pct, cp.price_changed
      FROM competitor_prices cp
      WHERE cp.date::date = $1::date
      ORDER BY cp.category, cp.price ASC
    `, [latestDate]);
    const products = productsResult.rows;

    // Mvolo verkoopprijzen per SKU
    const mvoloResult = await pool.query(`
      SELECT oi.title, oi.sku, ROUND(AVG(oi.price)::numeric, 2) as avg_price, SUM(oi.quantity) as units_sold
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.price > 0 AND oi.sku != ''
        AND o.created_at >= CURRENT_DATE - INTERVAL '60 days'
      GROUP BY oi.sku, oi.title
      ORDER BY units_sold DESC
    `);
    const mvoloPrices = mvoloResult.rows;

    // Recente prijswijzigingen (14 dagen)
    const changesResult = await pool.query(`
      SELECT competitor, product_name, price, prev_price, price_change_pct, category, url, date
      FROM competitor_prices
      WHERE price_changed = true
        AND date >= $1::date - INTERVAL '14 days'
      ORDER BY ABS(price_change_pct) DESC
      LIMIT 20
    `, [latestDate]);
    const priceChanges = changesResult.rows;

    // Prijshistorie per competitor (30d)
    const historyResult = await pool.query(`
      SELECT competitor, category, date, MIN(price) as min_price, AVG(price) as avg_price
      FROM competitor_prices
      WHERE date >= $1::date - INTERVAL '30 days'
      GROUP BY competitor, category, date
      ORDER BY date ASC
    `, [latestDate]);
    const priceHistory = historyResult.rows;

    // Samenvatting per categorie
    const summaryResult = await pool.query(`
      SELECT category,
        COUNT(DISTINCT competitor) as competitor_count,
        MIN(price) as min_price, MAX(price) as max_price, ROUND(AVG(price)::numeric, 2) as avg_price
      FROM competitor_prices
      WHERE date::date = $1::date
      GROUP BY category
      ORDER BY category
    `, [latestDate]);
    const categorySummary = summaryResult.rows;

    // Alerts: cheaper than Mvolo
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

    const alerts: any[] = [];
    for (const mvoloProduct of mvoloPrices) {
      const title = (mvoloProduct.title || '').toLowerCase();
      let matchedCat = null;
      for (const [cat, keywords] of Object.entries(PRODUCT_CATEGORIES)) {
        if (keywords.some((k: string) => title.includes(k))) { matchedCat = cat; break; }
      }
      if (!matchedCat) continue;

      const cheaperComps = products
        .filter((p: any) => p.category === matchedCat && parseFloat(p.price) < parseFloat(mvoloProduct.avg_price) * 0.85)
        .sort((a: any, b: any) => a.price - b.price);

      for (const comp of cheaperComps) {
        const diffPct = Math.round(((parseFloat(comp.price) - parseFloat(mvoloProduct.avg_price)) / parseFloat(mvoloProduct.avg_price)) * 100);
        alerts.push({
          mvolo_product: mvoloProduct.title, mvolo_price: mvoloProduct.avg_price,
          competitor: comp.competitor, competitor_product: comp.product_name,
          competitor_price: comp.price, diff_pct: diffPct, category: matchedCat, url: comp.url,
        });
      }
    }

    return NextResponse.json({
      products, priceChanges, priceHistory, categorySummary, mvoloPrices, alerts,
      lastSync: latestDate,
      totalProducts: products.length,
      totalCompetitors: [...new Set(products.map((p: any) => p.competitor))].length,
    });

  } catch (err: any) {
    console.error('Competitor prices API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
