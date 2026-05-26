export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import pool from '../../../lib/pg-client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? '30';
  const periodInt = period === 'all' ? null : Math.max(1, parseInt(period) || 30);

  const dateFilter = periodInt
    ? `AND date >= CURRENT_DATE - INTERVAL '${periodInt} days'`
    : '';

  try {
    // Totalen per metric
    const totalsRes = await pool.query(`
      SELECT metric_name, SUM(count) as total, ROUND(SUM(revenue)::numeric, 2) as revenue
      FROM klaviyo_metrics
      WHERE 1=1 ${dateFilter}
      GROUP BY metric_name
    `);
    const totals: Record<string, { total: number; revenue: number }> = {};
    totalsRes.rows.forEach((r: any) => {
      totals[r.metric_name] = { total: Number(r.total), revenue: Number(r.revenue) };
    });

    // Dagelijkse trends voor email funnel (laatste 30 dagen)
    const emailTrendRes = await pool.query(`
      SELECT date,
        SUM(CASE WHEN metric_name = 'received_email'   THEN count ELSE 0 END) as received,
        SUM(CASE WHEN metric_name = 'opened_email'     THEN count ELSE 0 END) as opened,
        SUM(CASE WHEN metric_name = 'clicked_email'    THEN count ELSE 0 END) as clicked,
        SUM(CASE WHEN metric_name = 'ordered_product'  THEN count ELSE 0 END) as ordered,
        SUM(CASE WHEN metric_name = 'ordered_product'  THEN revenue ELSE 0 END) as revenue
      FROM klaviyo_metrics
      WHERE metric_name IN ('received_email','opened_email','clicked_email','ordered_product')
        AND date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date ASC
    `);
    const emailTrend = emailTrendRes.rows;

    // Site journey funnel
    const siteFunnelRes = await pool.query(`
      SELECT metric_name, SUM(count) as total
      FROM klaviyo_metrics
      WHERE metric_name IN ('viewed_product','added_to_cart','checkout_started','placed_order')
        ${dateFilter}
      GROUP BY metric_name
    `);
    const siteFunnel = siteFunnelRes.rows;

    // Form conversie
    const formRes = await pool.query(`
      SELECT metric_name, SUM(count) as total
      FROM klaviyo_metrics
      WHERE metric_name IN ('viewed_form','submitted_form','closed_form')
        ${dateFilter}
      GROUP BY metric_name
    `);
    const formData = formRes.rows;

    // Subscriber groei (subscribed vs unsubscribed)
    const subscriberRes = await pool.query(`
      SELECT date,
        SUM(CASE WHEN metric_name = 'subscribed_email'   THEN count ELSE 0 END) as subscribed,
        SUM(CASE WHEN metric_name = 'unsubscribed_email' THEN count ELSE 0 END) as unsubscribed
      FROM klaviyo_metrics
      WHERE metric_name IN ('subscribed_email','unsubscribed_email')
        AND date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date ASC
    `);
    const subscriberTrend = subscriberRes.rows;

    // Campaign lijst
    const campaignsRes = await pool.query(`
      SELECT id, name, status, sent_at, subject
      FROM klaviyo_campaigns
      ORDER BY sent_at DESC
      LIMIT 20
    `);
    const campaigns = campaignsRes.rows;

    // Flow lijst
    const flowsRes = await pool.query(`
      SELECT id, name, status, created, trigger_type
      FROM klaviyo_flows
      ORDER BY created DESC
      LIMIT 20
    `);
    const flows = flowsRes.rows;

    return NextResponse.json({
      totals,
      emailTrend,
      siteFunnel,
      formData,
      subscriberTrend,
      campaigns,
      flows,
      period,
    });

  } catch (err: any) {
    console.error('Klaviyo API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
