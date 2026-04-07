'use client';

import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell,
  ResponsiveContainer,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface JourneyStats {
  // Meta windows
  metaWindows: { total_1d: number; total_7d: number; total_28d: number; rev_1d: number; rev_7d: number; rev_28d: number };
  // GA4
  ga4ByChannel: { channel: string; sessions: number; users: number; new_users: number; bounce_rate: number; avg_session_duration: number }[];
  ga4Daily: { date: string; sessions: number; users: number }[];
  ga4Journeys: { first_channel: string; session_channel: string; sessions: number; users: number }[];
  // Repeat purchases
  repeatPurchases: { first_channel: string; repeat_purchases: number; avg_days_between: number }[];
  returnBuckets: { bucket: string; count: number }[];
  loyalty: { single_order: number; repeat_customer: number };
  // PM touch
  pmTouchSummary: { total: number; single_touch: number; multi_touch: number };
  pmTouchRows: { total: number; first_touch: string; last_touch: string }[];
  vsJourneyByChannel: { channel: string; avg_sessions: number; avg_days: number; total: number }[];
  // Tracker sessions
  journeyByChannel: { channel: string; avg_sessions: number; avg_days: number; total: number }[];
  journeyHistogram: { bucket: string; count: number }[];
  totalTracked: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  direct:          '#6366f1',
  organic_search:  '#22c55e',
  meta_ads:        '#ec4899',
  google_search:   '#3b82f6',
  google_shopping: '#06b6d4',
  awin_affiliate:  '#f59e0b',
  email:           '#a78bfa',
  organic_social:  '#f97316',
  ai_referral:     '#14b8a6',
  bol_marketplace: '#ff6600',
  other:           '#6b7280',
};
const FALLBACK = ['#6366f1','#22c55e','#ec4899','#3b82f6','#06b6d4','#f59e0b','#a78bfa'];

function cc(ch: string, i = 0) { return CHANNEL_COLORS[ch] ?? FALLBACK[i % FALLBACK.length]; }

function fmtLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v);
}

function fmtDur(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
      {sub && <span className="text-xs text-gray-600">{sub}</span>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JourneyPage() {
  const [stats, setStats] = useState<JourneyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stats?period=all&platform=all')
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((d) => { if (d.error) throw new Error(d.error); setStats(d); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Mvolo Attribution Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">Customer Journey analyse</p>
            </div>
            <Nav />
          </div>
          <span className="text-xs text-gray-600">
            {new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {loading && (
          <div className="text-center py-24 text-gray-600 animate-pulse">Laden…</div>
        )}
        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
            Fout: {error}
          </div>
        )}

        {stats && (
          <>
            {/* ── SECTIE 1: Meta Attribution Windows ─────────────────────── */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <SectionHead
                title="Meta Attributievensters"
                sub="1d / 7d / 28d klik — cumulatief"
              />

              {stats.metaWindows && (stats.metaWindows.total_28d > 0) ? (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {[
                      { label: '1d klik', key: '1d', purchases: stats.metaWindows.total_1d, revenue: stats.metaWindows.rev_1d, color: '#22c55e' },
                      { label: '7d klik', key: '7d', purchases: stats.metaWindows.total_7d, revenue: stats.metaWindows.rev_7d, color: '#f59e0b' },
                      { label: '28d klik', key: '28d', purchases: stats.metaWindows.total_28d, revenue: stats.metaWindows.rev_28d, color: '#ec4899' },
                    ].map(({ label, purchases, revenue, color }) => {
                      const base = stats.metaWindows.total_28d || 1;
                      const pct  = Math.round((purchases / base) * 100);
                      return (
                        <div key={label} className="bg-gray-800/60 border border-gray-700/40 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                            <span className="text-xs font-medium text-gray-400">{label}</span>
                          </div>
                          <p className="text-2xl font-bold text-white tabular-nums">{pct}%</p>
                          <p className="text-xs text-gray-500 mt-1">
                            <span className="text-gray-300">{purchases}</span> aankopen ·{' '}
                            <span className="text-gray-300">{fmtEuro(revenue)}</span>
                          </p>
                          <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-600">
                    Cumulatief: 1d ≤ 7d ≤ 28d. Basis = 28d_click totaal ({stats.metaWindows.total_28d} aankopen).
                    {' '}Hoge 1d% = sterke koopintentie op de dag van klikken.
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-600">
                  Nog geen Meta window data — voer <code className="text-indigo-400">node src/tools/journey-rebuild.js</code> uit.
                </p>
              )}
            </section>

            {/* ── SECTIE 2: GA4 Verkeer & Journey ───────────────────────── */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
              <SectionHead title="GA4 Verkeer & Journey" sub="afgelopen 30 dagen" />

              {/* Sessies per dag */}
              {stats.ga4Daily?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-3">Sessies per dag</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={stats.ga4Daily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v: string) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={36} />
                      <Tooltip
                        contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: '#9ca3af' }}
                        formatter={(v: unknown) => [(v as number).toLocaleString('nl-NL'), 'sessies']}
                      />
                      <Line type="monotone" dataKey="sessions" stroke="#6366f1" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Kanaal tabel */}
              {stats.ga4ByChannel?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-3">Sessies per kanaal</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                        <th className="py-2 text-left font-medium">Kanaal</th>
                        <th className="py-2 text-right font-medium">Sessies</th>
                        <th className="py-2 text-right font-medium">Gebruikers</th>
                        <th className="py-2 text-right font-medium">Nieuw %</th>
                        <th className="py-2 text-right font-medium">Bounce</th>
                        <th className="py-2 text-right font-medium">Gem. duur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.ga4ByChannel.map((row) => {
                        const newPct = row.users > 0 ? Math.round((row.new_users / row.users) * 100) : 0;
                        const bounce = row.bounce_rate * 100;
                        return (
                          <tr key={row.channel} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                            <td className="py-2.5 text-gray-200">{row.channel}</td>
                            <td className="py-2.5 text-right text-gray-300 tabular-nums">{row.sessions.toLocaleString('nl-NL')}</td>
                            <td className="py-2.5 text-right text-gray-400 tabular-nums">{row.users.toLocaleString('nl-NL')}</td>
                            <td className="py-2.5 text-right text-gray-400 tabular-nums">{newPct}%</td>
                            <td className="py-2.5 text-right tabular-nums">
                              <span className={bounce > 60 ? 'text-red-400' : bounce > 40 ? 'text-yellow-400' : 'text-emerald-400'}>
                                {bounce.toFixed(0)}%
                              </span>
                            </td>
                            <td className="py-2.5 text-right text-gray-400 tabular-nums">{fmtDur(row.avg_session_duration)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Journey paden */}
              {stats.ga4Journeys?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-3">Eerste kanaal → sessiekanaal (top 10 paden)</p>
                  <div className="space-y-1.5">
                    {stats.ga4Journeys.slice(0, 10).map((row, i) => {
                      const max  = stats.ga4Journeys[0]?.sessions || 1;
                      const pct  = Math.round((row.sessions / max) * 100);
                      const same = row.first_channel === row.session_channel;
                      return (
                        <div key={i} className="flex items-center gap-3 bg-gray-800/40 rounded-lg px-3 py-2 text-xs">
                          <span className="text-gray-300 w-36 truncate">{row.first_channel}</span>
                          <span className="text-gray-600">→</span>
                          <span className={`w-36 truncate ${same ? 'text-gray-500' : 'text-indigo-400'}`}>{row.session_channel}</span>
                          <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-gray-400 tabular-nums w-16 text-right">{row.sessions.toLocaleString('nl-NL')}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!stats.ga4ByChannel?.length && !stats.ga4Daily?.length && (
                <p className="text-sm text-gray-600">Geen GA4 data — voer een sync uit.</p>
              )}
            </section>

            {/* ── SECTIE 3: Herhaalaankoop analyse ──────────────────────── */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
              <SectionHead title="Herhaalaankoop analyse" sub="klantloyaliteit" />

              {/* Loyalty KPIs */}
              {(stats.loyalty?.single_order > 0 || stats.loyalty?.repeat_customer > 0) && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-800/60 border border-gray-700/40 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">Eenmalige klanten</p>
                    <p className="text-2xl font-bold text-white tabular-nums">{stats.loyalty.single_order}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {Math.round((stats.loyalty.single_order / ((stats.loyalty.single_order + stats.loyalty.repeat_customer) || 1)) * 100)}% van totaal
                    </p>
                  </div>
                  <div className="bg-gray-800/60 border border-gray-700/40 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">Terugkerende klanten</p>
                    <p className="text-2xl font-bold text-indigo-400 tabular-nums">{stats.loyalty.repeat_customer}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {Math.round((stats.loyalty.repeat_customer / ((stats.loyalty.single_order + stats.loyalty.repeat_customer) || 1)) * 100)}% van totaal
                    </p>
                  </div>
                  <div className="bg-gray-800/60 border border-gray-700/40 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">Gem. dagen tussen aankopen</p>
                    <p className="text-2xl font-bold text-emerald-400 tabular-nums">
                      {stats.repeatPurchases?.length
                        ? Math.round(stats.repeatPurchases.reduce((s, r) => s + r.avg_days_between * r.repeat_purchases, 0) /
                            Math.max(stats.repeatPurchases.reduce((s, r) => s + r.repeat_purchases, 0), 1))
                        : '—'}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">gewogen gemiddelde</p>
                  </div>
                </div>
              )}

              {/* Per-channel repeat bar */}
              {stats.repeatPurchases?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-3">Gem. dagen tot herhaalaankoop per kanaal</p>
                  <div className="space-y-2">
                    {stats.repeatPurchases.map((r, i) => {
                      const maxDays = Math.max(...stats.repeatPurchases.map((x) => x.avg_days_between), 1);
                      const pct = Math.round((r.avg_days_between / maxDays) * 100);
                      const color = cc(r.first_channel, i);
                      return (
                        <div key={r.first_channel} className="flex items-center gap-3 text-xs">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="text-gray-300 w-36 truncate">{fmtLabel(r.first_channel)}</span>
                          <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                          </div>
                          <span className="text-white font-semibold tabular-nums w-16 text-right">{r.avg_days_between}d</span>
                          <span className="text-gray-600 w-20 text-right">{r.repeat_purchases}× herhaald</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Return-period histogram */}
              {stats.returnBuckets?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-3">Verdeling terugkeerperiode</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={stats.returnBuckets} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={28} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: unknown) => [String(v as number), 'klanten']}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {stats.returnBuckets.map((_, i) => (
                          <Cell key={i} fill={['#22c55e','#f59e0b','#f97316','#6b7280'][i % 4]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {!stats.repeatPurchases?.length && !stats.returnBuckets?.length && (
                <p className="text-sm text-gray-600">
                  Nog geen herhaalaankoop data — klanten hebben nog geen tweede bestelling geplaatst, of customer_id ontbreekt.
                </p>
              )}
            </section>

            {/* ── SECTIE 4: ProfitMetrics Touch Data ────────────────────── */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
              <SectionHead
                title="ProfitMetrics Touch Data"
                sub={`${stats.pmTouchSummary?.total ?? 0} orders geanalyseerd`}
              />

              {stats.pmTouchSummary?.total > 0 ? (
                <>
                  {/* Single vs multi-touch */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800/60 border border-gray-700/40 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">Single-touch orders</p>
                      <p className="text-2xl font-bold text-white tabular-nums">
                        {Math.round((stats.pmTouchSummary.single_touch / (stats.pmTouchSummary.total || 1)) * 100)}%
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {stats.pmTouchSummary.single_touch} orders — first = last touch
                      </p>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700/40 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">Multi-touch orders</p>
                      <p className="text-2xl font-bold text-indigo-400 tabular-nums">
                        {Math.round((stats.pmTouchSummary.multi_touch / (stats.pmTouchSummary.total || 1)) * 100)}%
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {stats.pmTouchSummary.multi_touch} orders — meerdere kanalen
                      </p>
                    </div>
                  </div>

                  {/* Touch path stacked bar */}
                  {stats.pmTouchSummary.total > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Single vs multi-touch verdeling</p>
                      <div className="h-3 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-gray-600"
                          style={{ width: `${Math.round((stats.pmTouchSummary.single_touch / stats.pmTouchSummary.total) * 100)}%` }}
                        />
                        <div
                          className="h-full bg-indigo-500"
                          style={{ width: `${Math.round((stats.pmTouchSummary.multi_touch / stats.pmTouchSummary.total) * 100)}%` }}
                        />
                      </div>
                      <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
                        <span><span className="inline-block w-2 h-2 rounded-full bg-gray-600 mr-1" />Single-touch</span>
                        <span><span className="inline-block w-2 h-2 rounded-full bg-indigo-500 mr-1" />Multi-touch</span>
                      </div>
                    </div>
                  )}

                  {/* Top touch paden */}
                  {stats.pmTouchRows?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Top touch-pad combinaties</p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 border-b border-gray-800">
                            <th className="py-2 text-left font-medium">First touch</th>
                            <th className="py-2 text-center font-medium text-gray-700">→</th>
                            <th className="py-2 text-left font-medium">Last touch</th>
                            <th className="py-2 text-right font-medium">Orders</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.pmTouchRows.slice(0, 8).map((row, i) => {
                            const isMulti = row.first_touch !== row.last_touch && row.last_touch;
                            return (
                              <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                                <td className="py-2 text-gray-300">{fmtLabel(row.first_touch)}</td>
                                <td className="py-2 text-center text-gray-700">→</td>
                                <td className={`py-2 ${isMulti ? 'text-indigo-400' : 'text-gray-500'}`}>
                                  {fmtLabel(row.last_touch ?? row.first_touch)}
                                </td>
                                <td className="py-2 text-right text-gray-400 tabular-nums">{row.total}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-600">
                  Geen PM touch data — voer <code className="text-indigo-400">node src/tools/journey-rebuild.js</code> uit
                  om ProfitMetrics metafields te verwerken.
                </p>
              )}
            </section>

            {/* ── SECTIE 5: Visitor Sessions (tracker) ──────────────────── */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
              <SectionHead
                title="Visitor Sessions — tracker.js"
                sub={stats.totalTracked > 0 ? `${stats.totalTracked} getrackte aankopen` : 'Data wordt verzameld'}
              />

              {stats.totalTracked > 0 ? (
                <>
                  {/* Per-channel breakdown */}
                  {stats.journeyByChannel?.length > 0 && (
                    <div className="space-y-2">
                      {stats.journeyByChannel.map((j) => (
                        <div
                          key={j.channel}
                          className="flex items-center justify-between bg-gray-800/60 rounded-lg px-4 py-3 border border-gray-700/40"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: CHANNEL_COLORS[j.channel] ?? '#6b7280' }} />
                            <span className="text-sm text-gray-200">{fmtLabel(j.channel)}</span>
                            <span className="text-xs text-gray-600">({j.total}×)</span>
                          </div>
                          <div className="flex gap-8 text-right">
                            <div>
                              <p className="text-xs text-gray-500">gem. sessies</p>
                              <p className="text-sm font-semibold text-white tabular-nums">{j.avg_sessions}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">dagen tot aankoop</p>
                              <p className="text-sm font-semibold text-indigo-400 tabular-nums">{j.avg_days}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Session histogram */}
                  {stats.journeyHistogram?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-3">Sessies voor aankoop — verdeling</p>
                      <div className="grid grid-cols-4 gap-3">
                        {(() => {
                          const total = stats.journeyHistogram.reduce((s, b) => s + b.count, 0) || 1;
                          const buckets = ['1 sessie', '2–3 sessies', '4–7 sessies', '8+ sessies'];
                          const map = Object.fromEntries(stats.journeyHistogram.map((b) => [b.bucket, b.count]));
                          return buckets.map((bucket) => {
                            const count = map[bucket] ?? 0;
                            const pct   = Math.round((count / total) * 100);
                            return (
                              <div key={bucket} className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/40 flex flex-col items-center gap-1">
                                <span className="text-lg font-bold text-white tabular-nums">{pct}%</span>
                                <span className="text-xs text-gray-400 text-center">{bucket}</span>
                                <span className="text-xs text-gray-600">{count} aankopen</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-6 text-center space-y-3">
                  <div className="text-3xl">📡</div>
                  <p className="text-sm font-medium text-gray-300">Data wordt verzameld</p>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    De tracker.js verzamelt sessiedata zodra bezoekers op mvolo.nl een aankoop doen.
                    Installeer de tracker op de bedankpagina van Shopify om sessies te registreren.
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Tracker actief vanaf:{' '}
                    <span className="text-gray-400">december 2025</span>
                  </p>
                  {/* PM-based journey as fallback */}
                  {stats.vsJourneyByChannel?.length > 0 && (
                    <div className="mt-4 text-left">
                      <p className="text-xs text-gray-500 mb-2">ProfitMetrics journey (fallback — {stats.vsJourneyByChannel.reduce((s, r) => s + r.total, 0)} orders)</p>
                      <div className="space-y-1.5">
                        {stats.vsJourneyByChannel.map((j) => (
                          <div key={j.channel} className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-2 text-xs">
                            <span className="text-gray-300">{fmtLabel(j.channel)}</span>
                            <span className="text-gray-500">{j.avg_sessions} touches · {j.avg_days}d</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
