export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import pool from '../../../lib/pg-client';

export async function GET() {
  try {
    // Laad email timing rapport (optioneel lokaal bestand)
    const reportPath = path.join(process.cwd(), 'data', 'email-timing-report.json');
    let report: any = null;
    try {
      report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    } catch {
      report = null;
    }

    // Open/click rates per dag van de week
    const dowRes = await pool.query(`
      SELECT EXTRACT(DOW FROM date::date)::int as dow,
        SUM(CASE WHEN metric_name='received_email'  THEN count ELSE 0 END) as sent,
        SUM(CASE WHEN metric_name='opened_email'    THEN count ELSE 0 END) as opened,
        SUM(CASE WHEN metric_name='clicked_email'   THEN count ELSE 0 END) as clicked,
        SUM(CASE WHEN metric_name='ordered_product' THEN count   ELSE 0 END) as orders,
        SUM(CASE WHEN metric_name='ordered_product' THEN revenue ELSE 0 END) as revenue
      FROM klaviyo_metrics
      WHERE metric_name IN ('received_email','opened_email','clicked_email','ordered_product')
      GROUP BY dow ORDER BY dow
    `);
    const dowStats = dowRes.rows.map((r: any) => {
      const sent = Number(r.sent);
      const opened = Number(r.opened);
      const clicked = Number(r.clicked);
      const revenue = Number(r.revenue);
      return {
        dow: r.dow,
        sent,
        opened,
        clicked,
        orders: Number(r.orders),
        revenue: Math.round(revenue),
        open_rate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
        click_rate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
        rev_per_email: sent > 0 ? Math.round((revenue / sent) * 100) / 100 : 0,
      };
    });

    // Orders per dag van de week (Shopify)
    const orderDowRes = await pool.query(`
      SELECT EXTRACT(DOW FROM created_at::date)::int as dow,
        COUNT(*) as orders,
        ROUND(SUM(total_price)::numeric, 2) as revenue,
        ROUND(AVG(total_price)::numeric, 2) as aov
      FROM orders WHERE marketplace != 'bol'
      GROUP BY dow ORDER BY dow
    `);
    const orderDow = orderDowRes.rows.map((r: any) => ({
      dow: r.dow,
      orders: Number(r.orders),
      revenue: Number(r.revenue),
      aov: Number(r.aov),
    }));

    // Segment analyse
    const segRes = await pool.query(`
      SELECT
        is_new_customer,
        COUNT(*) as orders,
        ROUND(AVG(total_price)::numeric, 2) as aov,
        ROUND(SUM(total_price)::numeric, 2) as revenue,
        channel
      FROM orders
      WHERE is_new_customer IS NOT NULL
      GROUP BY is_new_customer, channel
      ORDER BY orders DESC
    `);
    const segData = segRes.rows;

    // Top producten via email
    const emailSkuRes = await pool.query(`
      SELECT oi.sku, oi.title, SUM(oi.quantity) as sold, ROUND(SUM(oi.price * oi.quantity)::numeric, 2) as revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.channel = 'email' AND oi.sku != ''
      GROUP BY oi.sku, oi.title ORDER BY sold DESC LIMIT 10
    `);
    const emailSkus = emailSkuRes.rows;

    // Recente email orders per campaign
    const campaignOrdersRes = await pool.query(`
      SELECT utm_campaign, COUNT(*) as orders, ROUND(SUM(total_price)::numeric, 2) as revenue,
             MIN(created_at) as first_order, MAX(created_at) as last_order
      FROM orders
      WHERE channel = 'email' AND utm_campaign IS NOT NULL
      GROUP BY utm_campaign ORDER BY revenue DESC
    `);
    const campaignOrders = campaignOrdersRes.rows;

    // Email omzet vergelijking (Klaviyo vs UTM)
    const klaviyoTotalRes = await pool.query(`
      SELECT SUM(count) as orders, ROUND(SUM(revenue)::numeric, 2) as revenue
      FROM klaviyo_metrics WHERE metric_name = 'ordered_product'
      AND date >= CURRENT_DATE - INTERVAL '30 days'
    `);
    const utmTotalRes = await pool.query(`
      SELECT COUNT(*) as orders, ROUND(SUM(total_price)::numeric, 2) as revenue
      FROM orders WHERE channel = 'email' AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    `);

    const kl = klaviyoTotalRes.rows[0] ?? { orders: 0, revenue: 0 };
    const ut = utmTotalRes.rows[0] ?? { orders: 0, revenue: 0 };
    const klRevenue = Number(kl.revenue ?? 0);
    const utRevenue = Number(ut.revenue ?? 0);

    return NextResponse.json({
      report,
      dowStats,
      orderDow,
      segData,
      emailSkus,
      campaignOrders,
      emailImpact: {
        klaviyo_orders: Number(kl.orders),
        klaviyo_revenue: klRevenue,
        utm_orders: Number(ut.orders),
        utm_revenue: utRevenue,
        gap_pct: klRevenue > 0 ? Math.round(((klRevenue - utRevenue) / klRevenue) * 100) : 0,
      },
    });

  } catch (err: any) {
    console.error('Email intelligence API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
