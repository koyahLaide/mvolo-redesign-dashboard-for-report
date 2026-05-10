'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

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

const COMPETITORS = [
  { id: 'mvolo',     name: 'Mvolo',         keywords: 1247,  avgPos: 12.4, traffic: 24500, isSelf: true  },
  { id: 'luminette', name: 'Luminette',      keywords:  892,  avgPos: 15.7, traffic: 18200, isSelf: false },
  { id: 'philips',   name: 'Philips (SAD)',  keywords: 2341,  avgPos:  8.9, traffic: 67300, isSelf: false },
  { id: 'innolight', name: 'Innolight',      keywords:  445,  avgPos: 22.1, traffic:  6800, isSelf: false },
  { id: 'dayvigo',   name: 'Dayvigo',        keywords:  312,  avgPos: 19.3, traffic:  5200, isSelf: false },
];

type Difficulty = 'Laag' | 'Middel' | 'Hoog';

interface GapKeyword {
  keyword: string;
  volume: number;
  mvoloPos: number | null;
  bestCompetitor: string;
  compPos: number;
  difficulty: Difficulty;
}

const GAP_KEYWORDS: GapKeyword[] = [
  { keyword: 'daglichtlamp test 2024',                   volume: 2400, mvoloPos: null, bestCompetitor: 'Philips',   compPos:  1, difficulty: 'Middel' },
  { keyword: 'lichttherapie vergoeding zorgverzekering', volume: 1800, mvoloPos: null, bestCompetitor: 'Luminette', compPos:  3, difficulty: 'Laag'   },
  { keyword: 'wake-up light review',                     volume: 1200, mvoloPos: 45,   bestCompetitor: 'Philips',   compPos:  2, difficulty: 'Hoog'   },
  { keyword: 'beste SAD lamp 2024',                      volume:  980, mvoloPos: null, bestCompetitor: 'Innolight', compPos:  5, difficulty: 'Middel' },
  { keyword: 'lichttherapie side effects',               volume:  720, mvoloPos: null, bestCompetitor: 'Dayvigo',   compPos:  4, difficulty: 'Laag'   },
  { keyword: 'lichtbox kopen',                           volume:  560, mvoloPos: null, bestCompetitor: 'Luminette', compPos:  2, difficulty: 'Middel' },
  { keyword: 'SAD lamp bijwerkingen',                    volume:  480, mvoloPos: null, bestCompetitor: 'Dayvigo',   compPos:  6, difficulty: 'Laag'   },
  { keyword: 'lichttherapie vergelijking',               volume:  440, mvoloPos: 67,   bestCompetitor: 'Luminette', compPos:  4, difficulty: 'Middel' },
  { keyword: 'beste daglichtlamp test',                  volume:  390, mvoloPos: null, bestCompetitor: 'Philips',   compPos:  3, difficulty: 'Hoog'   },
  { keyword: 'daglichtlamp huren',                       volume:  320, mvoloPos: null, bestCompetitor: 'Innolight', compPos:  8, difficulty: 'Laag'   },
  { keyword: 'lichttherapie hersenen',                   volume:  280, mvoloPos: null, bestCompetitor: 'Luminette', compPos:  5, difficulty: 'Laag'   },
  { keyword: 'SAD therapie thuis',                       volume:  240, mvoloPos: null, bestCompetitor: 'Dayvigo',   compPos:  7, difficulty: 'Laag'   },
  { keyword: 'lichttherapie review 2024',                volume:  890, mvoloPos: 38,   bestCompetitor: 'Luminette', compPos:  3, difficulty: 'Middel' },
  { keyword: 'Philips SAD lamp review',                  volume:  760, mvoloPos: null, bestCompetitor: 'Philips',   compPos:  1, difficulty: 'Hoog'   },
  { keyword: 'daglichtlamp aanbieding 2024',             volume:  580, mvoloPos: 54,   bestCompetitor: 'Innolight', compPos:  9, difficulty: 'Laag'   },
  { keyword: 'lichttherapie kliniek',                    volume:  420, mvoloPos: null, bestCompetitor: 'Dayvigo',   compPos:  6, difficulty: 'Hoog'   },
  { keyword: 'seizoensdepressie lamp',                   volume:  340, mvoloPos: null, bestCompetitor: 'Luminette', compPos:  4, difficulty: 'Laag'   },
  { keyword: 'biodynamische verlichting thuis',          volume:  210, mvoloPos: null, bestCompetitor: 'Innolight', compPos: 11, difficulty: 'Laag'   },
];

const TRAFFIC_TREND = [
  { month: 'Dec', mvolo: 18000, luminette: 15000, innolight: 5000 },
  { month: 'Jan', mvolo: 20000, luminette: 16000, innolight: 5500 },
  { month: 'Feb', mvolo: 22000, luminette: 17000, innolight: 6000 },
  { month: 'Mrt', mvolo: 21000, luminette: 17500, innolight: 6200 },
  { month: 'Apr', mvolo: 23000, luminette: 18000, innolight: 6500 },
  { month: 'Mei', mvolo: 24500, luminette: 18200, innolight: 6800 },
];

const OVERLAP = [
  {
    competitor: 'Luminette',
    shared: 342,
    mvoloWins: 198,
    equal: 20,
    competitorWins: 124,
    color: '#8B5CF6',
  },
  {
    competitor: 'Innolight',
    shared: 156,
    mvoloWins: 112,
    equal: 13,
    competitorWins: 31,
    color: '#F97316',
  },
  {
    competitor: 'Dayvigo',
    shared: 98,
    mvoloWins: 67,
    equal: 7,
    competitorWins: 24,
    color: '#EF4444',
  },
];

const BACKLINK_ROWS = [
  { label: 'Totale Backlinks',        values: [3892, 2841, 891, 534]  },
  { label: 'Referring Domains',       values: [412,  287,   98,  67]  },
  { label: 'Gem. Domain Authority',   values: [42,    45,   28,  31]  },
  { label: 'Nieuwe Backlinks (30d)',  values: [127,   84,   23,  12]  },
];

const PERIODS = [
  { key: 'week',    label: 'Week'     },
  { key: 'month',   label: 'Maand'    },
  { key: 'quarter', label: 'Kwartaal' },
  { key: 'year',    label: 'Dit jaar' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const DIFF_STYLES: Record<Difficulty, string> = {
  Laag:   'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
  Middel: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-500',
  Hoog:   'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
};

function DiffBadge({ d }: { d: Difficulty }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DIFF_STYLES[d]}`}>{d}</span>
  );
}

function OverlapBar({ mvolo, equal, competitor }: { mvolo: number; equal: number; competitor: number }) {
  const total = mvolo + equal + competitor;
  const mv = (mvolo      / total) * 100;
  const eq = (equal      / total) * 100;
  const cp = (competitor / total) * 100;
  return (
    <div className="flex rounded-full overflow-hidden h-2 mt-2 gap-px">
      <div className="bg-blue-500 rounded-l-full" style={{ width: `${mv}%` }} />
      <div className="bg-gray-300 dark:bg-gray-600" style={{ width: `${eq}%` }} />
      <div className="bg-orange-400 rounded-r-full" style={{ width: `${cp}%` }} />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CompetitorsPage() {
  const [period, setPeriod] = useState('month');
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
  const legendStyle = { fontSize: '12px', color: isDark ? '#d1d5db' : '#374151' };

  const btnCls = (active: boolean) =>
    `px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
      active ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
    }`;

  const BACKLINK_HEADERS = ['Mvolo', 'Luminette', 'Innolight', 'Dayvigo'];

  return (
    <div className="space-y-6">

      {/* Back link */}
      <Link
        href="/seo"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        ← Terug naar SEO Overzicht
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">SEO Concurrentie</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Vergelijk Mvolo met concurrenten</p>
        </div>
        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 self-start sm:self-auto">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} className={btnCls(period === p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Competitor overview cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {COMPETITORS.map(c => (
          <div
            key={c.id}
            className={`bg-white dark:bg-gray-900 rounded-lg p-4 border flex flex-col gap-3 ${
              c.isSelf
                ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-500/30'
                : 'border-gray-100 dark:border-gray-800'
            }`}
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{c.name}</span>
              {c.isSelf && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  Jij
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-gray-500">Keywords</span>
                <span className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums">
                  {c.keywords.toLocaleString('nl-NL')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-gray-500">Gem. Positie</span>
                <span className={`text-xs font-semibold tabular-nums ${c.isSelf ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                  {c.avgPos}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-gray-500">Est. Traffic</span>
                <span className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums">
                  {c.traffic >= 1000 ? `${(c.traffic / 1000).toFixed(1)}k` : c.traffic}/mo
                </span>
              </div>
            </div>

            {/* Relative traffic bar */}
            <div className="mt-1">
              <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${c.isSelf ? 'bg-blue-500' : 'bg-gray-400 dark:bg-gray-600'}`}
                  style={{ width: `${Math.min((c.traffic / 67300) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Keyword gap table ── */}
      <div
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
      >
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Keyword Gaps</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Keywords waar concurrenten op ranken maar Mvolo niet (of veel lager)
          </p>
        </div>
        <div className="overflow-x-auto -mx-px">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left font-medium w-8">#</th>
                <th className="px-4 py-2.5 text-left font-medium">Keyword</th>
                <th className="px-4 py-2.5 text-right font-medium">Volume</th>
                <th className="px-4 py-2.5 text-center font-medium">Mvolo Pos.</th>
                <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Beste Concurrent</th>
                <th className="px-4 py-2.5 text-center font-medium hidden sm:table-cell">Conc. Pos.</th>
                <th className="px-4 py-2.5 text-center font-medium">Moeilijkheid</th>
                <th className="px-4 py-2.5 text-center font-medium hidden lg:table-cell">Kans</th>
              </tr>
            </thead>
            <tbody>
              {GAP_KEYWORDS.map((g, i) => {
                const isEasyWin = g.difficulty === 'Laag' && g.compPos > 10;
                return (
                  <tr
                    key={g.keyword}
                    className={`border-b border-gray-50 dark:border-gray-800/50 transition-colors ${
                      isEasyWin ? 'bg-green-50/40 dark:bg-green-950/10 hover:bg-green-50/60 dark:hover:bg-green-950/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/20'
                    }`}
                  >
                    <td className="px-4 py-2.5 text-gray-400 dark:text-gray-600">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-900 dark:text-gray-100 max-w-[200px] truncate block">{g.keyword}</span>
                        {isEasyWin && (
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 whitespace-nowrap hidden sm:inline">
                            KANS
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">
                      {g.volume.toLocaleString('nl-NL')}
                    </td>
                    <td className="px-4 py-2.5 text-center tabular-nums">
                      {g.mvoloPos === null
                        ? <span className="text-gray-400 dark:text-gray-600 italic">—</span>
                        : <span className={`font-medium ${g.mvoloPos > 20 ? 'text-red-500 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>{g.mvoloPos}</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell text-gray-600 dark:text-gray-400">{g.bestCompetitor}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums hidden sm:table-cell">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{g.compPos}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center"><DiffBadge d={g.difficulty} /></td>
                    <td className="px-4 py-2.5 text-center hidden lg:table-cell">
                      {isEasyWin
                        ? <TrendingUp size={14} className="text-green-500 mx-auto" />
                        : <TrendingDown size={14} className="text-gray-300 dark:text-gray-600 mx-auto" />
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Organic traffic comparison chart ── */}
      <div
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Organisch Verkeer Vergelijking</h2>
        <div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={TRAFFIC_TREND} margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barGap={2} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: tickColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [typeof v === 'number' ? v.toLocaleString('nl-NL') : v, '']} />
              <Legend wrapperStyle={legendStyle} />
              <Bar dataKey="mvolo"     name="Mvolo"     fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="luminette" name="Luminette" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="innolight" name="Innolight" fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Keyword overlap ── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Gedeelde Keywords — Overlap met Concurrenten</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {OVERLAP.map(o => (
            <div
              key={o.competitor}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Mvolo vs {o.competitor}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{o.shared} gedeeld</span>
              </div>

              <OverlapBar mvolo={o.mvoloWins} equal={o.equal} competitor={o.competitorWins} />

              <div className="flex items-center gap-4 mt-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Mvolo <span className="font-semibold text-gray-900 dark:text-white">{o.mvoloWins}</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Gelijk <span className="font-semibold text-gray-900 dark:text-white">{o.equal}</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">{o.competitor.split(' ')[0]} <span className="font-semibold text-gray-900 dark:text-white">{o.competitorWins}</span></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Backlink comparison ── */}
      <div
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
      >
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Backlink Vergelijking</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left font-medium">Metric</th>
                {BACKLINK_HEADERS.map(h => (
                  <th key={h} className={`px-4 py-2.5 text-right font-medium ${h === 'Mvolo' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BACKLINK_ROWS.map((row, ri) => {
                const mvoloVal = row.values[0];
                return (
                  <tr
                    key={row.label}
                    className={`border-b border-gray-50 dark:border-gray-800/50 ${ri % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/20'}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{row.label}</td>
                    {row.values.map((v, vi) => {
                      const isCompetitor = vi > 0;
                      const beatsUs = isCompetitor && v > mvoloVal;
                      return (
                        <td
                          key={vi}
                          className={`px-4 py-3 text-right tabular-nums font-medium ${
                            vi === 0
                              ? 'text-blue-600 dark:text-blue-400'
                              : beatsUs
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {v.toLocaleString('nl-NL')}
                          {beatsUs && <span className="ml-1 text-[9px]">▲</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800">
          <span className="text-[10px] text-gray-400 dark:text-gray-600">
            ▲ Concurrent scoort hoger dan Mvolo op dit metric
          </span>
        </div>
      </div>

    </div>
  );
}
