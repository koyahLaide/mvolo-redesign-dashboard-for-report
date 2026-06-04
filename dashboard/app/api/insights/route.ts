export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import pool from '../../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? '30';

  try {
    const dateFilter   = `AND date >= CURRENT_DATE - INTERVAL '${parseInt(period)} days'`;
    const orderFilter  = `AND created_at >= CURRENT_DATE - INTERVAL '${parseInt(period)} days'`;

    // 1. Email impact
    const klaviyoTotals = await pool.query(`
      SELECT SUM(count) as orders, ROUND(SUM(revenue)::numeric, 2) as revenue
      FROM klaviyo_metrics
      WHERE metric_name = 'ordered_product' ${dateFilter}
    `);
    const klaviyo = klaviyoTotals.rows[0] ?? { orders: 0, revenue: 0 };

    const utmEmail = await pool.query(`
      SELECT COUNT(*) as orders, ROUND(SUM(total_price)::numeric, 2) as revenue
      FROM orders
      WHERE channel = 'email' ${orderFilter}
    `);
    const utm = utmEmail.rows[0] ?? { orders: 0, revenue: 0 };

    const hiddenOrders  = Math.max(0, (parseInt(klaviyo.orders) ?? 0) - (parseInt(utm.orders) ?? 0));
    const hiddenRevenue = Math.max(0, (parseFloat(klaviyo.revenue) ?? 0) - (parseFloat(utm.revenue) ?? 0));

    // 2. Email per dag trend
    const klaviyoDailyResult = await pool.query(`
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
    const emailTrend = klaviyoDailyResult.rows;

    // UTM orders per dag
    const utmDailyResult = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as orders, ROUND(SUM(total_price)::numeric, 2) as revenue
      FROM orders
      WHERE channel = 'email' ${orderFilter}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    const utmByDate: Record<string, any> = {};
    utmDailyResult.rows.forEach((r: any) => { utmByDate[String(r.date).slice(0,10)] = r; });
    const emailTrendMerged = emailTrend.map((r: any) => ({
      ...r,
      utm_orders:  utmByDate[String(r.date).slice(0,10)]?.orders ?? 0,
      utm_revenue: utmByDate[String(r.date).slice(0,10)]?.revenue ?? 0,
    }));

    // 3. Kanaal breakdown
    const channelResult = await pool.query(`
      SELECT channel, COUNT(*) as orders, ROUND(SUM(total_price)::numeric, 2) as revenue
      FROM orders
      WHERE 1=1 ${orderFilter}
      GROUP BY channel ORDER BY orders DESC
    `);
    const channelBreakdown = channelResult.rows;

    // 4. Voorraad × kanaal alerts (Shopify + cogs.json)
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

    const cogsPath = path.join(process.cwd(), 'data', 'products-cogs.json');
    const cogsData = JSON.parse(fs.readFileSync(cogsPath, 'utf-8'));

    const velocityResult = await pool.query(`
      SELECT sku, SUM(quantity) * 1.0 / ${parseInt(period)} as daily
      FROM order_items
      WHERE order_date >= CURRENT_DATE - INTERVAL '${parseInt(period)} days' AND sku != ''
      GROUP BY sku
    `);
    const velocity: Record<string, number> = {};
    velocityResult.rows.forEach((r: any) => { velocity[r.sku] = parseFloat(r.daily); });

    const activeChannelsResult = await pool.query(`
      SELECT oi.sku, o.channel, COUNT(*) as orders
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND oi.sku != ''
        AND o.channel IN ('meta_ads', 'google_ads', 'google_search', 'awin_affiliate', 'ascendia_affiliate', 'email')
      GROUP BY oi.sku, o.channel
      ORDER BY orders DESC
    `);
    const activeChannels = activeChannelsResult.rows;

    const { lead_times, safety_stock_days } = cogsData;
    const sea_lead = lead_times.production_days + lead_times.sea_days + safety_stock_days;
    const stockAlerts: any[] = [];

    for (const p of cogsData.products) {
      const inv = inventory[p.sku];
      if (!inv) continue;
      const stock = inv.stock;
      const vel = velocity[p.sku] || 0;
      const days_left = vel > 0 ? Math.round(stock / vel) : (stock > 0 ? 999 : 0);
      const isUrgent = stock <= 0 || (vel > 0 && days_left < sea_lead);
      if (!isUrgent) continue;
      const channels = activeChannels.filter((r: any) => r.sku === p.sku);
      stockAlerts.push({
        name: p.name, sku: p.sku, stock,
        days_left: days_left > 900 ? null : days_left,
        velocity: Math.round(vel * 100) / 100,
        active_channels: channels,
        urgency: stock <= 0 ? 'KRITIEK' : days_left < 30 ? 'URGENT' : 'BESTEL',
        cogs_sea: p.cogs_sea, price: inv.price,
        margin: p.cogs_sea && inv.price > 0 ? Math.round(((inv.price - p.cogs_sea) / inv.price) * 100) : null,
      });
    }
    stockAlerts.sort((a, b) => {
      const o: Record<string, number> = { KRITIEK: 0, URGENT: 1, BESTEL: 2 };
      return (o[a.urgency] ?? 9) - (o[b.urgency] ?? 9);
    });

    // 5. Top campaigns met orders
    const campaignResult = await pool.query(`
      SELECT utm_campaign, COUNT(*) as orders, ROUND(SUM(total_price)::numeric, 2) as revenue
      FROM orders
      WHERE channel = 'email' AND utm_campaign IS NOT NULL ${orderFilter}
      GROUP BY utm_campaign
      ORDER BY revenue DESC
      LIMIT 10
    `);
    const topCampaigns = campaignResult.rows;

    return NextResponse.json({
      emailImpact: {
        klaviyo_orders:  parseInt(klaviyo.orders) ?? 0,
        klaviyo_revenue: parseFloat(klaviyo.revenue) ?? 0,
        utm_orders:      parseInt(utm.orders) ?? 0,
        utm_revenue:     parseFloat(utm.revenue) ?? 0,
        hidden_orders:   hiddenOrders,
        hidden_revenue:  hiddenRevenue,
        attribution_gap: klaviyo.revenue > 0
          ? Math.round((hiddenRevenue / klaviyo.revenue) * 100) : 0,
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
