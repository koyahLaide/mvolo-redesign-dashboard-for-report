'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';

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

type PageStatus = 'Optimaal' | 'Verbetering nodig' | 'Slecht';
type PageType   = 'Product' | 'Blog' | 'Categorie' | 'Landingspagina';

interface PageData {
  path: string;
  label: string;
  type: PageType;
  seoScore: number;
  sessions: number;
  bounce: number;
  avgTime: string;
  words: number;
  updatedDaysAgo: number;
  status: PageStatus;
}

const PAGES: PageData[] = [
  { path: '/',                                   label: 'Homepage',                          type: 'Landingspagina', seoScore: 92, sessions: 4200, bounce: 35, avgTime: '2m 45s', words: 1850, updatedDaysAgo:   3, status: 'Optimaal'          },
  { path: '/products/lichttherapie-lamp',        label: 'Lichttherapie Lamp 10.000 Lux',     type: 'Product',        seoScore: 88, sessions: 3100, bounce: 28, avgTime: '3m 12s', words: 2400, updatedDaysAgo:   7, status: 'Optimaal'          },
  { path: '/products/wake-up-light',             label: 'Wake-up Light',                      type: 'Product',        seoScore: 84, sessions: 1800, bounce: 32, avgTime: '2m 30s', words: 1900, updatedDaysAgo:  14, status: 'Optimaal'          },
  { path: '/blog/wat-is-lichttherapie',          label: 'Blog: Wat is Lichttherapie?',        type: 'Blog',           seoScore: 95, sessions: 2600, bounce: 22, avgTime: '4m 10s', words: 3200, updatedDaysAgo:   5, status: 'Optimaal'          },
  { path: '/blog/winterdepressie-tips',          label: 'Blog: Winterdepressie Tips',         type: 'Blog',           seoScore: 71, sessions:  890, bounce: 45, avgTime: '1m 50s', words: 1200, updatedDaysAgo:  92, status: 'Verbetering nodig' },
  { path: '/collections/winter-deals',           label: 'Winter Deals',                       type: 'Categorie',      seoScore: 58, sessions:  420, bounce: 55, avgTime: '1m 10s', words:  450, updatedDaysAgo: 182, status: 'Slecht'             },
  { path: '/products/uv-vrije-lichttherapie',    label: 'UV-vrije Lichttherapie',             type: 'Product',        seoScore: 76, sessions: 1100, bounce: 38, avgTime: '2m 20s', words: 1600, updatedDaysAgo:  62, status: 'Verbetering nodig' },
  { path: '/blog/lichttherapie-wetenschappelijk',label: 'Blog: Wetenschappelijk Bewijs',      type: 'Blog',           seoScore: 82, sessions:  720, bounce: 30, avgTime: '3m 55s', words: 4100, updatedDaysAgo:  31, status: 'Optimaal'          },
  { path: '/products/bioptic-lamp',              label: 'Bioptic Lamp',                       type: 'Product',        seoScore: 62, sessions:  340, bounce: 52, avgTime: '1m 05s', words:  800, updatedDaysAgo: 155, status: 'Slecht'             },
  { path: '/over-ons',                           label: 'Over Ons',                           type: 'Landingspagina', seoScore: 45, sessions:  180, bounce: 65, avgTime: '0m 45s', words:  350, updatedDaysAgo: 365, status: 'Slecht'             },
  { path: '/products/sad-lamp',                  label: 'SAD Lamp',                           type: 'Product',        seoScore: 79, sessions: 1200, bounce: 41, avgTime: '2m 10s', words: 1400, updatedDaysAgo:  21, status: 'Verbetering nodig' },
  { path: '/blog/lichttherapie-ervaringen',      label: 'Blog: Ervaringen Lichttherapie',     type: 'Blog',           seoScore: 88, sessions: 1100, bounce: 28, avgTime: '3m 45s', words: 2800, updatedDaysAgo:  14, status: 'Optimaal'          },
  { path: '/collections/lichttherapie',          label: 'Collectie: Lichttherapie',           type: 'Categorie',      seoScore: 73, sessions:  980, bounce: 43, avgTime: '1m 35s', words:  620, updatedDaysAgo:  62, status: 'Verbetering nodig' },
  { path: '/products/daglichtlamp',              label: 'Daglichtlamp',                       type: 'Product',        seoScore: 85, sessions: 2100, bounce: 31, avgTime: '2m 55s', words: 2100, updatedDaysAgo:   7, status: 'Optimaal'          },
  { path: '/blog/winterdepressie-lichttherapie', label: 'Blog: Winterdepressie & Licht',      type: 'Blog',           seoScore: 77, sessions:  850, bounce: 42, avgTime: '2m 20s', words: 1550, updatedDaysAgo:  31, status: 'Verbetering nodig' },
  { path: '/contact',                            label: 'Contact',                            type: 'Landingspagina', seoScore: 52, sessions:  230, bounce: 58, avgTime: '0m 55s', words:  280, updatedDaysAgo: 245, status: 'Slecht'             },
  { path: '/blog/lichttherapie-slaap',           label: 'Blog: Lichttherapie & Slaap',        type: 'Blog',           seoScore: 68, sessions:  560, bounce: 48, avgTime: '1m 40s', words:  950, updatedDaysAgo:  62, status: 'Verbetering nodig' },
  { path: '/products/bureau-lamp',               label: 'Bureau Daglichtlamp',                type: 'Product',        seoScore: 64, sessions:  410, bounce: 50, avgTime: '1m 15s', words:  780, updatedDaysAgo: 124, status: 'Slecht'             },
  { path: '/collections/alle-lampen',            label: 'Alle Lampen',                        type: 'Categorie',      seoScore: 61, sessions:  320, bounce: 54, avgTime: '1m 00s', words:  380, updatedDaysAgo: 155, status: 'Slecht'             },
  { path: '/blog/lichttherapie-voordelen',       label: 'Blog: Voordelen Lichttherapie',      type: 'Blog',           seoScore: 80, sessions:  890, bounce: 35, avgTime: '2m 45s', words: 2200, updatedDaysAgo:  21, status: 'Optimaal'          },
  { path: '/products/winter-blues-lamp',         label: 'Winter Blues Lamp',                  type: 'Product',        seoScore: 74, sessions:  640, bounce: 44, avgTime: '1m 50s', words: 1100, updatedDaysAgo:  42, status: 'Verbetering nodig' },
  { path: '/blog/lichttherapie-bijwerkingen',    label: 'Blog: Bijwerkingen Lichttherapie',   type: 'Blog',           seoScore: 86, sessions:  780, bounce: 32, avgTime: '3m 10s', words: 2600, updatedDaysAgo:  14, status: 'Optimaal'          },
  { path: '/faq',                                label: 'Veelgestelde Vragen',                type: 'Landingspagina', seoScore: 55, sessions:  190, bounce: 61, avgTime: '0m 50s', words:  420, updatedDaysAgo: 214, status: 'Slecht'             },
];

const SCORE_DIST = [
  { label: 'Optimaal',    count: 42, color: '#10B981' },
  { label: 'Verbetering', count: 32, color: '#F59E0B' },
  { label: 'Slecht',      count: 12, color: '#EF4444' },
];

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'all',               label: 'Alle'              },
  { key: 'Optimaal',          label: 'Optimaal'          },
  { key: 'Verbetering nodig', label: 'Verbetering nodig' },
  { key: 'Slecht',            label: 'Slecht'            },
];

const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: 'all',            label: 'Alle'          },
  { key: 'Product',        label: 'Product'       },
  { key: 'Blog',           label: 'Blog'          },
  { key: 'Categorie',      label: 'Categorie'     },
  { key: 'Landingspagina', label: 'Landingspagina'},
];

function fmtDays(d: number) {
  if (d <= 1)   return 'Vandaag';
  if (d <= 7)   return `${d} dagen geleden`;
  if (d <= 30)  return `${Math.round(d / 7)} weken geleden`;
  if (d <= 365) return `${Math.round(d / 30)} maanden geleden`;
  return '1+ jaar geleden';
}

function getChecklist(s: number, w: number, d: number) {
  return [
    { label: 'Title tag aanwezig (60–70 tekens)',          pass: s >= 68 },
    { label: 'Meta description aanwezig (150–160 tekens)', pass: s >= 63 },
    { label: 'H1 tag aanwezig',                            pass: s >= 58 },
    { label: 'Afbeeldingen hebben alt-text',               pass: s >= 76 },
    { label: 'Interne links naar gerelateerde content',    pass: s >= 82 },
    { label: 'Schema markup aanwezig',                     pass: s >= 86 },
    { label: 'Pagina laadt < 3 seconden',                  pass: s >= 78 },
    { label: 'Mobile-friendly',                            pass: s >= 50 },
    { label: 'Canonical URL aanwezig',                     pass: s >= 72 },
    { label: 'Geen broken links',                          pass: d < 120 },
  ];
}

function getSuggestions(s: number, w: number, d: number) {
  const out: string[] = [];
  if (w < 1000)  out.push('Voeg 500+ woorden toe voor betere ranking kwaliteit');
  if (s < 80)    out.push('Optimaliseer meta description voor hogere CTR in zoekresultaten');
  if (s < 73)    out.push('Voeg interne links toe naar 3+ gerelateerde producten of blogs');
  if (d > 90)    out.push(`Update content — pagina is ${fmtDays(d)} niet bijgewerkt`);
  if (s < 68)    out.push('Optimaliseer afbeeldingen — voeg alt-teksten toe voor SEO en toegankelijkheid');
  if (s < 60)    out.push('Voeg schema markup toe voor rich snippets in zoekresultaten');
  if (out.length === 0) out.push('Content presteert goed — blijf regelmatig updaten voor best resultaat');
  return out;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<PageStatus, string> = {
  'Optimaal':          'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400',
  'Verbetering nodig': 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-500',
  'Slecht':            'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400',
};

const TYPE_STYLES: Record<PageType, string> = {
  Product:        'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
  Blog:           'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400',
  Categorie:      'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  Landingspagina: 'bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400',
};

function SeoScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-green-500' :
    score >= 60 ? 'bg-amber-500' :
    'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums font-semibold text-gray-900 dark:text-white w-7 text-right">{score}</span>
      <div className="flex-1 max-w-[60px] h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ContentAuditPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [sortBy,       setSortBy]       = useState('seoScore');
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const isDark = useIsDark();

  const tooltipStyle = {
    background:   isDark ? '#1f2937' : '#ffffff',
    border:       isDark ? '1px solid #374151' : '1px solid #e5e7eb',
    borderRadius: '8px',
    color:        isDark ? '#f3f4f6' : '#111827',
    fontSize:     '12px',
  };
  const gridStroke = isDark ? '#374151' : '#e5e7eb';
  const tickColor  = isDark ? '#9CA3AF' : '#6b7280';

  const filtered = useMemo(() => {
    let d = [...PAGES];
    if (statusFilter !== 'all') d = d.filter(p => p.status === statusFilter);
    if (typeFilter   !== 'all') d = d.filter(p => p.type   === typeFilter);
    if (sortBy === 'seoScore')  d.sort((a, b) => b.seoScore - a.seoScore);
    if (sortBy === 'sessions')  d.sort((a, b) => b.sessions - a.sessions);
    if (sortBy === 'bounce')    d.sort((a, b) => a.bounce - b.bounce);
    if (sortBy === 'updated')   d.sort((a, b) => a.updatedDaysAgo - b.updatedDaysAgo);
    return d;
  }, [statusFilter, typeFilter, sortBy]);

  const btnCls = (active: boolean) =>
    `px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
      active ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
    }`;

  return (
    <div className="space-y-6">

      {/* Back link */}
      <Link href="/seo" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
        ← Terug naar SEO Overzicht
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Content Audit</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Prestaties en kwaliteit van alle pagina&apos;s</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Totaal Pagina\'s', value: '86',     sub: 'Geïndexeerd in Google'        },
          { label: 'Gem. SEO Score',   value: '67/100', sub: '↑ 4 vs vorige maand'          },
          { label: 'Content Gaps',     value: '12',     sub: 'Pagina\'s zonder content'      },
          { label: 'Verouderd',        value: '8',      sub: 'Niet bijgewerkt in 90+ dagen'  },
        ].map(kpi => (
          <div
            key={kpi.label}
            className="bg-white dark:bg-gray-900 rounded-lg p-4 flex flex-col gap-2 border border-gray-100 dark:border-gray-800"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
          >
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">{kpi.label}</span>
            <span className="text-[22px] font-bold text-gray-900 dark:text-white leading-tight">{kpi.value}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer self-start"
          >
            <option value="seoScore">Sorteer: SEO Score</option>
            <option value="sessions">Sorteer: Sessions</option>
            <option value="bounce">Sorteer: Bounce %</option>
            <option value="updated">Sorteer: Meest recent</option>
          </select>
        </div>
        <div className="overflow-x-auto pb-0.5">
          <div className="flex items-center gap-2 min-w-max">
            <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {STATUS_FILTERS.map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)} className={btnCls(statusFilter === f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {TYPE_FILTERS.map(f => (
                <button key={f.key} onClick={() => setTypeFilter(f.key)} className={btnCls(typeFilter === f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Page Audit Table */}
      <div
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Alle Pagina&apos;s</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            {filtered.length} pagina&apos;s
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left font-medium w-8">#</th>
                <th className="px-4 py-2.5 text-left font-medium">Pagina</th>
                <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Type</th>
                <th className="px-4 py-2.5 text-left font-medium">SEO Score</th>
                <th className="px-4 py-2.5 text-right font-medium">Sessions</th>
                <th className="px-4 py-2.5 text-center font-medium hidden sm:table-cell">Bounce</th>
                <th className="px-4 py-2.5 text-right font-medium hidden md:table-cell">Woorden</th>
                <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Bijgewerkt</th>
                <th className="px-4 py-2.5 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pg, i) => {
                const isExpanded = expandedPath === pg.path;
                const checklist  = getChecklist(pg.seoScore, pg.words, pg.updatedDaysAgo);
                const suggestions = getSuggestions(pg.seoScore, pg.words, pg.updatedDaysAgo);
                return (
                  <React.Fragment key={pg.path}>
                    <tr
                      onClick={() => setExpandedPath(isExpanded ? null : pg.path)}
                      className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors cursor-pointer select-none"
                    >
                      <td className="px-4 py-2.5 text-gray-400 dark:text-gray-600">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100 max-w-[180px] truncate">{pg.label}</div>
                            <div className="text-gray-400 dark:text-gray-600 truncate max-w-[180px] mt-0.5">{pg.path}</div>
                          </div>
                          {isExpanded
                            ? <ChevronUp size={12} className="text-gray-400 flex-shrink-0 ml-1" />
                            : <ChevronDown size={12} className="text-gray-300 dark:text-gray-600 flex-shrink-0 ml-1" />
                          }
                        </div>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TYPE_STYLES[pg.type]}`}>{pg.type}</span>
                      </td>
                      <td className="px-4 py-2.5"><SeoScoreBar score={pg.seoScore} /></td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                        {pg.sessions.toLocaleString('nl-NL')}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums hidden sm:table-cell">
                        <span className={
                          pg.bounce > 55 ? 'text-red-500 dark:text-red-400' :
                          pg.bounce < 35 ? 'text-green-600 dark:text-green-400' :
                          'text-gray-600 dark:text-gray-400'
                        }>{pg.bounce}%</span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400 hidden md:table-cell">
                        {pg.words.toLocaleString('nl-NL')}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 dark:text-gray-600 hidden sm:table-cell whitespace-nowrap">
                        {fmtDays(pg.updatedDaysAgo)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[pg.status]}`}>
                          {pg.status}
                        </span>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-gray-50 dark:bg-gray-800/40">
                        <td colSpan={9} className="px-4 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                            {/* SEO Checklist */}
                            <div>
                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                                SEO Checklist
                              </p>
                              <div className="space-y-1.5">
                                {checklist.map(item => (
                                  <div key={item.label} className="flex items-center gap-1.5">
                                    {item.pass
                                      ? <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                                      : <XCircle    size={12} className="text-red-400 flex-shrink-0"   />
                                    }
                                    <span className={`text-xs ${item.pass ? 'text-gray-700 dark:text-gray-300' : 'text-red-600 dark:text-red-400'}`}>
                                      {item.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Suggestions */}
                            <div>
                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Aanbevelingen
                              </p>
                              <div className="space-y-1.5">
                                {suggestions.map((s, si) => (
                                  <div key={si} className="flex items-start gap-1.5">
                                    <span className="text-blue-500 mt-0.5 flex-shrink-0">→</span>
                                    <span className="text-xs text-gray-700 dark:text-gray-300">{s}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                <span>{pg.words.toLocaleString('nl-NL')} woorden</span>
                                <span>Gem. tijd: {pg.avgTime}</span>
                                <span>{fmtDays(pg.updatedDaysAgo)}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Content Score Verdeling */}
      <div
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Content Score Verdeling</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Verdeling van 86 pagina&apos;s op SEO score</p>
        <div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={SCORE_DIST} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Pagina's" radius={[6, 6, 0, 0]}>
                {SCORE_DIST.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
