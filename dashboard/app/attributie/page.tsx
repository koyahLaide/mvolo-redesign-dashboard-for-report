'use client';

import { useEffect, useState, useCallback } from 'react';

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

const CHANNEL_ORDER = [
  'direct', 'organic_search', 'meta_ads', 'google_ads',
  'awin_affiliate', 'email', 'organic_social', 'bol_marketplace',
  'ai_referral', 'other',
];

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

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
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

interface HeatmapRow {
  first_touch: string;
  last_touch: string;
  orders: number;
  revenue: number;
}

interface AssistedData {
  paths: AssistedPath[];
  byChannel: ByChannel[];
  touchSummary: TouchSummary | null;
  heatmap: HeatmapRow[];
}

function AttributieHeatmap({ heatmap }: { heatmap: HeatmapRow[] }) {
  const [mode, setMode] = useState<'orders' | 'revenue'>('orders');
  const [tooltip, setTooltip] = useState<{ first: string; last: string; orders: number; revenue: number; x: number; y: number } | null>(null);

  const allChannels = Array.from(new Set([
    ...heatmap.map(r => r.first_touch),
    ...heatmap.map(r => r.last_touch),
  ])).sort((a, b) => {
    const ai = CHANNEL_ORDER.indexOf(a);
    const bi = CHANNEL_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const lookup: Record<string, HeatmapRow> = {};
  for (const row of heatmap) {
    lookup[`${row.first_touch}__${row.last_touch}`] = row;
  }

  const maxVal = Math.max(...heatmap.map(r => mode === 'orders' ? r.orders : r.revenue), 1);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Kanaal heatmap</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">First touch (rijen) × Last touch (kolommen)</p>
        </div>
        <div className="flex items-center gap-1">
          {(['orders', 'revenue'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${mode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}`}>
              {m === 'orders' ? 'Orders' : 'Omzet'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 overflow-x-auto relative">
        <table className="text-xs border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-32 text-left px-2 py-1">
                <span className="text-gray-500 text-[10px]">First ↓ / Last →</span>
              </th>
              {allChannels.map(ch => (
                <th key={ch} className="text-center pb-2 px-0.5">
                  <div className="text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap mx-auto"
                    style={{ color: channelColor(ch), background: `${channelColor(ch)}18` }}>
                    {formatLabel(ch)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allChannels.map(firstTouch => (
              <tr key={firstTouch}>
                <td className="pr-2 py-0.5">
                  <div className="text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap text-right"
                    style={{ color: channelColor(firstTouch), background: `${channelColor(firstTouch)}18` }}>
                    {formatLabel(firstTouch)}
                  </div>
                </td>
                {allChannels.map(lastTouch => {
                  const row = lookup[`${firstTouch}__${lastTouch}`];
                  const val = row ? (mode === 'orders' ? row.orders : row.revenue) : 0;
                  const intensity = val > 0 ? Math.pow(val / maxVal, 0.5) : 0;
                  const isDiagonal = firstTouch === lastTouch;
                  const color = channelColor(firstTouch);

                  return (
                    <td key={lastTouch} className="text-center p-0">
                      <div
                        className={`w-14 h-8 rounded flex items-center justify-center cursor-default transition-all ${
                          val === 0
                            ? isDiagonal
                              ? 'bg-gray-200 dark:bg-gray-800'
                              : 'bg-gray-50 dark:bg-[#0a0f1a]'
                            : ''
                        }`}
                        style={{
                          background: val > 0
                            ? `rgba(${hexToRgb(color)}, ${0.08 + intensity * 0.72})`
                            : undefined,
                          border: isDiagonal && val === 0 ? `1px solid ${color}20` : '1px solid transparent',
                        }}
                        onMouseEnter={e => {
                          if (val > 0 && row) {
                            const rect = (e.target as HTMLElement).getBoundingClientRect();
                            setTooltip({ first: firstTouch, last: lastTouch, orders: row.orders, revenue: row.revenue, x: rect.left, y: rect.top });
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {val > 0 && (
                          <span className="font-semibold tabular-nums" style={{
                            color: intensity > 0.5 ? 'white' : color,
                            fontSize: '10px',
                          }}>
                            {mode === 'orders' ? val : `€${Math.round((val as number) / 1000)}k`}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {tooltip && (
          <div className="fixed z-50 pointer-events-none bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl text-xs"
            style={{ left: tooltip.x + 8, top: tooltip.y - 64 }}>
            <p className="font-semibold text-white">{formatLabel(tooltip.first)} → {formatLabel(tooltip.last)}</p>
            <p className="text-gray-400 mt-0.5">{tooltip.orders} orders</p>
            <p className="text-indigo-400">{formatEuro(tooltip.revenue)}</p>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-500 dark:text-gray-600">
          <span>Licht</span>
          <div className="flex gap-0.5">
            {[0.1, 0.25, 0.4, 0.6, 0.8].map(o => (
              <div key={o} className="w-4 h-3 rounded-sm" style={{ background: `rgba(99,102,241,${o})` }} />
            ))}
          </div>
          <span>Donker = meer orders/omzet · Hover voor details · Diagonaal = single-touch</span>
        </div>
      </div>
    </div>
  );
}

export default function AttributiePage() {
  const [data, setData] = useState<AssistedData | null>(null);
  const [period, setPeriod] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assisted?period=${period}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e.message ?? 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const maxOrders = data ? Math.max(...data.paths.map(p => p.orders), 1) : 1;
  const maxAssisted = data ? Math.max(...data.byChannel.map(c => c.total_assisted), 1) : 1;

  return (
    <div className="text-gray-900 dark:text-white">

      {/* Top bar with period filter */}
      <div className="border-b border-gray-200 dark:border-gray-800 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-y-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Attributie</h1>
            <p className="text-xs text-gray-500 mt-0.5">Multi-touch attributie analyse</p>
          </div>
          <div className="flex items-center gap-2">
            {['30', '90', 'all'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}`}>
                {p === 'all' ? 'Alles' : `${p}d`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-5 py-4 text-sm text-red-700 dark:text-red-400">
            Fout bij laden: {error}
          </div>
        )}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Multi-touch attributie</h2>
          <p className="text-sm text-gray-500 mt-0.5">Welke kanalen assisteren conversies via andere kanalen?</p>
        </div>

        {data?.touchSummary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Totaal orders', value: data.touchSummary.total, sub: 'in geselecteerde periode', color: '#4f46e5' },
              { label: 'Single-touch', value: data.touchSummary.single_touch, sub: `${Math.round((data.touchSummary.single_touch / data.touchSummary.total) * 100)}% — zelfde first & last touch`, color: '#16a34a' },
              { label: 'Multi-touch', value: data.touchSummary.multi_touch, sub: `${Math.round((data.touchSummary.multi_touch / data.touchSummary.total) * 100)}% — meerdere kanalen betrokken`, color: '#db2777' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                <p className="text-xs text-gray-500">{kpi.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{kpi.sub}</p>
              </div>
            ))}
          </div>
        )}

        {!loading && data?.heatmap && data.heatmap.length > 0 && (
          <AttributieHeatmap heatmap={data.heatmap} />
        )}

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Top touch-paden</h2>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">First touch → Last touch</p>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-600">alleen multi-touch</span>
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
                  <div key={i} className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-700/30">
                    <span className="text-xs text-gray-500 w-4 flex-shrink-0">{i + 1}</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0" style={{ background: `${fc}22`, color: fc }}>{formatLabel(path.first_touch)}</span>
                      <span className="text-gray-400 text-xs flex-shrink-0">→</span>
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0" style={{ background: `${cc}22`, color: cc }}>{formatLabel(path.channel)}</span>
                    </div>
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden max-w-32">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fc }} />
                    </div>
                    <div className="flex items-center gap-4 text-right flex-shrink-0">
                      <div><p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{path.orders}</p><p className="text-xs text-gray-400 dark:text-gray-600">orders</p></div>
                      <div><p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">{formatEuro(path.revenue)}</p><p className="text-xs text-gray-400 dark:text-gray-600">omzet</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Assisterende kanalen</h2>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Kanalen die als first touch hebben bijgedragen aan conversies via andere kanalen</p>
          </div>
          <div className="p-6 space-y-3">
            {loading ? <div className="text-center py-8 text-gray-600 text-sm animate-pulse">Laden…</div> : data?.byChannel.map((ch, i) => {
              const pct = Math.round((ch.total_assisted / maxAssisted) * 100);
              const color = channelColor(ch.assisting_channel);
              return (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-48 flex-shrink-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{formatLabel(ch.assisting_channel)}</span>
                  </div>
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="flex items-center gap-6 text-right flex-shrink-0">
                    <div><span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{ch.total_assisted}</span><span className="text-xs text-gray-500 ml-1">assists</span></div>
                    <span className="text-sm text-indigo-600 dark:text-indigo-400 tabular-nums">{formatEuro(ch.total_revenue)}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-600">{ch.converting_channels} kanalen geholpen</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700/30 rounded-xl px-6 py-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Hoe lees je dit?</h3>
          <div className="space-y-2 text-xs text-gray-500">
            <p>• <span className="text-gray-700 dark:text-gray-300">Diagonaal:</span> single-touch orders — zelfde kanaal voor first & last touch.</p>
            <p>• <span className="text-gray-700 dark:text-gray-300">Google Ads → Organic Search:</span> klant klikte op ad, kocht later via organisch zoeken.</p>
            <p>• <span className="text-gray-700 dark:text-gray-300">Meta Ads → Awin:</span> Meta creëerde awareness, affiliate sloot de sale.</p>
            <p>• Donkere cellen = meer orders/omzet. Hover voor details.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
