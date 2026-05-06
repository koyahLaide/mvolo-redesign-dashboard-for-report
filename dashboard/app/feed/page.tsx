'use client';

import { useEffect, useState, useCallback } from 'react';

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v ?? 0);
}

function TitleScoreBadge({ score }: { score: string }) {
  const map: Record<string, string> = {
    Great: 'text-green-500 dark:text-green-400',
    Average: 'text-yellow-500 dark:text-yellow-400',
    Poor: 'text-red-500 dark:text-red-400',
    'Too Long': 'text-gray-500 dark:text-gray-400',
  };
  const dots: Record<string, string> = {
    Great: 'bg-green-500',
    Average: 'bg-yellow-500',
    Poor: 'bg-red-500',
    'Too Long': 'bg-gray-500',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${map[score] ?? 'text-gray-500 dark:text-gray-400'}`}>
      <span className={`w-2 h-2 rounded-full ${dots[score] ?? 'bg-gray-500'}`} />
      {score}
    </span>
  );
}

function LabelBadge({ label }: { label: string }) {
  const map: Record<string, string> = {
    Heroes: 'bg-blue-100 text-blue-700 dark:bg-blue-600 dark:text-white',
    Villains: 'bg-red-100 text-red-700 dark:bg-red-600 dark:text-white',
    Sidekicks: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500 dark:text-white',
    Zombies: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${map[label] ?? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
      {label}
    </span>
  );
}

function GMCStatusBadge({ status }: { status: string }) {
  if (status === 'approved') return <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><span className="w-2 h-2 rounded-full bg-green-500" />Goedgekeurd</span>;
  if (status === 'limited') return <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400"><span className="w-2 h-2 rounded-full bg-yellow-500" />Beperkt</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400"><span className="w-2 h-2 rounded-full bg-red-500" />Afgekeurd</span>;
}

function GMCFixPanel({ issues, onClose }: { issues: any[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">GMC problemen & oplossingen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">&times;</button>
        </div>
        {issues.map((issue: any, i: number) => (
          <div key={i} className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">{issue.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{issue.type}</p>
              </div>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                issue.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' :
                issue.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400' :
                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {issue.priority === 'high' ? 'Urgent' : issue.priority === 'medium' ? 'Middel' : 'Laag'}
              </span>
            </div>
            <div className="border-l-2 border-indigo-500/40 pl-3">
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{issue.fix}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TitleEditor({ product, onClose, onSave }: { product: any; onClose: () => void; onSave: (id: string, title: string) => void }) {
  const [title, setTitle] = useState(product.title ?? '');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const score = title.length > 150 ? 'Too Long' : title.length < 20 ? 'Poor' : title.length >= 70 && /lamp|therapie|therapy|mask|licht|light|infrarood|infrared|led|panel|sauna/i.test(title) && /mvolo/i.test(title) ? 'Great' : title.length >= 40 ? 'Average' : 'Poor';
  const barColor = title.length > 150 ? 'bg-red-500' : title.length > 100 ? 'bg-green-500' : title.length > 50 ? 'bg-yellow-500' : 'bg-red-500';

  async function generateAI() {
    setAiLoading(true);
    try {
      const res = await fetch('/api/feed/ai-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product }),
      });
      const data = await res.json();
      if (data.suggestions) setSuggestions(data.suggestions);
    } catch {
      setSuggestions(['Kon AI-suggesties niet laden. Controleer de API configuratie.']);
    }
    setAiLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl max-w-2xl w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Titel bewerken</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">#{product.id}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Titel</label>
            <TitleScoreBadge score={score} />
          </div>
          <textarea
            value={title}
            onChange={e => setTitle(e.target.value)}
            rows={3}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <div className="flex items-center justify-between">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mr-3">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, (title.length / 150) * 100)}%` }} />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{title.length} / 150</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI suggesties</label>
            <button onClick={generateAI} disabled={aiLoading}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 disabled:opacity-50 transition-colors">
              {aiLoading ? 'Genereren...' : 'Genereer met Claude'}
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => setTitle(s)}
                  className="w-full text-left text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 hover:border-indigo-500/50 rounded-xl px-4 py-3 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}
          {suggestions.length === 0 && !aiLoading && (
            <p className="text-xs text-gray-500 dark:text-gray-500">Klik op &quot;Genereer met Claude&quot; voor AI-geoptimaliseerde titelopties.</p>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
            Annuleren
          </button>
          <button
            onClick={() => { onSave(product.id, title); onClose(); }}
            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors">
            Titel opslaan
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fallback mock data for when API is not available ────────────────────────

const mockProducts = [
  {
    id: 'TDP-001', sku: 'TDP-001', title: 'TDP Moxa Lamp - Infrarood Therapie voor Pijnverlichting en Spijsvertering',
    clicks: 113, cost: 122, conversions: 4, conv_value: 796, roas: 651,
    titleScore: 'Great', gmcStatus: 'approved', label: 'Heroes',
    gmcIssues: [], feedScore: 80,
    feedIssues: ['Geen productafbeelding'],
  },
  {
    id: 'INF-002', sku: 'INF-002', title: 'Dubbele Infraroodlamp - Roodlicht Therapie voor Spierherstel',
    clicks: 93, cost: 89, conversions: 4, conv_value: 739, roas: 835,
    titleScore: 'Average', gmcStatus: 'approved', label: 'Heroes',
    gmcIssues: [], feedScore: 60,
    feedIssues: ['Geen productafbeelding', 'Beschrijving te kort of ontbreekt'],
  },
  {
    id: 'LED-003', sku: 'LED-003', title: 'LED Gezichtsmasker',
    clicks: 288, cost: 297, conversions: 2, conv_value: 268, roas: 90,
    titleScore: 'Average', gmcStatus: 'limited', label: 'Villains',
    gmcIssues: [
      { description: 'Ontbrekende GTIN [gtin]', type: 'gtin', priority: 'high', fix: 'Voeg barcode/EAN toe aan het product in Shopify onder Inventory > Barcode.' },
    ],
    feedScore: 40,
    feedIssues: ['Ontbrekende of ongeldige GTIN/barcode', 'Geen productafbeelding', 'Beschrijving te kort of ontbreekt'],
  },
  {
    id: 'RLT-004', sku: 'RLT-004', title: 'Mvolo Roodlicht',
    clicks: 266, cost: 216, conversions: 3, conv_value: 41, roas: 19,
    titleScore: 'Poor', gmcStatus: 'approved', label: 'Villains',
    gmcIssues: [], feedScore: 60,
    feedIssues: ['Geen productafbeelding', 'Beschrijving te kort of ontbreekt'],
  },
  {
    id: 'ELT-005', sku: 'ELT-005', title: 'Elite Series 306 Roodlicht Paneel',
    clicks: 0, cost: 0, conversions: 0, conv_value: 0, roas: 0,
    titleScore: 'Average', gmcStatus: 'approved', label: 'Zombies',
    gmcIssues: [], feedScore: 60,
    feedIssues: ['Geen productafbeelding', 'Beschrijving te kort of ontbreekt'],
  },
  {
    id: 'ELT-006', sku: 'ELT-006', title: 'Elite series 506 Red Light Therapy Lamp Panel',
    clicks: 0, cost: 0, conversions: 0, conv_value: 0, roas: 0,
    titleScore: 'Average', gmcStatus: 'disapproved', label: 'Zombies',
    gmcIssues: [
      { description: 'Ontbrekende GTIN [gtin]', type: 'gtin', priority: 'high', fix: 'Voeg barcode/EAN toe aan het product in Shopify onder Inventory > Barcode.' },
    ],
    feedScore: 40,
    feedIssues: ['Ontbrekende of ongeldige GTIN/barcode', 'Geen productafbeelding', 'Beschrijving te kort of ontbreekt', 'Product afgewezen door GMC'],
  },
  {
    id: 'INF-007', sku: 'INF-007', title: 'Enkele kop Infraroodlamp Red Therapy Behandeling',
    clicks: 0, cost: 0, conversions: 0, conv_value: 0, roas: 0,
    titleScore: 'Average', gmcStatus: 'disapproved', label: 'Zombies',
    gmcIssues: [
      { description: 'Prijsmismatch gedetecteerd [price]', type: 'price', priority: 'high', fix: 'Controleer of Shopify prijs overeenkomt met de prijs op de landingspagina. Verberg geen prijzen achter apps.' },
    ],
    feedScore: 40,
    feedIssues: ['Ontbrekende of ongeldige GTIN/barcode', 'Geen productafbeelding', 'Beschrijving te kort of ontbreekt', 'Product afgewezen door GMC'],
  },
  {
    id: 'ELT-008', sku: 'ELT-008', title: 'Elite Series 206 Red Light Therapy Infrared Light Panel',
    clicks: 0, cost: 0, conversions: 0, conv_value: 0, roas: 0,
    titleScore: 'Average', gmcStatus: 'disapproved', label: 'Zombies',
    gmcIssues: [
      { description: 'Niet-overeenkomende domeinen [link]', type: 'link', priority: 'high', fix: 'Claim mgrproduct.nl in GMC via Website > Claimen. Zorg dat de feed-URL overeenkomt met het gclaimde domein.' },
    ],
    feedScore: 40,
    feedIssues: ['Ontbrekende of ongeldige GTIN/barcode', 'Geen productafbeelding', 'Beschrijving te kort of ontbreekt', 'Product afgewezen door GMC'],
  },
];

const mockStats = {
  totalProducts: 8,
  feedCoverageScore: 50,
  disapproved: 3,
  limited: 1,
  titlePoor: 1,
  missingGtin: 3,
  heroes: 2,
  villains: 2,
  sidekicks: 0,
  zombies: 4,
  heroesConvValue: 1535,
  villainsCost: 513,
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function FeedPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [tab, setTab] = useState<'producten' | 'gmc' | 'health' | 'labels'>('producten');
  const [gmcPanel, setGmcPanel] = useState<any[] | null>(null);
  const [titleEditor, setTitleEditor] = useState<any | null>(null);
  const [savedTitles, setSavedTitles] = useState<Record<string, string>>({});
  const [marketFilter, setMarketFilter] = useState<string>('NL');
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const [gmcFilter, setGmcFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setApiError(false);
    try {
      const res = await fetch('/api/feed');
      if (!res.ok) throw new Error('API error');
      const json = await res.json();
      if (json?.products && json.products.length > 0) {
        setData(json);
      } else {
        setApiError(true);
      }
    } catch {
      setApiError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const products = ((apiError ? mockProducts : data?.products ?? [])).map((p: any) => ({
    ...p,
    title: savedTitles[p.id] ?? p.title,
  }));

  const stats = apiError ? mockStats : (data?.stats ?? {});
  const gmcConnected = apiError ? false : (data?.gmcConnected ?? true);

  const filteredProducts = products.filter((p: any) => {
    if (labelFilter !== 'all' && p.label !== labelFilter) return false;
    if (gmcFilter !== 'all' && p.gmcStatus !== gmcFilter) return false;
    return true;
  });

  const disapprovedProducts = products.filter((p: any) => p.gmcStatus === 'disapproved' || p.gmcStatus === 'limited');

  return (
    <div className="space-y-6">
      {gmcPanel && <GMCFixPanel issues={gmcPanel} onClose={() => setGmcPanel(null)} />}
      {titleEditor && (
        <TitleEditor
          product={titleEditor}
          onClose={() => setTitleEditor(null)}
          onSave={(id, title) => setSavedTitles(prev => ({ ...prev, [id]: title }))}
        />
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Feed Suite</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {stats.totalProducts ?? 0} producten &mdash; GMC
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            Demo modus
          </span>
        </div>
      </div>

      {/* GMC alert banner */}
      {!loading && disapprovedProducts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl px-5 py-4 space-y-2">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">
            {disapprovedProducts.length} producten hebben GMC problemen
          </p>
          {disapprovedProducts.slice(0, 3).map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-gray-700 dark:text-gray-300 truncate max-w-lg">{p.title?.substring(0, 60)}...</span>
              <button onClick={() => p.gmcIssues?.length > 0 && setGmcPanel(p.gmcIssues)}
                className="shrink-0 ml-4 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition-colors">
                Oplossen &rarr;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* KPI strip */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Feed coverage</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.feedCoverageScore}%</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Afgekeurd GMC</p>
            <p className="text-2xl font-bold text-red-500 dark:text-red-400 mt-1">{stats.disapproved}</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/20 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Beperkt zichtbaar</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{stats.limited}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Titel Poor</p>
            <p className="text-2xl font-bold text-red-500 dark:text-red-400 mt-1">{stats.titlePoor}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">van {stats.totalProducts}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Ontbrekende GTIN</p>
            <p className="text-2xl font-bold text-orange-500 dark:text-orange-400 mt-1">{stats.missingGtin}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/20 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Heroes</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.heroes}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{stats.totalProducts > 0 ? Math.round((stats.heroes / stats.totalProducts) * 100) : 0}% van feed</p>
          </div>
        </div>
      )}

      {/* Label performance summary */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => setLabelFilter(labelFilter === 'Heroes' ? 'all' : 'Heroes')}
            className={`text-left rounded-xl px-4 py-4 transition-colors ${labelFilter === 'Heroes'
              ? 'bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-400 dark:border-blue-500'
              : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}>
            <div className="flex items-center justify-between mb-2">
              <LabelBadge label="Heroes" />
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.heroes}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Hoge ROAS, top converters</p>
            {stats.heroesConvValue != null && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Omzet: {formatEuro(stats.heroesConvValue)}</p>
            )}
          </button>
          <button
            onClick={() => setLabelFilter(labelFilter === 'Villains' ? 'all' : 'Villains')}
            className={`text-left rounded-xl px-4 py-4 transition-colors ${labelFilter === 'Villains'
              ? 'bg-red-50 dark:bg-red-950/30 border-2 border-red-400 dark:border-red-500'
              : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}>
            <div className="flex items-center justify-between mb-2">
              <LabelBadge label="Villains" />
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.villains}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Hoog budget, lage ROAS</p>
            {stats.villainsCost != null && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Spend: {formatEuro(stats.villainsCost)}</p>
            )}
          </button>
          <button
            onClick={() => setLabelFilter(labelFilter === 'Sidekicks' ? 'all' : 'Sidekicks')}
            className={`text-left rounded-xl px-4 py-4 transition-colors ${labelFilter === 'Sidekicks'
              ? 'bg-yellow-50 dark:bg-yellow-950/30 border-2 border-yellow-400 dark:border-yellow-500'
              : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}>
            <div className="flex items-center justify-between mb-2">
              <LabelBadge label="Sidekicks" />
              <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.sidekicks}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Weinig clicks, laag budget</p>
          </button>
          <button
            onClick={() => setLabelFilter(labelFilter === 'Zombies' ? 'all' : 'Zombies')}
            className={`text-left rounded-xl px-4 py-4 transition-colors ${labelFilter === 'Zombies'
              ? 'bg-gray-100 dark:bg-gray-800/60 border-2 border-gray-400 dark:border-gray-500'
              : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}>
            <div className="flex items-center justify-between mb-2">
              <LabelBadge label="Zombies" />
              <span className="text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.zombies}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Geen clicks, geen spend</p>
          </button>
        </div>
      )}

      {/* Tab nav */}
      <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1 w-fit">
        {([
          ['producten', 'Producten'],
          ['gmc', 'GMC problemen'],
          ['health', 'Feed health'],
          ['labels', 'Label analyse'],
        ] as const).map(([key, lbl]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key
              ? 'bg-indigo-600 text-white'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
            {lbl}
            {key === 'gmc' && stats.disapproved > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{stats.disapproved}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      {tab === 'producten' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 dark:text-gray-400">Label:</span>
          {['all', 'Heroes', 'Villains', 'Sidekicks', 'Zombies'].map(l => (
            <button key={l} onClick={() => setLabelFilter(l)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${labelFilter === l
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
              {l === 'all' ? 'Alle labels' : l}
            </button>
          ))}
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-3">GMC:</span>
          {['all', 'approved', 'limited', 'disapproved'].map(g => (
            <button key={g} onClick={() => setGmcFilter(g)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${gmcFilter === g
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
              {g === 'all' ? 'Alles' : g === 'approved' ? 'Goedgekeurd' : g === 'limited' ? 'Beperkt' : 'Afgekeurd'}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400 animate-pulse">Feed laden...</div>
      ) : (
        <>
          {/* PRODUCTEN TAB */}
          {tab === 'producten' && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Product</th>
                      <th className="px-4 py-3 text-right">Clicks</th>
                      <th className="px-4 py-3 text-right">Kosten</th>
                      <th className="px-4 py-3 text-right">Conv.</th>
                      <th className="px-4 py-3 text-right">Omzet</th>
                      <th className="px-4 py-3 text-right">ROAS</th>
                      <th className="px-4 py-3 text-center">Titel</th>
                      <th className="px-4 py-3 text-center">GMC</th>
                      <th className="px-4 py-3 text-center">Label</th>
                      <th className="px-4 py-3 text-center">Acties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p: any) => (
                      <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 max-w-xs">
                          <p className="text-gray-900 dark:text-gray-200 truncate font-medium" title={p.title}>{p.title?.substring(0, 45)}{p.title?.length > 45 ? '...' : ''}</p>
                          <p className="text-gray-500 dark:text-gray-500 mt-0.5">{p.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{p.clicks ?? 0}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatEuro(p.cost ?? 0)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{p.conversions ?? 0}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white font-semibold">{formatEuro(p.conv_value ?? 0)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={p.roas >= 400 ? 'text-green-600 dark:text-green-400' : p.roas >= 100 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}>
                            {p.roas ?? 0}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => setTitleEditor(p)} className="hover:opacity-75 transition-opacity">
                            <TitleScoreBadge score={p.titleScore} />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.gmcIssues?.length > 0 ? (
                            <button onClick={() => setGmcPanel(p.gmcIssues)} className="hover:opacity-75 transition-opacity">
                              <GMCStatusBadge status={p.gmcStatus} />
                            </button>
                          ) : (
                            <GMCStatusBadge status={p.gmcStatus} />
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <LabelBadge label={p.label} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setTitleEditor(p)}
                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-xs transition-colors font-medium">
                              Titel
                            </button>
                            {p.gmcIssues?.length > 0 && (
                              <button onClick={() => setGmcPanel(p.gmcIssues)}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs transition-colors font-medium">
                                Fix
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* GMC TAB */}
          {tab === 'gmc' && (
            <div className="space-y-3">
              {disapprovedProducts.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-12 text-center">
                  <p className="text-green-600 dark:text-green-400 text-lg mb-2">Geen GMC problemen gevonden</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Alle producten zijn goedgekeurd in Google Merchant Center.</p>
                </div>
              ) : (
                disapprovedProducts.map((p: any) => (
                  <div key={p.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">{p.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">SKU: {p.sku} &middot; {p.id}</p>
                      </div>
                      <GMCStatusBadge status={p.gmcStatus} />
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      {p.gmcIssues.map((issue: any, i: number) => (
                        <div key={i} className="flex gap-4">
                          <div className="shrink-0 mt-0.5">
                            <span className={`inline-block w-2 h-2 rounded-full mt-1 ${issue.priority === 'high' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-xs font-semibold text-red-600 dark:text-red-400">{issue.description}</p>
                            <div className="flex items-start gap-2">
                              <span className="text-indigo-600 dark:text-indigo-400 text-xs shrink-0">Oplossing:</span>
                              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{issue.fix}</p>
                            </div>
                          </div>
                          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium h-fit ${
                            issue.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
                          }`}>
                            {issue.priority === 'high' ? 'Urgent' : 'Middel'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
              {!gmcConnected && (
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/30 rounded-xl px-5 py-4">
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 font-semibold">Demo modus &mdash; GMC niet verbonden</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Voeg GMC_CLIENT_ID, GMC_CLIENT_SECRET, GMC_REFRESH_TOKEN en GMC_MERCHANT_ID toe als GitHub Secrets voor live data.</p>
                </div>
              )}
            </div>
          )}

          {/* HEALTH TAB */}
          {tab === 'health' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Gemiddelde feed score</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {products.length > 0 ? Math.round(products.reduce((s: number, p: any) => s + p.feedScore, 0) / products.length) : 0}
                    <span className="text-sm text-gray-500 dark:text-gray-400">/100</span>
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Producten zonder problemen</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                    {products.filter((p: any) => p.feedIssues.length === 0).length}
                    <span className="text-sm text-gray-500 dark:text-gray-400"> / {products.length}</span>
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Totale feed issues</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                    {products.reduce((s: number, p: any) => s + p.feedIssues.length, 0)}
                  </p>
                </div>
              </div>

              {products.filter((p: any) => p.feedIssues.length > 0).map((p: any) => (
                <div key={p.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">{p.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{p.sku}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${p.feedScore >= 75 ? 'bg-green-500' : p.feedScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${p.feedScore}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{p.feedScore}/100</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {p.feedIssues.map((issue: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-orange-500 dark:text-orange-400">&#9888;</span>
                        <span className="text-gray-600 dark:text-gray-400">{issue}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* LABELS TAB */}
          {tab === 'labels' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <LabelBadge label="Heroes" />
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{products.filter((p: any) => p.label === 'Heroes').length}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">ROAS &ge; 400% en meer dan 20 clicks. Verhoog budget voor deze producten.</p>
                  <div className="space-y-2">
                    {products.filter((p: any) => p.label === 'Heroes').slice(0, 4).map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300 truncate max-w-xs">{p.title?.substring(0, 35)}...</span>
                        <span className={`tabular-nums font-medium ${p.roas >= 400 ? 'text-green-600 dark:text-green-400' : p.roas >= 100 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                          {p.roas ?? 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <LabelBadge label="Villains" />
                    <span className="text-2xl font-bold text-red-600 dark:text-red-400">{products.filter((p: any) => p.label === 'Villains').length}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">ROAS &lt; 100% met meer dan &euro;50 spend. Optimaliseer of pauzeer.</p>
                  <div className="space-y-2">
                    {products.filter((p: any) => p.label === 'Villains').slice(0, 4).map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300 truncate max-w-xs">{p.title?.substring(0, 35)}...</span>
                        <span className={`tabular-nums font-medium ${p.roas >= 400 ? 'text-green-600 dark:text-green-400' : p.roas >= 100 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                          {p.roas ?? 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/30 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <LabelBadge label="Sidekicks" />
                    <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{products.filter((p: any) => p.label === 'Sidekicks').length}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Weinig clicks maar laag budget. Test met hogere biedingen.</p>
                  {products.filter((p: any) => p.label === 'Sidekicks').length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">Geen producten in deze categorie.</p>
                  )}
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <LabelBadge label="Zombies" />
                    <span className="text-2xl font-bold text-gray-600 dark:text-gray-400">{products.filter((p: any) => p.label === 'Zombies').length}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Geen clicks of spend. Controleer feed health en GMC status.</p>
                  <div className="space-y-2">
                    {products.filter((p: any) => p.label === 'Zombies').slice(0, 4).map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400 truncate max-w-xs">{p.title?.substring(0, 35)}...</span>
                        <span className="tabular-nums font-medium text-gray-500 dark:text-gray-500">
                          {p.roas ?? 0}%
                        </span>
                      </div>
                    ))}
                    {products.filter((p: any) => p.label === 'Zombies').length > 4 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">+{products.filter((p: any) => p.label === 'Zombies').length - 4} meer</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Title status overzicht */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-4">Titel status overzicht</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { score: 'Poor', color: 'text-red-500 dark:text-red-400', barBg: 'bg-red-500', count: products.filter((p: any) => p.titleScore === 'Poor').length },
                    { score: 'Average', color: 'text-yellow-500 dark:text-yellow-400', barBg: 'bg-yellow-500', count: products.filter((p: any) => p.titleScore === 'Average').length },
                    { score: 'Great', color: 'text-green-500 dark:text-green-400', barBg: 'bg-green-500', count: products.filter((p: any) => p.titleScore === 'Great').length },
                    { score: 'Too Long', color: 'text-gray-500 dark:text-gray-400', barBg: 'bg-gray-500', count: products.filter((p: any) => p.titleScore === 'Too Long').length },
                  ].map(({ score, color, barBg, count }) => (
                    <div key={score} className="text-center">
                      <TitleScoreBadge score={score} />
                      <p className={`text-3xl font-bold ${color} mt-2`}>{count}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{products.length > 0 ? Math.round((count / products.length) * 100) : 0}%</p>
                      <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full ${barBg} rounded-full`} style={{ width: `${products.length > 0 ? (count / products.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
