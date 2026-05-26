'use client';

import { useState, useEffect, useCallback } from 'react';

type Product = {
  id: string; ean: string | null; sku: string | null; name_nl: string;
  category: string | null; shopify_id: string | null; active: boolean;
  brand: string; price_eur: number | null; sale_price_eur: number | null;
  image_url: string | null; additional_images: string[] | null;
  product_url: string | null; shopify_tags: string[] | null;
  description_nl: string | null; last_shopify_sync: string | null;
  feed_ready: boolean; feed_issues: string[]; image_bank_count: number;
  content_languages: { language: string; ai_status: string }[];
};
type Market = { id: string; code: string; name: string; language: string; language_code: string; status: string };
type FeedConfig = { id: string; market_id: string; channel: string; feed_name: string; is_active: boolean; last_fetched_at: string | null };
type Alert = { id: string; type: string; severity: string; message: string; product_id: string | null; channel: string | null; created_at: string };
type Stats = { totalProducts: number; feedReady: number; withIssues: number; activeFeeds: number; activeRules: number };
type TabKey = 'overview' | 'products' | 'feeds' | 'rules' | 'ai' | 'ab_testing' | 'versions' | 'alerts';

export default function FeedSuitePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [feedConfigs, setFeedConfigs] = useState<FeedConfig[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<Stats>({ totalProducts: 0, feedReady: 0, withIssues: 0, activeFeeds: 0, activeRules: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready' | 'issues'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/feed/products');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setProducts(data.products || []);
      setMarkets(data.markets || []);
      setFeedConfigs(data.feedConfigs || []);
      setAlerts(data.alerts || []);
      setStats(data.stats || { totalProducts: 0, feedReady: 0, withIssues: 0, activeFeeds: 0, activeRules: 0 });
    } catch (e) { console.error('Load error:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSync = async () => {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch('/api/feed/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) { setSyncResult(data.synced + '/' + data.total + ' producten gesynchroniseerd'); await loadData(); }
      else { setSyncResult('Fout: ' + data.error); }
    } catch (e: any) { setSyncResult('Sync gefaald: ' + e.message); }
    finally { setSyncing(false); }
  };

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))] as string[];
  const filtered = products.filter(p => {
    if (search) { const q = search.toLowerCase(); if (!p.name_nl.toLowerCase().includes(q) && !(p.ean || '').includes(q) && !(p.sku || '').includes(q)) return false; }
    if (filterStatus === 'ready' && !p.feed_ready) return false;
    if (filterStatus === 'issues' && p.feed_ready) return false;
    if (filterCategory !== 'all' && p.category !== filterCategory) return false;
    return true;
  });

  const timeAgo = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 60) return m + 'm geleden'; const h = Math.floor(m / 60); if (h < 24) return h + 'u geleden'; return Math.floor(h / 24) + 'd geleden'; };
  const fmtPrice = (p: number | null) => p ? '\u20AC' + p.toFixed(2).replace('.', ',') : '\u2014';
  const sevColor: Record<string, string> = { critical: 'text-red-400 bg-red-950/40 border-red-900/50', warning: 'text-amber-400 bg-amber-950/40 border-amber-900/50', info: 'text-blue-400 bg-blue-950/40 border-blue-900/50' };

  if (loading) return <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center"><div className="text-gray-500">Feed Suite laden...</div></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Feed Suite</h1>
          <p className="text-sm text-gray-500 mt-1">{stats.totalProducts} producten · {stats.activeFeeds} feeds live · {stats.activeRules} regels actief</p>
        </div>
        <button onClick={handleSync} disabled={syncing} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors">
          {syncing ? '\u27F3 Synchroniseren...' : '\u27F3 Shopify Sync'}
        </button>
      </div>

      {syncResult && <div className={'mb-4 px-4 py-2 rounded-lg text-sm ' + (syncResult.includes('Fout') || syncResult.includes('gefaald') ? 'bg-red-950/40 text-red-400 border border-red-900/50' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50')}>{syncResult}</div>}

      {alerts.filter(a => a.severity === 'critical').length > 0 && (
        <div className="mb-4 px-4 py-3 bg-red-950/30 border border-red-900/50 rounded-xl">
          <div className="flex items-center gap-2 text-red-400 text-sm font-semibold mb-1"><span>△</span><span>{alerts.filter(a => a.severity === 'critical').length} KRITIEKE ALERTS</span></div>
          {alerts.filter(a => a.severity === 'critical').map(a => <div key={a.id} className="text-sm text-gray-400 ml-5">{a.message}</div>)}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Producten', value: stats.totalProducts, sub: 'actief', color: 'text-white' },
          { label: 'Feed-ready', value: stats.feedReady, sub: 'van ' + stats.totalProducts, color: 'text-emerald-400' },
          { label: 'Met issues', value: stats.withIssues, sub: 'producten', color: stats.withIssues > 0 ? 'text-amber-400' : 'text-gray-500' },
          { label: 'Feeds live', value: stats.activeFeeds, sub: 'kanalen', color: 'text-indigo-400' },
          { label: 'Regels actief', value: stats.activeRules, sub: 'filters', color: 'text-purple-400' },
        ].map((c, i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{c.label}</div>
            <div className={'text-2xl font-bold tabular-nums ' + c.color}>{c.value}</div>
            <div className="text-xs text-gray-600 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {([['overview', '\uD83D\uDCCA Overzicht'], ['products', '\uD83D\uDCE6 Producten'], ['feeds', '\uD83D\uDD17 Feeds'], ['rules', '\uD83D\uDCCB Regels'], ['ai', '\uD83E\uDD16 AI Enrichments'], ['ab_testing', '\uD83D\uDD2C A/B Testing'], ['versions', '\uD83D\uDD16 Versies'], ['alerts', '\uD83D\uDD14 Alerts']] as [TabKey, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ' + (tab === key ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50')}>
            {label}{key === 'alerts' && alerts.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-red-600 text-white rounded-full">{alerts.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Live Feeds</h3>
            {feedConfigs.length === 0 ? <p className="text-sm text-gray-600">Geen feed configuraties. Draai eerst de Supabase migration.</p> : (
              <div className="space-y-2">{feedConfigs.map(fc => { const market = markets.find(m => m.id === fc.market_id); return (
                <div key={fc.id} className="flex items-center justify-between py-2">
                  <div><div className="text-sm font-medium text-gray-200">{fc.feed_name || (market?.code + ' ' + fc.channel)}</div><div className="text-xs text-gray-500">{market?.name} · {fc.channel}</div></div>
                  <span className={'px-2 py-0.5 rounded text-xs font-medium ' + (fc.is_active ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50' : 'bg-gray-800 text-gray-500 border border-gray-700')}>{fc.is_active ? 'Live' : 'Inactief'}</span>
                </div>); })}</div>
            )}
          </div>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Product Readiness</h3>
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1"><span className="text-gray-400">Feed-ready</span><span className="text-emerald-400 font-medium">{stats.totalProducts > 0 ? Math.round((stats.feedReady / stats.totalProducts) * 100) : 0}%</span></div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: (stats.totalProducts > 0 ? (stats.feedReady / stats.totalProducts) * 100 : 0) + '%' }} /></div>
            </div>
            {stats.withIssues > 0 && <div className="space-y-1"><div className="text-xs text-gray-500 mb-2">Veelvoorkomende issues:</div>
              {(() => { const ic: Record<string, number> = {}; products.forEach(p => p.feed_issues.forEach(i => { ic[i] = (ic[i] || 0) + 1; })); return Object.entries(ic).sort(([, a], [, b]) => b - a).map(([issue, count]) => <div key={issue} className="flex items-center justify-between text-xs"><span className="text-amber-400">{'\u26A0'} {issue}</span><span className="text-gray-500">{count} producten</span></div>); })()}
            </div>}
          </div>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Markten</h3>
            <div className="space-y-2">{markets.map(m => { const configs = feedConfigs.filter(fc => fc.market_id === m.id); const ac = configs.filter(c => c.is_active).length; const flags: Record<string, string> = { NL: '\uD83C\uDDF3\uD83C\uDDF1', BE: '\uD83C\uDDE7\uD83C\uDDEA', DE: '\uD83C\uDDE9\uD83C\uDDEA', FR: '\uD83C\uDDEB\uD83C\uDDF7', AT: '\uD83C\uDDE6\uD83C\uDDF9', CH: '\uD83C\uDDE8\uD83C\uDDED' }; return (
              <div key={m.id} className="flex items-center justify-between py-1"><div className="flex items-center gap-2"><span className="text-lg">{flags[m.code] || '\uD83C\uDF10'}</span><div><div className="text-sm text-gray-200">{m.name}</div><div className="text-xs text-gray-500">{m.language} · {ac} feeds actief</div></div></div>
              <span className={'text-xs px-2 py-0.5 rounded ' + (m.status === 'primary' ? 'bg-emerald-950/50 text-emerald-400' : 'bg-gray-800 text-gray-500')}>{m.status}</span></div>); })}</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-gray-300">Recente Alerts</h3>{alerts.length > 0 && <button onClick={() => setTab('alerts')} className="text-xs text-indigo-400 hover:text-indigo-300">Alle alerts →</button>}</div>
            {alerts.length === 0 ? <p className="text-sm text-gray-600">Geen openstaande alerts.</p> : <div className="space-y-2">{alerts.slice(0, 5).map(a => <div key={a.id} className={'px-3 py-2 rounded-lg border text-sm ' + (sevColor[a.severity] || sevColor.info)}><div className="flex items-center justify-between"><span>{a.message}</span><span className="text-xs opacity-60 ml-2 whitespace-nowrap">{timeAgo(a.created_at)}</span></div></div>)}</div>}
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input type="text" placeholder="Zoek op naam, EAN of SKU..." value={search} onChange={e => setSearch(e.target.value)} className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-64" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200">
              <option value="all">Alle statussen</option><option value="ready">Feed-ready</option><option value="issues">Met issues</option>
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200">
              <option value="all">Alle categorieen</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-xs text-gray-500 ml-auto">{filtered.length} producten</span>
          </div>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">EAN / SKU</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prijs</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Foto's</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Talen</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-800/50">
                  {filtered.map(p => (
                    <tr key={p.id} onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)} className="hover:bg-gray-800/30 cursor-pointer transition-colors">
                      <td className="px-4 py-3"><div className="flex items-center gap-3">
                        {p.image_url ? <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-800" /> : <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-600 text-xs">?</div>}
                        <div><div className="text-sm font-medium text-gray-200">{p.name_nl}</div><div className="text-xs text-gray-500">{p.category || 'Geen categorie'}</div></div>
                      </div></td>
                      <td className="px-4 py-3"><div className="text-xs text-gray-300 font-mono">{p.ean || <span className="text-red-400">{'\u2014'}</span>}</div><div className="text-xs text-gray-500 font-mono">{p.sku || <span className="text-red-400">geen SKU</span>}</div></td>
                      <td className="px-4 py-3 text-right"><div className="text-sm text-gray-200 tabular-nums">{fmtPrice(p.price_eur)}</div>{p.sale_price_eur && <div className="text-xs text-emerald-400 tabular-nums">Sale: {fmtPrice(p.sale_price_eur)}</div>}</td>
                      <td className="px-4 py-3 text-center"><span className={'text-sm tabular-nums ' + ((p.additional_images?.length || 0) + (p.image_url ? 1 : 0) > 3 ? 'text-emerald-400' : 'text-amber-400')}>{(p.additional_images?.length || 0) + (p.image_url ? 1 : 0)}</span>{p.image_bank_count > 0 && <span className="text-xs text-gray-500 ml-1">+{p.image_bank_count}</span>}</td>
                      <td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-1">{['nl', 'en', 'de', 'fr'].map(lang => { const has = p.content_languages.some(c => c.language === lang); return <span key={lang} className={'text-xs px-1.5 py-0.5 rounded ' + (has ? 'bg-indigo-950/50 text-indigo-400' : 'bg-gray-800/50 text-gray-600')}>{lang.toUpperCase()}</span>; })}</div></td>
                      <td className="px-4 py-3 text-center">{p.feed_ready ? <span className="px-2 py-0.5 text-xs font-medium bg-emerald-950/50 text-emerald-400 border border-emerald-900/50 rounded">{'\u2713'} Ready</span> : <span className="px-2 py-0.5 text-xs font-medium bg-amber-950/50 text-amber-400 border border-amber-900/50 rounded">{p.feed_issues.length} issues</span>}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-600">{products.length === 0 ? 'Geen producten. Klik "Shopify Sync" om producten op te halen.' : 'Geen producten voor deze filters.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          {expandedProduct && (() => { const p = products.find(pr => pr.id === expandedProduct); if (!p) return null; return (
            <div className="mt-4 bg-gray-900/50 border border-gray-800/50 rounded-xl p-5"><div className="flex items-start gap-4">
              {p.image_url && <img src={p.image_url} alt="" className="w-24 h-24 rounded-xl object-cover bg-gray-800" />}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-100">{p.name_nl}</h3>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm">
                  <span className="text-gray-400">EAN: <span className="text-gray-200 font-mono">{p.ean || '\u2014'}</span></span>
                  <span className="text-gray-400">SKU: <span className="text-gray-200 font-mono">{p.sku || '\u2014'}</span></span>
                  <span className="text-gray-400">Categorie: <span className="text-gray-200">{p.category || '\u2014'}</span></span>
                  <span className="text-gray-400">Shopify ID: <span className="text-gray-200 font-mono">{p.shopify_id || '\u2014'}</span></span>
                </div>
                {p.feed_issues.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{p.feed_issues.map(issue => <span key={issue} className="px-2 py-1 text-xs bg-amber-950/40 text-amber-400 border border-amber-900/50 rounded">{'\u26A0'} {issue}</span>)}</div>}
                {p.shopify_tags && p.shopify_tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{p.shopify_tags.map(tag => <span key={tag} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-400 rounded">{tag}</span>)}</div>}
                {p.description_nl && <p className="mt-3 text-xs text-gray-500 line-clamp-3">{p.description_nl.substring(0, 300)}...</p>}
              </div>
            </div></div>); })()}
        </div>
      )}

      {tab === 'feeds' && <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-8 text-center"><div className="text-3xl mb-3">{'\uD83D\uDD17'}</div><h3 className="text-lg font-semibold text-gray-300 mb-2">Feed URLs & Output</h3><p className="text-sm text-gray-500">Deel 2 — Feed output met XML/CSV per kanaal per markt.</p></div>}
      {tab === 'rules' && <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-8 text-center"><div className="text-3xl mb-3">{'\uD83D\uDCCB'}</div><h3 className="text-lg font-semibold text-gray-300 mb-2">Feed Regels</h3><p className="text-sm text-gray-500">Deel 2 — Channable-achtige regelengine. 4 standaard regels zijn al in Supabase.</p></div>}
      {tab === 'ai' && <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-8 text-center"><div className="text-3xl mb-3">{'\uD83E\uDD16'}</div><h3 className="text-lg font-semibold text-gray-300 mb-2">AI Enrichments</h3><p className="text-sm text-gray-500">Deel 3 — Claude titel & beschrijving optimalisatie per taal.</p></div>}
      {tab === 'ab_testing' && <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-8 text-center"><div className="text-3xl mb-3">{'\uD83D\uDD2C'}</div><h3 className="text-lg font-semibold text-gray-300 mb-2">A/B Testing</h3><p className="text-sm text-gray-500">Deel 4 — Simultane A/B tests op titels, beschrijvingen en afbeeldingen.</p></div>}
      {tab === 'versions' && <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-8 text-center"><div className="text-3xl mb-3">{'\uD83D\uDD16'}</div><h3 className="text-lg font-semibold text-gray-300 mb-2">Versie Beheer</h3><p className="text-sm text-gray-500">Deel 3 — Feed versie-historie met rollback.</p></div>}
      {tab === 'alerts' && (alerts.length === 0 ? <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-8 text-center"><div className="text-3xl mb-3">{'\u2713'}</div><h3 className="text-lg font-semibold text-gray-300 mb-2">Geen openstaande alerts</h3></div> : <div className="space-y-2">{alerts.map(a => <div key={a.id} className={'px-4 py-3 rounded-xl border ' + (sevColor[a.severity] || sevColor.info)}><div className="flex items-center justify-between"><div><span className="text-sm font-medium">{a.message}</span><div className="text-xs opacity-60 mt-0.5">{a.channel && (a.channel + ' · ')}{timeAgo(a.created_at)}</div></div><span className="text-xs px-2 py-0.5 rounded bg-black/20">{a.severity}</span></div></div>)}</div>)}
    </div>
  );
}
