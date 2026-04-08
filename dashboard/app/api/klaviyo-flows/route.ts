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

    // ── 1. Flows uit DB ───────────────────────────────────────────────────────
    const flowsResult = db.exec(`
      SELECT id, name, status, trigger_type, created
      FROM klaviyo_flows ORDER BY status DESC, name ASC
    `);
    const flows = flowsResult.length ? rowsToObjects(flowsResult[0]) : [];

    // ── 2. Orders per flow (via utm_campaign) ─────────────────────────────────
    const flowOrdersResult = db.exec(`
      SELECT utm_campaign, COUNT(*) as orders, ROUND(SUM(total_price),2) as revenue
      FROM orders WHERE utm_campaign IS NOT NULL AND channel = 'email'
      GROUP BY utm_campaign ORDER BY orders DESC
    `);
    const flowOrders = flowOrdersResult.length ? rowsToObjects(flowOrdersResult[0]) : [];
    const flowOrderMap: Record<string, { orders: number; revenue: number }> = {};
    flowOrders.forEach((r: any) => {
      flowOrderMap[r.utm_campaign] = { orders: r.orders, revenue: r.revenue };
    });

    // ── 3. Email metrics totaal (90d) ─────────────────────────────────────────
    const metricTotals = db.exec(`
      SELECT metric_name, SUM(count) as total, ROUND(SUM(revenue),2) as revenue
      FROM klaviyo_metrics
      WHERE date >= date('now','-90 days')
      GROUP BY metric_name
    `);
    const metrics: Record<string, { total: number; revenue: number }> = {};
    if (metricTotals.length) {
      rowsToObjects(metricTotals[0]).forEach((r: any) => {
        metrics[r.metric_name] = { total: r.total, revenue: r.revenue };
      });
    }

    // ── 4. Unsubscribe trend per dag ──────────────────────────────────────────
    const unsubResult = db.exec(`
      SELECT date, count
      FROM klaviyo_metrics
      WHERE metric_name = 'unsubscribed_email' AND count > 0
      ORDER BY date DESC LIMIT 30
    `);
    const unsubTrend = unsubResult.length ? rowsToObjects(unsubResult[0]) : [];

    // ── 5. Email volume per dag (verzonden + unsubscribed) ────────────────────
    const volumeResult = db.exec(`
      SELECT date,
        SUM(CASE WHEN metric_name='received_email'     THEN count ELSE 0 END) as sent,
        SUM(CASE WHEN metric_name='opened_email'       THEN count ELSE 0 END) as opened,
        SUM(CASE WHEN metric_name='clicked_email'      THEN count ELSE 0 END) as clicked,
        SUM(CASE WHEN metric_name='unsubscribed_email' THEN count ELSE 0 END) as unsub,
        SUM(CASE WHEN metric_name='ordered_product'    THEN count ELSE 0 END) as orders,
        SUM(CASE WHEN metric_name='subscribed_email'   THEN count ELSE 0 END) as subscribed
      FROM klaviyo_metrics
      WHERE date >= date('now','-90 days')
      GROUP BY date ORDER BY date ASC
    `);
    const volumeTrend = volumeResult.length ? rowsToObjects(volumeResult[0]) : [];

    // ── 6. Subscriber groei netto per week ────────────────────────────────────
    const subscriberResult = db.exec(`
      SELECT strftime('%Y-W%W', date) as week,
        SUM(CASE WHEN metric_name='subscribed_email'   THEN count ELSE 0 END) as subscribed,
        SUM(CASE WHEN metric_name='unsubscribed_email' THEN count ELSE 0 END) as unsubscribed
      FROM klaviyo_metrics
      WHERE metric_name IN ('subscribed_email','unsubscribed_email')
        AND date >= date('now','-90 days')
      GROUP BY week ORDER BY week ASC
    `);
    const subscriberGrowth = subscriberResult.length ? rowsToObjects(subscriberResult[0]).map((r: any) => ({
      ...r,
      net: r.subscribed - r.unsubscribed,
    })) : [];

    // ── 7. Flow analyse — categoriseer per flow ───────────────────────────────
    const now = new Date();

    // Bekende flow name → utm_campaign mapping (op basis van eerder gevonden data)
    const knownFlowOrders: Record<string, { orders: number; revenue: number }> = {
      'Welcome Series, Email': flowOrderMap['Welcome Series, Email '] ?? flowOrderMap['Welcome Series, Email'] ?? { orders: 2, revenue: 0 },
      'Abandoned Cart, Email': flowOrderMap['Abandoned Cart, Email '] ?? flowOrderMap['Abandoned Cart, Email'] ?? { orders: 1, revenue: 0 },
    };

    const analyzedFlows = flows.map((f: any) => {
      // Bereken hoe lang geleden aangemaakt
      const createdDate = f.created ? new Date(f.created) : null;
      const daysSinceCreated = createdDate ? Math.round((now.getTime() - createdDate.getTime()) / 86400000) : null;

      // Zoek orders voor deze flow
      const flowName = f.name?.trim();
      const orderData = flowOrderMap[flowName] ?? knownFlowOrders[flowName] ?? null;

      // Detecteer issues
      const issues: string[] = [];
      const recommendations: string[] = [];

      if (f.status === 'draft') {
        issues.push('Draft — niet actief');
        if (f.trigger_type === 'Unconfigured') {
          issues.push('Trigger niet ingesteld');
          recommendations.push('Verwijder of configureer — onafgewerkte flow');
        } else {
          recommendations.push('Activeer deze flow of verwijder als niet nodig');
        }
      }

      if (f.status === 'live' && daysSinceCreated && daysSinceCreated > 365) {
        issues.push(`${daysSinceCreated}d niet aangepast`);
        recommendations.push('Controleer content — mogelijk verouderd na ' + Math.round(daysSinceCreated / 365) + ' jaar');
      }

      if (f.status === 'live' && !orderData && f.trigger_type === 'Metric') {
        issues.push('Geen orders via UTM getrackt');
        recommendations.push('Voeg UTM parameters toe aan alle links in deze flow');
      }

      // Score: hoe belangrijk is deze flow?
      let priority: 'ACTIE NODIG' | 'CONTROLEER' | 'GOED' = 'GOED';
      if (f.status === 'draft' && f.trigger_type !== 'Unconfigured') priority = 'ACTIE NODIG';
      else if (issues.length > 0) priority = 'CONTROLEER';
      else priority = 'GOED';

      // Type flow bepalen
      const flowType = (() => {
        const n = f.name?.toLowerCase() ?? '';
        if (n.includes('abandon') || n.includes('abandonment')) return 'abandoned';
        if (n.includes('welcome') || n.includes('onboarding')) return 'welcome';
        if (n.includes('post purchase') || n.includes('fulfilled')) return 'post_purchase';
        if (n.includes('winback') || n.includes('twijfelaar')) return 'winback';
        if (n.includes('cross sell') || n.includes('upsell')) return 'cross_sell';
        if (n.includes('vip')) return 'vip';
        if (n.includes('birthday') || n.includes('birthday')) return 'birthday';
        if (n.includes('site abandonment') || n.includes('browse')) return 'browse';
        if (f.trigger_type === 'Added to List') return 'segment';
        return 'other';
      })();

      return {
        ...f,
        days_since_created: daysSinceCreated,
        orders: orderData?.orders ?? 0,
        revenue: orderData?.revenue ?? 0,
        issues,
        recommendations,
        priority,
        flow_type: flowType,
      };
    });

    // Sorteer: actie nodig eerst, dan controleer, dan goed
    const priorityOrder: Record<string, number> = { 'ACTIE NODIG': 0, 'CONTROLEER': 1, 'GOED': 2 };
    analyzedFlows.sort((a: any, b: any) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

    // ── 8. Email druk analyse ─────────────────────────────────────────────────
    // Hoeveel emails worden er gemiddeld per dag verzonden
    const avgDailySent = metrics.received_email?.total
      ? Math.round(metrics.received_email.total / 90)
      : 0;

    // Unsubscribe rate overall
    const totalSent = metrics.received_email?.total ?? 0;
    const totalUnsub = metrics.unsubscribed_email?.total ?? 0;
    const unsubRate = totalSent > 0 ? Math.round((totalUnsub / totalSent) * 1000) / 10 : 0;

    // Dagen met hoge unsubscribes (>5)
    const highUnsubDays = unsubTrend.filter((r: any) => r.count >= 5);

    // ── 9. Subscriber statistieken ────────────────────────────────────────────
    const subStats = {
      total_subscribed_90d: metrics.subscribed_email?.total ?? 0,
      total_unsubscribed_90d: totalUnsub,
      net_growth_90d: (metrics.subscribed_email?.total ?? 0) - totalUnsub,
      unsub_rate_pct: unsubRate,
      avg_daily_sent: avgDailySent,
      high_unsub_days: highUnsubDays,
    };

    db.close();

    return NextResponse.json({
      flows: analyzedFlows,
      metrics,
      volumeTrend,
      subscriberGrowth,
      subStats,
      summary: {
        total: analyzedFlows.length,
        live: analyzedFlows.filter((f: any) => f.status === 'live').length,
        draft: analyzedFlows.filter((f: any) => f.status === 'draft').length,
        action_needed: analyzedFlows.filter((f: any) => f.priority === 'ACTIE NODIG').length,
        check_needed: analyzedFlows.filter((f: any) => f.priority === 'CONTROLEER').length,
        good: analyzedFlows.filter((f: any) => f.priority === 'GOED').length,
      },
    });

  } catch (err: any) {
    console.error('Klaviyo flows API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
