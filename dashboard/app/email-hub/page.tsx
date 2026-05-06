'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

const DAYS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const MONTHS_SHORT = ['', 'Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v ?? 0);
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

const FLOW_TYPE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  abandoned:     { label: 'Abandoned',     color: '#f59e0b', emoji: '🛒' },
  welcome:       { label: 'Welcome',       color: '#22c55e', emoji: '👋' },
  post_purchase: { label: 'Post Purchase', color: '#6366f1', emoji: '📦' },
  winback:       { label: 'Winback',       color: '#ec4899', emoji: '🔄' },
  cross_sell:    { label: 'Cross-sell',    color: '#3b82f6', emoji: '🎯' },
  vip:           { label: 'VIP',           color: '#a78bfa', emoji: '⭐' },
  browse:        { label: 'Browse',        color: '#06b6d4', emoji: '👁' },
  segment:       { label: 'Segment',       color: '#14b8a6', emoji: '👥' },
  other:         { label: 'Overig',        color: '#6b7280', emoji: '📧' },
};

function EmailHubContent() {
  const router = useRouter();
  const params = useSearchParams();
  const activeTab = params.get('tab') ?? 'funnel';

  const [klaviyoData, setKlaviyoData] = useState<any>(null);
  const [timingData, setTimingData] = useState<any>(null);
  const [flowsData, setFlowsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  const load = useCallback(async () => {
    setLoading(true);
    const [k, t, f] = await Promise.all([
      fetch(`/api/klaviyo?period=${period}`).then(r => r.json()),
      fetch('/api/email-intelligence').then(r => r.json()),
      fetch('/api/klaviyo-flows').then(r => r.json()),
    ]);
    setKlaviyoData(k);
    setTimingData(t);
    setFlowsData(f);
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const TABS = [
    { key: 'funnel',       label: '📊 Funnel' },
    { key: 'timing',       label: '⏰ Timing' },
    { key: 'flows',        label: '🔄 Flows' },
    { key: 'subscribers',  label: '👥 Subscribers' },
    { key: 'advies',       label: '💡 Advies' },
  ];

  // Klaviyo totals
  const t = klaviyoData?.totals ?? {};
  const received   = t.received_email?.total ?? 0;
  const opened     = t.opened_email?.total ?? 0;
  const clicked    = t.clicked_email?.total ?? 0;
  const ordered    = t.ordered_product?.total ?? 0;
  const revenue    = t.ordered_product?.revenue ?? 0;
  const subscribed = t.subscribed_email?.total ?? 0;
  const unsub      = t.unsubscribed_email?.total ?? 0;

  // Timing
  const dowStats = (timingData?.dowStats ?? []).sort((a: any, b: any) => b.rev_per_email - a.rev_per_email);
  const maxRevPerEmail = Math.max(...dowStats.map((d: any) => d.rev_per_email), 1);
  const maxOrderDow = Math.max(...(timingData?.orderDow ?? []).map((d: any) => d.orders), 1);
  const bestDay = dowStats[0];

  // Flows
  const flows = flowsData?.flows ?? [];
  const ss = flowsData?.subStats ?? {};

  return (
    <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">
      {loading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400 animate-pulse">Laden…</div>
      ) : (
        <>
          {/* FUNNEL TAB */}
          {activeTab === 'funnel' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Verzonden ({period}d)</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{received.toLocaleString('nl-NL')}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Open rate</p>
                  <p className="text-2xl font-bold text-green-500 dark:text-green-400 mt-1">{received > 0 ? Math.round(opened/received*100) : 0}%</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{opened.toLocaleString()} geopend</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Click rate</p>
                  <p className="text-2xl font-bold text-blue-500 dark:text-blue-400 mt-1">{received > 0 ? Math.round(clicked/received*100) : 0}%</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{clicked.toLocaleString()} geklikt</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Email omzet</p>
                  <p className="text-2xl font-bold text-yellow-500 dark:text-yellow-400 mt-1">{formatEuro(revenue)}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{ordered} orders</p>
                </div>
              </div>

              {/* Email funnel bars */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email funnel</h2>
                </div>
                <div className="p-6 space-y-3">
                  {[
                    { label: 'Received', value: received, color: '#6366f1' },
                    { label: 'Opened', value: opened, color: '#22c55e' },
                    { label: 'Clicked', value: clicked, color: '#3b82f6' },
                    { label: 'Ordered', value: ordered, color: '#f59e0b' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-20 flex-shrink-0">{item.label}</span>
                      <div className="flex-1 h-5 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden relative">
                        <div className="h-full rounded transition-all" style={{ width: `${received > 0 ? (item.value/received*100) : 0}%`, background: item.color }} />
                        <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-white">
                          {item.value.toLocaleString('nl-NL')}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
                        {received > 0 ? Math.round(item.value/received*100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Site journey */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Site conversie funnel</h2>
                </div>
                <div className="p-6 space-y-3">
                  {[
                    { label: 'Viewed Product',  key: 'viewed_product',   color: '#6366f1' },
                    { label: 'Added to Cart',   key: 'added_to_cart',    color: '#3b82f6' },
                    { label: 'Checkout',        key: 'checkout_started', color: '#f59e0b' },
                    { label: 'Placed Order',    key: 'placed_order',     color: '#22c55e' },
                  ].map(item => {
                    const val = t[item.key]?.total ?? 0;
                    const maxVal = t.viewed_product?.total ?? 1;
                    return (
                      <div key={item.key} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-28 flex-shrink-0">{item.label}</span>
                        <div className="flex-1 h-5 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden relative">
                          <div className="h-full rounded" style={{ width: `${maxVal > 0 ? (val/maxVal*100) : 0}%`, background: item.color }} />
                          <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-white">{val.toLocaleString()}</span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">{maxVal > 0 ? Math.round(val/maxVal*100) : 0}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Forms */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Form views', key: 'viewed_form', color: '#6366f1' },
                  { label: 'Ingediend', key: 'submitted_form', color: '#22c55e' },
                  { label: 'Gesloten', key: 'closed_form', color: '#ef4444' },
                ].map(item => (
                  <div key={item.key} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: item.color }}>{(t[item.key]?.total ?? 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TIMING TAB */}
          {activeTab === 'timing' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900/40 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Beste dag</p>
                  <p className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 mt-1">{bestDay ? DAYS[bestDay.dow] : '—'}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">€{bestDay?.rev_per_email}/mail</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-green-200 dark:border-green-900/40 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Beste tijdstip</p>
                  <p className="text-2xl font-bold text-green-500 dark:text-green-400 mt-1">16:00–18:00</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">op basis van campaigns</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-yellow-200 dark:border-yellow-900/40 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Klaviyo omzet (30d)</p>
                  <p className="text-2xl font-bold text-yellow-500 dark:text-yellow-400 mt-1">{formatEuro(revenue)}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">via email kanaal</p>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">€ per email per dag</h2>
                </div>
                <div className="p-6 space-y-3">
                  {dowStats.map((d: any, i: number) => (
                    <div key={d.dow} className="flex items-center gap-4">
                      <div className="flex items-center gap-2 w-24 flex-shrink-0">
                        {i === 0 && <span className="text-yellow-400 text-xs">⭐</span>}
                        {i === 1 && <span className="text-gray-400 text-xs">✓</span>}
                        {i > 1 && <span className="text-gray-300 dark:text-gray-700 text-xs">·</span>}
                        <span className="text-sm text-gray-700 dark:text-gray-300">{DAYS[d.dow]}</span>
                      </div>
                      <MiniBar value={d.rev_per_email} max={maxRevPerEmail} color={i === 0 ? '#6366f1' : '#9ca3af'} />
                      <div className="flex items-center gap-3 text-xs text-right flex-shrink-0 w-56">
                        <span className="text-gray-500 dark:text-gray-400 w-14">{d.open_rate}% open</span>
                        <span className="text-gray-500 dark:text-gray-400 w-14">{d.click_rate}% click</span>
                        <span className="text-indigo-500 dark:text-indigo-400 font-semibold w-16">€{d.rev_per_email}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="px-6 pb-4 text-xs text-gray-400 dark:text-gray-600">* Open rates geïnfleerd door iOS Mail Privacy</p>
              </div>

              {/* Campaign performance */}
              {timingData?.report?.campaign_performance?.length > 0 && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Campaign performance (3 dagen na verzending)</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                          <th className="px-4 py-2 text-left">Campaign</th>
                          <th className="px-4 py-2 text-left">Dag</th>
                          <th className="px-4 py-2 text-left">Tijd</th>
                          <th className="px-4 py-2 text-right text-indigo-500 dark:text-indigo-400">Omzet (3d)</th>
                          <th className="px-4 py-2 text-right">Orders</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timingData.report.campaign_performance.slice(0, 10).map((c: any, i: number) => (
                          <tr key={c.id} className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20">
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300 max-w-xs truncate">{c.name}</td>
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{c.send_day_nl}</td>
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{c.send_time?.slice(11,16)}</td>
                            <td className="px-4 py-2 text-right font-semibold" style={{ color: c.total_revenue_3d > 0 ? '#818cf8' : '#9ca3af' }}>
                              {c.total_revenue_3d > 0 ? formatEuro(c.total_revenue_3d) : '—'}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">{c.total_orders_3d || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FLOWS TAB */}
          {activeTab === 'flows' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Totaal flows</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{flowsData?.summary?.total}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600">{flowsData?.summary?.live} live · {flowsData?.summary?.draft} draft</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Actie nodig</p>
                  <p className="text-xl font-bold text-red-500 dark:text-red-400 mt-1">{flowsData?.summary?.action_needed}</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/30 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Controleer</p>
                  <p className="text-xl font-bold text-yellow-500 dark:text-yellow-400 mt-1">{flowsData?.summary?.check_needed}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Goed</p>
                  <p className="text-xl font-bold text-green-500 dark:text-green-400 mt-1">{flowsData?.summary?.good}</p>
                </div>
              </div>

              <div className="space-y-2">
                {flows.map((flow: any) => {
                  const tc = FLOW_TYPE_LABELS[flow.flow_type] ?? FLOW_TYPE_LABELS.other;
                  const pc = flow.priority === 'ACTIE NODIG'
                    ? { color: '#ef4444', bg: '#7f1d1d22' }
                    : flow.priority === 'CONTROLEER'
                    ? { color: '#f59e0b', bg: '#78350f22' }
                    : { color: '#22c55e', bg: '#14532d22' };
                  return (
                    <div key={flow.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-base flex-shrink-0">{tc.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{flow.name}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${flow.status === 'live' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                                {flow.status}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${tc.color}22`, color: tc.color }}>{tc.label}</span>
                            </div>
                            {flow.issues.length > 0 && (
                              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-0.5">⚠ {flow.issues.join(' · ')}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {flow.orders > 0 && <span className="text-xs text-indigo-500 dark:text-indigo-400">{flow.orders} orders</span>}
                          <span className="text-xs px-2 py-1 rounded" style={{ background: pc.bg, color: pc.color }}>{flow.priority}</span>
                        </div>
                      </div>
                      {flow.recommendations.length > 0 && (
                        <p className="text-xs text-blue-500 dark:text-blue-400 mt-1.5 ml-9">→ {flow.recommendations[0]}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SUBSCRIBERS TAB */}
          {activeTab === 'subscribers' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Nieuw (90d)</p>
                  <p className="text-2xl font-bold text-green-500 dark:text-green-400 mt-1">+{ss.total_subscribed_90d}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Uitschrijvingen (90d)</p>
                  <p className="text-2xl font-bold text-red-500 dark:text-red-400 mt-1">-{ss.total_unsubscribed_90d}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Unsub rate</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: (ss.unsub_rate_pct ?? 0) > 2 ? '#ef4444' : '#22c55e' }}>
                    {ss.unsub_rate_pct}%
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{(ss.unsub_rate_pct ?? 0) < 1 ? 'Goed' : (ss.unsub_rate_pct ?? 0) < 2 ? 'Verhoogd' : 'Te hoog'}</p>
                </div>
              </div>

              {ss.high_unsub_days?.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-5 py-4">
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">Dagen met hoge unsubscribes</p>
                  {ss.high_unsub_days.map((d: any) => (
                    <div key={d.date} className="flex justify-between text-xs py-0.5">
                      <span className="text-gray-600 dark:text-gray-300">{new Date(d.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                      <span className="text-red-500 dark:text-red-400 font-semibold">{d.count} unsubs</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Subscriber groei per week</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                        <th className="px-4 py-2 text-left">Week</th>
                        <th className="px-4 py-2 text-right text-green-500 dark:text-green-400">Nieuw</th>
                        <th className="px-4 py-2 text-right text-red-500 dark:text-red-400">Uitschrijvingen</th>
                        <th className="px-4 py-2 text-right">Netto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(flowsData?.subscriberGrowth ?? []).map((r: any) => (
                        <tr key={r.week} className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20">
                          <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{r.week}</td>
                          <td className="px-4 py-2 text-right text-green-500 dark:text-green-400 tabular-nums">+{r.subscribed}</td>
                          <td className="px-4 py-2 text-right text-red-500 dark:text-red-400 tabular-nums">-{r.unsubscribed}</td>
                          <td className="px-4 py-2 text-right font-semibold tabular-nums"
                            style={{ color: r.net > 0 ? '#22c55e' : r.net < 0 ? '#ef4444' : '#6b7280' }}>
                            {r.net > 0 ? '+' : ''}{r.net}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ADVIES TAB */}
          {activeTab === 'advies' && (
            <div className="space-y-3">
              {[
                { priority: 'KRITIEK', color: '#ef4444', title: 'Activeer Abandoned Cart flow', detail: 'Draft flow staat klaar maar is niet actief. Dit is je hoogste-ROI flow.', actie: 'Open Klaviyo → Flows → New I Abandoned Cart Reminder → zet op Live.' },
                { priority: 'KRITIEK', color: '#ef4444', title: 'Activeer Site Abandonment', detail: '2.038 product views/90d maar geen site abandonment flow actief.', actie: 'Activeer de draft Site Abandonment flow. Stuur na 1 uur een herinnering.' },
                { priority: 'URGENT', color: '#f59e0b', title: 'Beste verzendtijd: Maandag 16-18u', detail: `Maandag heeft €${bestDay?.rev_per_email ?? 0} per email — beste dag van de week.`, actie: 'Plan je volgende campaign op maandag tussen 16:00 en 18:00.' },
                { priority: 'URGENT', color: '#f59e0b', title: 'Unsub piek op campagne dagen', detail: '10 unsubscribes op 3 april (Paasvoordeel scarcity). Te agressief of te snel na vorige mail.', actie: 'Bouw suppression segment: min. 4 dagen rust tussen campaigns.' },
                { priority: 'OPTIMALISATIE', color: '#6366f1', title: 'Cross-sell flows inzetten', detail: 'ReliefTorch → EMS Gua Sha (14d) en LED Face Mask → EMS Gua Sha zijn bewezen patronen.', actie: 'Controleer of de Cross Sell flows actief zijn en UTM parameters hebben.' },
                { priority: 'OPTIMALISATIE', color: '#6366f1', title: 'Verouderde segment flows controleren', detail: 'Huidproblemen, Spier & gewrichtspijn, Stress & ontspanning zijn 540+ dagen niet aangepast.', actie: 'Open elke flow in Klaviyo en update de content met huidige producten en prijzen.' },
              ].map((item, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xs px-2 py-1 rounded font-semibold flex-shrink-0"
                      style={{ background: `${item.color}22`, color: item.color }}>{item.priority}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.detail}</p>
                      <p className="text-xs text-blue-500 dark:text-blue-400 mt-1.5">→ {item.actie}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function EmailHubPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-6 w-6 border-2 border-gray-300 dark:border-gray-600 border-t-indigo-500 rounded-full" /></div>}>
      <EmailHubContent />
    </Suspense>
  );
}