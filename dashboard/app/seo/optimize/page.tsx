'use client';

import { Zap, CheckCircle, AlertTriangle, XCircle, ArrowUpRight } from 'lucide-react';

const OPPORTUNITIES = [
  { page: 'Homepage',                      issue: 'Title tag te lang (72 tekens)',               impact: 'High',   status: 'Open',  fix: 'Verkort title tot max. 60 tekens' },
  { page: 'Lichttherapie Lamp 10.000 Lux', issue: 'Meta description ontbreekt',                  impact: 'High',   status: 'Open',  fix: 'Voeg meta description toe (120–155 tekens)' },
  { page: 'Blog: Wat is Lichttherapie?',   issue: 'Geen interne links naar productpagina\'s',    impact: 'Medium', status: 'Open',  fix: 'Voeg 2–3 contextrelevante interne links toe' },
  { page: 'SAD Lamp',                      issue: 'H1 bevat geen primair keyword',               impact: 'High',   status: 'Fixed', fix: 'H1 aangepast met keyword "SAD lamp kopen"' },
  { page: 'Collectie: Lichttherapie',      issue: 'Weinig tekst op categoriepagina (<80 woorden)', impact: 'Medium', status: 'Open', fix: 'Voeg minimaal 150 woorden categorietekst toe' },
  { page: 'Blog: Winterdepressie',         issue: 'Alt-tekst ontbreekt op 4 afbeeldingen',       impact: 'Medium', status: 'Open',  fix: 'Voeg beschrijvende alt-tekst toe per afbeelding' },
  { page: 'Wake-up Light',                 issue: 'Laadtijd pagina > 3s (LCP: 3.8s)',            impact: 'High',   status: 'Open',  fix: 'Optimaliseer hero-afbeelding, gebruik WebP' },
  { page: 'Winter Deals',                  issue: 'Duplicate title met Homepage',                 impact: 'High',   status: 'Fixed', fix: 'Unieke title toegevoegd voor Winter Deals' },
  { page: 'Blog: Bijwerkingen',            issue: 'Geen canonical tag',                          impact: 'Low',    status: 'Open',  fix: 'Voeg self-referencing canonical tag toe' },
  { page: 'Bureau Daglichtlamp',           issue: 'Schema markup ontbreekt (Product)',            impact: 'Medium', status: 'Open',  fix: 'Voeg Product structured data toe (prijs, beschikbaarheid)' },
  { page: 'Blog: Lichttherapie & Slaap',   issue: 'Keyword density te laag (<0.5%)',              impact: 'Low',    status: 'Open',  fix: 'Verwerk primair keyword 3–4x naturlijk in tekst' },
  { page: 'Over Mvolo',                    issue: 'Ontbrekende breadcrumb structured data',       impact: 'Low',    status: 'Fixed', fix: 'Breadcrumb JSON-LD toegevoegd' },
];

const IMPACT_STYLES: Record<string, string> = {
  High:   'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-400',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Low:    'bg-gray-100  text-gray-600  dark:bg-gray-800     dark:text-gray-400',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  Open:  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
  Fixed: <CheckCircle   className="w-3.5 h-3.5 text-green-500 shrink-0" />,
};

export default function OptimaliseerPage() {
  const open  = OPPORTUNITIES.filter(o => o.status === 'Open').length;
  const fixed = OPPORTUNITIES.filter(o => o.status === 'Fixed').length;
  const high  = OPPORTUNITIES.filter(o => o.impact === 'High' && o.status === 'Open').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Optimaliseer</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">On-page SEO verbeterpunten en quick wins</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Open issues',   value: open,  color: '#f59e0b', icon: AlertTriangle },
          { label: 'High impact',   value: high,  color: '#ef4444', icon: XCircle       },
          { label: 'Opgelost',      value: fixed, color: '#22c55e', icon: CheckCircle   },
        ].map(({ label, value, color, icon: Icon }) => (
          <div
            key={label}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} style={{ color }} />
              <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Verbeterpunten</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{OPPORTUNITIES.length} items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Pagina</th>
                <th className="px-4 py-2.5 text-left font-medium">Issue</th>
                <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Impact</th>
                <th className="px-4 py-2.5 text-left font-medium hidden lg:table-cell">Aanbeveling</th>
              </tr>
            </thead>
            <tbody>
              {OPPORTUNITIES.map((o, i) => (
                <tr key={i} className={`border-b border-gray-50 dark:border-gray-800/50 transition-colors ${o.status === 'Fixed' ? 'opacity-50' : 'hover:bg-gray-50 dark:hover:bg-gray-800/20'}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {STATUS_ICON[o.status]}
                      <span className={o.status === 'Fixed' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                        {o.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200 max-w-[140px]">
                    <span className="block truncate">{o.page}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 max-w-[200px]">
                    <span className="block truncate">{o.issue}</span>
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${IMPACT_STYLES[o.impact]}`}>
                      {o.impact}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-gray-500 dark:text-gray-400 max-w-[220px]">
                    <span className="block truncate">{o.fix}</span>
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
