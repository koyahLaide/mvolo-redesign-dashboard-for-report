'use client';

import { useEffect, useState, useCallback } from 'react';

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v ?? 0);
}
function pct(v: number) {
  return `${v > 0 ? '+' : ''}${v}%`;
}
function profitColor(v: number) {
  return v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : '#6b7280';
}

const CHANNEL_COLORS: Record<string, string> = {
  direct: '#6366f1', organic_search: '#22c55e', meta_ads: '#ec4899',
  awin_affiliate: '#f59e0b', email: '#a78bfa', organic_social: '#f97316', other: '#6b7280',
};
function channelColor(ch: string) { return CHANNEL_COLORS[ch] ?? '#6b7280'; }
function formatLabel(s: string) { return s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—'; }

function MonthLabel({ m }: { m: string }) {
  const months = ['', 'Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
  const [year, month] = m.split('-');
  return <span>{months[parseInt(month)]} {year}</span>;
}

export default function FinancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'monthly' | 'quarterly'>('monthly');
  const [tab, setTab] = useState<'pnl' | 'btw' | 'opex' | 'returns'>('pnl');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/finance?mode=${mode}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [mode]);

  useEffect(() => { load(); }, [load]);

  const pnl = data?.pnl ?? [];
  const latest = pnl[pnl.length - 1] ?? {};
  const prev = pnl[pnl.length - 2] ?? {};

  const totalRevExcl = pnl.reduce((s: number, r: any) => s + (r.revenue_excl ?? 0), 0);
  const totalGross   = pnl.reduce((s: number, r: any) => s + (r.gross_profit ?? 0), 0);
  const totalNet     = pnl.reduce((s: number, r: any) => s + (r.net_profit ?? 0), 0);
  const totalBtwTeBetalen = pnl.reduce((s: number, r: any) => s + (r.btw_te_betalen ?? 0), 0);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">

      {/* Top bar with mode switch */}
      <div className="border-b border-gray-200 dark:border-gray-800 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Finance</h1>
            <p className="text-xs text-gray-500 mt-0.5">Winst & verlies · BTW · returns</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-0.5">
              <button onClick={() => setMode('monthly')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${mode === 'monthly' ? 'bg-white dark:bg-white text-gray-900 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                Per maand
              </button>
              <button onClick={() => setMode('quarterly')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${mode === 'quarterly' ? 'bg-white dark:bg-white text-gray-900 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                Per kwartaal
              </button>
            </div>
            {data?.usdEurRate && (
              <span className="text-xs text-gray-500 dark:text-gray-600">
                1 USD = €{data.usdEurRate.toFixed(4)} · {data.lastCurrencyUpdate}
              </span>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">

        {/* KPI banner */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
              <p className="text-xs text-gray-500">Omzet excl. BTW (12m)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatEuro(totalRevExcl)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Laatste periode: {formatEuro(latest.revenue_excl)}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
              <p className="text-xs text-gray-500">Brutomarge (12m)</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{formatEuro(totalGross)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{totalRevExcl > 0 ? Math.round((totalGross / totalRevExcl) * 100) : 0}% marge</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
              <p className="text-xs text-gray-500">Nettoresultaat (12m)</p>
              <p className="text-2xl font-bold mt-1" style={{ color: profitColor(totalNet) }}>{formatEuro(totalNet)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">na OPEX + ad spend</p>
            </div>
            <div className="bg-amber-50 dark:bg-yellow-950/30 border border-amber-200 dark:border-yellow-900/30 rounded-xl px-5 py-4">
              <p className="text-xs text-gray-500">BTW saldo (12m)</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-yellow-400 mt-1">{formatEuro(totalBtwTeBetalen)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">ontvangen − betaald</p>
            </div>
          </div>
        )}

        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1 w-fit">
          {([
            ['pnl', '📊 Winst & Verlies'],
            ['btw', '🧾 BTW Overzicht'],
            ['opex', '💸 OPEX'],
            ['returns', '↩ Returns'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key ? 'bg-gray-100 dark:bg-white text-gray-900 dark:text-gray-900' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-600 animate-pulse">Laden…</div>
        ) : (
          <>
            {/* P&L TAB */}
            {tab === 'pnl' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Winst & Verlies {mode === 'quarterly' ? 'per kwartaal' : 'per maand'}</h2>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Omzet excl. BTW − COG − OPEX − Ad spend = Nettoresultaat</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase tracking-wider">
                          <th className="px-4 py-2 text-left">Periode</th>
                          <th className="px-4 py-2 text-right">Orders</th>
                          <th className="px-4 py-2 text-right">Omzet incl.</th>
                          <th className="px-4 py-2 text-right">Omzet excl.</th>
                          <th className="px-4 py-2 text-right">COG</th>
                          <th className="px-4 py-2 text-right">Bruto</th>
                          <th className="px-4 py-2 text-right">Bruto%</th>
                          <th className="px-4 py-2 text-right">OPEX</th>
                          <th className="px-4 py-2 text-right">Ad spend</th>
                          <th className="px-4 py-2 text-right font-bold text-gray-900 dark:text-white">Netto</th>
                          <th className="px-4 py-2 text-right">Netto%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pnl.slice(-12).map((r: any) => (
                          <tr key={r.month ?? r.quarter} className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20">
                            <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">
                              {mode === 'quarterly' ? r.quarter : <MonthLabel m={r.month} />}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums">{r.orders}</td>
                            <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums">{formatEuro(r.revenue_incl)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white font-semibold tabular-nums">{formatEuro(r.revenue_excl)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums">{r.cog > 0 ? formatEuro(r.cog) : '—'}</td>
                            <td className="px-4 py-2.5 text-right text-green-600 dark:text-green-400 tabular-nums">{formatEuro(r.gross_profit)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              <span className={r.gross_margin_pct > 50 ? 'text-green-600 dark:text-green-400' : r.gross_margin_pct > 30 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}>
                                {r.gross_margin_pct}%
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums">{formatEuro(r.opex)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums">{r.spend > 0 ? formatEuro(r.spend) : '—'}</td>
                            <td className="px-4 py-2.5 text-right font-bold tabular-nums" style={{ color: profitColor(r.net_profit) }}>
                              {formatEuro(r.net_profit)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: profitColor(r.net_margin_pct) }}>
                              {r.net_margin_pct}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
                          <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-semibold text-xs">Totaal</td>
                          <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums text-xs">
                            {pnl.reduce((s: number, r: any) => s + r.orders, 0)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums text-xs">
                            {formatEuro(pnl.reduce((s: number, r: any) => s + r.revenue_incl, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white font-bold tabular-nums text-xs">
                            {formatEuro(totalRevExcl)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums text-xs">
                            {formatEuro(pnl.reduce((s: number, r: any) => s + r.cog, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right text-green-600 dark:text-green-400 font-bold tabular-nums text-xs">
                            {formatEuro(totalGross)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                            <span style={{ color: profitColor(totalGross) }}>
                              {totalRevExcl > 0 ? Math.round((totalGross / totalRevExcl) * 100) : 0}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums text-xs">
                            {formatEuro(pnl.reduce((s: number, r: any) => s + r.opex, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums text-xs">
                            {formatEuro(pnl.reduce((s: number, r: any) => s + r.spend, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums text-xs" style={{ color: profitColor(totalNet) }}>
                            {formatEuro(totalNet)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-xs" style={{ color: profitColor(totalNet) }}>
                            {totalRevExcl > 0 ? Math.round((totalNet / totalRevExcl) * 100) : 0}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* BTW TAB */}
            {tab === 'btw' && (
              <div className="space-y-6">
                <div className="bg-amber-50 dark:bg-yellow-950/20 border border-amber-200 dark:border-yellow-900/30 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    BTW ontvangen = 21% over omzet incl. · BTW betaald = BTW op OPEX facturen · Saldo = te betalen aan Belastingdienst per kwartaal
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">BTW overzicht {mode === 'quarterly' ? 'per kwartaal' : 'per maand'}</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase tracking-wider">
                          <th className="px-4 py-2 text-left">Periode</th>
                          <th className="px-4 py-2 text-right">Omzet incl.</th>
                          <th className="px-4 py-2 text-right text-green-600 dark:text-green-400">BTW ontvangen</th>
                          <th className="px-4 py-2 text-right text-red-600 dark:text-red-400">BTW betaald (OPEX)</th>
                          <th className="px-4 py-2 text-right font-bold text-amber-600 dark:text-yellow-400">Saldo te betalen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pnl.slice(-12).map((r: any) => {
                          const key = mode === 'quarterly' ? r.quarter : r.month;
                          return (
                            <tr key={key} className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20">
                              <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-medium">
                                {mode === 'quarterly' ? r.quarter : <MonthLabel m={r.month} />}
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums">{formatEuro(r.revenue_incl)}</td>
                              <td className="px-4 py-2.5 text-right text-green-600 dark:text-green-400 tabular-nums">{formatEuro(r.btw_ontvangen)}</td>
                              <td className="px-4 py-2.5 text-right text-red-600 dark:text-red-400 tabular-nums">{formatEuro(r.btw_betaald)}</td>
                              <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                                <span style={{ color: r.btw_te_betalen > 0 ? '#d97706' : '#16a34a' }}>
                                  {formatEuro(r.btw_te_betalen)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
                          <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-semibold text-xs">Totaal</td>
                          <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums text-xs">
                            {formatEuro(pnl.reduce((s: number, r: any) => s + r.revenue_incl, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right text-green-600 dark:text-green-400 font-bold tabular-nums text-xs">
                            {formatEuro(pnl.reduce((s: number, r: any) => s + r.btw_ontvangen, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right text-red-600 dark:text-red-400 font-bold tabular-nums text-xs">
                            {formatEuro(pnl.reduce((s: number, r: any) => s + r.btw_betaald, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums text-xs text-amber-600 dark:text-yellow-400">
                            {formatEuro(totalBtwTeBetalen)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* OPEX TAB */}
            {tab === 'opex' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                    <p className="text-xs text-gray-500">Totaal maandelijks</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatEuro(data?.opex ?? 0)}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                    <p className="text-xs text-gray-500">Per week</p>
                    <p className="text-2xl font-bold text-gray-700 dark:text-gray-300 mt-1">{formatEuro((data?.opex ?? 0) / 4.33)}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                    <p className="text-xs text-gray-500">Per dag</p>
                    <p className="text-2xl font-bold text-gray-700 dark:text-gray-300 mt-1">{formatEuro((data?.opex ?? 0) / 30)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Per categorie</h2>
                    </div>
                    <div className="divide-y divide-gray-200/50 dark:divide-gray-800/50">
                      {(data?.opexByCategory ?? []).map((cat: any) => {
                        const pctOfTotal = data?.opex > 0 ? Math.round((cat.monthly / data.opex) * 100) : 0;
                        return (
                          <div key={cat.category} className="px-5 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-700 dark:text-gray-300 capitalize">{cat.category}</span>
                              <span className="text-xs text-gray-400 dark:text-gray-600">{cat.items}x</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-right">
                              <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pctOfTotal}%` }} />
                              </div>
                              <span className="text-gray-900 dark:text-white font-semibold w-16">{formatEuro(cat.monthly)}</span>
                              <span className="text-gray-500 w-8">{pctOfTotal}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Alle kostenposten</h2>
                    </div>
                    <div className="overflow-y-auto max-h-96 divide-y divide-gray-200/30 dark:divide-gray-800/30">
                      {(data?.opexDetail ?? []).filter((item: any) => item.category !== 'salary').map((item: any, i: number) => (
                        <div key={i} className="px-5 py-2 flex items-center justify-between">
                          <div>
                            <span className="text-xs text-gray-700 dark:text-gray-300">{item.name}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-600 ml-2 capitalize">{item.frequency === 'yearly' ? 'jaarlijks' : 'maandelijks'}</span>
                          </div>
                          <div className="text-xs text-right">
                            <span className="text-gray-900 dark:text-white">{formatEuro(item.monthly_amount)}</span>
                            {item.btw > 0 && <span className="text-gray-400 dark:text-gray-600 ml-2">+€{item.btw} BTW</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RETURNS TAB */}
            {tab === 'returns' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Return rate per kanaal</h2>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Gebaseerd op financial_status = refunded of partially_refunded</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                        <th className="px-5 py-2 text-left">Kanaal</th>
                        <th className="px-5 py-2 text-right">Orders</th>
                        <th className="px-5 py-2 text-right">Returns</th>
                        <th className="px-5 py-2 text-right">Return rate</th>
                        <th className="px-5 py-2 text-right">Return waarde</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.returnByChannel ?? []).map((r: any) => {
                        const color = channelColor(r.channel);
                        return (
                          <tr key={r.channel} className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20">
                            <td className="px-5 py-2.5">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
                                style={{ background: `${color}22`, color }}>
                                {formatLabel(r.channel)}
                              </span>
                            </td>
                            <td className="px-5 py-2.5 text-right text-gray-400 tabular-nums text-xs">{r.orders}</td>
                            <td className="px-5 py-2.5 text-right text-gray-600 dark:text-gray-300 tabular-nums text-xs">{r.returns}</td>
                            <td className="px-5 py-2.5 text-right tabular-nums text-xs">
                              <span style={{ color: r.pct > 10 ? '#dc2626' : r.pct > 5 ? '#d97706' : '#16a34a' }}>
                                {r.pct}%
                              </span>
                            </td>
                            <td className="px-5 py-2.5 text-right text-red-600 dark:text-red-400 tabular-nums text-xs">
                              {r.return_value > 0 ? formatEuro(r.return_value) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Returns {mode === 'quarterly' ? 'per kwartaal' : 'per maand'}</h2>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-2 text-left">Periode</th>
                        <th className="px-4 py-2 text-right">Orders</th>
                        <th className="px-4 py-2 text-right">Returns</th>
                        <th className="px-4 py-2 text-right">Return rate</th>
                        <th className="px-4 py-2 text-right">Return waarde</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pnl.filter((r: any) => r.returns > 0).map((r: any) => (
                        <tr key={r.month ?? r.quarter} className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20">
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                            {mode === 'quarterly' ? r.quarter : <MonthLabel m={r.month} />}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-400 tabular-nums">{r.orders}</td>
                          <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-300 tabular-nums">{r.returns}</td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            <span style={{ color: r.return_rate > 10 ? '#dc2626' : r.return_rate > 5 ? '#d97706' : '#16a34a' }}>
                              {r.return_rate}%
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-red-600 dark:text-red-400 tabular-nums">{formatEuro(r.return_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}