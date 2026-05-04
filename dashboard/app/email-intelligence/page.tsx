'use client';

import { useEffect, useState, useCallback } from 'react';

const DAYS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const DAYS_SHORT = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function EmailIntelligencePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'timing' | 'campaigns' | 'segmenten' | 'producten' | 'advies'>('timing');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/email-intelligence');
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const dowStats = (data?.dowStats ?? []).sort((a: any, b: any) => b.rev_per_email - a.rev_per_email);
  const maxRevPerEmail = Math.max(...dowStats.map((d: any) => d.rev_per_email), 1);
  const maxOrders = Math.max(...(data?.orderDow ?? []).map((d: any) => d.orders), 1);
  const bestDay = dowStats[0];
  const report = data?.report;

  const newCustomers = (data?.segData ?? []).filter((r: any) => r.is_new_customer === 1);
  const retCustomers = (data?.segData ?? []).filter((r: any) => r.is_new_customer === 0);
  const totalNew = newCustomers.reduce((s: number, r: any) => s + r.orders, 0);
  const totalRet = retCustomers.reduce((s: number, r: any) => s + r.orders, 0);
  const aovNew = newCustomers.length ? Math.round(newCustomers.reduce((s: number, r: any) => s + r.aov * r.orders, 0) / totalNew) : 0;
  const aovRet = retCustomers.length ? Math.round(retCustomers.reduce((s: number, r: any) => s + r.aov * r.orders, 0) / totalRet) : 0;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
      
      <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">

        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl p-1 w-fit">
          {([
            ['timing', '⏰ Timing'],
            ['campaigns', '📨 Campaigns'],
            ['segmenten', '👥 Segmenten'],
            ['producten', '📦 Producten'],
            ['advies', '💡 Advies'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key ? 'bg-white text-gray-900' : 'text-gray-500 dark:text-gray-400 hover:text-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-600 animate-pulse">Laden…</div>
        ) : (
          <>
            {/* TIMING TAB */}
            {tab === 'timing' && (
              <div className="space-y-6">
                {/* KPIs */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-900 border border-indigo-900/40 rounded-xl px-5 py-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Beste dag om te sturen</p>
                    <p className="text-2xl font-bold text-indigo-400 mt-1">{bestDay ? DAYS[bestDay.dow] : '—'}</p>
                    <p className="text-xs text-gray-600 mt-1">€{bestDay?.rev_per_email} omzet per email</p>
                  </div>
                  <div className="bg-gray-900 border border-green-900/40 rounded-xl px-5 py-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Beste tijdstip</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">16:00–18:00</p>
                    <p className="text-xs text-gray-600 mt-1">op basis van campaign performance</p>
                  </div>
                  <div className="bg-gray-900 border border-yellow-900/40 rounded-xl px-5 py-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Klaviyo omzet (30d)</p>
                    <p className="text-2xl font-bold text-yellow-400 mt-1">{formatEuro(data?.emailImpact?.klaviyo_revenue ?? 0)}</p>
                    <p className="text-xs text-gray-600 mt-1">{data?.emailImpact?.gap_pct}% niet via UTM geattribueerd</p>
                  </div>
                </div>

                {/* DOW heatmap */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Omzet per email per dag van de week</h2>
                    <p className="text-xs text-gray-600 mt-0.5">Gesorteerd op €/email — beste dag bovenaan</p>
                  </div>
                  <div className="p-6 space-y-3">
                    {dowStats.map((d: any, i: number) => (
                      <div key={d.dow} className="flex items-center gap-4">
                        <div className="flex items-center gap-2 w-24 flex-shrink-0">
                          {i === 0 && <span className="text-yellow-400 text-xs">⭐</span>}
                          {i === 1 && <span className="text-gray-500 dark:text-gray-400 text-xs">✓</span>}
                          {i > 1 && <span className="text-gray-700 text-xs">·</span>}
                          <span className="text-sm text-gray-700 dark:text-gray-300">{DAYS[d.dow]}</span>
                        </div>
                        <ScoreBar value={d.rev_per_email} max={maxRevPerEmail} color={i === 0 ? '#6366f1' : i === 1 ? '#22c55e' : '#374151'} />
                        <div className="flex items-center gap-4 text-xs text-right flex-shrink-0 w-64">
                          <span className="text-gray-500 w-16">{d.open_rate}% open</span>
                          <span className="text-gray-500 w-16">{d.click_rate}% click</span>
                          <span className="text-indigo-400 font-semibold w-16">€{d.rev_per_email}/mail</span>
                          <span className="text-gray-600 w-16">{formatEuro(d.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-6 pb-4 text-xs text-gray-600">
                    * Open rates zijn geïnfleerd door iOS Mail Privacy — gebruik click rate en omzet als primaire KPI
                  </div>
                </div>

                {/* Orders per dag */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Orders per dag van de week (alle kanalen)</h2>
                    <p className="text-xs text-gray-600 mt-0.5">Wanneer zijn klanten het meest actief?</p>
                  </div>
                  <div className="p-6 space-y-3">
                    {(data?.orderDow ?? []).map((d: any) => (
                      <div key={d.dow} className="flex items-center gap-4">
                        <span className="text-sm text-gray-600 dark:text-gray-300 w-24 flex-shrink-0">{DAYS[parseInt(d.dow)]}</span>
                        <ScoreBar value={d.orders} max={maxOrders} color="#3b82f6" />
                        <div className="flex items-center gap-4 text-xs text-right flex-shrink-0 w-48">
                          <span className="text-blue-400 font-semibold w-16">{d.orders} orders</span>
                          <span className="text-gray-500 w-16">{formatEuro(d.revenue)}</span>
                          <span className="text-gray-600 w-16">AOV €{d.aov}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CAMPAIGNS TAB */}
            {tab === 'campaigns' && (
              <div className="space-y-6">
                {report?.campaign_performance && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-200 dark:border-gray-800">
                      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Campaign performance (omzet 3 dagen na verzending)</h2>
                      <p className="text-xs text-gray-600 mt-0.5">Koppeling tussen Klaviyo verzendtijd en ordered_product metric</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                            <th className="px-4 py-2 text-left">#</th>
                            <th className="px-4 py-2 text-left">Campaign</th>
                            <th className="px-4 py-2 text-left">Dag</th>
                            <th className="px-4 py-2 text-left">Tijd</th>
                            <th className="px-4 py-2 text-right text-indigo-400">Omzet (3d)</th>
                            <th className="px-4 py-2 text-right">Orders</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.campaign_performance.slice(0, 15).map((c: any, i: number) => (
                            <tr key={c.id} className={`border-b border-gray-800/50 hover:bg-gray-800/20 ${i < 3 ? 'bg-indigo-950/10' : ''}`}>
                              <td className="px-4 py-2 text-gray-600">{i + 1}</td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-300 max-w-xs truncate">{c.name}</td>
                              <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{c.send_day_nl}</td>
                              <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{c.send_time?.slice(11, 16)}</td>
                              <td className="px-4 py-2 text-right font-semibold tabular-nums" style={{ color: c.total_revenue_3d > 0 ? '#818cf8' : '#374151' }}>
                                {c.total_revenue_3d > 0 ? formatEuro(c.total_revenue_3d) : '—'}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-500 tabular-nums">{c.total_orders_3d || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* UTM geattribueerde orders per campaign */}
                {data?.campaignOrders?.length > 0 && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-200 dark:border-gray-800">
                      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">UTM-geattribueerde orders per campaign</h2>
                      <p className="text-xs text-gray-600 mt-0.5">Alleen orders met utm_source=klaviyo — dit is een fractie van de werkelijke impact</p>
                    </div>
                    <div className="divide-y divide-gray-800/50">
                      {data.campaignOrders.map((c: any, i: number) => (
                        <div key={i} className="px-6 py-3 flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-md">{c.utm_campaign}</span>
                          <div className="flex items-center gap-6 text-xs flex-shrink-0">
                            <span className="text-gray-500 dark:text-gray-400">{c.orders} orders</span>
                            <span className="text-indigo-400 font-semibold">{formatEuro(c.revenue)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SEGMENTEN TAB */}
            {tab === 'segmenten' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Nieuwe klanten</p>
                    <p className="text-3xl font-bold text-green-400 mt-1">{totalNew}</p>
                    <p className="text-xs text-gray-600 mt-1">AOV €{aovNew} · {Math.round(totalNew/(totalNew+totalRet)*100)}% van alle orders</p>
                    <div className="mt-3 space-y-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Beste kanalen:</p>
                      {newCustomers.sort((a: any, b: any) => b.orders - a.orders).slice(0, 4).map((r: any) => (
                        <div key={r.channel} className="flex justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">{r.channel?.replace(/_/g,' ')}</span>
                          <span className="text-gray-700 dark:text-gray-300">{r.orders} orders, €{r.aov}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Terugkerende klanten</p>
                    <p className="text-3xl font-bold text-indigo-400 mt-1">{totalRet}</p>
                    <p className="text-xs text-gray-600 mt-1">AOV €{aovRet} · {Math.round(totalRet/(totalNew+totalRet)*100)}% van alle orders</p>
                    <div className="mt-3 space-y-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Beste kanalen:</p>
                      {retCustomers.sort((a: any, b: any) => b.orders - a.orders).slice(0, 4).map((r: any) => (
                        <div key={r.channel} className="flex justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">{r.channel?.replace(/_/g,' ')}</span>
                          <span className="text-gray-700 dark:text-gray-300">{r.orders} orders, €{r.aov}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl px-6 py-5 space-y-4">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email strategie per segment</h2>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">Nieuwe klanten (AOV €{aovNew})</p>
                      {[
                        { flow: 'Welcome Series', status: 'live', tip: 'Focus op productvoordelen + social proof' },
                        { flow: 'Browse Abandonment', status: 'live', tip: 'Stuur na 1u + reminder na 24u' },
                        { flow: 'Abandoned Cart', status: 'live', tip: 'Urgentie + voorraad indicator toevoegen' },
                      ].map(f => (
                        <div key={f.flow} className="bg-gray-800/40 rounded-lg px-4 py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{f.flow}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/40 text-green-400">{f.status}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{f.tip}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Terugkerende klanten (AOV €{aovRet})</p>
                      {[
                        { flow: 'Cross-sell RLT lamps', status: 'live', tip: 'LED Face Mask kopers → Elite Series' },
                        { flow: 'VIP Flow', status: 'live', tip: 'Top 10% kopers — exclusive aanbiedingen' },
                        { flow: 'Winback', status: 'live', tip: '90+ dagen geen aankoop → urgentie mail' },
                        { flow: 'Post-Purchase', status: 'live', tip: 'Gebruik tips → cross-sell na 2 weken' },
                      ].map(f => (
                        <div key={f.flow} className="bg-gray-800/40 rounded-lg px-4 py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{f.flow}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/40 text-green-400">{f.status}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{f.tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PRODUCTEN TAB */}
            {tab === 'producten' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Top producten via email kanaal</h2>
                    <p className="text-xs text-gray-600 mt-0.5">Welke producten converteren het best via email?</p>
                  </div>
                  {data?.emailSkus?.length > 0 ? (
                    <div className="divide-y divide-gray-800/50">
                      {data.emailSkus.map((s: any, i: number) => (
                        <div key={s.sku} className="px-6 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-600 w-4">{i + 1}</span>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-sm">{s.title?.substring(0, 50)}</p>
                              <p className="text-xs text-gray-600 font-mono">{s.sku}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-xs text-right flex-shrink-0">
                            <span className="text-gray-500 dark:text-gray-400">{s.sold} verkocht</span>
                            <span className="text-indigo-400 font-semibold">{formatEuro(s.revenue)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-6 py-8 text-center text-gray-600 text-sm">
                      Nog geen email-geattribueerde orders met SKU data
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ADVIES TAB */}
            {tab === 'advies' && (
              <div className="space-y-4">
                <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl px-6 py-5">
                  <h2 className="text-sm font-semibold text-indigo-300 mb-4">💡 Data-gedreven email aanbevelingen</h2>
                  <div className="space-y-4 text-sm">

                    <div className="bg-gray-900/60 rounded-lg px-4 py-3 border border-gray-800/40">
                      <p className="font-semibold text-white">⏰ Beste verzendmoment</p>
                      <p className="text-gray-500 dark:text-gray-400 mt-1">
                        <span className="text-indigo-400">Maandag</span> heeft de hoogste omzet per email (€{dowStats[0]?.rev_per_email}).
                        Combineer dit met <span className="text-indigo-400">16:00–18:00</span> op basis van je best-converterende campaigns
                        (Paasvoordeel: Vr 17:45, Flash sale VIP: Di 19:45).
                      </p>
                      <p className="text-gray-600 mt-1 text-xs">→ Test: stuur volgende campaign op maandag 17:00 en vergelijk met vrijdag 17:00</p>
                    </div>

                    <div className="bg-gray-900/60 rounded-lg px-4 py-3 border border-gray-800/40">
                      <p className="font-semibold text-white">🎯 Segmentatie strategie</p>
                      <p className="text-gray-500 dark:text-gray-400 mt-1">
                        <span className="text-green-400">{totalNew} nieuwe klanten</span> (AOV €{aovNew}) vs
                        <span className="text-indigo-400"> {totalRet} terugkerende</span> (AOV €{aovRet}).
                        Stuur <span className="text-green-400">nieuwe klanten</span> product-educatie content.
                        Stuur <span className="text-indigo-400">terugkerende klanten</span> scarcity + cross-sell aanbiedingen.
                      </p>
                      <p className="text-gray-600 mt-1 text-xs">→ Maak twee aparte segmenten in Klaviyo: "Heeft gekocht" vs "Heeft nog niet gekocht"</p>
                    </div>

                    <div className="bg-gray-900/60 rounded-lg px-4 py-3 border border-gray-800/40">
                      <p className="font-semibold text-white">📧 Content type dat converteert</p>
                      <p className="text-gray-500 dark:text-gray-400 mt-1">
                        <span className="text-yellow-400">Scarcity campaigns</span> (Paasvoordeel, Flash sale VIP) genereren 2-3x meer omzet dan reguliere campaigns.
                        Het Paasvoordeel + scarcity follow-up patroon (2 dagen later) is het meest effectief: <span className="text-yellow-400">€2.348 in 3 dagen</span>.
                      </p>
                      <p className="text-gray-600 mt-1 text-xs">→ Template: [Campaign] → [Follow-up 2 dagen later met "Laatste kans"] → [Scarcity reminder dag 3]</p>
                    </div>

                    <div className="bg-gray-900/60 rounded-lg px-4 py-3 border border-gray-800/40">
                      <p className="font-semibold text-white">🌑 Dark email aanpak</p>
                      <p className="text-gray-500 dark:text-gray-400 mt-1">
                        <span className="text-red-400">{data?.emailImpact?.gap_pct}% van Klaviyo-gedreven omzet</span> (€{formatEuro(data?.emailImpact?.klaviyo_revenue - data?.emailImpact?.utm_revenue)})
                        wordt niet als email geattribueerd. Dit zijn klanten die de mail openen, wachten, en later terugkomen via direct/organic.
                      </p>
                      <p className="text-gray-600 mt-1 text-xs">→ Gebruik Klaviyo's eigen dashboard voor werkelijke email ROI, niet de UTM-gebaseerde attributie</p>
                    </div>

                    <div className="bg-gray-900/60 rounded-lg px-4 py-3 border border-gray-800/40">
                      <p className="font-semibold text-white">📦 Voorraad × email planning</p>
                      <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Controleer altijd de voorraad voor je een campaign plant. Als een product kritiek is (&lt;14 dagen voorraad), plan dan geen campaign voor dat product.
                        De Insights tab toont welke producten kritiek zijn.
                      </p>
                      <p className="text-gray-600 mt-1 text-xs">→ Combineer: Voorraad tab + Email planning = geen campagnes voor uitverkochte producten</p>
                    </div>

                    <div className="bg-gray-900/60 rounded-lg px-4 py-3 border border-gray-800/40">
                      <p className="font-semibold text-white">🔄 Flows optimaliseren</p>
                      <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Je hebt <span className="text-green-400">20+ live flows</span> — dat is goed. Focus op:
                        <br/>1. <span className="text-indigo-400">Abandoned Cart</span> — hoogste ROI, stuur na 1u + 24u + 72u
                        <br/>2. <span className="text-indigo-400">Post-Purchase</span> — gebruik tips na 7 dagen, cross-sell na 21 dagen
                        <br/>3. <span className="text-indigo-400">Winback</span> — na 90 dagen inactief, stuur scarcity offer
                      </p>
                      <p className="text-gray-600 mt-1 text-xs">→ Wekelijks elke maandag draait dit rapport opnieuw met de nieuwste data</p>
                    </div>

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
