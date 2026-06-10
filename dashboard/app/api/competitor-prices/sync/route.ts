export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';
import { scrapeCompetitorPrices } from '../../../../lib/bol-scraper';

export async function POST() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const { products: scraped, debug } = await scrapeCompetitorPrices();
    console.log('[competitor-sync] debug:', debug.join(' | '));

    if (scraped.length === 0) {
      return NextResponse.json({ synced: 0, message: 'Geen producten gevonden op Bol.com', debug });
    }

    // Load previous prices to detect changes
    const prevResult = await pool.query(
      `SELECT competitor, product_name, category, price
       FROM competitor_prices
       WHERE date = (SELECT MAX(date) FROM competitor_prices WHERE date < $1)`,
      [today]
    );
    const prevMap = new Map<string, number>();
    for (const row of prevResult.rows) {
      prevMap.set(`${row.competitor}|${row.product_name}|${row.category}`, parseFloat(row.price));
    }

    // Delete today's existing rows (upsert by re-inserting)
    await pool.query(`DELETE FROM competitor_prices WHERE date::date = $1::date`, [today]);

    // Insert new rows
    let inserted = 0;
    for (const p of scraped) {
      const key = `${p.competitor}|${p.product_name}|${p.category}`;
      const prevPrice = prevMap.get(key) ?? null;
      const priceChanged = prevPrice !== null && Math.abs(prevPrice - p.price) > 0.01;
      const changePct = priceChanged && prevPrice
        ? Math.round(((p.price - prevPrice) / prevPrice) * 100 * 10) / 10
        : null;

      await pool.query(
        `INSERT INTO competitor_prices
           (date, competitor, product_name, price, compare_price, category, url,
            prev_price, price_change_pct, price_changed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [today, p.competitor, p.product_name, p.price, p.compare_price,
         p.category, p.url, prevPrice, changePct, priceChanged]
      );
      inserted++;
    }

    return NextResponse.json({ synced: inserted, date: today, debug });

  } catch (err: any) {
    console.error('[competitor-sync]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
