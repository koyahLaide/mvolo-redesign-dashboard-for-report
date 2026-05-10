'use client';

import { useEffect, useState, useCallback } from 'react';

const CHANNEL_COLORS: Record<string, string> = {
  direct: '#6366f1', organic_search: '#22c55e', meta_ads: '#ec4899',
  google_ads: '#3b82f6', awin_affiliate: '#f59e0b', email: '#a78bfa',
  organic_social: '#f97316', bol_marketplace: '#fb923c', ai_referral: '#14b8a6', other: '#6b7280',
};
const MONTHS = ['', 'Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}
function channelColor(ch: string) { return CHANNEL_COLORS[ch] ?? '#6b7280'; }
function formatLabel(s: string) { return s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—'; }

export default function StrategiePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'reorder' | 'bundles' | 'margin' | 'seizoen'>('reorder');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/strategie');
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxWeight = Math.max(...(data?.seasonWeights ?? []).map((s: any) => s.weight), 1);
  const maxContrib = Math.max(...(data?.contributionMargin ?? []).map((c: any) => Math.abs(c.contribution ?? 0)), 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">

      <div className="overflow-x-auto">
      <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1 w-fit min-w-max">
        {([
          ['reorder', 'Predictive Reorder'],
          ['bundles', 'Bundle Intelligence'],
          ['margin', 'Contribution Margin'],
          ['seizoen', 'Seizoenspatroon'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400 animate-pulse">Laden…</div>
      ) : (
        <>
          {/* PREDICTIVE REORDER */}
          {tab === 'reorder' && (
            <div className="space-y-6">
              <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/30 rounded-xl px-5 py-4">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  De reorder calculator is gecorrigeerd voor het seizoen van volgende maand
                  (<span className="text-gray-900 dark:text-white font-semibold">{MONTHS[data.nextMonth]}: {data.nextMonthWeight}x</span>).
                  Als de seizoensfactor &gt;1 is, bestel je meer dan de normale velocity aangeeft.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Predictive reorder advies</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Velocity × seizoensfactor {MONTHS[data.nextMonth]} ({data.nextMonthWeight}x)</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <th className="px-5 py-2 text-left">Product</th>
                        <th className="px-5 py-2 text-right">Voorraad</th>
                        <th className="px-5 py-2 text-right">Vel. huidig</th>
                        <th className="px-5 py-2 text-right">Vel. seizoen</th>
                        <th className="px-5 py-2 text-right">Normaal qty</th>
                        <th className="px-5 py-2 text-right">Seizoen qty</th>
                        <th className="px-5 py-2 text-right">Extra</th>
                        <th className="px-5 py-2 text-right">Kosten</th>
                        <th className="px-5 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.predictiveReorder ?? []).map((p: any) => {
                        const urgencyColor = p.urgency === 'KRITIEK' ? '#ef4444' : p.urgency === 'SEIZOEN URGENT' ? '#f97316' : '#6366f1';
                        const stockColor = p.stock <= 0 ? '#ef4444' : p.stock <= 5 ? '#f59e0b' : undefined;
                        return (
                          <tr key={p.sku} className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20">
                            <td className="px-5 py-2.5 text-gray-700 dark:text-gray-300 max-w-[180px] truncate">{p.name}</td>
                            <td className="px-5 py-2.5 text-right tabular-nums" style={{ color: stockColor }}>{p.stock}</td>
                            <td className="px-5 py-2.5 text-right text-gray-500 dark:text-gray-400 tabular-nums">{p.velocity_30d}/d</td>
                            <td className="px-5 py-2.5 text-right text-orange-500 dark:text-orange-400 tabular-nums font-semibold">{p.adjusted_velocity}/d</td>
                            <td className="px-5 py-2.5 text-right text-gray-500 dark:text-gray-400 tabular-nums">{p.reorder_qty_normal}</td>
                            <td className="px-5 py-2.5 text-right text-gray-900 dark:text-white font-semibold tabular-nums">{p.reorder_qty_seasonal}</td>
                            <td className="px-5 py-2.5 text-right tabular-nums">
                              {p.extra_for_season > 0 ? <span className="text-orange-500 dark:text-orange-400 font-semibold">+{p.extra_for_season}</span> : <span className="text-gray-400 dark:text-gray-500">—</span>}
                            </td>
                            <td className="px-5 py-2.5 text-right text-indigo-500 dark:text-indigo-400 tabular-nums">{p.cogs_sea ? formatEuro(p.total_cost_seasonal) : '—'}</td>
                            <td className="px-5 py-2.5">
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${urgencyColor}22`, color: urgencyColor }}>
                                {p.urgency}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {data?.predictiveReorder?.length === 0 && (
                        <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">Alle voorraden OK voor komende maand</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* BUNDLE INTELLIGENCE */}
          {tab === 'bundles' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bundle pairs */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Samen gekocht</h2>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Producten die in dezelfde order zitten</p>
                  </div>
                  <div className="divide-y divide-gray-200/50 dark:divide-gray-800/50">
                    {(data?.bundlePairs ?? []).filter((p: any) => p.samen_gekocht >= 2).slice(0, 8).map((p: any, i: number) => (
                      <div key={i} className="px-5 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{p.naam_a}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">+ {p.naam_b}</p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-right flex-shrink-0 ml-3">
                            <span className="text-indigo-500 dark:text-indigo-400 font-semibold">{p.samen_gekocht}x</span>
                            <span className="text-gray-500 dark:text-gray-400">samen</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cross-sell aanbevelingen */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cross-sell triggers</h2>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Klanten die product A kopen → kopen B na X dagen</p>
                  </div>
                  <div className="divide-y divide-gray-200/50 dark:divide-gray-800/50">
                    {(data?.crossSellRecs ?? []).filter((p: any) => p.cross_sell_freq >= 1).slice(0, 8).map((p: any, i: number) => (
                      <div key={i} className="px-5 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{p.naam_a}</p>
                            <p className="text-xs text-indigo-500 dark:text-indigo-400 truncate">→ {p.naam_b}</p>
                          </div>
                          <div className="text-xs text-right flex-shrink-0 ml-3 space-y-0.5">
                            <p className="text-green-500 dark:text-green-400 font-semibold">{p.cross_sell_freq}x gekocht</p>
                            <p className="text-gray-500 dark:text-gray-400">{p.trigger}</p>
                            {p.stock_b !== null && p.stock_b <= 0 && (
                              <p className="text-red-500 dark:text-red-400">Uitverkocht</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Klaviyo flow aanbevelingen */}
              <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/30 rounded-xl px-6 py-5">
                <h2 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-3">Klaviyo flow aanbevelingen op basis van bundle data</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {[
                    { product: 'ReliefTorch koper', followup: 'EMS Gua Sha', dagen: 14, freq: 4, reden: '4x samen gekocht, 4x cross-sell' },
                    { product: 'LED Face Mask koper', followup: 'EMS Gua Sha', dagen: 0, freq: 3, reden: '3x samen gekocht — direct bundel' },
                    { product: 'Elite Series 306 koper', followup: 'ReliefTorch', dagen: 93, freq: 3, reden: '3x na 93 dagen — winback cross-sell' },
                    { product: 'Dubbele IR lamp koper', followup: 'EMS Gua Sha', dagen: 14, freq: 3, reden: '3x na 14 dagen — post-purchase flow' },
                    { product: 'Elite 306 koper', followup: 'Circadian Bulb', dagen: 7, freq: 3, reden: '3x samen — direct upsell' },
                    { product: 'Sauna Deken koper', followup: 'LED Face Mask', dagen: 14, freq: 2, reden: '2x samen — skincare bundel' },
                  ].map((r, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900/60 rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-800/40">
                      <p className="font-semibold text-gray-900 dark:text-white text-xs">{r.product}</p>
                      <p className="text-indigo-500 dark:text-indigo-400 mt-1">→ Stuur {r.followup}</p>
                      <p className="text-gray-500 dark:text-gray-400 mt-0.5">{r.dagen === 0 ? 'Direct in bundel' : `Na ${r.dagen} dagen`}</p>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">{r.reden}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CONTRIBUTION MARGIN */}
          {tab === 'margin' && (
            <div className="space-y-6">
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/30 rounded-xl px-5 py-3 text-xs text-gray-600 dark:text-gray-400">
                CAC schattingen zijn approximaties. Koppel Meta spend API voor exacte cijfers. Awin commissie zit al in orderwaarde verwerkt.
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Contribution margin per kanaal (30d)</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Brutomarge minus geschatte acquisitiekosten</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <th className="px-5 py-2 text-left">Kanaal</th>
                        <th className="px-5 py-2 text-right">Orders</th>
                        <th className="px-5 py-2 text-right">Omzet</th>
                        <th className="px-5 py-2 text-right">Brutomarge</th>
                        <th className="px-5 py-2 text-right">Marge%</th>
                        <th className="px-5 py-2 text-right">Est. CAC</th>
                        <th className="px-5 py-2 text-right">Contribution</th>
                        <th className="px-5 py-2 text-right">Contrib%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.contributionMargin ?? []).map((ch: any) => {
                        const color = channelColor(ch.channel);
                        const contribColor = ch.contribution_pct === null ? '#6b7280' :
                          ch.contribution_pct > 50 ? '#22c55e' : ch.contribution_pct > 30 ? '#f59e0b' : '#ef4444';
                        return (
                          <tr key={ch.channel} className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20">
                            <td className="px-5 py-2.5">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
                                style={{ background: `${color}22`, color }}>
                                {formatLabel(ch.channel)}
                              </span>
                            </td>
                            <td className="px-5 py-2.5 text-right text-gray-500 dark:text-gray-400 tabular-nums">{ch.orders}</td>
                            <td className="px-5 py-2.5 text-right text-gray-900 dark:text-white font-semibold tabular-nums">{formatEuro(ch.revenue)}</td>
                            <td className="px-5 py-2.5 text-right text-green-500 dark:text-green-400 tabular-nums">
                              {ch.gross_profit !== null ? formatEuro(ch.gross_profit) : '—'}
                            </td>
                            <td className="px-5 py-2.5 text-right tabular-nums">
                              {ch.gross_margin_pct !== null ? <span className="text-green-500 dark:text-green-400">{ch.gross_margin_pct}%</span> : '—'}
                            </td>
                            <td className="px-5 py-2.5 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                              {ch.est_cac > 0 ? `€${ch.est_cac}/order` : '€0'}
                            </td>
                            <td className="px-5 py-2.5 text-right font-semibold tabular-nums" style={{ color: contribColor }}>
                              {ch.contribution !== null ? formatEuro(ch.contribution) : '—'}
                            </td>
                            <td className="px-5 py-2.5 text-right font-semibold tabular-nums" style={{ color: contribColor }}>
                              {ch.contribution_pct !== null ? `${ch.contribution_pct}%` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800/50 text-xs text-gray-400 dark:text-gray-600">
                  → Koppel Meta Ads spend API voor exacte CAC per campagne · Organic Search heeft 0 CAC = hoogste contribution
                </div>
              </div>
            </div>
          )}

          {/* SEIZOENSPATROON */}
          {tab === 'seizoen' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Seizoensgewichten per maand</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">1.0 = gemiddeld · &gt;1.0 = boven gemiddeld · &lt;1.0 = onder gemiddeld</p>
                </div>
                <div className="p-6 space-y-3">
                  {(data?.seasonWeights ?? []).map((s: any) => {
                    const isPiek = s.weight > 1.5;
                    const isDal = s.weight < 0.5;
                    const isNext = s.month === data.nextMonth;
                    const color = isPiek ? '#f59e0b' : isDal ? '#6b7280' : '#6366f1';
                    const pct = Math.round((s.weight / maxWeight) * 100);
                    return (
                      <div key={s.month} className={`flex items-center gap-4 ${isNext ? 'bg-indigo-50 dark:bg-indigo-950/30 rounded-lg px-3 -mx-3' : ''}`}>
                        <div className="flex items-center gap-2 w-20 flex-shrink-0">
                          {isNext && <span className="text-indigo-500 dark:text-indigo-400 text-xs">→</span>}
                          <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{MONTHS[s.month]}</span>
                          {isPiek && <span className="text-xs">🔥</span>}
                          {isDal && <span className="text-xs">❄</span>}
                        </div>
                        <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden relative">
                          <div className="h-full rounded-lg transition-all" style={{ width: `${pct}%`, background: color, opacity: 0.7 }} />
                          <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-gray-900 dark:text-white">
                            {s.weight.toFixed(2)}x · gem. €{Math.round(s.avg_revenue).toLocaleString('nl-NL')}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 w-32 text-right flex-shrink-0">
                          {isPiek ? 'PIEK — extra bestellen' : isDal ? 'DAL — minder bestellen' : 'Normaal'}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-6 py-4 bg-gray-100 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-800/50 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                  <p>→ <span className="text-orange-500 dark:text-orange-400">November (2.59x)</span>: bestel in augustus/september voor BFCM — 2.6x meer dan gemiddeld</p>
                  <p>→ <span className="text-yellow-500 dark:text-yellow-400">Januari (1.73x)</span>: bestel in oktober/november — sterk begin van het jaar</p>
                  <p>→ <span className="text-blue-500 dark:text-blue-400">Juni (0.26x)</span>: minimale inkoop — zomersal is bijna 4x minder dan november</p>
                  <p>→ Predictive reorder past automatisch de bestelhoeveelheden aan op basis van deze gewichten</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}