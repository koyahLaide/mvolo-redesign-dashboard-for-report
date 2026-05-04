'use client';

import { useEffect, useState, useCallback } from 'react';

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v ?? 0);
}

const FLOW_TYPE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  abandoned:     { label: 'Abandoned',      color: '#f59e0b', emoji: '🛒' },
  welcome:       { label: 'Welcome',        color: '#22c55e', emoji: '👋' },
  post_purchase: { label: 'Post Purchase',  color: '#6366f1', emoji: '📦' },
  winback:       { label: 'Winback',        color: '#ec4899', emoji: '🔄' },
  cross_sell:    { label: 'Cross-sell',     color: '#3b82f6', emoji: '🎯' },
  vip:           { label: 'VIP',            color: '#a78bfa', emoji: '⭐' },
  birthday:      { label: 'Birthday',       color: '#fb923c', emoji: '🎂' },
  browse:        { label: 'Browse',         color: '#06b6d4', emoji: '👁' },
  segment:       { label: 'Segment',        color: '#14b8a6', emoji: '👥' },
  other:         { label: 'Overig',         color: '#6b7280', emoji: '📧' },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  'ACTIE NODIG': { color: '#ef4444', bg: '#7f1d1d22', label: '🔴 Actie nodig' },
  'CONTROLEER':  { color: '#f59e0b', bg: '#78350f22', label: '🟡 Controleer' },
  'GOED':        { color: '#22c55e', bg: '#14532d22', label: '🟢 Goed' },
};

export default function KlaviyoFlowsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'flows' | 'subscriber' | 'volume' | 'advies'>('flows');
  const [filter, setFilter] = useState<'all' | 'actie' | 'live' | 'draft'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/klaviyo-flows');
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flows = (data?.flows ?? []).filter((f: any) => {
    if (filter === 'actie') return f.priority === 'ACTIE NODIG' || f.priority === 'CONTROLEER';
    if (filter === 'live') return f.status === 'live';
    if (filter === 'draft') return f.status === 'draft';
    return true;
  });

  const s = data?.summary ?? {};
  const ss = data?.subStats ?? {};
  const maxSent = Math.max(...(data?.volumeTrend ?? []).map((r: any) => r.sent), 1);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
      
      <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">

        {/* KPI banner */}
        {!loading && (
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Totaal flows</p>
              <p className="text-xl font-bold text-white mt-1">{s.total}</p>
              <p className="text-xs text-gray-600">{s.live} live · {s.draft} draft</p>
            </div>
            <div className="bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Actie nodig</p>
              <p className="text-xl font-bold text-red-400 mt-1">{s.action_needed}</p>
              <p className="text-xs text-gray-600">flows</p>
            </div>
            <div className="bg-yellow-950/20 border border-yellow-900/30 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Controleer</p>
              <p className="text-xl font-bold text-yellow-400 mt-1">{s.check_needed}</p>
              <p className="text-xs text-gray-600">flows</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Unsub rate (90d)</p>
              <p className="text-xl font-bold mt-1" style={{ color: ss.unsub_rate_pct > 2 ? '#ef4444' : '#22c55e' }}>
                {ss.unsub_rate_pct}%
              </p>
              <p className="text-xs text-gray-600">{ss.total_unsubscribed_90d} unsubscribes</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Netto groei (90d)</p>
              <p className="text-xl font-bold mt-1" style={{ color: (ss.net_growth_90d ?? 0) > 0 ? '#22c55e' : '#ef4444' }}>
                {ss.net_growth_90d > 0 ? '+' : ''}{ss.net_growth_90d}
              </p>
              <p className="text-xs text-gray-600">subscribers</p>
            </div>
          </div>
        )}

        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl p-1 w-fit">
          {([
            ['flows', '🔄 Flow Analyse'],
            ['subscriber', '📈 Subscriber Gedrag'],
            ['volume', '📊 Email Volume'],
            ['advies', '💡 Aanbevelingen'],
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
            {/* FLOW ANALYSE TAB */}
            {tab === 'flows' && (
              <div className="space-y-4">
                {/* Filter */}
                <div className="flex items-center gap-2">
                  {(['all', 'actie', 'live', 'draft'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-700'}`}>
                      {f === 'all' ? `Alle (${s.total})` : f === 'actie' ? `⚠ Actie (${s.action_needed + s.check_needed})` : f === 'live' ? `Live (${s.live})` : `Draft (${s.draft})`}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {flows.map((flow: any) => {
                    const typeConfig = FLOW_TYPE_LABELS[flow.flow_type] ?? FLOW_TYPE_LABELS.other;
                    const priorityConfig = PRIORITY_CONFIG[flow.priority] ?? PRIORITY_CONFIG['GOED'];
                    return (
                      <div key={flow.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Type emoji */}
                            <span className="text-lg flex-shrink-0 mt-0.5">{typeConfig.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-white truncate">{flow.name}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${flow.status === 'live' ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                                  {flow.status}
                                </span>
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${typeConfig.color}22`, color: typeConfig.color }}>
                                  {typeConfig.label}
                                </span>
                                <span className="text-xs text-gray-600">{flow.trigger_type}</span>
                              </div>
                              {flow.days_since_created && (
                                <p className="text-xs text-gray-600 mt-0.5">Aangemaakt {flow.days_since_created} dagen geleden</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 flex-shrink-0">
                            {/* Orders */}
                            <div className="text-right">
                              <p className="text-xs text-gray-500 dark:text-gray-400">Orders</p>
                              <p className="text-sm font-semibold text-white">{flow.orders}</p>
                            </div>
                            {/* Revenue */}
                            {flow.revenue > 0 && (
                              <div className="text-right">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Omzet</p>
                                <p className="text-sm font-semibold text-indigo-400">{formatEuro(flow.revenue)}</p>
                              </div>
                            )}
                            {/* Priority badge */}
                            <span className="text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0"
                              style={{ background: priorityConfig.bg, color: priorityConfig.color }}>
                              {priorityConfig.label}
                            </span>
                          </div>
                        </div>

                        {/* Issues & recommendations */}
                        {(flow.issues.length > 0 || flow.recommendations.length > 0) && (
                          <div className="mt-3 flex gap-6">
                            {flow.issues.length > 0 && (
                              <div className="flex-1">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Issues</p>
                                <div className="space-y-0.5">
                                  {flow.issues.map((issue: string, i: number) => (
                                    <p key={i} className="text-xs text-yellow-400">⚠ {issue}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                            {flow.recommendations.length > 0 && (
                              <div className="flex-1">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Aanbeveling</p>
                                <div className="space-y-0.5">
                                  {flow.recommendations.map((rec: string, i: number) => (
                                    <p key={i} className="text-xs text-blue-400">→ {rec}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUBSCRIBER GEDRAG TAB */}
            {tab === 'subscriber' && (
              <div className="space-y-6">
                {/* Hoge unsub dagen */}
                {ss.high_unsub_days?.length > 0 && (
                  <div className="bg-red-950/20 border border-red-900/30 rounded-xl px-5 py-4">
                    <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">⚠ Dagen met hoge unsubscribes (≥5)</p>
                    <div className="space-y-1">
                      {ss.high_unsub_days.map((d: any) => (
                        <div key={d.date} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 dark:text-gray-300">{new Date(d.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                          <span className="text-red-400 font-semibold">{d.count} unsubscribes</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 mt-2">→ Correleer met campaign verzendtijden om te zien welke emails te agressief zijn</p>
                  </div>
                )}

                {/* Subscriber groei per week */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Subscriber groei per week (90d)</h2>
                    <p className="text-xs text-gray-600 mt-0.5">Nieuw ingeschreven − uitgeschreven = netto groei</p>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-200 dark:border-gray-800 text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-2 text-left">Week</th>
                        <th className="px-4 py-2 text-right text-green-400">Nieuw</th>
                        <th className="px-4 py-2 text-right text-red-400">Uitschrijvingen</th>
                        <th className="px-4 py-2 text-right">Netto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.subscriberGrowth ?? []).map((r: any) => (
                        <tr key={r.week} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                          <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{r.week}</td>
                          <td className="px-4 py-2 text-right text-green-400 tabular-nums">+{r.subscribed}</td>
                          <td className="px-4 py-2 text-right text-red-400 tabular-nums">-{r.unsubscribed}</td>
                          <td className="px-4 py-2 text-right font-semibold tabular-nums"
                            style={{ color: r.net > 0 ? '#22c55e' : r.net < 0 ? '#ef4444' : '#6b7280' }}>
                            {r.net > 0 ? '+' : ''}{r.net}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Email druk stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Gem. emails per dag</p>
                    <p className="text-2xl font-bold text-white mt-1">{ss.avg_daily_sent}</p>
                    <p className="text-xs text-gray-600 mt-1">over afgelopen 90 dagen</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Unsub rate</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: ss.unsub_rate_pct > 2 ? '#ef4444' : ss.unsub_rate_pct > 0.5 ? '#f59e0b' : '#22c55e' }}>
                      {ss.unsub_rate_pct}%
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {ss.unsub_rate_pct < 0.5 ? 'Uitstekend' : ss.unsub_rate_pct < 1 ? 'Normaal' : ss.unsub_rate_pct < 2 ? 'Verhoogd' : 'Te hoog'}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Netto groei (90d)</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: ss.net_growth_90d > 0 ? '#22c55e' : '#ef4444' }}>
                      {ss.net_growth_90d > 0 ? '+' : ''}{ss.net_growth_90d}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">{ss.total_subscribed_90d} nieuw · {ss.total_unsubscribed_90d} weg</p>
                  </div>
                </div>
              </div>
            )}

            {/* EMAIL VOLUME TAB */}
            {tab === 'volume' && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-200 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Dagelijkse email activiteit (90d)</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-200 dark:border-gray-800 text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-2 text-left">Datum</th>
                        <th className="px-4 py-2 text-right">Verzonden</th>
                        <th className="px-4 py-2 text-right text-green-400">Geopend</th>
                        <th className="px-4 py-2 text-right text-blue-400">Geklikt</th>
                        <th className="px-4 py-2 text-right text-indigo-400">Orders</th>
                        <th className="px-4 py-2 text-right text-green-400">+Subscribed</th>
                        <th className="px-4 py-2 text-right text-red-400">-Unsub</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.volumeTrend ?? []).filter((r: any) => r.sent > 0 || r.unsub > 0).reverse().slice(0, 30).map((r: any) => (
                        <tr key={r.date} className={`border-b border-gray-800/50 hover:bg-gray-800/20 ${r.unsub >= 5 ? 'bg-red-950/10' : ''}`}>
                          <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                            {new Date(r.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {r.unsub >= 5 && <span className="ml-2 text-red-400">⚠</span>}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-300 tabular-nums">{r.sent || '—'}</td>
                          <td className="px-4 py-2 text-right text-green-400 tabular-nums">{r.opened || '—'}</td>
                          <td className="px-4 py-2 text-right text-blue-400 tabular-nums">{r.clicked || '—'}</td>
                          <td className="px-4 py-2 text-right text-indigo-400 tabular-nums">{r.orders || '—'}</td>
                          <td className="px-4 py-2 text-right text-green-400 tabular-nums">{r.subscribed > 0 ? `+${r.subscribed}` : '—'}</td>
                          <td className="px-4 py-2 text-right tabular-nums" style={{ color: r.unsub > 0 ? '#ef4444' : '#374151' }}>
                            {r.unsub > 0 ? `-${r.unsub}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* AANBEVELINGEN TAB */}
            {tab === 'advies' && (
              <div className="space-y-4">
                <div className="space-y-3">
                  {[
                    {
                      priority: 'KRITIEK',
                      color: '#ef4444',
                      title: 'Activeer Abandoned Cart Reminder',
                      detail: 'De "New I Abandoned Cart Reminder" staat op draft terwijl "M new | Abandoned cart flow" live is. Dit zijn waarschijnlijk duplicaten. Controleer welke actueel is en archiveer de andere.',
                      actie: 'Vergelijk beide flows in Klaviyo en activeer de beste versie. Abandoned cart is je hoogste-ROI flow.',
                    },
                    {
                      priority: 'KRITIEK',
                      color: '#ef4444',
                      title: 'Activeer Site Abandonment',
                      detail: '"New I Site abandonment" staat op draft. Je hebt 2.038 product views in 90 dagen — veel potentiële klanten verlaten de site zonder aankoop.',
                      actie: 'Activeer de site abandonment flow. Stuur na 1 uur een herinnering met het bekeken product.',
                    },
                    {
                      priority: 'URGENT',
                      color: '#f59e0b',
                      title: 'Verouderde segment flows (500+ dagen)',
                      detail: 'Huidproblemen, Spier & gewrichtspijn, Stress & ontspanning, Slaap & vermoeidheid zijn allemaal 540+ dagen geleden aangemaakt en mogelijk niet meer aangepast.',
                      actie: 'Open elke flow in Klaviyo en controleer of de content nog actueel is. Verouderde productnamen of prijzen kosten conversies.',
                    },
                    {
                      priority: 'URGENT',
                      color: '#f59e0b',
                      title: 'Campagne timing vs unsubscribes',
                      detail: '3 april: 10 unsubscribes op één dag — dit was de Paasvoordeel scarcity campaign (Vr 17:45). Te veel druk of te snel na vorige mail.',
                      actie: 'Bouw een suppression segment: stuur geen scarcity emails naar mensen die de vorige email niet hebben geopend. Minimale rust: 3-4 dagen tussen campaigns.',
                    },
                    {
                      priority: 'VERBETERING',
                      color: '#6366f1',
                      title: 'Unsub rate 1.9% is verhoogd',
                      detail: '114 unsubscribes op 6.073 verzonden emails = 1.9% over 90 dagen. Benchmark is <0.5%. Dit suggereert dat je te vaak mailt of irrelevante content stuurt.',
                      actie: 'Segmenteer beter: stuur productgerichte emails alleen naar mensen die interesse hebben getoond (viewed product, clicked). Gebruik Klaviyo segmenten op basis van engagement.',
                    },
                    {
                      priority: 'OPTIMALISATIE',
                      color: '#22c55e',
                      title: 'Cross-sell flows presteren goed',
                      detail: 'ReliefTorch → EMS Gua Sha (14d) en LED Face Mask → EMS Gua Sha zijn je best-bewezen cross-sell patronen op basis van orderdata.',
                      actie: 'Zorg dat deze flows actief zijn en UTM parameters hebben. Test een directe bundel aanbeveling in de post-purchase email.',
                    },
                    {
                      priority: 'OPTIMALISATIE',
                      color: '#22c55e',
                      title: 'Welcome Series heeft orders',
                      detail: '2 orders via Welcome Series UTM — dit is je eerste contactmoment. Optimaliseer de tweede en derde email met product educatie.',
                      actie: 'Voeg een product aanbeveling toe in email 2 (dag 3) gebaseerd op wat de subscriber heeft bekeken.',
                    },
                  ].map((item, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                      <div className="flex items-start gap-3">
                        <span className="text-xs px-2 py-1 rounded font-semibold flex-shrink-0 mt-0.5"
                          style={{ background: `${item.color}22`, color: item.color }}>
                          {item.priority}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.detail}</p>
                          <p className="text-xs text-blue-400 mt-2">→ {item.actie}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
