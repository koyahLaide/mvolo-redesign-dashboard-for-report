'use client';

import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

const POSITIONS_DATA = [
  { keyword: 'lichttherapie lamp',           pos: 2,  prev: 5,  volume: 4400, url: '/products/lichttherapie-lamp-10000-lux' },
  { keyword: 'daglichtlamp kopen',            pos: 1,  prev: 1,  volume: 3600, url: '/products/daglichtlamp' },
  { keyword: 'infraroodlamp kopen',           pos: 12, prev: 15, volume: 3200, url: '/collections/lichttherapie' },
  { keyword: 'SAD lamp',                     pos: 4,  prev: 5,  volume: 2900, url: '/products/sad-lamp' },
  { keyword: 'lichttherapielamp 10000 lux',  pos: 3,  prev: 5,  volume: 2400, url: '/products/lichttherapie-lamp-10000-lux' },
  { keyword: 'beste rood licht apparaat',    pos: 15, prev: 12, volume: 900,  url: '/collections/alle-lampen' },
  { keyword: 'lichttherapie pijnklachten',   pos: 6,  prev: 6,  volume: 1100, url: '/blog/lichttherapie-pijnklachten' },
  { keyword: 'winterdepressie lamp',         pos: 7,  prev: 11, volume: 1900, url: '/blog/winterdepressie-lichttherapie' },
  { keyword: 'lichttherapie apparaat',       pos: 5,  prev: 5,  volume: 1600, url: '/collections/lichttherapie' },
  { keyword: 'wake-up light',               pos: 9,  prev: 7,  volume: 1400, url: '/products/wake-up-light' },
  { keyword: 'UV-vrije lichttherapie',      pos: 6,  prev: 8,  volume: 1100, url: '/products/uv-vrije-lamp' },
  { keyword: 'bioptic lamp',               pos: 11, prev: 14, volume: 880,  url: '/products/bioptic-lamp' },
  { keyword: 'energielamp vermoeidheid',    pos: 14, prev: 20, volume: 720,  url: '/blog/energielamp' },
  { keyword: 'lichttherapie bijwerkingen',  pos: 8,  prev: 9,  volume: 680,  url: '/blog/lichttherapie-bijwerkingen' },
  { keyword: 'daglichtlamp bureau',         pos: 16, prev: 14, volume: 590,  url: '/products/bureau-lamp' },
  { keyword: 'mvolo lamp',                  pos: 1,  prev: 1,  volume: 480,  url: '/' },
  { keyword: 'lichttherapie slaap',         pos: 19, prev: 24, volume: 440,  url: '/blog/lichttherapie-slaap' },
  { keyword: 'lichtbak therapie',           pos: 22, prev: 19, volume: 380,  url: '/collections/lichttherapie' },
  { keyword: 'seizoensgebonden depressie',  pos: 13, prev: 12, volume: 320,  url: '/blog/seizoensgebonden-depressie' },
  { keyword: 'therapielamp kopen',          pos: 28, prev: 36, volume: 290,  url: '/collections/alle-lampen' },
];

function posBadge(pos: number) {
  if (pos <= 3)  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (pos <= 10) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  if (pos <= 20) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
}

function DeltaEl({ curr, prev }: { curr: number; prev: number }) {
  const diff = prev - curr; // positive = improved (lower pos = better)
  if (diff === 0) return <span className="text-gray-400 flex items-center gap-0.5"><Minus className="w-3 h-3" />0</span>;
  return diff > 0
    ? <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />+{diff}</span>
    : <span className="text-red-500 dark:text-red-400 flex items-center gap-0.5"><ArrowDownRight className="w-3 h-3" />{diff}</span>;
}

export default function PositiesPage() {
  const top3  = POSITIONS_DATA.filter(k => k.pos <= 3).length;
  const top10 = POSITIONS_DATA.filter(k => k.pos <= 10).length;
  const top20 = POSITIONS_DATA.filter(k => k.pos <= 20).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
          <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Posities</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Keyword rankingposities per pagina</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Top 3',  count: top3,  color: '#22c55e' },
          { label: 'Top 10', count: top10, color: '#3b82f6' },
          { label: 'Top 20', count: top20, color: '#f59e0b' },
        ].map(({ label, count, color }) => (
          <div
            key={label}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 text-center"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}
          >
            <p className="text-2xl font-bold" style={{ color }}>{count}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Alle posities</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{POSITIONS_DATA.length} keywords</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left font-medium">#</th>
                <th className="px-4 py-2.5 text-left font-medium">Keyword</th>
                <th className="px-4 py-2.5 text-center font-medium">Positie</th>
                <th className="px-4 py-2.5 text-center font-medium">vs Vorig</th>
                <th className="px-4 py-2.5 text-right font-medium">Volume</th>
                <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">URL</th>
              </tr>
            </thead>
            <tbody>
              {POSITIONS_DATA.map((kw, i) => (
                <tr key={kw.keyword} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-2.5 text-gray-400 dark:text-gray-600">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100 max-w-[160px]">
                    <span className="block truncate">{kw.keyword}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${posBadge(kw.pos)}`}>
                      {kw.pos}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <DeltaEl curr={kw.pos} prev={kw.prev} />
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">
                    {kw.volume.toLocaleString('nl-NL')}
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell max-w-[160px]">
                    <span className="block truncate text-gray-400 dark:text-gray-600">{kw.url}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
