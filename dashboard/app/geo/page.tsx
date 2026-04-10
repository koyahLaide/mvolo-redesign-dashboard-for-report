'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// ── Viewport: NL + BE + stukje DE ────────────────────────────────────────────
const MAP_W = 600;
const MAP_H = 500;
const LON_MIN = 2.3, LON_MAX = 7.6;
const LAT_MIN = 50.3, LAT_MAX = 53.9;

function project(lon: number, lat: number): [number, number] {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_H;
  return [x, y];
}

const CITY_COORDS: Record<string, [number, number]> = {
  'Amsterdam':       [4.9041, 52.3676],
  'Rotterdam':       [4.4777, 51.9244],
  'Utrecht':         [5.1214, 52.0907],
  'Den Haag':        [4.3007, 52.0705],
  "'s-Gravenhage":   [4.3007, 52.0705],
  'Eindhoven':       [5.4697, 51.4416],
  'Tilburg':         [5.0919, 51.5555],
  'Groningen':       [6.5665, 53.2194],
  'Almere':          [5.2647, 52.3508],
  'Breda':           [4.7753, 51.5719],
  'Nijmegen':        [5.8523, 51.8426],
  'Enschede':        [6.8936, 52.2215],
  'Apeldoorn':       [5.9699, 52.2112],
  'Haarlem':         [4.6462, 52.3874],
  'Arnhem':          [5.8987, 51.9851],
  'Amersfoort':      [5.3878, 52.1561],
  'Zoetermeer':      [4.4942, 52.0574],
  'Maastricht':      [5.6909, 50.8514],
  'Leiden':          [4.4974, 52.1601],
  'Dordrecht':       [4.6900, 51.8133],
  'Deventer':        [6.1552, 52.2550],
  'Delft':           [4.3571, 52.0116],
  'Alkmaar':         [4.7480, 52.6324],
  'Venlo':           [6.1725, 51.3704],
  'Venray':          [5.9753, 51.5279],
  'Heerhugowaard':   [4.8374, 52.6660],
  'Amstelveen':      [4.8720, 52.3103],
  'Leeuwarden':      [5.7909, 53.2012],
  'Zwolle':          [6.0830, 52.5168],
  'Helmond':         [5.6612, 51.4817],
  'Hilversum':       [5.1753, 52.2292],
  'Heerlen':         [5.9796, 50.8881],
  'Purmerend':       [4.9538, 52.5028],
  'Sittard':         [5.8731, 51.0018],
  'Zaandam':         [4.8123, 52.4380],
  'Middelburg':      [3.6136, 51.4988],
  'Roosendaal':      [4.4603, 51.5308],
  'Ede':             [5.6611, 52.0408],
  'Gent':            [3.7174, 51.0543],
  'Antwerpen':       [4.4025, 51.2194],
  'Brussel':         [4.3517, 50.8503],
  'Brugge':          [3.2247, 51.2093],
  'Leuven':          [4.7005, 50.8798],
  'Düsseldorf':      [6.7735, 51.2217],
  'Köln':            [6.9603, 50.9333],
};

const COUNTRY_COLORS: Record<string, string> = {
  NL: '#6366f1',
  BE: '#8b5cf6',
  DE: '#a78bfa',
  IL: '#ec4899',
  default: '#6366f1',
};

function formatEuro(n: number) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);
}

interface CityRow {
  city: string;
  country: string;
  orders: number;
  revenue: number;
  avg_order_value: number;
}

interface CountryRow {
  country: string;
  orders: number;
  revenue: number;
}

interface GeoData {
  cities: CityRow[];
  countries: CountryRow[];
  totals: { total_orders: number; orders_with_city: number; total_revenue: number };
}

interface TooltipState {
  city: string;
  orders: number;
  revenue: number;
  x: number;
  y: number;
}

export default function GeoPage() {
  const [data, setData] = useState<GeoData | null>(null);
  const [period, setPeriod] = useState('all');
  const [activeTab, setActiveTab] = useState<'kaart' | 'visitors'>('kaart');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/geo?period=${period}`);
    const json = await res.json();
    setData(json);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const maxOrders = data ? Math.max(...data.cities.map((c) => c.orders), 1) : 1;
  const mappedCities = data?.cities.filter((c) => CITY_COORDS[c.city]) ?? [];

  // Tooltip positie relatief aan SVG container
  const handleMouseEnter = (e: React.MouseEvent<SVGCircleElement>, city: CityRow) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      city: city.city,
      orders: city.orders,
      revenue: city.revenue,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Geografische verdeling</h1>
          <p className="text-sm text-gray-500 mt-0.5">Orders per stad en land</p>
        </div>
        <div className="flex items-center gap-2">
          {['30', '90', 'all'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === p ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {p === 'all' ? 'Alles' : `${p}d`}
            </button>
          ))}
        </div>
      </div>

      {/* KPI balk */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Orders met locatie', value: `${data.totals.orders_with_city} / ${data.totals.total_orders}` },
            { label: 'Unieke steden', value: data.cities.length },
            { label: 'Landen', value: data.countries.length },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
              <p className="text-xs text-gray-500">{kpi.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Kaart + tabel */}
      <div className="grid grid-cols-5 gap-6">

        {/* SVG Kaart */}
        <div className="col-span-3 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">Kaart — NL &amp; BE</h2>
            <span className="text-xs text-gray-600">Hover voor details</span>
          </div>
          <div className="p-4 relative">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              className="w-full rounded-lg"
              style={{ background: '#030712' }}
            >
              {/* Grid */}
              <defs>
                <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#0f172a" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={MAP_W} height={MAP_H} fill="url(#grid)" />

              {/* Meridiaanlijnen als referentie */}
              {[3, 4, 5, 6, 7].map((lon) => {
                const [x] = project(lon, 52);
                return <line key={lon} x1={x} y1={0} x2={x} y2={MAP_H} stroke="#111827" strokeWidth="0.5" strokeDasharray="4,4" />;
              })}
              {[51, 52, 53].map((lat) => {
                const [, y] = project(5, lat);
                return <line key={lat} x1={0} y1={y} x2={MAP_W} y2={y} stroke="#111827" strokeWidth="0.5" strokeDasharray="4,4" />;
              })}

              {/* Graadindicatoren */}
              {[3, 4, 5, 6, 7].map((lon) => {
                const [x] = project(lon, 52);
                return <text key={lon} x={x} y={MAP_H - 4} fill="#1f2937" fontSize="8" textAnchor="middle">{lon}°</text>;
              })}

              {/* Regio labels */}
              {(() => {
                const [nlX, nlY] = project(5.1, 52.4);
                const [beX, beY] = project(4.5, 50.9);
                return (
                  <>
                    <text x={nlX} y={nlY} fill="#1e3a8a" fontSize="14" fontWeight="700" opacity="0.3" textAnchor="middle">NL</text>
                    <text x={beX} y={beY} fill="#4c1d95" fontSize="14" fontWeight="700" opacity="0.3" textAnchor="middle">BE</text>
                  </>
                );
              })()}

              {/* Stippen per stad */}
              {mappedCities.map((city) => {
                const coords = CITY_COORDS[city.city]!;
                const [px, py] = project(coords[0], coords[1]);
                const r = 5 + (city.orders / maxOrders) * 18;
                const color = COUNTRY_COLORS[city.country] ?? COUNTRY_COLORS.default;
                const showLabel = city.orders >= 5;

                return (
                  <g key={city.city}>
                    {/* Glow */}
                    <circle cx={px} cy={py} r={r + 4} fill={color} opacity={0.1} style={{ pointerEvents: 'none' }} />
                    {/* Stip */}
                    <circle
                      cx={px} cy={py} r={r}
                      fill={color} fillOpacity={0.7}
                      stroke={color} strokeWidth={1.5} strokeOpacity={1}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => handleMouseEnter(e, city)}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    {/* Label */}
                    {showLabel && (
                      <text
                        x={px + r + 3} y={py + 4}
                        fill="#6b7280" fontSize="9"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {city.city}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* HTML Tooltip (buiten SVG voor betere styling) */}
            {tooltip && (
              <div
                className="absolute z-50 pointer-events-none bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl text-xs"
                style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
              >
                <p className="font-semibold text-white">{tooltip.city}</p>
                <p className="text-gray-400 mt-0.5">{tooltip.orders} orders</p>
                <p className="text-indigo-400">{formatEuro(tooltip.revenue)}</p>
              </div>
            )}

            {/* Legenda */}
            <div className="flex items-center gap-4 mt-3">
              {Object.entries(COUNTRY_COLORS).filter(([k]) => k !== 'default').map(([code, color]) => (
                <div key={code} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-xs text-gray-500">{code}</span>
                </div>
              ))}
              <span className="text-xs text-gray-700 ml-auto">Grootte stip = aantal orders</span>
            </div>
          </div>
        </div>

        {/* Steden tabel */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-800 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-300">Top steden</h2>
          </div>
          <div className="overflow-y-auto flex-1" style={{ maxHeight: 520 }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900 z-10">
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  <th className="px-4 py-2.5 text-left font-medium">#</th>
                  <th className="px-4 py-2.5 text-left font-medium">Stad</th>
                  <th className="px-4 py-2.5 text-right font-medium">Orders</th>
                  <th className="px-4 py-2.5 text-right font-medium">Omzet</th>
                </tr>
              </thead>
              <tbody>
                {data?.cities.map((city, i) => {
                  const pct = Math.round((city.orders / maxOrders) * 100);
                  const color = COUNTRY_COLORS[city.country] ?? COUNTRY_COLORS.default;
                  return (
                    <tr key={city.city} className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-2.5 text-gray-600 text-xs tabular-nums">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-200 text-xs">{city.city}</span>
                          {city.country && city.country !== 'NL' && (
                            <span className="text-xs text-gray-600">{city.country}</span>
                          )}
                        </div>
                        <div className="mt-1 h-0.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-300 tabular-nums text-xs font-medium">{city.orders}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums text-xs">{formatEuro(city.revenue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Landen breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Verdeling per land</h2>
        <div className="grid grid-cols-2 gap-4">
          {data?.countries.map((c) => {
            const total = data.totals.orders_with_city || 1;
            const pct = ((c.orders / total) * 100).toFixed(1);
            const color = COUNTRY_COLORS[c.country] ?? '#6b7280';
            return (
              <div key={c.country} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-sm text-gray-200 font-medium">{c.country}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-400 tabular-nums">{c.orders} orders</span>
                    <span className="text-gray-500 tabular-nums">{formatEuro(c.revenue)}</span>
                    <span className="text-indigo-400 font-semibold w-10 text-right tabular-nums">{pct}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeTab === 'visitors' && (
        <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">
          {/* Session stats */}
          {data?.sessionStats && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                <p className="text-xs text-gray-500">Getrackte sessies</p>
                <p className="text-2xl font-bold text-white mt-1">{data.sessionStats.total_sessions}</p>
                <p className="text-xs text-gray-600 mt-1">{data.sessionStats.unique_visitors} unieke bezoekers</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                <p className="text-xs text-gray-500">Gem. sessies voor aankoop</p>
                <p className="text-2xl font-bold text-indigo-400 mt-1">{data.sessionStats.avg_sessions_before_purchase}x</p>
                <p className="text-xs text-gray-600 mt-1">max {data.sessionStats.max_sessions} sessies</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                <p className="text-xs text-gray-500">Rage clicks</p>
                <p className="text-2xl font-bold mt-1" style={{ color: (data.sessionStats.total_rage_clicks ?? 0) > 0 ? '#ef4444' : '#22c55e' }}>
                  {data.sessionStats.total_rage_clicks ?? 0}
                </p>
                <p className="text-xs text-gray-600 mt-1">frustratie signaal</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                <p className="text-xs text-gray-500">Dead clicks</p>
                <p className="text-2xl font-bold mt-1" style={{ color: (data.sessionStats.total_dead_clicks ?? 0) > 5 ? '#f59e0b' : '#22c55e' }}>
                  {data.sessionStats.total_dead_clicks ?? 0}
                </p>
                <p className="text-xs text-gray-600 mt-1">UX probleem signaal</p>
              </div>
            </div>
          )}

          {/* Visitors vs orders per land */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-300">Visitors vs orders per land</h2>
              <p className="text-xs text-gray-600 mt-0.5">Op basis van tracker.js sessies gekoppeld aan orders</p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-2 text-left">Land</th>
                  <th className="px-5 py-2 text-right">Visitors</th>
                  <th className="px-5 py-2 text-right">Orders</th>
                  <th className="px-5 py-2 text-right">Conv. rate</th>
                  <th className="px-5 py-2 text-right">Gem. sessies</th>
                  <th className="px-5 py-2 text-right">Rage clicks</th>
                  <th className="px-5 py-2 text-right">Dead clicks</th>
                </tr>
              </thead>
              <tbody>
                {(data?.visitorGeo ?? []).map((r: any) => (
                  <tr key={r.country} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="px-5 py-2.5 text-gray-300 font-medium">{r.country}</td>
                    <td className="px-5 py-2.5 text-right text-gray-300 tabular-nums">{r.visitors}</td>
                    <td className="px-5 py-2.5 text-right text-indigo-400 tabular-nums">{r.orders}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">
                      <span className="text-green-400">{r.visitors > 0 ? Math.round((r.orders / r.visitors) * 100) : 0}%</span>
                    </td>
                    <td className="px-5 py-2.5 text-right text-gray-400 tabular-nums">{r.avg_sessions_before_purchase}x</td>
                    <td className="px-5 py-2.5 text-right tabular-nums" style={{ color: r.rage_clicks > 0 ? '#ef4444' : '#374151' }}>{r.rage_clicks || '—'}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums" style={{ color: r.dead_clicks > 0 ? '#f59e0b' : '#374151' }}>{r.dead_clicks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Terugkeer verdeling */}
          {(data?.returnVisits ?? []).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800">
                <h2 className="text-sm font-semibold text-gray-300">Sessies voor aankoop</h2>
                <p className="text-xs text-gray-600 mt-0.5">Hoeveel sessies hebben bezoekers nodig voor ze kopen?</p>
              </div>
              <div className="p-6 space-y-3">
                {(data?.returnVisits ?? []).map((r: any) => {
                  const maxV = Math.max(...(data?.returnVisits ?? []).map((x: any) => x.visitors), 1);
                  return (
                    <div key={r.bucket} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">{r.bucket}</span>
                      <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden relative">
                        <div className="h-full bg-indigo-600/60 rounded" style={{ width: `${(r.visitors / maxV) * 100}%` }} />
                        <span className="absolute inset-0 flex items-center px-2 text-xs text-white font-semibold">{r.visitors} bezoekers</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      )}
    </div>

    </div>
  );
}