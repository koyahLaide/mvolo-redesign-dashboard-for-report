'use client';

import { useEffect, useState, useCallback } from 'react';

const CHANNEL_COLORS: Record<string, string> = {
  direct: '#6366f1', organic_search: '#22c55e', meta_ads: '#ec4899',
  google_ads: '#3b82f6', awin_affiliate: '#f59e0b', email: '#a78bfa',
  organic_social: '#f97316', bol_marketplace: '#fb923c', ai_referral: '#14b8a6', other: '#6b7280',
};
function channelColor(ch: string) { return CHANNEL_COLORS[ch] ?? '#6b7280'; }
function formatLabel(s: string) { return s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—'; }
function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function CohortPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ltv' | 'winback' | 'window' | 'site'>('ltv');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/cohort');
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxLtv = Math.max(...(data?.ltvByChannel ?? []).map((r: any) => r.avg_ltv), 1);
  const maxWinback = Math.max(...(data?.winback ?? []).map((r: any) => r.klanten), 1);
  const maxWindow = Math.max(...(data?.purchaseWindow ?? []).map((r: any) => r.klanten), 1);

  const totalWinbackLtv = data?.winbackTotal?.total_ltv ?? 0;
  const totalWinbackKlanten = data?.winbackTotal?.total_klanten ?? 0;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
      
      <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">

        {/* KPI banner */}
        {data && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
              <p className="text-xs text-gray-500">Winback kandidaten</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{totalWinbackKlanten}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">klanten &gt;60 dagen inactief</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/30 rounded-xl px-5 py-4">
              <p className="text-xs text-gray-500">Verloren LTV</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{formatEuro(totalWinbackLtv)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">historische waarde winback klanten</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
              <p className="text-xs text-gray-500">Beste LTV kanaal</p>
              <p className="text-2xl font-bold text-indigo-400 mt-1">
                {data?.ltvByChannel?.[0] ? formatLabel(data.ltvByChannel[0].first_channel) : '—'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">gem. LTV €{data?.ltvByChannel?.[0]?.avg_ltv}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
              <p className="text-xs text-gray-500">Snelste herhaalaankoop</p>
              <p className="text-2xl font-bold text-green-400 mt-1">25 dagen</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">direct & meta_ads klanten</p>
            </div>
          </div>
        )}

        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1 w-fit">
          {([
            ['ltv', '💰 LTV per kanaal'],
            ['winback', '🔄 Winback'],
            ['window', '⏱ Herhaalpatroon'],
            ['site', '👁 Site zonder aankoop'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-600 animate-pulse">Laden…</div>
        ) : (
          <>
            {/* LTV TAB */}
            {tab === 'ltv' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Lifetime Value per eerste kanaal</h2>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Welk kanaal brengt de meest waardevolle klanten?</p>
                  </div>
                  <div className="p-6 space-y-4">
                    {(data?.ltvByChannel ?? []).map((ch: any) => {
                      const color = channelColor(ch.first_channel);
                      return (
                        <div key={ch.first_channel} className="flex items-center gap-4">
                          <div className="flex items-center gap-2 w-36 flex-shrink-0">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{formatLabel(ch.first_channel)}</span>
                          </div>
                          <MiniBar value={ch.avg_ltv} max={maxLtv} color={color} />
                          <div className="flex items-center gap-4 text-xs text-right flex-shrink-0 w-72">
                            <span className="text-white font-semibold w-16">€{ch.avg_ltv}</span>
                            <span className="text-gray-500 w-16">{ch.klanten} klanten</span>
                            <span className="text-gray-600 w-20">{ch.avg_orders_per_klant}x orders</span>
                            <span className="text-gray-600 w-20">max €{ch.max_ltv}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Terugkeer rate */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Herhaalgedrag per kanaal</h2>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Hoe vaak koopt een klant per kanaal opnieuw?</p>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500">
                        <th className="px-5 py-2 text-left">Kanaal</th>
                        <th className="px-5 py-2 text-right">Eerste orders</th>
                        <th className="px-5 py-2 text-right">Herhaalaankopen</th>
                        <th className="px-5 py-2 text-right">Herhaalrate</th>
                        <th className="px-5 py-2 text-right">Gem. dagen tussen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.returnRate ?? []).map((r: any) => {
                        const color = channelColor(r.first_channel);
                        return (
                          <tr key={r.first_channel} className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20">
                            <td className="px-5 py-2.5">
                              <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
                                style={{ background: `${color}22`, color }}>
                                {formatLabel(r.first_channel)}
                              </span>
                            </td>
                            <td className="px-5 py-2.5 text-right text-gray-400 tabular-nums">{r.eerste_orders}</td>
                            <td className="px-5 py-2.5 text-right text-gray-300 tabular-nums font-semibold">{r.herhaalaankopen}</td>
                            <td className="px-5 py-2.5 text-right tabular-nums">
                              <span className={`font-semibold ${r.herhaal_rate_pct > 10 ? 'text-green-400' : r.herhaal_rate_pct > 5 ? 'text-yellow-400' : 'text-gray-500'}`}>
                                {r.herhaal_rate_pct}%
                              </span>
                            </td>
                            <td className="px-5 py-2.5 text-right text-gray-500 tabular-nums">
                              {r.gem_dagen_tussen ? `${r.gem_dagen_tussen}d` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Nieuwe vs terugkerende per maand */}
                {data?.newByMonth?.length > 0 && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nieuwe vs terugkerende klanten per maand</h2>
                    </div>
                    <div className="p-6 space-y-2">
                      {data.newByMonth.map((r: any) => {
                        const total = r.nieuw + r.terugkerend;
                        const newPct = total > 0 ? Math.round((r.nieuw / total) * 100) : 0;
                        return (
                          <div key={r.month} className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-16 flex-shrink-0">{r.month}</span>
                            <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden flex">
                              <div className="h-full bg-green-600/60" style={{ width: `${newPct}%` }} />
                              <div className="h-full bg-indigo-600/60" style={{ width: `${100 - newPct}%` }} />
                            </div>
                            <div className="text-xs text-right w-40 flex-shrink-0">
                              <span className="text-green-400">{r.nieuw} nieuw</span>
                              <span className="text-gray-600 mx-1">·</span>
                              <span className="text-indigo-400">{r.terugkerend} terugk.</span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-600">
                        <span><span className="text-green-400">■</span> Nieuw</span>
                        <span><span className="text-indigo-400">■</span> Terugkerend</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* WINBACK TAB */}
            {tab === 'winback' && (
              <div className="space-y-6">
                <div className="bg-red-950/20 border border-red-900/30 rounded-xl px-6 py-5">
                  <h2 className="text-sm font-semibold text-red-400 mb-3">🔄 Winback strategie</h2>
                  <div className="grid grid-cols-3 gap-4 text-xs text-gray-400">
                    <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg px-4 py-3">
                      <p className="font-semibold text-white">60-90 dagen inactief</p>
                      <p className="mt-1">Stuur een "We missen je" email met een kleine korting (10%). Klant is nog actief in geheugen.</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg px-4 py-3">
                      <p className="font-semibold text-white">90-180 dagen inactief</p>
                      <p className="mt-1">Stuur scarcity offer of nieuwe productlancering. Grotere korting (15-20%) om terug te winnen.</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg px-4 py-3">
                      <p className="font-semibold text-white">180+ dagen inactief</p>
                      <p className="mt-1">Laatste kans email met beste aanbod. Als geen reactie: verwijder uit actieve lijst om deliverability te beschermen.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Winback kandidaten per kanaal</h2>
                      <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Klanten die &gt;60 dagen geen aankoop hebben gedaan</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-400">{totalWinbackKlanten} klanten</p>
                      <p className="text-xs text-gray-400 dark:text-gray-600">{formatEuro(totalWinbackLtv)} historische LTV</p>
                    </div>
                  </div>
                  <div className="p-6 space-y-3">
                    {(data?.winback ?? []).map((r: any) => {
                      const color = channelColor(r.laatste_kanaal);
                      return (
                        <div key={r.laatste_kanaal} className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800/30 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-2 w-36 flex-shrink-0">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{formatLabel(r.laatste_kanaal)}</span>
                          </div>
                          <MiniBar value={r.klanten} max={maxWinback} color={color} />
                          <div className="flex items-center gap-4 text-xs text-right flex-shrink-0 w-80">
                            <span className="text-red-400 font-semibold w-20">{r.klanten} klanten</span>
                            <span className="text-gray-500 w-24">gem. {r.gem_dagen_geleden}d geleden</span>
                            <span className="text-gray-400 w-16">€{r.avg_ltv} LTV</span>
                            <span className="text-indigo-400 font-semibold w-20">{formatEuro(r.totale_ltv)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* HERHAALPATROON TAB */}
            {tab === 'window' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Hoe lang tussen eerste en tweede aankoop?</h2>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Bepaalt wanneer je een winback of cross-sell email moet sturen</p>
                  </div>
                  <div className="p-6 space-y-3">
                    {(data?.purchaseWindow ?? []).map((r: any, i: number) => (
                      <div key={r.window} className="flex items-center gap-4">
                        <span className="text-xs text-gray-400 w-28 flex-shrink-0">{r.window}</span>
                        <MiniBar value={r.klanten} max={maxWindow} color={i === 0 ? '#22c55e' : '#6366f1'} />
                        <span className="text-xs text-gray-900 dark:text-white font-semibold tabular-nums w-24 text-right">{r.klanten} klanten</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-6 pb-5 text-xs text-gray-500 space-y-1">
                    <p>→ <span className="text-green-400">23 klanten</span> kopen binnen 30 dagen opnieuw — stuur cross-sell email na 14 dagen</p>
                    <p>→ <span className="text-indigo-400">5 klanten</span> kopen na 90-180 dagen — stuur winback na 75 dagen</p>
                    <p>→ Zet je <span className="text-white">Winback flow</span> op 60 dagen als eerste trigger</p>
                  </div>
                </div>
              </div>
            )}

            {/* SITE ZONDER AANKOOP TAB */}
            {tab === 'site' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Klaviyo site-activiteit zonder aankoop</h2>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                      Bekende contacten die producten bekijken maar niet kopen — dit zijn de Browse Abandonment targets.
                      Viewed Product zonder Order = potentiële winback of browse abandon email.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500">
                          <th className="px-5 py-2 text-left">Datum</th>
                          <th className="px-5 py-2 text-right">Product views</th>
                          <th className="px-5 py-2 text-right">Cart adds</th>
                          <th className="px-5 py-2 text-right">Checkouts</th>
                          <th className="px-5 py-2 text-right">Orders</th>
                          <th className="px-5 py-2 text-right text-red-400">Niet gekocht</th>
                          <th className="px-5 py-2 text-right">Conv. rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.siteJourney ?? []).filter((r: any) => r.product_views > 0).reverse().slice(0, 20).map((r: any) => {
                          const notBought = Math.max(0, r.product_views - r.orders);
                          const convRate = r.product_views > 0 ? Math.round((r.orders / r.product_views) * 100) : 0;
                          return (
                            <tr key={r.date} className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20">
                              <td className="px-5 py-2 text-gray-400">{new Date(r.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</td>
                              <td className="px-5 py-2 text-right text-gray-300 tabular-nums">{r.product_views}</td>
                              <td className="px-5 py-2 text-right text-blue-400 tabular-nums">{r.cart_adds || '—'}</td>
                              <td className="px-5 py-2 text-right text-yellow-400 tabular-nums">{r.checkouts || '—'}</td>
                              <td className="px-5 py-2 text-right text-green-400 tabular-nums">{r.orders || '—'}</td>
                              <td className="px-5 py-2 text-right text-red-400 font-semibold tabular-nums">{notBought}</td>
                              <td className="px-5 py-2 text-right tabular-nums">
                                <span className={convRate > 20 ? 'text-green-400' : convRate > 10 ? 'text-yellow-400' : 'text-red-400'}>
                                  {convRate}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-6 py-4 bg-indigo-950/20 border-t border-gray-200 dark:border-gray-800/50 text-xs text-gray-500">
                    <p>→ Bekende Klaviyo contacten die een product bekijken maar niet kopen triggeren de <span className="text-indigo-400">Browse Abandonment flow</span></p>
                    <p className="mt-1">→ Je Browse Abandonment flow is <span className="text-green-400">live</span> — zorg dat de trigger timing op max 1 uur staat</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
