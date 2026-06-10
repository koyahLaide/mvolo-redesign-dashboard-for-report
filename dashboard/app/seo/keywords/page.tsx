'use client';

import { useState, useMemo } from 'react';
import {
  Search, ChevronUp, ChevronDown, ArrowUpDown,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  KEYWORDS, OPPORTUNITIES, CATEGORY_TAGS,
  type Keyword, type Opportunity, type Category,
} from '@/lib/seo/mock-data';
import { useDomain } from '../domain-context';

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 56, H = 22;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - 2 - ((v - min) / range) * (H - 4)}`)
    .join(' ');
  return (
    <svg width={W} height={H} className="shrink-0">
      <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}


// ── Badges ────────────────────────────────────────────────────────────────────

function CompBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const cls = {
    HIGH:   'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-400',
    MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    LOW:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  }[level];
  const lbl = { HIGH: 'HOOG', MEDIUM: 'GEMIDDELD', LOW: 'LAAG' }[level];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{lbl}</span>;
}

function PosBadge({ pos }: { pos: number }) {
  const cls = pos <= 3  ? 'text-green-600 dark:text-green-400 font-bold'
    : pos <= 10 ? 'text-blue-600  dark:text-blue-400  font-semibold'
    : pos <= 25 ? 'text-amber-600 dark:text-amber-400'
    : 'text-gray-500 dark:text-gray-400';
  return <span className={`text-sm tabular-nums ${cls}`}>{pos}</span>;
}

// ── Table ─────────────────────────────────────────────────────────────────────

type SortKey = keyof Keyword | 'opportunityScore';
type Dir = 'asc' | 'desc';
const PAGE = 10;

function KwTable({
  data,
  showOpp = false,
}: {
  data: (Keyword & { opportunityScore?: number })[];
  showOpp?: boolean;
}) {
  const [sort, setSort] = useState<SortKey>('volume');
  const [dir, setDir]   = useState<Dir>('desc');
  const [page, setPage] = useState(1);
  const [q, setQ]       = useState('');

  const filtered = useMemo(
    () => data.filter(k => k.keyword.toLowerCase().includes(q.toLowerCase())),
    [data, q],
  );

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sort] ?? 0;
    const bv = (b as unknown as Record<string, unknown>)[sort] ?? 0;
    if (typeof av === 'number' && typeof bv === 'number')
      return dir === 'asc' ? av - bv : bv - av;
    return dir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  }), [filtered, sort, dir]);

  const pages = Math.ceil(sorted.length / PAGE);
  const rows  = sorted.slice((page - 1) * PAGE, page * PAGE);

  function toggleSort(k: SortKey) {
    if (sort === k) setDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSort(k); setDir('desc'); }
    setPage(1);
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sort !== col) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return dir === 'asc'
      ? <ChevronUp   className="w-3 h-3 text-blue-500" />
      : <ChevronDown className="w-3 h-3 text-blue-500" />;
  }

  function Th({ col, label, right }: { col: SortKey; label: string; right?: boolean }) {
    return (
      <th
        onClick={() => toggleSort(col)}
        className={`px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 ${right ? 'text-right' : 'text-left'}`}
      >
        <span className={`inline-flex items-center gap-1 ${right ? 'flex-row-reverse' : ''}`}>
          {label}<SortIcon col={col} />
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
          placeholder="Zoek keywords…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-175">
            <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 sticky top-0">
              <tr>
                <Th col="keyword"     label="Keyword" />
                <Th col="volume"      label="Volume"     right />
                <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Trend</th>
                <Th col="cpc"         label="CPC"        right />
                <Th col="competition" label="Concurrentie" />
                <Th col="position"    label="Positie"    right />
                <Th col="impressions" label="Impressies" right />
                <Th col="clicks"      label="Clicks"     right />
                {showOpp && <Th col="opportunityScore" label="Kans" right />}
                <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((kw, i) => (
                <tr
                  key={kw.id}
                  className={`${
                    i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'
                  } hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors`}
                >
                  <td className="px-3 py-3 font-medium text-gray-900 dark:text-gray-100 max-w-45">
                    <span className="block truncate">{kw.keyword}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {kw.volume.toLocaleString('nl-NL')}
                  </td>
                  <td className="px-3 py-3"><Sparkline data={kw.trend} /></td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    €{kw.cpc.toFixed(2)}
                  </td>
                  <td className="px-3 py-3"><CompBadge level={kw.competition} /></td>
                  <td className="px-3 py-3 text-right"><PosBadge pos={kw.position} /></td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {kw.impressions.toLocaleString('nl-NL')}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {kw.clicks.toLocaleString('nl-NL')}
                  </td>
                  {showOpp && (
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                      {(kw as Opportunity).opportunityScore ?? 0}
                    </td>
                  )}
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                        Track
                      </button>
                      <button className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap">
                        Content
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={showOpp ? 10 : 9}
                    className="px-3 py-10 text-center text-sm text-gray-400 dark:text-gray-500"
                  >
                    Geen keywords gevonden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{filtered.length} keywords</span>
        {pages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 tabular-nums">{page} / {pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Category tag colors ───────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  'long-tail':      'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-400   border border-blue-200   dark:border-blue-800',
  'questions':      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800',
  'commercial':     'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-400  border border-green-200  dark:border-green-800',
  'related-topics': 'bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-400  border border-amber-200  dark:border-amber-800',
  'semantic':       'bg-gray-100   text-gray-700   dark:bg-gray-800      dark:text-gray-300   border border-gray-200   dark:border-gray-700',
};

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'tracker' | 'opportunities' | 'categories';

export default function KeywordsPage() {
  const { domain } = useDomain();
  const [tab, setTab]       = useState<Tab>('tracker');
  const [catFilter, setCatFilter] = useState<Category | null>(null);

  const filteredKw = useMemo(
    () => catFilter ? KEYWORDS.filter(k => k.category === catFilter) : KEYWORDS,
    [catFilter],
  );

  const TABS: [Tab, string][] = [
    ['tracker',       'Keyword Tracker'],
    ['opportunities', 'Kansen'],
    ['categories',    'Categorieën'],
  ];

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Keywords</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {domain} · keyword tracking en kansen
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-gray-200 dark:border-gray-700">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Keyword Tracker */}
      {tab === 'tracker' && (
        <div className="space-y-3">
          {catFilter && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Gefilterd op:&nbsp;
                <span className="font-medium text-gray-900 dark:text-white">{catFilter}</span>
              </span>
              <button
                onClick={() => setCatFilter(null)}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Wis filter
              </button>
            </div>
          )}
          <KwTable data={filteredKw} />
        </div>
      )}

      {/* Opportunities */}
      {tab === 'opportunities' && <KwTable data={OPPORTUNITIES} showOpp />}

      {/* Categories */}
      {tab === 'categories' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Keyword categorieën
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Klik op een categorie om de Keyword Tracker te filteren.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            {CATEGORY_TAGS.map(cat => (
              <button
                key={cat.key}
                onClick={() => { setCatFilter(cat.key); setTab('tracker'); }}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105 active:scale-95 ${TAG_COLORS[cat.key]}`}
              >
                {cat.label} ({cat.count})
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => { setCatFilter(null); setTab('tracker'); }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Bekijk alles →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
