'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Info } from 'lucide-react';

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

const CRAWL_ERRORS = [
  { url: '/products/oude-product-2023', type: '404 Not Found',      status: 'Niet opgelost', discovered: '14 dagen geleden', action: 'Doorverwijzen of verwijderen' },
  { url: '/blog/draft-zonder-content',  type: '500 Server Error',   status: 'Niet opgelost', discovered: '7 dagen geleden',  action: 'Controleer server logs'      },
  { url: '/category/lege-categorie',    type: 'Noindex gevolgd',    status: 'Niet opgelost', discovered: '30 dagen geleden', action: 'Toevoegen aan robots.txt'    },
];

const ERROR_STYLES: Record<string, string> = {
  '404 Not Found':    'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400',
  '500 Server Error': 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400',
  'Noindex gevolgd':  'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-500',
};

type VitalStatus = 'green' | 'amber' | 'red';

interface Vital {
  label: string;
  value: string;
  status: VitalStatus;
  target: string;
}

interface PageSpeed {
  path: string;
  label: string;
  vitals: Vital[];
}

const PAGE_SPEEDS: PageSpeed[] = [
  {
    path: '/', label: 'Homepage',
    vitals: [
      { label: 'LCP', value: '1,8s', status: 'green', target: '< 2,5s' },
      { label: 'FID', value: '45ms', status: 'green', target: '< 100ms' },
      { label: 'CLS', value: '0,05', status: 'green', target: '< 0,1' },
    ],
  },
  {
    path: '/products/lichttherapie-lamp', label: 'Lichttherapie Lamp',
    vitals: [
      { label: 'LCP', value: '2,1s',  status: 'green', target: '< 2,5s' },
      { label: 'FID', value: '78ms',  status: 'green', target: '< 100ms' },
      { label: 'CLS', value: '0,12',  status: 'amber', target: '< 0,1' },
    ],
  },
  {
    path: '/products/wake-up-light', label: 'Wake-up Light',
    vitals: [
      { label: 'LCP', value: '3,2s',  status: 'red',   target: '< 2,5s' },
      { label: 'FID', value: '120ms', status: 'red',   target: '< 100ms' },
      { label: 'CLS', value: '0,08',  status: 'green', target: '< 0,1' },
    ],
  },
  {
    path: '/blog/wat-is-lichttherapie', label: 'Wat is Lichttherapie?',
    vitals: [
      { label: 'LCP', value: '1,5s', status: 'green', target: '< 2,5s' },
      { label: 'FID', value: '32ms', status: 'green', target: '< 100ms' },
      { label: 'CLS', value: '0,03', status: 'green', target: '< 0,1' },
    ],
  },
  {
    path: '/collections/winter-deals', label: 'Winter Deals',
    vitals: [
      { label: 'LCP', value: '2,8s', status: 'amber', target: '< 2,5s' },
      { label: 'FID', value: '95ms', status: 'green', target: '< 100ms' },
      { label: 'CLS', value: '0,15', status: 'red',   target: '< 0,1' },
    ],
  },
  {
    path: '/products/bioptic-lamp', label: 'Bioptic Lamp',
    vitals: [
      { label: 'LCP', value: '4,1s',  status: 'red', target: '< 2,5s' },
      { label: 'FID', value: '200ms', status: 'red', target: '< 100ms' },
      { label: 'CLS', value: '0,22',  status: 'red', target: '< 0,1' },
    ],
  },
];

const NON_INDEXED = [
  { url: '/products/oude-product-2023', reason: 'Redactie verwijderd',      intentional: false },
  { url: '/blog/draft-zonder-content',  reason: 'Noindex tag aanwezig',     intentional: true  },
  { url: '/admin/dashboard',            reason: 'robots.txt geblokkeerd',   intentional: true  },
  { url: '/api/internal',              reason: 'robots.txt geblokkeerd',   intentional: true  },
];

const SCHEMA_PAGES = [
  { path: '/',                           label: 'Homepage',              schemaType: 'Organization + WebSite', status: 'valid',   errors: 0, errorMsg: '' },
  { path: '/products/lichttherapie-lamp', label: 'Lichttherapie Lamp',  schemaType: 'Product',               status: 'valid',   errors: 0, errorMsg: '' },
  { path: '/products/wake-up-light',     label: 'Wake-up Light',        schemaType: 'Product',               status: 'warning', errors: 1, errorMsg: 'price ontbreekt' },
  { path: '/blog/wat-is-lichttherapie', label: 'Wat is Lichttherapie?', schemaType: 'Article',               status: 'valid',   errors: 0, errorMsg: '' },
  { path: '/products/bioptic-lamp',     label: 'Bioptic Lamp',          schemaType: 'Product',               status: 'invalid', errors: 2, errorMsg: 'reviewCount ongeldig, offers ontbreekt' },
];

const SECURITY_ITEMS = [
  { label: 'SSL-certificaat geldig (verloopt: 15 mei 2027)', status: 'pass'    },
  { label: 'HTTPS op alle pagina\'s',                        status: 'pass'    },
  { label: 'HSTS header aanwezig',                           status: 'pass'    },
  { label: 'Geen gemengde content (mixed content)',           status: 'pass'    },
  { label: '3 externe scripts zonder integrity check',        status: 'warning' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const VITAL_STYLES: Record<VitalStatus, string> = {
  green: 'text-green-600 dark:text-green-400',
  amber: 'text-amber-600 dark:text-amber-500',
  red:   'text-red-600 dark:text-red-400',
};

const VITAL_BG: Record<VitalStatus, string> = {
  green: 'bg-green-50 dark:bg-green-950/20',
  amber: 'bg-amber-50 dark:bg-amber-950/20',
  red:   'bg-red-50 dark:bg-red-950/20',
};

const VITAL_ICONS: Record<VitalStatus, React.ReactNode> = {
  green: <CheckCircle   size={12} className="text-green-500 flex-shrink-0" />,
  amber: <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />,
  red:   <XCircle       size={12} className="text-red-500 flex-shrink-0"   />,
};

function SchemaStatusBadge({ status }: { status: string }) {
  if (status === 'valid')   return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">✅ Geldig</span>;
  if (status === 'warning') return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-500">⚠️ Waarschuwing</span>;
  return                           <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400">❌ Ongeldig</span>;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TechnicalSeoPage() {
  const [refreshing, setRefreshing] = useState(false);

  function handleRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1400);
  }

  return (
    <div className="space-y-6">

      {/* Back link */}
      <Link href="/seo" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
        ← Terug naar SEO Overzicht
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Technische SEO</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Gezondheidscheck van je website</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">Gescand: 2 uur geleden</span>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Vernieuwen
          </button>
        </div>
      </div>

      {/* ── Health Score Hero ── */}
      <div
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-6"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          {/* Score */}
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 rounded-full border-8 border-green-500/20 flex items-center justify-center bg-green-50 dark:bg-green-950/20">
                <span className="text-3xl font-extrabold text-green-600 dark:text-green-400 leading-none">78</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white animate-ping" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Gezondheidsscore</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">Goed</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">↑ 12 punten vs vorige maand</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-green-600 dark:text-green-400">Gezond</span>
              </div>
            </div>
          </div>

          {/* Mini metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle size={13} className="text-green-500" />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Geïndexeerd</span>
              </div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">82 / 86</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">pagina&apos;s</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle size={13} className="text-amber-500" />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Waarschuwingen</span>
              </div>
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400">14</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">actief</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <XCircle size={13} className="text-red-500" />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fouten</span>
              </div>
              <p className="text-sm font-bold text-red-600 dark:text-red-400">3</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">kritiek</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Info size={13} className="text-blue-500" />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Info</span>
              </div>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400">7</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">meldingen</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 1: Crawl Errors ── */}
      <div
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Crawl Fouten</h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400">
            {CRAWL_ERRORS.length} fouten
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left font-medium">URL</th>
                <th className="px-4 py-2.5 text-left font-medium">Fouttype</th>
                <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Ontdekt</th>
                <th className="px-4 py-2.5 text-left font-medium">Actie</th>
              </tr>
            </thead>
            <tbody>
              {CRAWL_ERRORS.map(err => (
                <tr key={err.url} className="border-b border-gray-50 dark:border-gray-800/50 border-l-4 border-l-red-500">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900 dark:text-gray-100 max-w-[200px] truncate block">{err.url}</span>
                    <span className="text-gray-400 dark:text-gray-600 mt-0.5 block">{err.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ERROR_STYLES[err.type] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                      {err.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-600 hidden sm:table-cell whitespace-nowrap">{err.discovered}</td>
                  <td className="px-4 py-3">
                    <button className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium text-left">
                      {err.action}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 2: Page Speed ── */}
      <div
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Page Speed Insights</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Core Web Vitals per pagina — LCP, FID, CLS</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PAGE_SPEEDS.map(pg => {
            const allGreen = pg.vitals.every(v => v.status === 'green');
            const hasRed   = pg.vitals.some(v => v.status === 'red');
            const overallStatus = hasRed ? 'red' : allGreen ? 'green' : 'amber';
            return (
              <div
                key={pg.path}
                className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-4"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">{pg.label}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5 truncate">{pg.path}</p>
                  </div>
                  {overallStatus === 'green'
                    ? <CheckCircle   size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                    : overallStatus === 'amber'
                    ? <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    : <XCircle       size={16} className="text-red-500 flex-shrink-0 mt-0.5"   />
                  }
                </div>
                <div className="space-y-2">
                  {pg.vitals.map(v => (
                    <div key={v.label} className={`flex items-center justify-between px-2.5 py-1.5 rounded-md ${VITAL_BG[v.status]}`}>
                      <div className="flex items-center gap-1.5">
                        {VITAL_ICONS[v.status]}
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{v.label}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-600">{v.target}</span>
                      </div>
                      <span className={`text-xs font-bold tabular-nums ${VITAL_STYLES[v.status]}`}>{v.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 3: Indexation ── */}
      <div
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle size={18} className="text-green-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Indexatie Status</h2>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-gray-700 dark:text-gray-300">82 van 86 pagina&apos;s geïndexeerd</span>
            <span className="text-gray-400 dark:text-gray-500">95,3%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-green-500" style={{ width: '95.3%' }} />
          </div>
        </div>

        {/* Non-indexed pages */}
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Niet-geïndexeerde pagina&apos;s ({NON_INDEXED.length})
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <th className="px-2 py-2 text-left font-medium">URL</th>
                <th className="px-2 py-2 text-left font-medium">Reden</th>
                <th className="px-2 py-2 text-center font-medium hidden sm:table-cell">Opzettelijk</th>
              </tr>
            </thead>
            <tbody>
              {NON_INDEXED.map(pg => (
                <tr key={pg.url} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="px-2 py-2.5 font-mono text-gray-700 dark:text-gray-300 max-w-[200px] truncate">{pg.url}</td>
                  <td className="px-2 py-2.5 text-gray-500 dark:text-gray-400">{pg.reason}</td>
                  <td className="px-2 py-2.5 text-center hidden sm:table-cell">
                    {pg.intentional
                      ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">Ja</span>
                      : <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">Probleem</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 4: Structured Data ── */}
      <div
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
      >
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Structured Data Validatie</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Schema.org markup per pagina</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left font-medium">Pagina</th>
                <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Schema Type</th>
                <th className="px-4 py-2.5 text-center font-medium">Status</th>
                <th className="px-4 py-2.5 text-center font-medium">Fouten</th>
                <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Details</th>
              </tr>
            </thead>
            <tbody>
              {SCHEMA_PAGES.map(pg => (
                <tr key={pg.path} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100 max-w-[160px] truncate">{pg.label}</div>
                    <div className="text-gray-400 dark:text-gray-600 mt-0.5 max-w-[160px] truncate">{pg.path}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      {pg.schemaType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center"><SchemaStatusBadge status={pg.status} /></td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {pg.errors === 0
                      ? <span className="text-green-500">0</span>
                      : <span className={pg.status === 'invalid' ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-amber-500 dark:text-amber-400 font-semibold'}>{pg.errors}</span>
                    }
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-400 dark:text-gray-600">
                    {pg.errorMsg || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 5: Security ── */}
      <div
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">HTTPS &amp; Beveiliging</h2>
        <div className="space-y-2.5">
          {SECURITY_ITEMS.map(item => (
            <div key={item.label} className="flex items-center gap-2.5">
              {item.status === 'pass'
                ? <CheckCircle   size={16} className="text-green-500 flex-shrink-0" />
                : <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
              }
              <span className={`text-sm ${item.status === 'pass' ? 'text-gray-700 dark:text-gray-300' : 'text-amber-700 dark:text-amber-400'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-1.5">
          <CheckCircle size={13} className="text-green-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">4 van 5 beveiligingschecks geslaagd</span>
        </div>
      </div>

    </div>
  );
}
