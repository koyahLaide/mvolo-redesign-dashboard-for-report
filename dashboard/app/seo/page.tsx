'use client';

import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import {
  Search, Globe, TrendingUp, Link2, Shield,
  ArrowUpRight, ArrowDownRight, Eye, Clock,
} from 'lucide-react';

// ── Dark mode hook ────────────────────────────────────────────────────────────

function useIsDark() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const TRAFFIC_DATA = [
  { date: '09 apr', sessions: 1842, users: 1456 },
  { date: '10 apr', sessions: 2134, users: 1689 },
  { date: '11 apr', sessions: 2287, users: 1812 },
  { date: '12 apr', sessions: 1943, users: 1534 },
  { date: '13 apr', sessions: 1654, users: 1298 },
  { date: '14 apr', sessions: 1521, users: 1187 },
  { date: '15 apr', sessions: 1489, users: 1165 },
  { date: '16 apr', sessions: 2356, users: 1867 },
  { date: '17 apr', sessions: 2489, users: 1978 },
  { date: '18 apr', sessions: 2612, users: 2078 },
  { date: '19 apr', sessions: 2734, users: 2187 },
  { date: '20 apr', sessions: 1987, users: 1567 },
  { date: '21 apr', sessions: 1734, users: 1356 },
  { date: '22 apr', sessions: 1612, users: 1256 },
  { date: '23 apr', sessions: 2456, users: 1945 },
  { date: '24 apr', sessions: 2567, users: 2034 },
  { date: '25 apr', sessions: 2689, users: 2134 },
  { date: '26 apr', sessions: 2812, users: 2234 },
  { date: '27 apr', sessions: 2134, users: 1689 },
  { date: '28 apr', sessions: 1845, users: 1456 },
  { date: '29 apr', sessions: 1723, users: 1356 },
  { date: '30 apr', sessions: 2678, users: 2134 },
  { date: '01 mei', sessions: 2789, users: 2212 },
  { date: '02 mei', sessions: 2934, users: 2345 },
  { date: '03 mei', sessions: 3012, users: 2412 },
  { date: '04 mei', sessions: 2456, users: 1945 },
  { date: '05 mei', sessions: 2134, users: 1689 },
  { date: '06 mei', sessions: 2012, users: 1587 },
  { date: '07 mei', sessions: 2867, users: 2287 },
  { date: '08 mei', sessions: 2934, users: 2345 },
];

const KEYWORDS_DATA = [
  { keyword: 'lichttherapie lamp',         pos: 2,  volume: 4400, change: +3, url: '/products/lichttherapie-lamp-10000-lux' },
  { keyword: 'daglichtlamp kopen',          pos: 1,  volume: 3600, change: +1, url: '/products/daglichtlamp' },
  { keyword: 'SAD lamp',                   pos: 4,  volume: 2900, change: -1, url: '/products/sad-lamp' },
  { keyword: 'lichttherapielamp 10000 lux', pos: 3,  volume: 2400, change: +2, url: '/products/lichttherapie-lamp-10000-lux' },
  { keyword: 'winterdepressie lamp',        pos: 7,  volume: 1900, change: +4, url: '/blog/winterdepressie-lichttherapie' },
  { keyword: 'lichttherapie apparaat',      pos: 5,  volume: 1600, change:  0, url: '/collections/lichttherapie' },
  { keyword: 'wake-up light',              pos: 9,  volume: 1400, change: -2, url: '/products/wake-up-light' },
  { keyword: 'UV-vrije lichttherapie',     pos: 6,  volume: 1100, change: +1, url: '/products/uv-vrije-lamp' },
  { keyword: 'bioptic lamp',              pos: 11, volume:  880, change: +3, url: '/products/bioptic-lamp' },
  { keyword: 'energielamp vermoeidheid',   pos: 14, volume:  720, change: +6, url: '/blog/energielamp' },
  { keyword: 'lichttherapie bijwerkingen', pos:  8, volume:  680, change: -1, url: '/blog/lichttherapie-bijwerkingen' },
  { keyword: 'daglichtlamp bureau',        pos: 16, volume:  590, change: +2, url: '/products/bureau-lamp' },
  { keyword: 'mvolo lamp',                 pos: 1,  volume:  480, change:  0, url: '/' },
  { keyword: 'lichttherapie slaap',        pos: 19, volume:  440, change: +5, url: '/blog/lichttherapie-slaap' },
  { keyword: 'lichtbak therapie',          pos: 22, volume:  380, change: -3, url: '/collections/lichttherapie' },
  { keyword: 'seizoensgebonden depressie', pos: 13, volume:  320, change: +1, url: '/blog/seizoensgebonden-depressie' },
  { keyword: 'therapielamp kopen',         pos: 28, volume:  290, change: +8, url: '/collections/alle-lampen' },
  { keyword: 'zonlichtlamp',              pos: 17, volume:  240, change: -2, url: '/products/daglichtlamp' },
];

const PAGES_DATA = [
  { label: 'Homepage',                      path: '/',                                    sessions: 4823, bounce: 38, avgTime: '2m 14s' },
  { label: 'Lichttherapie Lamp 10.000 Lux', path: '/products/lichttherapie-lamp-10000-lux', sessions: 3421, bounce: 42, avgTime: '3m 08s' },
  { label: 'Blog: Wat is Lichttherapie?',   path: '/blog/wat-is-lichttherapie',           sessions: 2876, bounce: 51, avgTime: '4m 32s' },
  { label: 'SAD Lamp',                      path: '/products/sad-lamp',                   sessions: 2134, bounce: 39, avgTime: '2m 55s' },
  { label: 'Collectie: Lichttherapie',      path: '/collections/lichttherapie',           sessions: 1987, bounce: 44, avgTime: '2m 41s' },
  { label: 'Blog: Winterdepressie',         path: '/blog/winterdepressie-lichttherapie',  sessions: 1654, bounce: 56, avgTime: '5m 12s' },
  { label: 'Wake-up Light',                 path: '/products/wake-up-light',              sessions: 1432, bounce: 37, avgTime: '2m 28s' },
  { label: 'Winter Deals',                  path: '/collections/winter-deals',            sessions: 1287, bounce: 62, avgTime: '1m 45s' },
  { label: 'Blog: Bijwerkingen',            path: '/blog/lichttherapie-bijwerkingen',     sessions: 1134, bounce: 48, avgTime: '3m 56s' },
  { label: 'Bureau Daglichtlamp',           path: '/products/bureau-lamp',                sessions:  987, bounce: 41, avgTime: '2m 34s' },
  { label: 'Blog: Lichttherapie & Slaap',   path: '/blog/lichttherapie-slaap',            sessions:  876, bounce: 53, avgTime: '4m 18s' },
  { label: 'Over Mvolo',                    path: '/about',                               sessions:  743, bounce: 67, avgTime: '1m 23s' },
];

const RANKING_DATA = [
  { bucket: 'Pos. 1–3',   count:  89, color: '#10B981' },
  { bucket: 'Pos. 4–10',  count: 234, color: '#3B82F6' },
  { bucket: 'Pos. 11–20', count: 412, color: '#F59E0B' },
  { bucket: 'Pos. 21–50', count: 389, color: '#F97316' },
  { bucket: 'Pos. 51+',   count: 123, color: '#EF4444' },
];

const TOTAL_KEYWORDS = RANKING_DATA.reduce((s, r) => s + r.count, 0);

const PERIODS = [
  { key: 'today',   label: 'Vandaag',    short: 'Vand.' },
  { key: 'week',    label: 'Deze week',  short: 'Week'  },
  { key: 'month',   label: 'Deze maand', short: 'Maand' },
  { key: 'quarter', label: 'Kwartaal',   short: 'Kwrt.' },
  { key: 'year',    label: 'Dit jaar',   short: 'Jaar'  },
  { key: 'all',     label: 'Alles',      short: 'Alles' },
];

const MARKETS = [
  { key: 'all',     label: 'Alle'    },
  { key: 'shopify', label: 'Shopify' },
  { key: 'bol',     label: 'Bol.com' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label, icon: Icon, color, value, sub,
}: {
  label: string;
  icon: React.ElementType;
  color: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      className="bg-white dark:bg-gray-900 rounded-lg p-4 flex flex-col gap-2 border border-gray-100 dark:border-gray-800"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: color + '1a' }}
        >
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider leading-tight">{label}</span>
      </div>
      <span className="text-[22px] font-bold text-gray-900 dark:text-white leading-tight">{value}</span>
      <span className="text-xs text-gray-400 dark:text-gray-500">{sub}</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SeoPage() {
  const [period, setPeriod] = useState('month');
  const [market, setMarket] = useState('all');
  const isDark = useIsDark();

  const gridStroke  = isDark ? '#374151' : '#e5e7eb';
  const tickColor   = isDark ? '#9CA3AF' : '#6b7280';
  const tooltipStyle = {
    background:   isDark ? '#1f2937' : '#ffffff',
    border:       isDark ? '1px solid #374151' : '1px solid #e5e7eb',
    borderRadius: '8px',
    color:        isDark ? '#f3f4f6' : '#111827',
    fontSize:     '12px',
  };

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">SEO Overzicht</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-400 dark:text-gray-500">Live</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Mvolo Organische Prestaties</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Period filter */}
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  period === p.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <span className="hidden sm:inline">{p.label}</span>
                <span className="sm:hidden">{p.short}</span>
              </button>
            ))}
          </div>

          {/* Market filter */}
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {MARKETS.map(m => (
              <button
                key={m.key}
                onClick={() => setMarket(m.key)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  market === m.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <KpiCard label="Organische Sessions" icon={Search}   color="#3B82F6" value="24.531" sub="↑ 18,2% vs vorige periode" />
        <KpiCard label="Gerankte Keywords"   icon={Globe}    color="#10B981" value="1.247"  sub="Top 3: 89 keywords"        />
        <KpiCard label="Gem. Positie"        icon={TrendingUp} color="#F59E0B" value="12,4" sub="↑ 2,1 vs vorige periode"  />
        <KpiCard label="Backlinks"           icon={Link2}    color="#8B5CF6" value="3.892"  sub="↑ 127 nieuwe"             />
        <KpiCard label="SEO Score"           icon={Shield}   color="#06B6D4" value="78/100" sub="Goed"                     />
      </div>

      {/* ── Organic Traffic Chart ── */}
      <div
        className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-4"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Organisch Verkeer</h2>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            <ArrowUpRight size={12} />
            +18,2%
          </span>
        </div>

        <div className="h-[280px] sm:h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={TRAFFIC_DATA} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey="date"
                tick={{ fill: tickColor, fontSize: 11 }}
                interval={6}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: tickColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="users"    name="Users"    stroke="#10B981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center gap-5 mt-3 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full bg-blue-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Sessions</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full bg-green-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Users</span>
          </div>
        </div>
      </div>

      {/* ── Two-column: Keywords + Pages ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Keywords table */}
        <div
          className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Keywords</h2>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
              {KEYWORDS_DATA.length} keywords
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left font-medium">#</th>
                  <th className="px-4 py-2.5 text-left font-medium">Keyword</th>
                  <th className="px-4 py-2.5 text-center font-medium">Pos.</th>
                  <th className="px-4 py-2.5 text-right font-medium">Volume</th>
                  <th className="px-4 py-2.5 text-center font-medium">+/−</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">URL</th>
                </tr>
              </thead>
              <tbody>
                {KEYWORDS_DATA.map((kw, i) => (
                  <tr key={kw.keyword} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-2.5 text-gray-400 dark:text-gray-600">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100 max-w-[140px]">
                      <span className="block truncate">{kw.keyword}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {kw.pos <= 3 ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          {kw.pos}
                        </span>
                      ) : (
                        <span className="text-gray-700 dark:text-gray-300">{kw.pos}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">
                      {kw.volume.toLocaleString('nl-NL')}
                    </td>
                    <td className="px-4 py-2.5 text-center tabular-nums">
                      {kw.change > 0 ? (
                        <span className="text-green-600 dark:text-green-400 flex items-center justify-center gap-0.5">
                          <ArrowUpRight size={10} />
                          {kw.change}
                        </span>
                      ) : kw.change < 0 ? (
                        <span className="text-red-500 dark:text-red-400 flex items-center justify-center gap-0.5">
                          <ArrowDownRight size={10} />
                          {Math.abs(kw.change)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell max-w-[120px]">
                      <span className="block truncate text-gray-400 dark:text-gray-600">{kw.url}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pages table */}
        <div
          className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Pages</h2>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
              {PAGES_DATA.length} pagina&apos;s
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left font-medium">#</th>
                  <th className="px-4 py-2.5 text-left font-medium">Pagina</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    <span className="flex items-center justify-end gap-1"><Eye size={10} />Sessions</span>
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium hidden sm:table-cell">Bounce</th>
                  <th className="px-4 py-2.5 text-right font-medium hidden sm:table-cell">
                    <span className="flex items-center justify-end gap-1"><Clock size={10} />Gem. Tijd</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {PAGES_DATA.map((pg, i) => (
                  <tr key={pg.path} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-2.5 text-gray-400 dark:text-gray-600">{i + 1}</td>
                    <td className="px-4 py-2.5 max-w-[160px]">
                      <span className="block truncate font-medium text-gray-900 dark:text-gray-100">{pg.label}</span>
                      <span className="block truncate text-gray-400 dark:text-gray-600 mt-0.5">{pg.path}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                      {pg.sessions.toLocaleString('nl-NL')}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums hidden sm:table-cell">
                      <span className={
                        pg.bounce > 60 ? 'text-red-500 dark:text-red-400' :
                        pg.bounce < 42 ? 'text-green-600 dark:text-green-400' :
                                         'text-gray-600 dark:text-gray-400'
                      }>
                        {pg.bounce}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                      {pg.avgTime}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Keyword Ranking Distribution ── */}
      <div
        className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-4"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Keyword Positie Verdeling</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Verdeling van {TOTAL_KEYWORDS.toLocaleString('nl-NL')} gerankte keywords over positiebuckets
          </p>
        </div>

        <div className="h-[220px] sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={RANKING_DATA}
              layout="vertical"
              margin={{ top: 0, right: 48, bottom: 0, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: tickColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="bucket"
                tick={{ fill: tickColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Keywords" radius={[0, 4, 4, 0]}>
                {RANKING_DATA.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 px-1">
          {RANKING_DATA.map(r => (
            <div key={r.bucket} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: r.color }} />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {r.bucket}:{' '}
                <span className="font-semibold text-gray-700 dark:text-gray-300">{r.count}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
