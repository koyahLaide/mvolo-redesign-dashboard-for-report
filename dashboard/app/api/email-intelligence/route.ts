export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import pool from '../../../lib/db';

export async function GET() {
  try {
    // Laad email timing rapport (static file, not in DB)
    const reportPath = path.join(process.cwd(), 'data', 'email-timing-report.json');
    let report: any = null;
    try {
      report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    } catch {
      report = null;
    }

    // Open/click rates per dag van de week
    const dowResult = await pool.query(`
      SELECT EXTRACT(DOW FROM date)::text as dow,
        SUM(CASE WHEN metric_name='received_email'  THEN count ELSE 0 END) as sent,
        SUM(CASE WHEN metric_name='opened_email'    THEN count ELSE 0 END) as opened,
        SUM(CASE WHEN metric_name='clicked_email'   THEN count ELSE 0 END) as clicked,
        SUM(CASE WHEN metric_name='ordered_product' THEN count   ELSE 0 END) as orders,
        SUM(CASE WHEN metric_name='ordered_product' THEN revenue ELSE 0 END) as revenue
      FROM klaviyo_metrics
      WHERE metric_name IN ('received_email','opened_email','clicked_email','ordered_product')
      GROUP BY EXTRACT(DOW FROM date)
      ORDER BY EXTRACT(DOW FROM date)
    `);
    const dowStats = dowResult.rows.map((r: any) => ({
      dow:           parseInt(r.dow),
      sent:          parseInt(r.sent),
      opened:        parseInt(r.opened),
      clicked:       parseInt(r.clicked),
      orders:        parseInt(r.orders),
      revenue:       Math.round(parseFloat(r.revenue)),
      open_rate:     r.sent > 0 ? Math.round((r.opened / r.sent) * 100) : 0,
      click_rate:    r.sent > 0 ? Math.round((r.clicked / r.sent) * 100) : 0,
      rev_per_email: r.sent > 0 ? Math.round((r.revenue / r.sent) * 100) / 100 : 0,
    }));

    // Orders per dag van de week
    const orderDowResult = await pool.query(`
      SELECT EXTRACT(DOW FROM created_at)::text as dow,
        COUNT(*) as orders,
        ROUND(SUM(total_price)::numeric, 2) as revenue,
        ROUND(AVG(total_price)::numeric, 2) as aov
      FROM orders WHERE marketplace != 'bol'
      GROUP BY EXTRACT(DOW FROM created_at)
      ORDER BY EXTRACT(DOW FROM created_at)
    `);
    const orderDow = orderDowResult.rows;

    // Segment analyse
    const segResult = await pool.query(`
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
    const segData = segResult.rows;

    // Top producten via email
    const emailSkuResult = await pool.query(`
      SELECT oi.sku, oi.title, SUM(oi.quantity) as sold, ROUND(SUM(oi.price * oi.quantity)::numeric, 2) as revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.channel = 'email' AND oi.sku != ''
      GROUP BY oi.sku, oi.title ORDER BY sold DESC LIMIT 10
    `);
    const emailSkus = emailSkuResult.rows;

    // Recente email orders per campaign
    const campaignOrdersResult = await pool.query(`
      SELECT utm_campaign, COUNT(*) as orders, ROUND(SUM(total_price)::numeric, 2) as revenue,
             MIN(created_at) as first_order, MAX(created_at) as last_order
      FROM orders
      WHERE channel = 'email' AND utm_campaign IS NOT NULL
      GROUP BY utm_campaign ORDER BY revenue DESC
    `);
    const campaignOrders = campaignOrdersResult.rows;

    // Email omzet vergelijking
    const klaviyoTotal = await pool.query(`
      SELECT SUM(count) as orders, ROUND(SUM(revenue)::numeric, 2) as revenue
      FROM klaviyo_metrics WHERE metric_name = 'ordered_product'
      AND date >= CURRENT_DATE - INTERVAL '30 days'
    `);
    const utmTotal = await pool.query(`
      SELECT COUNT(*) as orders, ROUND(SUM(total_price)::numeric, 2) as revenue
      FROM orders WHERE channel = 'email' AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    `);

    const kl = klaviyoTotal.rows[0] ?? { orders: 0, revenue: 0 };
    const ut = utmTotal.rows[0] ?? { orders: 0, revenue: 0 };

    return NextResponse.json({
      report,
      dowStats,
      orderDow,
      segData,
      emailSkus,
      campaignOrders,
      emailImpact: {
        klaviyo_orders:  parseInt(kl.orders) || 0,
        klaviyo_revenue: parseFloat(kl.revenue) || 0,
        utm_orders:      parseInt(ut.orders) || 0,
        utm_revenue:     parseFloat(ut.revenue) || 0,
        gap_pct: kl.revenue > 0
          ? Math.round(((kl.revenue - ut.revenue) / kl.revenue) * 100)
          : 0,
      },
    });

  } catch (err: any) {
    console.error('Email intelligence API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
