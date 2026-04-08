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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? '30';
  const dateFilter = `AND date >= date('now', '-${parseInt(period)} days')`;
  const orderFilter = `AND created_at >= date('now', '-${parseInt(period)} days')`;

  try {
    const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const db = new SQL.Database(fs.readFileSync(DB_PATH));

    // ── 1. Email impact vergelijking ─────────────────────────────────────────
    // Klaviyo metric (werkelijke email-driven orders)
    const klaviyoTotals = db.exec(`
      SELECT SUM(count) as orders, ROUND(SUM(revenue), 2) as revenue
      FROM klaviyo_metrics
      WHERE metric_name = 'ordered_product' ${dateFilter}
    `);
    const klaviyo = rowsToObjects(klaviyoTotals[0] ?? {})[0] ?? { orders: 0, revenue: 0 };

    // UTM-gebaseerde email attributie
    const utmEmail = db.exec(`
      SELECT COUNT(*) as orders, ROUND(SUM(total_price), 2) as revenue
      FROM orders
      WHERE channel = 'email' ${orderFilter}
    `);
    const utm = rowsToObjects(utmEmail[0] ?? {})[0] ?? { orders: 0, revenue: 0 };

    // Dark social gap
    const hiddenOrders  = Math.max(0, (klaviyo.orders ?? 0) - (utm.orders ?? 0));
    const hiddenRevenue = Math.max(0, (klaviyo.revenue ?? 0) - (utm.revenue ?? 0));

    // ── 2. Email per dag trend (Klaviyo vs UTM) ──────────────────────────────
    const klaviyoDailyResult = db.exec(`
      SELECT date,
        SUM(CASE WHEN metric_name = 'ordered_product' THEN count   ELSE 0 END) as kl_orders,
        SUM(CASE WHEN metric_name = 'ordered_product' THEN revenue ELSE 0 END) as kl_revenue,
        SUM(CASE WHEN metric_name = 'received_email'  THEN count   ELSE 0 END) as sent,
        SUM(CASE WHEN metric_name = 'opened_email'    THEN count   ELSE 0 END) as opened,
        SUM(CASE WHEN metric_name = 'clicked_email'   THEN count   ELSE 0 END) as clicked
      FROM klaviyo_metrics
      WHERE metric_name IN ('ordered_product','received_email','opened_email','clicked_email')
        ${dateFilter}
      GROUP BY date
      ORDER BY date ASC
    `);
    const emailTrend = klaviyoDailyResult.length ? rowsToObjects(klaviyoDailyResult[0]) : [];

    // UTM orders per dag
    const utmDailyResult = db.exec(`
      SELECT DATE(created_at) as date, COUNT(*) as orders, ROUND(SUM(total_price), 2) as revenue
      FROM orders
      WHERE channel = 'email' ${orderFilter}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    const utmDaily = utmDailyResult.length ? rowsToObjects(utmDailyResult[0]) : [];

    // Merge email trend met UTM
    const utmByDate: Record<string, any> = {};
    utmDaily.forEach((r: any) => { utmByDate[r.date] = r; });
    const emailTrendMerged = emailTrend.map((r: any) => ({
      ...r,
      utm_orders:  utmByDate[r.date]?.orders ?? 0,
      utm_revenue: utmByDate[r.date]?.revenue ?? 0,
    }));

    // ── 3. Kanaal breakdown (alle orders) ────────────────────────────────────
    const channelResult = db.exec(`
      SELECT channel, COUNT(*) as orders, ROUND(SUM(total_price), 2) as revenue
      FROM orders
      WHERE 1=1 ${orderFilter}
      GROUP BY channel ORDER BY orders DESC
    `);
    const channelBreakdown = channelResult.length ? rowsToObjects(channelResult[0]) : [];

    // ── 4. Voorraad × kanaal alerts ──────────────────────────────────────────
    // Haal Shopify inventory op
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

    // COGS data
    const cogsPath = path.join(process.cwd(), 'data', 'products-cogs.json');
    const cogsData = JSON.parse(fs.readFileSync(cogsPath, 'utf-8'));

    // Verkoop velocity per SKU (30d)
    const velocityResult = db.exec(`
      SELECT sku, SUM(quantity) * 1.0 / ${parseInt(period)} as daily
      FROM order_items
      WHERE order_date >= date('now', '-${parseInt(period)} days') AND sku != ''
      GROUP BY sku
    `);
    const velocity: Record<string, number> = {};
    if (velocityResult.length) rowsToObjects(velocityResult[0]).forEach((r: any) => { velocity[r.sku] = r.daily; });

    // Welke kanalen adverteren actief? (orders per kanaal per SKU)
    const activeChannelsResult = db.exec(`
      SELECT oi.sku, o.channel, COUNT(*) as orders
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at >= date('now', '-30 days')
        AND oi.sku != ''
        AND o.channel IN ('meta_ads', 'google_ads', 'google_search', 'awin_affiliate', 'ascendia_affiliate', 'email')
      GROUP BY oi.sku, o.channel
      ORDER BY orders DESC
    `);
    const activeChannels = activeChannelsResult.length ? rowsToObjects(activeChannelsResult[0]) : [];

    // Bouw alerts: kritieke producten die nog actief geadverteerd worden
    const { lead_times, safety_stock_days } = cogsData;
    const sea_lead = lead_times.production_days + lead_times.sea_days + safety_stock_days;

    const stockAlerts: any[] = [];
    for (const p of cogsData.products) {
      const inv = inventory[p.sku];
      if (!inv) continue;

      const stock    = inv.stock;
      const vel      = velocity[p.sku] || 0;
      const days_left = vel > 0 ? Math.round(stock / vel) : (stock > 0 ? 999 : 0);
      const isUrgent = stock <= 0 || (vel > 0 && days_left < sea_lead);

      if (!isUrgent) continue;

      // Zoek actieve kanalen voor dit product
      const channels = activeChannels.filter((r: any) => r.sku === p.sku);

      stockAlerts.push({
        name:          p.name,
        sku:           p.sku,
        stock,
        days_left:     days_left > 900 ? null : days_left,
        velocity:      Math.round(vel * 100) / 100,
        active_channels: channels,
        urgency:       stock <= 0 ? 'KRITIEK' : days_left < 30 ? 'URGENT' : 'BESTEL',
        cogs_sea:      p.cogs_sea,
        price:         inv.price,
        margin:        p.cogs_sea && inv.price > 0 ? Math.round(((inv.price - p.cogs_sea) / inv.price) * 100) : null,
      });
    }

    stockAlerts.sort((a, b) => {
      const o = { KRITIEK: 0, URGENT: 1, BESTEL: 2 };
      return (o[a.urgency as keyof typeof o] ?? 9) - (o[b.urgency as keyof typeof o] ?? 9);
    });

    // ── 5. Top campaigns met orders ──────────────────────────────────────────
    const campaignResult = db.exec(`
      SELECT utm_campaign, COUNT(*) as orders, ROUND(SUM(total_price), 2) as revenue
      FROM orders
      WHERE channel = 'email' AND utm_campaign IS NOT NULL ${orderFilter}
      GROUP BY utm_campaign
      ORDER BY revenue DESC
      LIMIT 10
    `);
    const topCampaigns = campaignResult.length ? rowsToObjects(campaignResult[0]) : [];

    db.close();

    return NextResponse.json({
      emailImpact: {
        klaviyo_orders:  klaviyo.orders  ?? 0,
        klaviyo_revenue: klaviyo.revenue ?? 0,
        utm_orders:      utm.orders      ?? 0,
        utm_revenue:     utm.revenue     ?? 0,
        hidden_orders:   hiddenOrders,
        hidden_revenue:  hiddenRevenue,
        attribution_gap: klaviyo.revenue > 0
          ? Math.round((hiddenRevenue / klaviyo.revenue) * 100)
          : 0,
      },
      emailTrend: emailTrendMerged,
      channelBreakdown,
      stockAlerts,
      topCampaigns,
      period,
    });

  } catch (err: any) {
    console.error('Insights API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
