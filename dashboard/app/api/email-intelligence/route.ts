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

    // Laad email timing rapport
    const reportPath = path.join(process.cwd(), 'data', 'email-timing-report.json');
    let report: any = null;
    try {
      report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    } catch {
      report = null;
    }

    // Open/click rates per dag van de week uit DB
    const dowResult = db.exec(`
      SELECT strftime('%w', date) as dow,
        SUM(CASE WHEN metric_name='received_email'  THEN count ELSE 0 END) as sent,
        SUM(CASE WHEN metric_name='opened_email'    THEN count ELSE 0 END) as opened,
        SUM(CASE WHEN metric_name='clicked_email'   THEN count ELSE 0 END) as clicked,
        SUM(CASE WHEN metric_name='ordered_product' THEN count   ELSE 0 END) as orders,
        SUM(CASE WHEN metric_name='ordered_product' THEN revenue ELSE 0 END) as revenue
      FROM klaviyo_metrics
      WHERE metric_name IN ('received_email','opened_email','clicked_email','ordered_product')
      GROUP BY dow ORDER BY dow
    `);
    const dowStats = dowResult.length ? rowsToObjects(dowResult[0]).map((r: any) => ({
      dow:          parseInt(r.dow),
      sent:         r.sent,
      opened:       r.opened,
      clicked:      r.clicked,
      orders:       r.orders,
      revenue:      Math.round(r.revenue),
      open_rate:    r.sent > 0 ? Math.round((r.opened / r.sent) * 100) : 0,
      click_rate:   r.sent > 0 ? Math.round((r.clicked / r.sent) * 100) : 0,
      rev_per_email: r.sent > 0 ? Math.round((r.revenue / r.sent) * 100) / 100 : 0,
    })) : [];

    // Orders per dag van de week (Shopify)
    const orderDowResult = db.exec(`
      SELECT strftime('%w', created_at) as dow,
        COUNT(*) as orders,
        ROUND(SUM(total_price), 2) as revenue,
        ROUND(AVG(total_price), 2) as aov
      FROM orders WHERE marketplace != 'bol'
      GROUP BY dow ORDER BY dow
    `);
    const orderDow = orderDowResult.length ? rowsToObjects(orderDowResult[0]) : [];

    // Segment analyse
    const segResult = db.exec(`
      SELECT
        is_new_customer,
        COUNT(*) as orders,
        ROUND(AVG(total_price), 2) as aov,
        ROUND(SUM(total_price), 2) as revenue,
        channel
      FROM orders
      WHERE is_new_customer IS NOT NULL
      GROUP BY is_new_customer, channel
      ORDER BY orders DESC
    `);
    const segData = segResult.length ? rowsToObjects(segResult[0]) : [];

    // Top producten via email
    const emailSkuResult = db.exec(`
      SELECT oi.sku, oi.title, SUM(oi.quantity) as sold, ROUND(SUM(oi.price * oi.quantity), 2) as revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.channel = 'email' AND oi.sku != ''
      GROUP BY oi.sku ORDER BY sold DESC LIMIT 10
    `);
    const emailSkus = emailSkuResult.length ? rowsToObjects(emailSkuResult[0]) : [];

    // Recente email orders per campaign
    const campaignOrdersResult = db.exec(`
      SELECT utm_campaign, COUNT(*) as orders, ROUND(SUM(total_price), 2) as revenue,
             MIN(created_at) as first_order, MAX(created_at) as last_order
      FROM orders
      WHERE channel = 'email' AND utm_campaign IS NOT NULL
      GROUP BY utm_campaign ORDER BY revenue DESC
    `);
    const campaignOrders = campaignOrdersResult.length ? rowsToObjects(campaignOrdersResult[0]) : [];

    // Email omzet vergelijking (Klaviyo vs UTM)
    const klaviyoTotal = db.exec(`
      SELECT SUM(count) as orders, ROUND(SUM(revenue), 2) as revenue
      FROM klaviyo_metrics WHERE metric_name = 'ordered_product'
      AND date >= date('now', '-30 days')
    `);
    const utmTotal = db.exec(`
      SELECT COUNT(*) as orders, ROUND(SUM(total_price), 2) as revenue
      FROM orders WHERE channel = 'email' AND created_at >= date('now', '-30 days')
    `);

    const kl = klaviyoTotal.length ? rowsToObjects(klaviyoTotal[0])[0] : { orders: 0, revenue: 0 };
    const ut = utmTotal.length ? rowsToObjects(utmTotal[0])[0] : { orders: 0, revenue: 0 };

    db.close();

    return NextResponse.json({
      report,
      dowStats,
      orderDow,
      segData,
      emailSkus,
      campaignOrders,
      emailImpact: {
        klaviyo_orders: kl.orders,
        klaviyo_revenue: kl.revenue,
        utm_orders: ut.orders,
        utm_revenue: ut.revenue,
        gap_pct: kl.revenue > 0 ? Math.round(((kl.revenue - ut.revenue) / kl.revenue) * 100) : 0,
      },
    });

  } catch (err: any) {
    console.error('Email intelligence API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
