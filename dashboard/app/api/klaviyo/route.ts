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

  try {
    const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const db = new SQL.Database(fs.readFileSync(DB_PATH));

    const dateFilter = period === 'all' ? '' : `AND date >= date('now', '-${parseInt(period)} days')`;

    // Totalen per metric
    const totalsResult = db.exec(`
      SELECT metric_name, SUM(count) as total, ROUND(SUM(revenue), 2) as revenue
      FROM klaviyo_metrics
      WHERE 1=1 ${dateFilter}
      GROUP BY metric_name
    `);
    const totals: Record<string, { total: number; revenue: number }> = {};
    if (totalsResult.length) {
      rowsToObjects(totalsResult[0]).forEach((r: any) => {
        totals[r.metric_name] = { total: r.total, revenue: r.revenue };
      });
    }

    // Dagelijkse trends voor email funnel (laatste 30 dagen)
    const emailTrendResult = db.exec(`
      SELECT date,
        SUM(CASE WHEN metric_name = 'received_email'   THEN count ELSE 0 END) as received,
        SUM(CASE WHEN metric_name = 'opened_email'     THEN count ELSE 0 END) as opened,
        SUM(CASE WHEN metric_name = 'clicked_email'    THEN count ELSE 0 END) as clicked,
        SUM(CASE WHEN metric_name = 'ordered_product'  THEN count ELSE 0 END) as ordered,
        SUM(CASE WHEN metric_name = 'ordered_product'  THEN revenue ELSE 0 END) as revenue
      FROM klaviyo_metrics
      WHERE metric_name IN ('received_email','opened_email','clicked_email','ordered_product')
        AND date >= date('now', '-30 days')
      GROUP BY date
      ORDER BY date ASC
    `);
    const emailTrend = emailTrendResult.length ? rowsToObjects(emailTrendResult[0]) : [];

    // Site journey funnel
    const siteFunnelResult = db.exec(`
      SELECT metric_name, SUM(count) as total
      FROM klaviyo_metrics
      WHERE metric_name IN ('viewed_product','added_to_cart','checkout_started','placed_order')
        ${dateFilter}
      GROUP BY metric_name
    `);
    const siteFunnel = siteFunnelResult.length ? rowsToObjects(siteFunnelResult[0]) : [];

    // Form conversie
    const formResult = db.exec(`
      SELECT metric_name, SUM(count) as total
      FROM klaviyo_metrics
      WHERE metric_name IN ('viewed_form','submitted_form','closed_form')
        ${dateFilter}
      GROUP BY metric_name
    `);
    const formData = formResult.length ? rowsToObjects(formResult[0]) : [];

    // Subscriber groei (subscribed vs unsubscribed)
    const subscriberResult = db.exec(`
      SELECT date,
        SUM(CASE WHEN metric_name = 'subscribed_email'   THEN count ELSE 0 END) as subscribed,
        SUM(CASE WHEN metric_name = 'unsubscribed_email' THEN count ELSE 0 END) as unsubscribed
      FROM klaviyo_metrics
      WHERE metric_name IN ('subscribed_email','unsubscribed_email')
        AND date >= date('now', '-30 days')
      GROUP BY date
      ORDER BY date ASC
    `);
    const subscriberTrend = subscriberResult.length ? rowsToObjects(subscriberResult[0]) : [];

    // Campaign lijst
    const campaignsResult = db.exec(`
      SELECT id, name, status, sent_at, subject
      FROM klaviyo_campaigns
      ORDER BY sent_at DESC
      LIMIT 20
    `);
    const campaigns = campaignsResult.length ? rowsToObjects(campaignsResult[0]) : [];

    // Flow lijst
    const flowsResult = db.exec(`
      SELECT id, name, status, created, trigger_type
      FROM klaviyo_flows
      ORDER BY created DESC
      LIMIT 20
    `);
    const flows = flowsResult.length ? rowsToObjects(flowsResult[0]) : [];

    db.close();

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
