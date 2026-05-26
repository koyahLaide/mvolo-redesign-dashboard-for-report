'use client';

import { useEffect, useState, useCallback } from 'react';
import Nav from '../components/Nav';

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v ?? 0);
}

function TitleScoreBadge({ score }: { score: string }) {
  const map: Record<string, string> = {
    Great: 'text-green-400',
    Average: 'text-yellow-400',
    Poor: 'text-red-400',
    'Too Long': 'text-gray-400',
  };
  const dots: Record<string, string> = {
    Great: 'bg-green-400',
    Average: 'bg-yellow-400',
    Poor: 'bg-red-400',
    'Too Long': 'bg-gray-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${map[score] ?? 'text-gray-400'}`}>
      <span className={`w-2 h-2 rounded-full ${dots[score] ?? 'bg-gray-400'}`} />
      {score}
    </span>
  );
}

function LabelBadge({ label }: { label: string }) {
  const map: Record<string, string> = {
    Heroes: 'bg-blue-600 text-white',
    Villains: 'bg-red-600 text-white',
    Sidekicks: 'bg-yellow-500 text-white',
    Zombies: 'bg-gray-700 text-gray-300',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${map[label] ?? 'bg-gray-700 text-gray-300'}`}>
      {label}
    </span>
  );
}

function GMCStatusBadge({ status }: { status: string }) {
  if (status === 'approved') return <span className="inline-flex items-center gap-1 text-xs text-green-400"><span className="w-2 h-2 rounded-full bg-green-400" />Goedgekeurd</span>;
  if (status === 'limited') return <span className="inline-flex items-center gap-1 text-xs text-yellow-400"><span className="w-2 h-2 rounded-full bg-yellow-400" />Beperkt</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-red-400"><span className="w-2 h-2 rounded-full bg-red-400" />Afgekeurd</span>;
}

function GMCFixPanel({ issues, onClose }: { issues: any[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">GMC problemen & oplossingen</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
        </div>
        {issues.map((issue: any, i: number) => (
          <div key={i} className="bg-gray-800/60 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-red-400">{issue.description}</p>
                <p className="text-xs text-gray-500 mt-0.5">{issue.type}</p>
              </div>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                issue.priority === 'high' ? 'bg-red-900/50 text-red-400' :
                issue.priority === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                'bg-gray-800 text-gray-400'
              }`}>
                {issue.priority === 'high' ? 'Urgent' : issue.priority === 'medium' ? 'Middel' : 'Laag'}
              </span>
            </div>
            <div className="border-l-2 border-indigo-500/40 pl-3">
              <p className="text-xs text-gray-300 leading-relaxed">💡 {issue.fix}</p>
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
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Titel bewerken</h3>
            <p className="text-xs text-gray-500 mt-0.5">#{product.id}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">×</button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Titel</label>
            <TitleScoreBadge score={score} />
          </div>
          <textarea
            value={title}
            onChange={e => setTitle(e.target.value)}
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white resize-none focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <div className="flex items-center justify-between">
            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden mr-3">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, (title.length / 150) * 100)}%` }} />
            </div>
            <span className="text-xs text-gray-500 tabular-nums">{title.length} / 150</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400 uppercase tracking-wider">AI suggesties</label>
            <button onClick={generateAI} disabled={aiLoading}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors">
              {aiLoading ? 'Genereren…' : '✦ Genereer met Claude'}
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => setTitle(s)}
                  className="w-full text-left text-xs text-gray-300 bg-gray-800/60 border border-gray-700 hover:border-indigo-500/50 rounded-xl px-4 py-3 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}
          {suggestions.length === 0 && !aiLoading && (
            <p className="text-xs text-gray-600">Klik op "Genereer met Claude" voor AI-geoptimaliseerde titelopties.</p>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
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

export default function FeedPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'producten' | 'gmc' | 'health' | 'labels'>('producten');
  const [gmcPanel, setGmcPanel] = useState<any[] | null>(null);
  const [titleEditor, setTitleEditor] = useState<any | null>(null);
  const [savedTitles, setSavedTitles] = useState<Record<string, string>>({});
  const [marketFilter, setMarketFilter] = useState<string>('NL');
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const [gmcFilter, setGmcFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/feed');
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const products = (data?.products ?? []).map((p: any) => ({
    ...p,
    title: savedTitles[p.id] ?? p.title,
  }));

  const stats = data?.stats ?? {};

  const filteredProducts = products.filter((p: any) => {
    if (labelFilter !== 'all' && p.label !== labelFilter) return false;
    if (gmcFilter !== 'all' && p.gmcStatus !== gmcFilter) return false;
    return true;
  });

  const disapprovedProducts = products.filter((p: any) => p.gmcStatus === 'disapproved' || p.gmcStatus === 'limited');

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {gmcPanel && <GMCFixPanel issues={gmcPanel} onClose={() => setGmcPanel(null)} />}
      {titleEditor && (
        <TitleEditor
          product={titleEditor}
          onClose={() => setTitleEditor(null)}
          onSave={(id, title) => setSavedTitles(prev => ({ ...prev, [id]: title }))}
        />
      )}

      <header className="border-b border-gray-800 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Mvolo Attribution Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Feed Suite — {stats.totalProducts ?? 0} producten ·{' '}
                <span className={data?.gmcConnected ? 'text-green-400' : 'text-yellow-400'}>
                  GMC {data?.gmcConnected ? 'verbonden' : 'demo modus'}
                </span>
                {' '}· sync {data?.lastSync ? new Date(data.lastSync).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
            </div>
            <Nav />
          </div>
          <div className="flex items-center gap-2">
            {['NL', 'DE', 'UK', 'BE'].map(m => (
              <button key={m} onClick={() => setMarketFilter(m)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${marketFilter === m ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">

        {/* GMC alert banner */}
        {!loading && disapprovedProducts.length > 0 && (
          <div className="bg-red-950/30 border border-red-900/40 rounded-xl px-5 py-4 space-y-2">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">
              ⚠ {disapprovedProducts.length} producten hebben GMC problemen
            </p>
            {disapprovedProducts.slice(0, 3).map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-300 truncate max-w-lg">{p.title?.substring(0, 60)}…</span>
                <button onClick={() => setGmcPanel(p.gmcIssues)}
                  className="shrink-0 ml-4 text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                  Oplossen →
                </button>
              </div>
            ))}
          </div>
        )}

        {/* KPI strip */}
        {!loading && (
          <div className="grid grid-cols-6 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500">Feed coverage</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.feedCoverageScore}%</p>
            </div>
            <div className="bg-red-950/30 border border-red-900/30 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500">Afgekeurd GMC</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{stats.disapproved}</p>
            </div>
            <div className="bg-yellow-950/20 border border-yellow-900/20 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500">Beperkt zichtbaar</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.limited}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500">Titel Poor</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{stats.titlePoor}</p>
              <p className="text-xs text-gray-600">van {stats.totalProducts}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500">Ontbrekende GTIN</p>
              <p className="text-2xl font-bold text-orange-400 mt-1">{stats.missingGtin}</p>
            </div>
            <div className="bg-blue-950/20 border border-blue-900/20 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500">Heroes</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{stats.heroes}</p>
              <p className="text-xs text-gray-600">{stats.totalProducts > 0 ? Math.round((stats.heroes / stats.totalProducts) * 100) : 0}% van feed</p>
            </div>
          </div>
        )}

        {/* Label performance summary */}
        {!loading && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Heroes', color: 'blue', count: stats.heroes, convValue: stats.heroesConvValue, desc: 'Hoge ROAS, top converters' },
              { label: 'Villains', color: 'red', count: stats.villains, convValue: stats.villainsCost, desc: 'Hoog budget, lage ROAS' },
              { label: 'Sidekicks', color: 'yellow', count: stats.sidekicks, convValue: null, desc: 'Weinig clicks, laag budget' },
              { label: 'Zombies', color: 'gray', count: stats.zombies, convValue: null, desc: 'Geen clicks, geen spend' },
            ].map(({ label, color, count, convValue, desc }) => (
              <button key={label}
                onClick={() => setLabelFilter(labelFilter === label ? 'all' : label)}
                className={`text-left bg-gray-900 border rounded-xl px-4 py-4 transition-colors ${labelFilter === label ? 'border-indigo-500' : 'border-gray-800 hover:border-gray-700'}`}>
                <div className="flex items-center justify-between mb-2">
                  <LabelBadge label={label} />
                  <span className={`text-2xl font-bold text-${color}-400`}>{count}</span>
                </div>
                <p className="text-xs text-gray-500">{desc}</p>
                {convValue !== null && (
                  <p className="text-xs text-gray-400 mt-1">
                    {label === 'Heroes' ? `Omzet: ${formatEuro(convValue)}` : `Spend: ${formatEuro(convValue)}`}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {([
            ['producten', '📦 Producten'],
            ['gmc', '🔴 GMC problemen'],
            ['health', '🩺 Feed health'],
            ['labels', '🏷 Label analyse'],
          ] as const).map(([key, lbl]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}>
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
            <span className="text-xs text-gray-600">Label:</span>
            {['all', 'Heroes', 'Villains', 'Sidekicks', 'Zombies'].map(l => (
              <button key={l} onClick={() => setLabelFilter(l)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${labelFilter === l ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
                {l === 'all' ? 'Alle labels' : l}
              </button>
            ))}
            <span className="text-xs text-gray-600 ml-3">GMC:</span>
            {['all', 'approved', 'limited', 'disapproved'].map(g => (
              <button key={g} onClick={() => setGmcFilter(g)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${gmcFilter === g ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
                {g === 'all' ? 'Alles' : g === 'approved' ? 'Goedgekeurd' : g === 'limited' ? 'Beperkt' : 'Afgekeurd'}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-600 animate-pulse">Feed laden…</div>
        ) : (
          <>
            {/* PRODUCTEN TAB */}
            {tab === 'producten' && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider">
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
                      <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                        <td className="px-4 py-3 max-w-xs">
                          <p className="text-gray-200 truncate font-medium" title={p.title}>{p.title?.substring(0, 45)}{p.title?.length > 45 ? '…' : ''}</p>
                          <p className="text-gray-600 mt-0.5">{p.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-300">{p.clicks ?? 0}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-300">{formatEuro(p.cost ?? 0)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-300">{p.conversions ?? 0}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white font-semibold">{formatEuro(p.conv_value ?? 0)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={p.roas >= 400 ? 'text-green-400' : p.roas >= 100 ? 'text-yellow-400' : 'text-red-400'}>
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
                              className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors">
                              ✏ Titel
                            </button>
                            {p.gmcIssues?.length > 0 && (
                              <button onClick={() => setGmcPanel(p.gmcIssues)}
                                className="text-red-400 hover:text-red-300 text-xs transition-colors">
                                🔧 Fix
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* GMC TAB */}
            {tab === 'gmc' && (
              <div className="space-y-3">
                {disapprovedProducts.length === 0 ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-12 text-center">
                    <p className="text-green-400 text-lg mb-2">✓ Geen GMC problemen gevonden</p>
                    <p className="text-xs text-gray-600">Alle producten zijn goedgekeurd in Google Merchant Center.</p>
                  </div>
                ) : (
                  disapprovedProducts.map((p: any) => (
                    <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-800 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-200 truncate">{p.title}</p>
                          <p className="text-xs text-gray-600 mt-0.5">SKU: {p.sku} · {p.id}</p>
                        </div>
                        <GMCStatusBadge status={p.gmcStatus} />
                      </div>
                      <div className="px-5 py-4 space-y-3">
                        {p.gmcIssues.map((issue: any, i: number) => (
                          <div key={i} className="flex gap-4">
                            <div className="shrink-0 mt-0.5">
                              <span className={`inline-block w-2 h-2 rounded-full mt-1 ${issue.priority === 'high' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className="text-xs font-semibold text-red-400">{issue.description}</p>
                              <div className="flex items-start gap-2">
                                <span className="text-indigo-400 text-xs shrink-0">💡 Oplossing:</span>
                                <p className="text-xs text-gray-300 leading-relaxed">{issue.fix}</p>
                              </div>
                            </div>
                            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium h-fit ${
                              issue.priority === 'high' ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'
                            }`}>
                              {issue.priority === 'high' ? 'Urgent' : 'Middel'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
                {!data?.gmcConnected && (
                  <div className="bg-yellow-950/20 border border-yellow-900/30 rounded-xl px-5 py-4">
                    <p className="text-xs text-yellow-400 font-semibold">Demo modus — GMC niet verbonden</p>
                    <p className="text-xs text-gray-500 mt-1">Voeg GMC_CLIENT_ID, GMC_CLIENT_SECRET, GMC_REFRESH_TOKEN en GMC_MERCHANT_ID toe als GitHub Secrets voor live data.</p>
                  </div>
                )}
              </div>
            )}

            {/* HEALTH TAB */}
            {tab === 'health' && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                    <p className="text-xs text-gray-500">Gemiddelde feed score</p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {products.length > 0 ? Math.round(products.reduce((s: number, p: any) => s + p.feedScore, 0) / products.length) : 0}
                      <span className="text-sm text-gray-500">/100</span>
                    </p>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                    <p className="text-xs text-gray-500">Producten zonder problemen</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">
                      {products.filter((p: any) => p.feedIssues.length === 0).length}
                      <span className="text-sm text-gray-500"> / {products.length}</span>
                    </p>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                    <p className="text-xs text-gray-500">Totale feed issues</p>
                    <p className="text-2xl font-bold text-orange-400 mt-1">
                      {products.reduce((s: number, p: any) => s + p.feedIssues.length, 0)}
                    </p>
                  </div>
                </div>

                {products.filter((p: any) => p.feedIssues.length > 0).map((p: any) => (
                  <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">{p.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{p.sku}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${p.feedScore}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 tabular-nums">{p.feedScore}/100</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {p.feedIssues.map((issue: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="text-orange-400">⚠</span>
                          <span className="text-gray-400">{issue}</span>
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
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Heroes', color: 'blue-400', bg: 'blue-950/20', border: 'blue-900/30', desc: 'ROAS ≥ 400% en meer dan 20 clicks. Verhoog budget voor deze producten.', products: products.filter((p: any) => p.label === 'Heroes') },
                    { label: 'Villains', color: 'red-400', bg: 'red-950/20', border: 'red-900/30', desc: 'ROAS < 100% met meer dan €50 spend. Optimaliseer of pauzeer.', products: products.filter((p: any) => p.label === 'Villains') },
                    { label: 'Sidekicks', color: 'yellow-400', bg: 'yellow-950/20', border: 'yellow-900/30', desc: 'Weinig clicks maar laag budget. Test met hogere biedingen.', products: products.filter((p: any) => p.label === 'Sidekicks') },
                    { label: 'Zombies', color: 'gray-400', bg: 'gray-800/40', border: 'gray-700/50', desc: 'Geen clicks of spend. Controleer feed health en GMC status.', products: products.filter((p: any) => p.label === 'Zombies') },
                  ].map(({ label, color, bg, border, desc, products: lp }) => (
                    <div key={label} className={`bg-${bg} border border-${border} rounded-xl p-5`}>
                      <div className="flex items-center justify-between mb-2">
                        <LabelBadge label={label} />
                        <span className={`text-2xl font-bold text-${color}`}>{lp.length}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">{desc}</p>
                      <div className="space-y-2">
                        {lp.slice(0, 4).map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between text-xs">
                            <span className="text-gray-400 truncate max-w-xs">{p.title?.substring(0, 35)}…</span>
                            <span className={`tabular-nums font-medium ${p.roas >= 400 ? 'text-green-400' : p.roas >= 100 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {p.roas ?? 0}%
                            </span>
                          </div>
                        ))}
                        {lp.length > 4 && <p className="text-xs text-gray-600">+{lp.length - 4} meer</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Title status overzicht */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-300 mb-4">Titel status overzicht</h3>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { score: 'Poor', color: 'red-400', count: products.filter((p: any) => p.titleScore === 'Poor').length },
                      { score: 'Average', color: 'yellow-400', count: products.filter((p: any) => p.titleScore === 'Average').length },
                      { score: 'Great', color: 'green-400', count: products.filter((p: any) => p.titleScore === 'Great').length },
                      { score: 'Too Long', color: 'gray-400', count: products.filter((p: any) => p.titleScore === 'Too Long').length },
                    ].map(({ score, color, count }) => (
                      <div key={score} className="text-center">
                        <TitleScoreBadge score={score} />
                        <p className={`text-3xl font-bold text-${color} mt-2`}>{count}</p>
                        <p className="text-xs text-gray-600">{products.length > 0 ? Math.round((count / products.length) * 100) : 0}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
