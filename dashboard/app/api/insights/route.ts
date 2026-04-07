export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import fs from 'fs';
import initSqlJs from 'sql.js';
import path from 'path';
import { DB_PATH } from '../../../lib/db-path';

const WEEKDAY_NL = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

function rowsToObjects(result: { columns: string[]; values: unknown[][] }): unknown[] {
  return result.values.map((row) =>
    Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
  );
}

function fmt(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v);
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export async function GET() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return Response.json({ insights: [] });
    }

    const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const db = new SQL.Database(fs.readFileSync(DB_PATH));

    const migrations = [
      'ALTER TABLE orders ADD COLUMN is_new_customer INTEGER',
    ];
    for (const sql of migrations) {
      try { db.run(sql); } catch { /* already exists */ }
    }

    // ── Raw data ─────────────────────────────────────────────────────────────
    const chResult = db.exec(`
      SELECT
        channel,
        COUNT(*) as orders,
        ROUND(SUM(total_price), 2) as revenue,
        ROUND(AVG(total_price), 2) as avg_value
      FROM orders
      GROUP BY channel
      ORDER BY orders DESC
    `);
    const channels = chResult.length ? rowsToObjects(chResult[0]) as {
      channel: string; orders: number; revenue: number; avg_value: number;
    }[] : [];

    const totResult = db.exec(`SELECT COUNT(*) as total, SUM(total_price) as rev FROM orders`);
    const tot = totResult.length ? rowsToObjects(totResult[0])[0] as { total: number; rev: number } : { total: 0, rev: 0 };
    const globalAvg = tot.total > 0 ? tot.rev / tot.total : 0;

    const wdResult = db.exec(`
      SELECT strftime('%w', created_at) as wd, COUNT(*) as orders, ROUND(SUM(total_price), 2) as revenue
      FROM orders GROUP BY wd ORDER BY revenue DESC LIMIT 1
    `);
    const bestWd = wdResult.length ? rowsToObjects(wdResult[0])[0] as { wd: string; orders: number; revenue: number } : null;

    const wdCountResult = db.exec(`
      SELECT strftime('%w', created_at) as wd, COUNT(DISTINCT DATE(created_at)) as day_count
      FROM orders GROUP BY wd
    `);
    const wdCounts: Record<string, number> = {};
    if (wdCountResult.length) {
      (rowsToObjects(wdCountResult[0]) as Record<string, unknown>[]).forEach((r) => {
        wdCounts[String(r.wd)] = Number(r.day_count);
      });
    }

    const hrResult = db.exec(`
      SELECT strftime('%H', created_at) as hr, COUNT(*) as orders
      FROM orders GROUP BY hr ORDER BY orders DESC LIMIT 1
    `);
    const bestHr = hrResult.length ? rowsToObjects(hrResult[0])[0] as { hr: string; orders: number } : null;

    const newCustResult = db.exec(`
      SELECT
        SUM(CASE WHEN is_new_customer = 1 THEN 1 ELSE 0 END) as nieuwe,
        SUM(CASE WHEN is_new_customer = 0 THEN 1 ELSE 0 END) as terugkerend
      FROM orders
    `);
    const cust = newCustResult.length ? rowsToObjects(newCustResult[0])[0] as { nieuwe: number; terugkerend: number } : null;

    db.close();

    // ── Generate insights ─────────────────────────────────────────────────────
    const insights: { text: string }[] = [];

    if (channels.length > 0 && tot.total > 0) {
      const top = channels[0];
      const topPct = pct(top.orders, tot.total);
      insights.push({
        text: `${label(top.channel)} is je grootste kanaal met ${topPct}% van alle orders (${top.orders} orders, ${fmt(top.revenue)} omzet).`,
      });

      // Channel with highest avg order value
      const byAvg = [...channels].sort((a, b) => b.avg_value - a.avg_value);
      const highAvg = byAvg[0];
      const diffPct = globalAvg > 0 ? Math.round(((highAvg.avg_value - globalAvg) / globalAvg) * 100) : 0;
      if (highAvg.channel !== top.channel && diffPct > 0) {
        insights.push({
          text: `${label(highAvg.channel)} klanten besteden gemiddeld ${fmt(highAvg.avg_value)} per order — ${diffPct}% boven het overall gemiddelde van ${fmt(globalAvg)}.`,
        });
      }

      // Lowest avg order value channel (with significant volume)
      const significant = channels.filter(c => c.orders >= 5);
      if (significant.length >= 2) {
        const lowAvg = [...significant].sort((a, b) => a.avg_value - b.avg_value)[0];
        const highestAvg = [...significant].sort((a, b) => b.avg_value - a.avg_value)[0];
        if (lowAvg.channel !== highestAvg.channel) {
          const ratio = highestAvg.avg_value > 0 ? Math.round((highestAvg.avg_value / lowAvg.avg_value) * 10) / 10 : 1;
          insights.push({
            text: `${label(highestAvg.channel)} orders zijn ${ratio}× meer waard dan ${label(lowAvg.channel)} orders (${fmt(highestAvg.avg_value)} vs ${fmt(lowAvg.avg_value)} gem. orderwaarde).`,
          });
        }
      }
    }

    // Best weekday
    if (bestWd) {
      const dayName = WEEKDAY_NL[Number(bestWd.wd)] ?? '?';
      const count = wdCounts[bestWd.wd] ?? 1;
      const avgRevPerDay = count > 0 ? bestWd.revenue / count : bestWd.revenue;
      insights.push({
        text: `${dayName} is je beste dag: gemiddeld ${fmt(avgRevPerDay)} omzet per ${dayName.toLowerCase()}.`,
      });
    }

    // Best hour
    if (bestHr) {
      const hr = Number(bestHr.hr);
      insights.push({
        text: `De meeste orders komen binnen tussen ${hr}:00 en ${hr + 1}:00 uur (${bestHr.orders} orders in die tijdslot).`,
      });
    }

    // New vs returning
    if (cust && (cust.nieuwe + cust.terugkerend) > 0) {
      const total = cust.nieuwe + cust.terugkerend;
      const retPct = pct(cust.terugkerend, total);
      const newPct = pct(cust.nieuwe, total);
      if (retPct > 40) {
        insights.push({
          text: `${retPct}% van je gesyncte orders komt van terugkerende klanten — sterke loyaliteit. ${newPct}% zijn nieuwe klanten.`,
        });
      } else if (newPct > 70) {
        insights.push({
          text: `${newPct}% van je orders zijn van nieuwe klanten — focus op retentie kan de lifetime value flink verhogen.`,
        });
      }
    }

    return Response.json({ insights });
  } catch (err) {
    console.error('[/api/insights] Error:', err);
    return Response.json({ insights: [] });
  }
}

function label(channel: string) {
  return channel.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
