export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? '30';

  try {
    const dateFilter = period === 'all'
      ? ''
      : `AND date >= CURRENT_DATE - INTERVAL '${parseInt(period)} days'`;

    // Totalen per metric
    const totalsResult = await pool.query(`
      SELECT metric_name, SUM(count) as total, ROUND(SUM(revenue)::numeric, 2) as revenue
      FROM klaviyo_metrics
      WHERE 1=1 ${dateFilter}
      GROUP BY metric_name
    `);
    const totals: Record<string, { total: number; revenue: number }> = {};
    totalsResult.rows.forEach((r: any) => {
      totals[r.metric_name] = { total: parseInt(r.total), revenue: parseFloat(r.revenue) };
    });

    // Dagelijkse trends voor email funnel
    const emailTrendResult = await pool.query(`
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
    const emailTrend = emailTrendResult.rows;

    // Site journey funnel
    const siteFunnelResult = await pool.query(`
      SELECT metric_name, SUM(count) as total
      FROM klaviyo_metrics
      WHERE metric_name IN ('viewed_product','added_to_cart','checkout_started','placed_order')
        ${dateFilter}
      GROUP BY metric_name
    `);
    const siteFunnel = siteFunnelResult.rows;

    // Form conversie
    const formResult = await pool.query(`
      SELECT metric_name, SUM(count) as total
      FROM klaviyo_metrics
      WHERE metric_name IN ('viewed_form','submitted_form','closed_form')
        ${dateFilter}
      GROUP BY metric_name
    `);
    const formData = formResult.rows;

    // Subscriber groei
    const subscriberResult = await pool.query(`
      SELECT date,
        SUM(CASE WHEN metric_name = 'subscribed_email'   THEN count ELSE 0 END) as subscribed,
        SUM(CASE WHEN metric_name = 'unsubscribed_email' THEN count ELSE 0 END) as unsubscribed
      FROM klaviyo_metrics
      WHERE metric_name IN ('subscribed_email','unsubscribed_email')
        AND date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date ASC
    `);
    const subscriberTrend = subscriberResult.rows;

    // Campaign lijst
    const campaignsResult = await pool.query(`
      SELECT id, name, status, sent_at, subject
      FROM klaviyo_campaigns
      ORDER BY sent_at DESC
      LIMIT 20
    `);
    const campaigns = campaignsResult.rows;

    // Flow lijst
    const flowsResult = await pool.query(`
      SELECT id, name, status, created, trigger_type
      FROM klaviyo_flows
      ORDER BY created DESC
      LIMIT 20
    `);
    const flows = flowsResult.rows;

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
