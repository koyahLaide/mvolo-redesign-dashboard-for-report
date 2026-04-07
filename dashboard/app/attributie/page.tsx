'use client';

import { useEffect, useState, useCallback } from 'react';
import Nav from '../components/Nav';

const CHANNEL_COLORS: Record<string, string> = {
  direct:              '#6366f1',
  organic_search:      '#22c55e',
  meta_ads:            '#ec4899',
  google_ads:          '#3b82f6',
  google_search:       '#3b82f6',
  google_shopping:     '#06b6d4',
  awin_affiliate:      '#f59e0b',
  ascendia_affiliate:  '#fbbf24',
  email:               '#a78bfa',
  organic_social:      '#f97316',
  bol_marketplace:     '#fb923c',
  ai_referral:         '#14b8a6',
  other:               '#6b7280',
};

function channelColor(ch: string) {
  return CHANNEL_COLORS[ch] ?? '#6b7280';
}

function formatLabel(s: string | null) {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

interface AssistedPath {
  path: string;
  first_touch: string;
  channel: string;
  orders: number;
  revenue: number;
}

interface ByChannel {
  assisting_channel: string;
  total_assisted: number;
  total_revenue: number;
  converting_channels: number;
}

interface TouchSummary {
  total: number;
  multi_touch: number;
  single_touch: number;
}

interface AssistedData {
  paths: AssistedPath[];
  byChannel: ByChannel[];
  touchSummary: TouchSummary | null;
}

export default function AttributiePage() {
  const [data, setData] = useState<AssistedData | null>(null);
  const [period, setPeriod] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/assisted?period=${period}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const maxOrders = data ? Math.max(...data.paths.map(p => p.orders), 1) : 1;
  const maxAssisted = data ? Math.max(...data.byChannel.map(c => c.total_assisted), 1) : 1;

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <header className="border-b border-gray-800 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Mvolo Attribution Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">Multi-touch attributie analyse</p>
            </div>
            <Nav />
          </div>
          <div className="flex items-center gap-2">
            {['30', '90', 'all'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {p === 'all' ? 'Alles' : `${p}d`}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">

        <div>
          <h2 className="text-lg font-semibold text-white">Multi-touch attributie</h2>
          <p className="text-sm text-gray-500 mt-0.5">Welke kanalen assisteren conversies via andere kanalen?</p>
        </div>

        {/* Touch summary KPIs */}
        {data?.touchSummary && (
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: 'Totaal orders',
                value: data.touchSummary.total,
                sub: 'in geselecteerde periode',
                color: '#6366f1',
              },
              {
                label: 'Single-touch',
                value: data.touchSummary.single_touch,
                sub: `${Math.round((data.touchSummary.single_touch / data.touchSummary.total) * 100)}% — zelfde first & last touch`,
                color: '#22c55e',
              },
              {
                label: 'Multi-touch',
                value: data.touchSummary.multi_touch,
                sub: `${Math.round((data.touchSummary.multi_touch / data.touchSummary.total) * 100)}% — meerdere kanalen betrokken`,
                color: '#ec4899',
              },
            ].map(kpi => (
              <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                <p className="text-xs text-gray-500">{kpi.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-xs text-gray-600 mt-1">{kpi.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Top assisterende paden */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-300">Top touch-paden</h2>
              <p className="text-xs text-gray-600 mt-0.5">First touch → Last touch (conversiekanaal)</p>
            </div>
            <span className="text-xs text-gray-600">alleen multi-touch orders</span>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-gray-600 text-sm animate-pulse">Laden…</div>
          ) : (
            <div className="p-6 space-y-3">
              {data?.paths.map((path, i) => {
                const pct = Math.round((path.orders / maxOrders) * 100);
                const fc = channelColor(path.first_touch);
                const cc = channelColor(path.channel);
                return (
                  <div key={i} className="flex items-center gap-4 bg-gray-800/40 rounded-xl px-4 py-3 border border-gray-700/30">
                    {/* Rank */}
                    <span className="text-xs text-gray-600 w-4 flex-shrink-0">{i + 1}</span>

                    {/* Path visualisatie */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
                        style={{ background: `${fc}22`, color: fc }}>
                        {formatLabel(path.first_touch)}
                      </span>
                      <span className="text-gray-600 text-xs flex-shrink-0">→</span>
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
                        style={{ background: `${cc}22`, color: cc }}>
                        {formatLabel(path.channel)}
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden max-w-32">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fc }} />
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-right flex-shrink-0">
                      <div>
                        <p className="text-sm font-semibold text-white tabular-nums">{path.orders}</p>
                        <p className="text-xs text-gray-600">orders</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-indigo-400 tabular-nums">{formatEuro(path.revenue)}</p>
                        <p className="text-xs text-gray-600">omzet</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {data?.paths.length === 0 && (
                <div className="text-center py-8 text-gray-600 text-sm">
                  Geen multi-touch paden gevonden in deze periode.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Assisterende kanalen */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300">Assisterende kanalen</h2>
            <p className="text-xs text-gray-600 mt-0.5">Kanalen die als first touch hebben bijgedragen aan conversies via andere kanalen</p>
          </div>

          <div className="p-6 space-y-3">
            {loading ? (
              <div className="text-center py-8 text-gray-600 text-sm animate-pulse">Laden…</div>
            ) : data?.byChannel.map((ch, i) => {
              const pct = Math.round((ch.total_assisted / maxAssisted) * 100);
              const color = channelColor(ch.assisting_channel);
              return (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-48 flex-shrink-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-sm text-gray-200 truncate">{formatLabel(ch.assisting_channel)}</span>
                  </div>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="flex items-center gap-6 text-right flex-shrink-0">
                    <div>
                      <span className="text-sm font-semibold text-white tabular-nums">{ch.total_assisted}</span>
                      <span className="text-xs text-gray-600 ml-1">assists</span>
                    </div>
                    <div>
                      <span className="text-sm text-indigo-400 tabular-nums">{formatEuro(ch.total_revenue)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">{ch.converting_channels} kanalen geholpen</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Uitleg */}
        <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl px-6 py-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Hoe lees je dit?</h3>
          <div className="space-y-2 text-xs text-gray-500">
            <p>• <span className="text-gray-300">Google Ads → Organic Search:</span> 34 orders waarbij de klant eerst op een Google Ad klikte, maar later terugkwam via organisch zoeken en toen kocht.</p>
            <p>• <span className="text-gray-300">Meta Ads → Awin:</span> 6 orders waarbij Meta de awareness creëerde, maar de klant uiteindelijk via een affiliate link kocht.</p>
            <p>• Last-touch attributie (standaard) geeft al het krediet aan het laatste kanaal. Deze analyse toont welke kanalen de klant eerder in de journey hebben beïnvloed.</p>
          </div>
        </div>

      </main>
    </div>
  );
}
