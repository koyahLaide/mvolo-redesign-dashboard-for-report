'use client';

import { useEffect, useState, useCallback } from 'react';
import Nav from '../components/Nav';

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

const CHANNEL_COLORS: Record<string, string> = {
  direct:             '#6366f1',
  organic_search:     '#22c55e',
  meta_ads:           '#ec4899',
  google_ads:         '#3b82f6',
  awin_affiliate:     '#f59e0b',
  ascendia_affiliate: '#fbbf24',
  email:              '#a78bfa',
  organic_social:     '#f97316',
  bol_marketplace:    '#fb923c',
  ai_referral:        '#14b8a6',
  other:              '#6b7280',
};

function channelColor(ch: string) { return CHANNEL_COLORS[ch] ?? '#6b7280'; }
function formatLabel(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

export default function InsightsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/insights?period=${period}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const ei = data?.emailImpact ?? {};
  const maxChannel = Math.max(...(data?.channelBreakdown ?? []).map((r: any) => r.revenue), 1);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Mvolo Attribution Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">Gecombineerde inzichten — email impact & voorraad alerts</p>
            </div>
            <Nav />
          </div>
          <div className="flex items-center gap-2">
            {['7', '30', '90'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {p}d
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-8">

        {loading ? (
          <div className="text-center py-16 text-gray-600 animate-pulse">Laden…</div>
        ) : (
          <>
            {/* ── SECTIE 1: EMAIL IMPACT ─────────────────────────────────── */}
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white">📧 Email impact — werkelijk vs geattribueerd</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Klaviyo registreert orders die email-gerelateerd zijn, maar UTM tracking mist het meeste.
                  Het verschil is de "dark email" omzet die als direct of organic wordt geteld.
                </p>
              </div>

              {/* KPI vergelijking */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500">Klaviyo registered</p>
                  <p className="text-2xl font-bold text-indigo-400 mt-1">{formatEuro(ei.klaviyo_revenue ?? 0)}</p>
                  <p className="text-xs text-gray-600 mt-1">{ei.klaviyo_orders} orders via email</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500">UTM geattribueerd</p>
                  <p className="text-2xl font-bold text-gray-400 mt-1">{formatEuro(ei.utm_revenue ?? 0)}</p>
                  <p className="text-xs text-gray-600 mt-1">{ei.utm_orders} orders met email UTM</p>
                </div>
                <div className="bg-red-950/30 border border-red-900/40 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500">Dark email (niet geattribueerd)</p>
                  <p className="text-2xl font-bold text-red-400 mt-1">{formatEuro(ei.hidden_revenue ?? 0)}</p>
                  <p className="text-xs text-gray-600 mt-1">{ei.hidden_orders} orders als direct/organic geteld · {ei.attribution_gap}% gap</p>
                </div>
              </div>

              {/* Visuele vergelijking bar */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-5">
                <p className="text-xs text-gray-500 mb-3">Verdeling email omzet</p>
                <div className="h-8 bg-gray-800 rounded-full overflow-hidden flex">
                  {ei.utm_revenue > 0 && (
                    <div className="h-full bg-indigo-500 flex items-center justify-center text-xs font-medium text-white"
                      style={{ width: `${(ei.utm_revenue / ei.klaviyo_revenue) * 100}%` }}>
                      {Math.round((ei.utm_revenue / ei.klaviyo_revenue) * 100)}% getrackt
                    </div>
                  )}
                  <div className="h-full bg-red-500/60 flex items-center justify-center text-xs font-medium text-white flex-1">
                    {ei.attribution_gap}% niet geattribueerd (dark)
                  </div>
                </div>
                <div className="flex items-center gap-6 mt-3 text-xs text-gray-500">
                  <span><span className="text-indigo-400">■</span> UTM-tracked: {formatEuro(ei.utm_revenue ?? 0)}</span>
                  <span><span className="text-red-400">■</span> Dark email: {formatEuro(ei.hidden_revenue ?? 0)}</span>
                  <span className="ml-auto text-gray-600">Bron: Klaviyo Placed Order metric</span>
                </div>
              </div>

              {/* Email trend tabel */}
              {data?.emailTrend?.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-300">Dagelijkse email activiteit</h3>
                    <p className="text-xs text-gray-600 mt-0.5">Klaviyo metric vs UTM-geattribueerde orders</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-800 text-gray-500">
                          <th className="px-4 py-2 text-left">Datum</th>
                          <th className="px-4 py-2 text-right">Verzonden</th>
                          <th className="px-4 py-2 text-right">Geopend</th>
                          <th className="px-4 py-2 text-right">Geklikt</th>
                          <th className="px-4 py-2 text-right text-indigo-400">Klaviyo orders</th>
                          <th className="px-4 py-2 text-right text-indigo-400">Klaviyo omzet</th>
                          <th className="px-4 py-2 text-right text-gray-500">UTM orders</th>
                          <th className="px-4 py-2 text-right text-gray-500">UTM omzet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.emailTrend.filter((r: any) => r.kl_orders > 0 || r.sent > 0).slice(-14).reverse().map((row: any) => (
                          <tr key={row.date} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                            <td className="px-4 py-2 text-gray-400">{new Date(row.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</td>
                            <td className="px-4 py-2 text-right text-gray-400 tabular-nums">{row.sent || '—'}</td>
                            <td className="px-4 py-2 text-right text-green-400 tabular-nums">{row.opened || '—'}</td>
                            <td className="px-4 py-2 text-right text-blue-400 tabular-nums">{row.clicked || '—'}</td>
                            <td className="px-4 py-2 text-right text-indigo-400 font-semibold tabular-nums">{row.kl_orders || '—'}</td>
                            <td className="px-4 py-2 text-right text-indigo-400 tabular-nums">{row.kl_revenue > 0 ? formatEuro(row.kl_revenue) : '—'}</td>
                            <td className="px-4 py-2 text-right text-gray-500 tabular-nums">{row.utm_orders || '—'}</td>
                            <td className="px-4 py-2 text-right text-gray-500 tabular-nums">{row.utm_revenue > 0 ? formatEuro(row.utm_revenue) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top campaigns */}
              {data?.topCampaigns?.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-300">Top campaigns met directe UTM attributie</h3>
                  </div>
                  <div className="divide-y divide-gray-800/50">
                    {data.topCampaigns.map((c: any, i: number) => (
                      <div key={i} className="px-6 py-3 flex items-center justify-between">
                        <span className="text-sm text-gray-300 truncate max-w-md">{c.utm_campaign}</span>
                        <div className="flex items-center gap-6 text-xs text-right flex-shrink-0">
                          <span className="text-gray-500">{c.orders} orders</span>
                          <span className="text-indigo-400 font-semibold">{formatEuro(c.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ── SECTIE 2: VOORRAAD × KANAAL ───────────────────────────── */}
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white">⚠️ Voorraad × kanaal alerts</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Producten met kritieke voorraad die nog actief via betaalde kanalen verkopen.
                  Budget verspilling risico.
                </p>
              </div>

              {data?.stockAlerts?.length === 0 ? (
                <div className="bg-green-900/20 border border-green-800/40 rounded-xl px-6 py-8 text-center">
                  <p className="text-green-400 font-medium">✓ Geen kritieke voorraad alerts</p>
                  <p className="text-xs text-gray-600 mt-1">Alle actief geadverteerde producten hebben voldoende voorraad</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.stockAlerts.map((p: any) => {
                    const urgencyColor = p.urgency === 'KRITIEK' ? '#ef4444' : p.urgency === 'URGENT' ? '#f97316' : '#eab308';
                    const urgencyBg   = p.urgency === 'KRITIEK' ? '#7f1d1d22' : p.urgency === 'URGENT' ? '#7c2d1222' : '#71350222';
                    return (
                      <div key={p.sku} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 mt-0.5"
                              style={{ background: urgencyBg, color: urgencyColor }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: urgencyColor }} />
                              {p.urgency}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-white">{p.name}</p>
                              <p className="text-xs text-gray-500 mt-0.5 font-mono">{p.sku}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-right flex-shrink-0">
                            <div>
                              <p className="text-sm font-bold tabular-nums" style={{ color: p.stock < 0 ? '#ef4444' : p.stock === 0 ? '#f97316' : '#eab308' }}>
                                {p.stock} stuks
                              </p>
                              <p className="text-xs text-gray-600">{p.days_left !== null ? `${p.days_left}d over` : '∞'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-300 tabular-nums">{p.velocity.toFixed(2)}/dag</p>
                              <p className="text-xs text-gray-600">velocity</p>
                            </div>
                            {p.margin !== null && (
                              <div>
                                <p className="text-sm text-green-400 tabular-nums">{p.margin}%</p>
                                <p className="text-xs text-gray-600">marge</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actieve kanalen */}
                        {p.active_channels?.length > 0 && (
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-600">Actief via:</span>
                            {p.active_channels.map((ch: any) => (
                              <span key={ch.channel} className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ background: `${channelColor(ch.channel)}22`, color: channelColor(ch.channel) }}>
                                {formatLabel(ch.channel)} ({ch.orders} orders)
                              </span>
                            ))}
                            <span className="text-xs text-red-400 ml-2">
                              → overweeg budget te pauzeren of te verschuiven
                            </span>
                          </div>
                        )}

                        {p.active_channels?.length === 0 && (
                          <p className="mt-2 text-xs text-gray-600">Geen actieve betaalde kanalen gevonden (laatste 30d)</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── SECTIE 3: KANAAL OMZET BREAKDOWN ─────────────────────── */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-white">📊 Kanaal omzet (last-touch vs Klaviyo-gecorrigeerd)</h2>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-300">Last-touch attributie per kanaal</h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Directe omzet is waarschijnlijk {Math.round((ei.hidden_revenue / Math.max(ei.klaviyo_revenue, 1)) * 100)}% hoger dan getoond door dark email
                    </p>
                  </div>
                </div>
                <div className="p-6 space-y-2">
                  {(data?.channelBreakdown ?? []).map((ch: any) => {
                    const pct = Math.round((ch.revenue / maxChannel) * 100);
                    const color = channelColor(ch.channel);
                    const isDirect = ch.channel === 'direct';
                    return (
                      <div key={ch.channel} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 w-40 flex-shrink-0">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="text-xs text-gray-300 truncate">{formatLabel(ch.channel)}</span>
                          {isDirect && <span className="text-xs text-yellow-500 flex-shrink-0">*</span>}
                        </div>
                        <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden relative">
                          <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: color, opacity: 0.7 }} />
                          <span className="absolute inset-0 flex items-center px-2 text-xs text-white font-medium">
                            {formatEuro(ch.revenue)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 w-16 text-right tabular-nums">{ch.orders} orders</span>
                      </div>
                    );
                  })}
                  <p className="text-xs text-yellow-500/70 mt-2">* Direct bevat waarschijnlijk {formatEuro(ei.hidden_revenue ?? 0)} aan dark email omzet</p>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
