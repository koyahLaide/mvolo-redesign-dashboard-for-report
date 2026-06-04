export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import pool from '../../../lib/db';

export async function GET() {
  try {
    // Week-over-week
    const wowResult = await pool.query(`
      SELECT
        ROUND(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days'  THEN total_price ELSE 0 END)::numeric, 2) as this_week_rev,
        ROUND(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '14 days' AND created_at < CURRENT_DATE - INTERVAL '7 days' THEN total_price ELSE 0 END)::numeric, 2) as last_week_rev,
        SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days'  THEN 1 ELSE 0 END) as this_week_orders,
        SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '14 days' AND created_at < CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END) as last_week_orders
      FROM orders
    `);
    const wow = wowResult.rows[0];
    const revChange = wow && wow.last_week_rev > 0
      ? Math.round(((wow.this_week_rev - wow.last_week_rev) / wow.last_week_rev) * 100) : null;
    const orderChange = wow && wow.last_week_orders > 0
      ? Math.round(((wow.this_week_orders - wow.last_week_orders) / wow.last_week_orders) * 100) : null;

    // Vandaag vs gisteren
    const todayResult = await pool.query(`
      SELECT
        ROUND(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN total_price ELSE 0 END)::numeric, 2) as today_rev,
        SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 ELSE 0 END) as today_orders,
        ROUND(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE - INTERVAL '1 day' THEN total_price ELSE 0 END)::numeric, 2) as yesterday_rev,
        SUM(CASE WHEN DATE(created_at) = CURRENT_DATE - INTERVAL '1 day' THEN 1 ELSE 0 END) as yesterday_orders
      FROM orders
    `);
    const today = todayResult.rows[0];

    // Kritieke voorraad
    const cogsPath = path.join(process.cwd(), 'data', 'products-cogs.json');
    const cogsData = JSON.parse(fs.readFileSync(cogsPath, 'utf-8'));

    const inventory: Record<string, { title: string; stock: number }> = {};
    if (process.env.SHOPIFY_STORE && process.env.SHOPIFY_TOKEN) {
      const shopifyRes = await fetch(
        `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/products.json?limit=250&fields=id,title,variants`,
        { headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_TOKEN } }
      );
      if (shopifyRes.ok) {
        const shopifyData = await shopifyRes.json();
        for (const p of shopifyData.products ?? []) {
          for (const v of p.variants ?? []) {
            if (v.sku) inventory[String(v.sku)] = { title: p.title, stock: v.inventory_quantity };
          }
        }
      }
    }

    const velocityResult = await pool.query(`
      SELECT sku, SUM(quantity) * 1.0 / 30 as daily
      FROM order_items WHERE order_date >= CURRENT_DATE - INTERVAL '30 days' AND sku != ''
      GROUP BY sku
    `);
    const velocity: Record<string, number> = {};
    velocityResult.rows.forEach((r: any) => { velocity[r.sku] = parseFloat(r.daily); });

    const { lead_times, safety_stock_days } = cogsData;
    const sea_lead = lead_times.production_days + lead_times.sea_days + safety_stock_days;
    const criticalProducts: any[] = [];
    for (const p of cogsData.products) {
      const inv = inventory[p.sku];
      if (!inv) continue;
      const stock = inv.stock;
      const vel = velocity[p.sku] || 0;
      const days_left = vel > 0 ? Math.round(stock / vel) : (stock > 0 ? 999 : 0);
      if (stock <= 0 || (vel > 0 && days_left < sea_lead)) {
        criticalProducts.push({
          name: p.name, sku: p.sku, stock,
          days_left: days_left > 900 ? null : days_left,
          urgency: stock <= 0 ? 'KRITIEK' : days_left < 30 ? 'URGENT' : 'BESTEL',
        });
      }
    }
    criticalProducts.sort((a, b) => (a.stock < b.stock ? -1 : 1));

    // Kanaal anomalie
    const channelWowResult = await pool.query(`
      SELECT channel,
        SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END) as this_week,
        SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '14 days' AND created_at < CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END) as last_week
      FROM orders
      GROUP BY channel
      HAVING SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '14 days' AND created_at < CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END) > 0
          OR SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END) > 0
      ORDER BY last_week DESC
    `);
    const channelWow = channelWowResult.rows.map((r: any) => ({
      channel: r.channel,
      this_week: parseInt(r.this_week),
      last_week: parseInt(r.last_week),
      change_pct: r.last_week > 0 ? Math.round(((r.this_week - r.last_week) / r.last_week) * 100) : null,
    }));

    // Email timing aanbeveling
    let emailAdvice: any = null;
    try {
      const reportPath = path.join(process.cwd(), 'data', 'email-timing-report.json');
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      const best = report.dow_stats?.[0];
      emailAdvice = best ? {
        best_day: best.dag, best_times: report.recommendations?.best_times ?? ['16:00–18:00'],
        rev_per_email: best.rev_per_email, best_campaign_type: report.recommendations?.best_campaign_type,
      } : null;
    } catch { emailAdvice = null; }

    // Meest verkochte SKU vandaag
    const todaySkuResult = await pool.query(`
      SELECT oi.sku, oi.title, SUM(oi.quantity) as qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE DATE(o.created_at) = CURRENT_DATE AND oi.sku != ''
      GROUP BY oi.sku, oi.title ORDER BY qty DESC LIMIT 3
    `);
    const todaySkus = todaySkuResult.rows;

    // Netto winst deze maand
    const revenueMonthResult = await pool.query(`
      SELECT
        ROUND(SUM(total_price)::numeric, 2) as revenue,
        ROUND((SUM(total_price) / 1.21)::numeric, 2) as revenue_excl
      FROM orders
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
        AND financial_status NOT IN ('refunded', 'voided')
    `);
    const revMonth = revenueMonthResult.rows[0];

    const cogMonthResult = await pool.query(`
      SELECT ROUND(SUM(oi.quantity * oi.price)::numeric, 2) as total_items_revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    const cogMonth = cogMonthResult.rows[0];

    const spendMonthResult = await pool.query(`
      SELECT ROUND(SUM(spend)::numeric, 2) as total_spend
      FROM ad_spend
      WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    const spendMonth = spendMonthResult.rows[0];

    const opexResult = await pool.query(`SELECT ROUND(SUM(monthly_amount)::numeric, 2) as total FROM opex`);
    const opexTotal = parseFloat(opexResult.rows[0]?.total ?? '0');

    const revenueExcl = parseFloat(revMonth?.revenue_excl ?? '0');
    const cogEstimate = parseFloat(cogMonth?.total_items_revenue ?? '0') > 0
      ? Math.round(parseFloat(cogMonth.total_items_revenue) * 0.28)
      : Math.round(revenueExcl * 0.28);
    const adSpend = parseFloat(spendMonth?.total_spend ?? '0');
    const grossProfit = Math.round(revenueExcl - cogEstimate);
    const netProfit = Math.round(grossProfit - opexTotal - adSpend);
    const netMarginPct = revenueExcl > 0 ? Math.round((netProfit / revenueExcl) * 100) : 0;

    // Return rate (30d)
    const returnResult = await pool.query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN financial_status IN ('refunded','partially_refunded') THEN 1 ELSE 0 END) as returns,
        ROUND(100.0 * SUM(CASE WHEN financial_status IN ('refunded','partially_refunded') THEN 1 ELSE 0 END) / COUNT(*), 1) as return_rate
      FROM orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `);
    const returnStats = returnResult.rows[0];

    // Competitor prijs alerts
    const compAlertResult = await pool.query(`
      SELECT competitor, product_name, price, category, url, price_change_pct, price_changed
      FROM competitor_prices
      WHERE date = (SELECT MAX(date) FROM competitor_prices)
        AND price_changed = true
      ORDER BY ABS(price_change_pct) DESC
      LIMIT 3
    `);

    const cheaperCompResult = await pool.query(`
      SELECT cp.competitor, cp.category, MIN(cp.price) as min_price
      FROM competitor_prices cp
      WHERE cp.date = (SELECT MAX(date) FROM competitor_prices)
        AND cp.category IN ('led_face_mask', 'rlt_panel', 'infrared_double_head')
      GROUP BY cp.competitor, cp.category
      ORDER BY min_price ASC
      LIMIT 5
    `);

    return NextResponse.json({
      wow: {
        this_week_rev:    parseFloat(wow?.this_week_rev ?? '0'),
        last_week_rev:    parseFloat(wow?.last_week_rev ?? '0'),
        this_week_orders: parseInt(wow?.this_week_orders ?? '0'),
        last_week_orders: parseInt(wow?.last_week_orders ?? '0'),
        rev_change_pct:   revChange,
        order_change_pct: orderChange,
      },
      today: {
        revenue:           parseFloat(today?.today_rev ?? '0'),
        orders:            parseInt(today?.today_orders ?? '0'),
        yesterday_revenue: parseFloat(today?.yesterday_rev ?? '0'),
        yesterday_orders:  parseInt(today?.yesterday_orders ?? '0'),
      },
      critical_products: criticalProducts.slice(0, 5),
      channel_wow:       channelWow,
      email_advice:      emailAdvice,
      today_skus:        todaySkus,
      profit: {
        revenue_excl: revenueExcl, cog: cogEstimate, gross_profit: grossProfit,
        opex: opexTotal, ad_spend: adSpend, net_profit: netProfit, net_margin_pct: netMarginPct,
      },
      return_rate: {
        total_orders: parseInt(returnStats?.total_orders ?? '0'),
        returns:      parseInt(returnStats?.returns ?? '0'),
        rate:         parseFloat(returnStats?.return_rate ?? '0'),
      },
      competitor_alerts:   compAlertResult.rows,
      cheaper_competitors: cheaperCompResult.rows,
    });

  } catch (err: any) {
    console.error('Actions API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
