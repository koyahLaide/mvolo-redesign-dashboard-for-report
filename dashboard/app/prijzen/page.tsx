'use client';

import { useEffect, useState, useCallback } from 'react';

const CHANNEL_COLORS: Record<string, string> = {
  direct: '#6366f1', organic_search: '#22c55e', meta_ads: '#ec4899',
  google_ads: '#3b82f6', awin_affiliate: '#f59e0b', email: '#a78bfa',
  organic_social: '#f97316', bol_marketplace: '#fb923c', ai_referral: '#14b8a6', other: '#6b7280',
};
function channelColor(ch: string) { return CHANNEL_COLORS[ch] ?? '#6b7280'; }
function formatLabel(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}
function MarginBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-gray-400 dark:text-gray-600">—</span>;
  const color = pct < 30 ? 'text-red-500 dark:text-red-400' : pct < 50 ? 'text-amber-500 dark:text-amber-400' : 'text-green-500 dark:text-green-400';
  return <span className={`text-xs font-semibold tabular-nums ${color}`}>{pct}%</span>;
}

export default function PrijzenPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'marge' | 'prijzen' | 'kanaal'>('marge');
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/prices');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxRevenue = Math.max(...(data?.channels ?? []).map((c: any) => c.revenue), 1);
  const alerts = (data?.priceAnalysis ?? []).filter((p: any) => p.alert && (p.stock === null || p.stock > 0));
  const withTests = (data?.priceAnalysis ?? []).filter((p: any) => p.test_advice && (p.stock === null || p.stock > 5));

  return (
    <div className="space-y-6">

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-5 py-3 text-sm text-red-700 dark:text-red-400">
          Fout bij laden: {error}
        </div>
      )}

      {/* Tab nav */}
      <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1 w-fit">
        {([
          ['marge', 'Marge per kanaal'],
          ['prijzen', 'Prijsanalyse'],
          ['kanaal', 'Producten per kanaal'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key ? 'bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400 animate-pulse">Laden...</div>
      ) : (
        <>
          {/* MARGE PER KANAAL */}
          {tab === 'marge' && (
            <div className="space-y-6">
              {/* Alerts */}
              {alerts.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl px-5 py-4">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider mb-2">Marge alerts</p>
                  <div className="space-y-1">
                    {alerts.map((p: any) => (
                      <div key={p.sku} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300">{p.name}</span>
                        <span className="text-red-600 dark:text-red-400">{p.alert} — meest verkocht op &euro;{p.best_volume_price} met {p.best_volume_margin}% marge</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Kanaal marge tabel */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-200">Marge per kanaal</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Gewogen gemiddelde op basis van verkochte SKUs &times; COGS</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                        <th className="px-5 py-3 text-left">Kanaal</th>
                        <th className="px-5 py-3 text-right">Orders</th>
                        <th className="px-5 py-3 text-right">Omzet</th>
                        <th className="px-5 py-3 text-right">AOV</th>
                        <th className="px-5 py-3 text-right">Brutomarge</th>
                        <th className="px-5 py-3 text-right">Marge %</th>
                        <th className="px-5 py-3 text-left">Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.channels ?? []).map((ch: any) => {
                        const color = channelColor(ch.channel);
                        const pct = Math.round((ch.revenue / maxRevenue) * 100);
                        return (
                          <tr key={ch.channel} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                            <td className="px-5 py-3">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
                                style={{ background: `${color}22`, color }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                                {formatLabel(ch.channel)}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">{ch.orders}</td>
                            <td className="px-5 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-white">{formatEuro(ch.revenue)}</td>
                            <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-400 tabular-nums">{formatEuro(ch.aov)}</td>
                            <td className="px-5 py-3 text-right tabular-nums">
                              {ch.gross_profit !== null ? <span className="text-green-600 dark:text-green-400 font-semibold">{formatEuro(ch.gross_profit)}</span> : <span className="text-gray-400 dark:text-gray-600">—</span>}
                            </td>
                            <td className="px-5 py-3 text-right"><MarginBadge pct={ch.margin_pct} /></td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden max-w-24">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PRIJSANALYSE */}
          {tab === 'prijzen' && (
            <div className="space-y-6">
              {/* Prijstest aanbevelingen */}
              {withTests.length > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 rounded-xl px-5 py-4">
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-3">Aanbevolen prijstests</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {withTests.slice(0, 6).map((p: any) => (
                      <div key={p.sku} className="bg-white dark:bg-gray-900/60 rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-800/40">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">{p.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Nu: <span className="text-gray-900 dark:text-white">&euro;{p.test_advice.current_price}</span> ({p.test_advice.current_margin}%)</span>
                          <span className="text-gray-400 dark:text-gray-600">&rarr;</span>
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">Test: &euro;{p.test_advice.test_price} ({p.test_advice.projected_margin}%)</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{p.test_advice.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per product prijspunten */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-200">Prijs &times; volume per product</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Op welke prijs wordt elk product het meest verkocht?</p>
                  </div>
                </div>
                <div className="divide-y divide-gray-200/50 dark:divide-gray-800/50">
                  {(data?.priceAnalysis ?? []).map((p: any) => {
                    const isSelected = selectedSku === p.sku;
                    const maxQty = Math.max(...p.price_points.map((r: any) => r.qty), 1);
                    return (
                      <div key={p.sku}>
                        <div
                          className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors"
                          onClick={() => setSelectedSku(isSelected ? null : p.sku)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{p.name}</span>
                            {p.alert && p.stock > 0 && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">{p.alert}</span>
                            )}
                            {p.stock !== null && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${p.stock <= 0 ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' : p.stock <= 5 ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                                {p.stock <= 0 ? 'Uitverkocht' : `${p.stock} op voorraad`}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 sm:gap-6 text-xs text-right flex-shrink-0">
                            <span className="text-gray-500 dark:text-gray-400">COGS: &euro;{p.cogs_sea}</span>
                            <span className="text-gray-600 dark:text-gray-400">Meest: <span className="text-gray-900 dark:text-white font-semibold">&euro;{p.best_volume_price}</span></span>
                            <MarginBadge pct={p.best_volume_margin} />
                            <span className="text-gray-400 dark:text-gray-600">{isSelected ? '\u2191' : '\u2193'}</span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="px-5 pb-4 bg-gray-50 dark:bg-gray-800/10">
                            <div className="space-y-2 pt-2">
                              {p.price_points.map((r: any, i: number) => {
                                const barPct = Math.round((r.qty / maxQty) * 100);
                                const isBest = i === 0;
                                return (
                                  <div key={r.price} className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right flex-shrink-0 tabular-nums">&euro;{r.price.toFixed(2)}</span>
                                    <div className="flex-1 h-5 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden relative max-w-xs">
                                      <div className="h-full rounded transition-all"
                                        style={{ width: `${barPct}%`, background: isBest ? '#6366f1' : '#9ca3af' }} />
                                      <span className="absolute inset-0 flex items-center px-2 text-xs text-gray-900 dark:text-white font-medium">
                                        {r.qty} stuks ({r.pct_of_volume}%)
                                      </span>
                                    </div>
                                    <MarginBadge pct={r.margin_pct} />
                                    <span className="text-xs text-gray-500 dark:text-gray-500 w-24 truncate">{r.channels}</span>
                                    {isBest && <span className="text-xs text-indigo-600 dark:text-indigo-400">&larr; best</span>}
                                  </div>
                                );
                              })}
                            </div>
                            {p.test_advice && (
                              <div className="mt-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/30 rounded-lg px-4 py-2">
                                <p className="text-xs text-indigo-700 dark:text-indigo-400">Test aanbeveling: {p.test_advice.reason}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* PRODUCTEN PER KANAAL */}
          {tab === 'kanaal' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(data?.channelProducts ?? {}).map(([channel, products]: [string, any]) => {
                const color = channelColor(channel);
                return (
                  <div key={channel} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-200">{formatLabel(channel)}</span>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800/40">
                      {products.map((p: any, i: number) => (
                        <div key={p.sku} className="px-5 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 dark:text-gray-600">{i + 1}</span>
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{p.title?.substring(0, 35)}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-right flex-shrink-0">
                            <span className="text-gray-500 dark:text-gray-400">{p.qty}x</span>
                            <span className="text-gray-600 dark:text-gray-400">&euro;{p.avg_price?.toFixed(0)}</span>
                            <MarginBadge pct={p.margin_pct} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
