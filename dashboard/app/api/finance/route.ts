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

function getQuarter(month: string) {
  const m = parseInt(month.split('-')[1]);
  return `${month.split('-')[0]}-Q${Math.ceil(m / 3)}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') ?? 'monthly'; // monthly | quarterly

  try {
    const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const db = new SQL.Database(fs.readFileSync(DB_PATH));

    // COGS data
    const cogsPath = path.join(process.cwd(), 'data', 'products-cogs.json');
    const cogsData = JSON.parse(fs.readFileSync(cogsPath, 'utf-8'));
    const cogsMap: Record<string, any> = {};
    cogsData.products.forEach((p: any) => { cogsMap[p.sku] = p; });

    // ── 1. Omzet per maand (incl + excl BTW) ─────────────────────────────────
    const revenueResult = db.exec(`
      SELECT strftime('%Y-%m', created_at) as month,
        COUNT(*) as orders,
        ROUND(SUM(total_price), 2) as revenue_incl,
        ROUND(SUM(total_price) / 1.21, 2) as revenue_excl,
        ROUND(SUM(total_price) - SUM(total_price) / 1.21, 2) as btw_ontvangen,
        SUM(CASE WHEN financial_status IN ('refunded','partially_refunded') THEN 1 ELSE 0 END) as returns,
        ROUND(SUM(CASE WHEN financial_status IN ('refunded','partially_refunded') THEN total_price ELSE 0 END), 2) as return_value
      FROM orders
      WHERE created_at >= date('now', '-12 months')
      GROUP BY month ORDER BY month ASC
    `);
    const revenueByMonth = revenueResult.length ? rowsToObjects(revenueResult[0]) : [];

    // ── 2. COG per maand (werkelijke inkoopkosten via SKU × cogs_sea) ─────────
    const cogResult = db.exec(`
      SELECT strftime('%Y-%m', o.created_at) as month,
        oi.sku, SUM(oi.quantity) as qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.sku != '' AND o.created_at >= date('now', '-12 months')
      GROUP BY month, oi.sku
    `);
    const cogRows = cogResult.length ? rowsToObjects(cogResult[0]) : [];

    // Bereken COG per maand
    const cogByMonth: Record<string, number> = {};
    cogRows.forEach((r: any) => {
      const p = cogsMap[r.sku];
      if (!p?.cogs_sea) return;
      cogByMonth[r.month] = (cogByMonth[r.month] ?? 0) + p.cogs_sea * r.qty;
    });

    // ── 3. Ad spend per maand ─────────────────────────────────────────────────
    const spendResult = db.exec(`
      SELECT strftime('%Y-%m', date) as month, ROUND(SUM(spend), 2) as spend
      FROM ad_spend
      WHERE date >= date('now', '-12 months')
      GROUP BY month ORDER BY month
    `);
    const spendByMonth: Record<string, number> = {};
    if (spendResult.length) rowsToObjects(spendResult[0]).forEach((r: any) => { spendByMonth[r.month] = r.spend; });

    // ── 4. OPEX ───────────────────────────────────────────────────────────────
    const opexResult = db.exec(`
      SELECT ROUND(SUM(monthly_amount), 2) as total,
        ROUND(SUM(btw), 2) as btw_betaald,
        category, ROUND(SUM(monthly_amount), 2) as cat_amount
      FROM opex GROUP BY category ORDER BY cat_amount DESC
    `);
    const opexByCategory = opexResult.length ? rowsToObjects(opexResult[0]) : [];

    const opexTotals = db.exec(`
      SELECT ROUND(SUM(monthly_amount), 2) as total, ROUND(SUM(btw), 2) as btw_betaald
      FROM opex
    `);
    const opex = opexTotals.length ? rowsToObjects(opexTotals[0])[0] : { total: 0, btw_betaald: 0 };

    // OPEX detail voor breakdown
    const opexDetailResult = db.exec(`
      SELECT category, name, monthly_amount, btw, frequency
      FROM opex ORDER BY category, monthly_amount DESC
    `);
    const opexDetail = opexDetailResult.length ? rowsToObjects(opexDetailResult[0]) : [];

    // ── 5. Samengestelde P&L per maand ────────────────────────────────────────
    const allMonths = [...new Set([
      ...revenueByMonth.map((r: any) => r.month),
    ])].sort();

    const pnlByMonth = allMonths.map(month => {
      const rev = revenueByMonth.find((r: any) => r.month === month) ?? {
        revenue_incl: 0, revenue_excl: 0, btw_ontvangen: 0, orders: 0, returns: 0, return_value: 0,
      };
      const cog = Math.round(cogByMonth[month] ?? 0);
      const spend = spendByMonth[month] ?? 0;
      const opexMonthly = opex.total ?? 0;
      const btwBetaald = opex.btw_betaald ?? 0;

      const grossProfit = Math.round((rev.revenue_excl ?? 0) - cog);
      const grossMarginPct = rev.revenue_excl > 0 ? Math.round((grossProfit / rev.revenue_excl) * 100) : 0;
      const netProfit = Math.round(grossProfit - opexMonthly - spend);
      const netMarginPct = rev.revenue_excl > 0 ? Math.round((netProfit / rev.revenue_excl) * 100) : 0;

      // BTW: ontvangen over omzet − betaald over OPEX = per kwartaal te betalen
      const btwTeBetalenMaand = Math.round((rev.btw_ontvangen ?? 0) - btwBetaald);
      const returnRate = rev.orders > 0 ? Math.round((rev.returns / rev.orders) * 100) : 0;

      return {
        month,
        quarter: getQuarter(month),
        orders: rev.orders ?? 0,
        revenue_incl: rev.revenue_incl ?? 0,
        revenue_excl: rev.revenue_excl ?? 0,
        btw_ontvangen: Math.round(rev.btw_ontvangen ?? 0),
        btw_betaald: Math.round(btwBetaald),
        btw_te_betalen: btwTeBetalenMaand,
        cog,
        spend: Math.round(spend),
        opex: Math.round(opexMonthly),
        gross_profit: grossProfit,
        gross_margin_pct: grossMarginPct,
        net_profit: netProfit,
        net_margin_pct: netMarginPct,
        returns: rev.returns ?? 0,
        return_value: rev.return_value ?? 0,
        return_rate: returnRate,
      };
    });

    // ── 6. Kwartaal aggregatie ────────────────────────────────────────────────
    const pnlByQuarter: Record<string, any> = {};
    pnlByMonth.forEach(m => {
      const q = m.quarter;
      if (!pnlByQuarter[q]) {
        pnlByQuarter[q] = {
          quarter: q, months: [], orders: 0, revenue_incl: 0, revenue_excl: 0,
          btw_ontvangen: 0, btw_betaald: 0, btw_te_betalen: 0,
          cog: 0, spend: 0, opex: 0, gross_profit: 0, net_profit: 0,
          returns: 0, return_value: 0,
        };
      }
      const q_data = pnlByQuarter[q];
      q_data.months.push(m.month);
      q_data.orders        += m.orders;
      q_data.revenue_incl  += m.revenue_incl;
      q_data.revenue_excl  += m.revenue_excl;
      q_data.btw_ontvangen += m.btw_ontvangen;
      q_data.btw_betaald   += m.btw_betaald;
      q_data.btw_te_betalen += m.btw_te_betalen;
      q_data.cog           += m.cog;
      q_data.spend         += m.spend;
      q_data.opex          += m.opex;
      q_data.gross_profit  += m.gross_profit;
      q_data.net_profit    += m.net_profit;
      q_data.returns       += m.returns;
      q_data.return_value  += m.return_value;
    });

    // Bereken percentages op kwartaal niveau
    const pnlQuarterArr = Object.values(pnlByQuarter).map((q: any) => ({
      ...q,
      revenue_incl:  Math.round(q.revenue_incl),
      revenue_excl:  Math.round(q.revenue_excl),
      gross_profit:  Math.round(q.gross_profit),
      net_profit:    Math.round(q.net_profit),
      gross_margin_pct: q.revenue_excl > 0 ? Math.round((q.gross_profit / q.revenue_excl) * 100) : 0,
      net_margin_pct:   q.revenue_excl > 0 ? Math.round((q.net_profit   / q.revenue_excl) * 100) : 0,
      return_rate:   q.orders > 0 ? Math.round((q.returns / q.orders) * 100) : 0,
      btw_ontvangen: Math.round(q.btw_ontvangen),
      btw_betaald:   Math.round(q.btw_betaald),
      btw_te_betalen: Math.round(q.btw_te_betalen),
    }));

    // ── 7. Return rate per kanaal ─────────────────────────────────────────────
    const returnResult = db.exec(`
      SELECT channel,
        COUNT(*) as orders,
        SUM(CASE WHEN financial_status IN ('refunded','partially_refunded') THEN 1 ELSE 0 END) as returns,
        ROUND(100.0 * SUM(CASE WHEN financial_status IN ('refunded','partially_refunded') THEN 1 ELSE 0 END) / COUNT(*), 1) as pct,
        ROUND(SUM(CASE WHEN financial_status IN ('refunded','partially_refunded') THEN total_price ELSE 0 END), 2) as return_value
      FROM orders GROUP BY channel ORDER BY returns DESC
    `);
    const returnByChannel = returnResult.length ? rowsToObjects(returnResult[0]) : [];

    db.close();

    const data = mode === 'quarterly' ? pnlQuarterArr : pnlByMonth;

    return NextResponse.json({
      pnl: data,
      opex: opex.total,
      opexByCategory,
      opexDetail,
      returnByChannel,
      mode,
      usdEurRate: cogsData.usd_eur_rate ?? null,
      lastCurrencyUpdate: cogsData.last_currency_update ?? null,
    });

  } catch (err: any) {
    console.error('Finance API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
