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
type Market    = { id: string; code: string; name: string; language: string; language_code: string; status: string };
type FeedConfig= { id: string; market_id: string; channel: string; feed_name: string; is_active: boolean; last_fetched_at: string | null };
type Alert     = { id: string; type: string; severity: string; message: string; product_id: string | null; channel: string | null; created_at: string };
type Stats     = { totalProducts: number; feedReady: number; withIssues: number; activeFeeds: number; activeRules: number };
type Condition = { field: string; operator: string; value?: string };
type Rule      = {
  id: string; name: string;
  type: 'filter' | 'transform'; conditions: Condition[];
  actions: Record<string, string>; priority: number; active: boolean; created_at: string;
};
type FeedPreview = {
  total_before_rules: number; total_after_rules: number; excluded: number;
  products: { id: string; title: string; price: number | null; ean: string | null; sku: string | null; image: string | null }[];
};
type TabKey = 'overview' | 'products' | 'feeds' | 'rules' | 'ai' | 'ab_testing' | 'versions' | 'alerts';

const FLAGS: Record<string, string> = { NL: '🇳🇱', BE: '🇧🇪', DE: '🇩🇪', FR: '🇫🇷', AT: '🇦🇹', CH: '🇨🇭' };
const CHANNEL_ICONS: Record<string, string> = { google: 'G', meta: 'M', awin: 'A', bol: 'B' };
const FIELDS = ['title','price','ean','sku','category','brand','description'] as const;
const FIELD_NL: Record<string, string> = { title:'Titel', price:'Prijs', ean:'EAN', sku:'SKU', category:'Categorie', brand:'Merk', description:'Beschrijving' };
const OPS = [
  { v:'contains',     l:'bevat' },
  { v:'not_contains', l:'bevat niet' },
  { v:'equals',       l:'gelijk aan' },
  { v:'not_equals',   l:'niet gelijk aan' },
  { v:'is_empty',     l:'is leeg' },
  { v:'is_not_empty', l:'is niet leeg' },
  { v:'greater_than', l:'groter dan' },
  { v:'less_than',    l:'kleiner dan' },
];
const NO_VAL_OPS = ['is_empty','is_not_empty'];
const FIELD_MAP: Record<string, keyof Product> = {
  title:'name_nl', name:'name_nl', price:'price_eur',
  ean:'ean', sku:'sku', category:'category', description:'description_nl', brand:'brand',
};

function evalCond(p: Product, c: Condition): boolean {
  const val = p[FIELD_MAP[c.field] ?? c.field as keyof Product] as unknown;
  switch (c.operator) {
    case 'contains':     return String(val ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase());
    case 'not_contains': return !String(val ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase());
    case 'equals':       return val == c.value;
    case 'not_equals':   return val != c.value;
    case 'is_empty':     return val === null || val === undefined || val === '' || val === 0;
    case 'is_not_empty': return val !== null && val !== undefined && val !== '' && val !== 0;
    case 'greater_than': return Number(val) > Number(c.value);
    case 'less_than':    return Number(val) < Number(c.value);
    default:             return false;
  }
}

function countAffected(rule: Rule, products: Product[]): number {
  return products.filter(p => (rule.conditions ?? []).every(c => evalCond(p, c))).length;
}

const BLANK_COND: Condition = { field: 'title', operator: 'contains', value: '' };

export default function FeedSuitePage() {
  const [products,       setProducts]       = useState<Product[]>([]);
  const [markets,        setMarkets]         = useState<Market[]>([]);
  const [feedConfigs,    setFeedConfigs]     = useState<FeedConfig[]>([]);
  const [alerts,         setAlerts]          = useState<Alert[]>([]);
  const [stats,          setStats]           = useState<Stats>({ totalProducts:0, feedReady:0, withIssues:0, activeFeeds:0, activeRules:0 });
  const [rules,          setRules]           = useState<Rule[]>([]);
  const [loading,        setLoading]         = useState(true);
  const [syncing,        setSyncing]         = useState(false);
  const [syncResult,     setSyncResult]      = useState<string | null>(null);
  const [tab,            setTab]             = useState<TabKey>('overview');
  const [search,         setSearch]          = useState('');
  const [filterStatus,   setFilterStatus]    = useState<'all'|'ready'|'issues'>('all');
  const [filterCategory, setFilterCategory]  = useState('all');
  const [expandedProd,   setExpandedProd]    = useState<string | null>(null);

  // Feeds tab
  const [feedPreviews,   setFeedPreviews]    = useState<Record<string, FeedPreview>>({});
  const [previewLoading, setPreviewLoading]  = useState<string | null>(null);
  const [copied,         setCopied]          = useState<string | null>(null);

  // Rules tab
  const [newRuleOpen,    setNewRuleOpen]     = useState(false);
  const [ruleName,       setRuleName]        = useState('');
  const [ruleType,       setRuleType]        = useState<'filter'|'transform'>('filter');
  const [ruleConds,      setRuleConds]       = useState<Condition[]>([{ ...BLANK_COND }]);
  const [ruleSetField,   setRuleSetField]    = useState('title');
  const [ruleSetValue,   setRuleSetValue]    = useState('');
  const [savingRule,     setSavingRule]      = useState(false);
  const [ruleError,      setRuleError]       = useState<string | null>(null);
  const [deletingRule,   setDeletingRule]    = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [pRes, rRes] = await Promise.all([
        fetch('/api/feed/products'),
        fetch('/api/feed/rules'),
      ]);
      if (!pRes.ok) throw new Error('Producten laden mislukt');
      const pData = await pRes.json();
      setProducts(pData.products  ?? []);
      setMarkets(pData.markets    ?? []);
      setFeedConfigs(pData.feedConfigs ?? []);
      setAlerts(pData.alerts      ?? []);
      setStats(pData.stats        ?? { totalProducts:0, feedReady:0, withIssues:0, activeFeeds:0, activeRules:0 });
      if (rRes.ok) {
        const rData = await rRes.json();
        setRules(rData.rules ?? []);
      }
    } catch (e) { console.error('Load error:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSync() {
    setSyncing(true); setSyncResult(null);
    try {
      const res  = await fetch('/api/feed/sync', { method: 'POST' });
      const data = await res.json();
      setSyncResult(data.success
        ? `${data.synced}/${data.total} producten gesynchroniseerd`
        : 'Fout: ' + data.error);
      if (data.success) await loadData();
    } catch (e: any) { setSyncResult('Sync gefaald: ' + e.message); }
    finally { setSyncing(false); }
  }

  // ── Feed preview ─────────────────────────────────────────────────────────────
  async function loadFeedPreview(marketCode: string, channel: string) {
    const key = `${marketCode}_${channel}`;
    setPreviewLoading(key);
    try {
      const res  = await fetch(`/api/feed/output?market=${marketCode}&channel=${channel}&preview=true`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Preview mislukt');
      setFeedPreviews(prev => ({ ...prev, [key]: data }));
    } catch (e: any) {
      setFeedPreviews(prev => ({ ...prev, [key]: { total_before_rules:0, total_after_rules:0, excluded:0, products:[], _error: e.message } as any }));
    } finally { setPreviewLoading(null); }
  }

  function copyUrl(url: string, key: string) {
    const full = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(full).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(c => c === key ? null : c), 2000);
    });
  }

  // ── Rule CRUD ─────────────────────────────────────────────────────────────────
  async function toggleRule(id: string, active: boolean) {
    await fetch('/api/feed/rules', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, active }) });
    setRules(prev => prev.map(r => r.id === id ? { ...r, active } : r));
  }

  async function deleteRule(id: string) {
    setDeletingRule(id);
    await fetch(`/api/feed/rules?id=${id}`, { method:'DELETE' });
    setRules(prev => prev.filter(r => r.id !== id));
    setDeletingRule(null);
  }

  function updateCond(i: number, key: keyof Condition, val: string) {
    setRuleConds(prev => prev.map((c, idx) => idx === i ? { ...c, [key]: val } : c));
  }

  async function saveRule() {
    if (!ruleName.trim()) { setRuleError('Geef een naam op'); return; }
    if (ruleConds.some(c => !c.field || !c.operator)) { setRuleError('Vul alle condities in'); return; }
    setSavingRule(true); setRuleError(null);
    try {
      const actions = ruleType === 'transform' ? { set_field: ruleSetField, value: ruleSetValue } : {};
      const res  = await fetch('/api/feed/rules', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name: ruleName.trim(), type: ruleType, conditions: ruleConds, actions, priority: rules.length * 10 + 10, active: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRules(prev => [...prev, data.rule]);
      setNewRuleOpen(false);
      setRuleName(''); setRuleType('filter'); setRuleConds([{ ...BLANK_COND }]);
      setRuleSetField('title'); setRuleSetValue('');
    } catch (e: any) { setRuleError(e.message); }
    finally { setSavingRule(false); }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))] as string[];
  const filtered   = products.filter(p => {
    if (search) { const q = search.toLowerCase(); if (!p.name_nl.toLowerCase().includes(q) && !(p.ean ?? '').includes(q) && !(p.sku ?? '').includes(q)) return false; }
    if (filterStatus === 'ready'  && !p.feed_ready) return false;
    if (filterStatus === 'issues' &&  p.feed_ready) return false;
    if (filterCategory !== 'all'  && p.category !== filterCategory) return false;
    return true;
  });

  const timeAgo  = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 60) return m + 'm geleden'; const h = Math.floor(m/60); if (h < 24) return h + 'u geleden'; return Math.floor(h/24) + 'd geleden'; };
  const fmtPrice = (p: number | null) => p ? '€' + p.toFixed(2).replace('.',',') : '—';
  const sevColor: Record<string, string> = {
    critical:'text-red-400 bg-red-950/40 border-red-900/50',
    warning:'text-amber-400 bg-amber-950/40 border-amber-900/50',
    info:'text-blue-400 bg-blue-950/40 border-blue-900/50',
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center"><div className="text-gray-500">Feed Suite laden...</div></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Feed Suite</h1>
          <p className="text-sm text-gray-500 mt-1">{stats.totalProducts} producten · {stats.activeFeeds} feeds live · {stats.activeRules} regels actief</p>
        </div>
        <button onClick={handleSync} disabled={syncing} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors">
          {syncing ? '⟳ Synchroniseren...' : '⟳ Shopify Sync'}
        </button>
      </div>

      {syncResult && <div className={'mb-4 px-4 py-2 rounded-lg text-sm ' + (syncResult.includes('Fout') || syncResult.includes('gefaald') ? 'bg-red-950/40 text-red-400 border border-red-900/50' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50')}>{syncResult}</div>}

      {alerts.filter(a => a.severity === 'critical').length > 0 && (
        <div className="mb-4 px-4 py-3 bg-red-950/30 border border-red-900/50 rounded-xl">
          <div className="flex items-center gap-2 text-red-400 text-sm font-semibold mb-1"><span>△</span><span>{alerts.filter(a => a.severity === 'critical').length} KRITIEKE ALERTS</span></div>
          {alerts.filter(a => a.severity === 'critical').map(a => <div key={a.id} className="text-sm text-gray-400 ml-5">{a.message}</div>)}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label:'Producten',   value:stats.totalProducts, sub:'actief',            color:'text-white' },
          { label:'Feed-ready',  value:stats.feedReady,     sub:'van '+stats.totalProducts, color:'text-emerald-400' },
          { label:'Met issues',  value:stats.withIssues,    sub:'producten',         color:stats.withIssues>0?'text-amber-400':'text-gray-500' },
          { label:'Feeds live',  value:stats.activeFeeds,   sub:'kanalen',           color:'text-indigo-400' },
          { label:'Regels actief',value:rules.filter(r=>r.active).length, sub:'filters', color:'text-purple-400' },
        ].map((c, i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{c.label}</div>
            <div className={'text-2xl font-bold tabular-nums ' + c.color}>{c.value}</div>
            <div className="text-xs text-gray-600 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {([['overview','📊 Overzicht'],['products','📦 Producten'],['feeds','🔗 Feeds'],['rules','📋 Regels'],['ai','🤖 AI'],['ab_testing','🔬 A/B'],['versions','🔖 Versies'],['alerts','🔔 Alerts']] as [TabKey,string][]).map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)} className={'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ' + (tab===key?'bg-gray-800 text-white':'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50')}>
            {label}{key==='alerts' && alerts.length>0 && <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-red-600 text-white rounded-full">{alerts.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Live Feeds</h3>
            {feedConfigs.length === 0 ? <p className="text-sm text-gray-600">Geen feed configuraties.</p> : (
              <div className="space-y-2">{feedConfigs.map(fc => { const mkt = markets.find(m => m.id === fc.market_id); return (
                <div key={fc.id} className="flex items-center justify-between py-2">
                  <div><div className="text-sm font-medium text-gray-200">{fc.feed_name || ((mkt?.code ?? '') + ' ' + fc.channel)}</div><div className="text-xs text-gray-500">{mkt?.name} · {fc.channel}</div></div>
                  <span className={'px-2 py-0.5 rounded text-xs font-medium ' + (fc.is_active?'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50':'bg-gray-800 text-gray-500 border border-gray-700')}>{fc.is_active?'Live':'Inactief'}</span>
                </div>); })}</div>
            )}
          </div>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Product Readiness</h3>
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1"><span className="text-gray-400">Feed-ready</span><span className="text-emerald-400 font-medium">{stats.totalProducts>0?Math.round((stats.feedReady/stats.totalProducts)*100):0}%</span></div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{width:(stats.totalProducts>0?(stats.feedReady/stats.totalProducts)*100:0)+'%'}} /></div>
            </div>
            {stats.withIssues>0 && <div className="space-y-1"><div className="text-xs text-gray-500 mb-2">Veelvoorkomende issues:</div>
              {(() => { const ic:Record<string,number>={}; products.forEach(p=>p.feed_issues.forEach(i=>{ic[i]=(ic[i]||0)+1;})); return Object.entries(ic).sort(([,a],[,b])=>b-a).map(([issue,count])=><div key={issue} className="flex items-center justify-between text-xs"><span className="text-amber-400">⚠ {issue}</span><span className="text-gray-500">{count}p</span></div>); })()}
            </div>}
          </div>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Markten</h3>
            <div className="space-y-2">{markets.map(m => { const cfgs=feedConfigs.filter(fc=>fc.market_id===m.id); const ac=cfgs.filter(c=>c.is_active).length; return (
              <div key={m.id} className="flex items-center justify-between py-1"><div className="flex items-center gap-2"><span className="text-lg">{FLAGS[m.code]||'🌐'}</span><div><div className="text-sm text-gray-200">{m.name}</div><div className="text-xs text-gray-500">{m.language} · {ac} feeds actief</div></div></div>
              <span className={'text-xs px-2 py-0.5 rounded '+(m.status==='primary'?'bg-emerald-950/50 text-emerald-400':'bg-gray-800 text-gray-500')}>{m.status}</span></div>); })}</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-gray-300">Recente Alerts</h3>{alerts.length>0&&<button onClick={()=>setTab('alerts')} className="text-xs text-indigo-400 hover:text-indigo-300">Alle alerts →</button>}</div>
            {alerts.length===0?<p className="text-sm text-gray-600">Geen openstaande alerts.</p>:<div className="space-y-2">{alerts.slice(0,5).map(a=><div key={a.id} className={'px-3 py-2 rounded-lg border text-sm '+(sevColor[a.severity]||sevColor.info)}><div className="flex items-center justify-between"><span>{a.message}</span><span className="text-xs opacity-60 ml-2 whitespace-nowrap">{timeAgo(a.created_at)}</span></div></div>)}</div>}
          </div>
        </div>
      )}

      {/* ── Products ─────────────────────────────────────────────────────────── */}
      {tab === 'products' && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input type="text" placeholder="Zoek op naam, EAN of SKU..." value={search} onChange={e=>setSearch(e.target.value)} className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-64" />
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value as any)} className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200">
              <option value="all">Alle statussen</option><option value="ready">Feed-ready</option><option value="issues">Met issues</option>
            </select>
            <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200">
              <option value="all">Alle categorieën</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-xs text-gray-500 ml-auto">{filtered.length} producten</span>
          </div>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-800">
                  {['Product','EAN / SKU','Prijs',"Foto's",'Talen','Status'].map(h=><th key={h} className={'px-4 py-3 text-xs font-medium text-gray-500 uppercase '+(h==='Prijs'||h==="Foto's"||h==='Talen'||h==='Status'?'text-center':'')}>{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-800/50">
                  {filtered.map(p => (
                    <tr key={p.id} onClick={()=>setExpandedProd(expandedProd===p.id?null:p.id)} className="hover:bg-gray-800/30 cursor-pointer transition-colors">
                      <td className="px-4 py-3"><div className="flex items-center gap-3">
                        {p.image_url?<img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-800"/>:<div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-600 text-xs">?</div>}
                        <div><div className="text-sm font-medium text-gray-200">{p.name_nl}</div><div className="text-xs text-gray-500">{p.category||'Geen categorie'}</div></div>
                      </div></td>
                      <td className="px-4 py-3"><div className="text-xs text-gray-300 font-mono">{p.ean||<span className="text-red-400">—</span>}</div><div className="text-xs text-gray-500 font-mono">{p.sku||<span className="text-red-400">geen SKU</span>}</div></td>
                      <td className="px-4 py-3 text-right"><div className="text-sm text-gray-200 tabular-nums">{fmtPrice(p.price_eur)}</div>{p.sale_price_eur&&<div className="text-xs text-emerald-400 tabular-nums">Sale: {fmtPrice(p.sale_price_eur)}</div>}</td>
                      <td className="px-4 py-3 text-center"><span className={'text-sm tabular-nums '+((p.additional_images?.length||0)+(p.image_url?1:0)>3?'text-emerald-400':'text-amber-400')}>{(p.additional_images?.length||0)+(p.image_url?1:0)}</span>{p.image_bank_count>0&&<span className="text-xs text-gray-500 ml-1">+{p.image_bank_count}</span>}</td>
                      <td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-1">{['nl','en','de','fr'].map(lang=>{const has=p.content_languages.some(c=>c.language===lang);return<span key={lang} className={'text-xs px-1.5 py-0.5 rounded '+(has?'bg-indigo-950/50 text-indigo-400':'bg-gray-800/50 text-gray-600')}>{lang.toUpperCase()}</span>;})}</div></td>
                      <td className="px-4 py-3 text-center">{p.feed_ready?<span className="px-2 py-0.5 text-xs font-medium bg-emerald-950/50 text-emerald-400 border border-emerald-900/50 rounded">✓ Ready</span>:<span className="px-2 py-0.5 text-xs font-medium bg-amber-950/50 text-amber-400 border border-amber-900/50 rounded">{p.feed_issues.length} issues</span>}</td>
                    </tr>
                  ))}
                  {filtered.length===0&&<tr><td colSpan={6} className="px-4 py-12 text-center text-gray-600">{products.length===0?'Geen producten. Klik "Shopify Sync" om producten op te halen.':'Geen producten voor deze filters.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          {expandedProd&&(()=>{const p=products.find(pr=>pr.id===expandedProd);if(!p)return null;return(
            <div className="mt-4 bg-gray-900/50 border border-gray-800/50 rounded-xl p-5"><div className="flex items-start gap-4">
              {p.image_url&&<img src={p.image_url} alt="" className="w-24 h-24 rounded-xl object-cover bg-gray-800"/>}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-100">{p.name_nl}</h3>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm">
                  <span className="text-gray-400">EAN: <span className="text-gray-200 font-mono">{p.ean||'—'}</span></span>
                  <span className="text-gray-400">SKU: <span className="text-gray-200 font-mono">{p.sku||'—'}</span></span>
                  <span className="text-gray-400">Categorie: <span className="text-gray-200">{p.category||'—'}</span></span>
                  <span className="text-gray-400">Shopify ID: <span className="text-gray-200 font-mono">{p.shopify_id||'—'}</span></span>
                </div>
                {p.feed_issues.length>0&&<div className="mt-3 flex flex-wrap gap-2">{p.feed_issues.map(i=><span key={i} className="px-2 py-1 text-xs bg-amber-950/40 text-amber-400 border border-amber-900/50 rounded">⚠ {i}</span>)}</div>}
                {p.shopify_tags&&p.shopify_tags.length>0&&<div className="mt-3 flex flex-wrap gap-1">{p.shopify_tags.map(t=><span key={t} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-400 rounded">{t}</span>)}</div>}
                {p.description_nl&&<p className="mt-3 text-xs text-gray-500 line-clamp-3">{p.description_nl.substring(0,300)}...</p>}
              </div>
            </div></div>);})()}
        </div>
      )}

      {/* ── Feeds ────────────────────────────────────────────────────────────── */}
      {tab === 'feeds' && (
        <div className="space-y-5">
          {markets.map(mkt => {
            const cfgs = feedConfigs.filter(fc => fc.market_id === mkt.id);
            if (cfgs.length === 0) return null;
            return (
              <div key={mkt.id} className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">{FLAGS[mkt.code] ?? '🌐'}</span>
                  <h3 className="font-semibold text-gray-200">{mkt.name}</h3>
                  <span className="text-xs text-gray-500 ml-1">{mkt.language_code?.toUpperCase()}</span>
                </div>
                <div className="space-y-3">
                  {cfgs.map(cfg => {
                    const feedPath = `/api/feed/output?market=${mkt.code}&channel=${cfg.channel}`;
                    const key      = `${mkt.code}_${cfg.channel}`;
                    const preview  = feedPreviews[key] as (FeedPreview & { _error?: string }) | undefined;
                    const isLoading= previewLoading === key;

                    return (
                      <div key={cfg.id} className="border border-gray-800 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded bg-gray-800 text-gray-300 text-xs font-bold flex items-center justify-center">{CHANNEL_ICONS[cfg.channel] ?? cfg.channel[0].toUpperCase()}</span>
                              <span className="font-medium text-gray-200 capitalize">{cfg.feed_name || cfg.channel}</span>
                              <span className={'text-xs px-1.5 py-0.5 rounded ' + (cfg.is_active ? 'bg-emerald-950/50 text-emerald-400' : 'bg-gray-800 text-gray-500')}>
                                {cfg.is_active ? 'Live' : 'Inactief'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <code className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 font-mono truncate max-w-xs">{feedPath}</code>
                              <button onClick={() => copyUrl(feedPath, key)} className={'text-xs px-2 py-1 rounded transition-colors ' + (copied === key ? 'bg-emerald-900/40 text-emerald-400' : 'bg-gray-800 text-gray-400 hover:text-gray-200')}>
                                {copied === key ? '✓ Gekopieerd' : 'Kopieer URL'}
                              </button>
                              <a href={feedPath} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-gray-200">Open ↗</a>
                            </div>
                            {cfg.last_fetched_at && <div className="text-xs text-gray-600 mt-1">Laatst opgehaald: {timeAgo(cfg.last_fetched_at)}</div>}
                          </div>
                          <button onClick={() => loadFeedPreview(mkt.code, cfg.channel)} disabled={isLoading} className="shrink-0 text-xs px-3 py-1.5 bg-indigo-900/40 text-indigo-400 hover:bg-indigo-900/60 disabled:opacity-50 rounded-lg transition-colors">
                            {isLoading ? '...' : 'Preview'}
                          </button>
                        </div>

                        {preview && (
                          <div className="mt-4 pt-4 border-t border-gray-800">
                            {(preview as any)._error ? (
                              <p className="text-xs text-red-400">{(preview as any)._error}</p>
                            ) : (
                              <>
                                <div className="flex items-center gap-4 text-xs mb-3">
                                  <span className="text-gray-500">{preview.total_before_rules} producten totaal</span>
                                  <span className="text-amber-400">−{preview.excluded} uitgesloten door regels</span>
                                  <span className="text-emerald-400 font-medium">{preview.total_after_rules} in feed</span>
                                </div>
                                {preview.products.length > 0 && (
                                  <div className="grid grid-cols-5 gap-2">
                                    {preview.products.map(p => (
                                      <div key={p.id} className="bg-gray-800/50 rounded-lg p-2">
                                        {p.image
                                          ? <img src={p.image} alt="" className="w-full h-14 object-cover rounded mb-1.5" />
                                          : <div className="w-full h-14 bg-gray-700 rounded mb-1.5 flex items-center justify-center text-gray-600 text-xs">?</div>}
                                        <div className="text-xs text-gray-300 truncate leading-tight">{p.title}</div>
                                        <div className="text-xs text-gray-500 tabular-nums mt-0.5">{p.price != null ? '€' + Number(p.price).toFixed(2) : '—'}</div>
                                        {!p.ean && <div className="text-xs text-amber-500 mt-0.5">geen EAN</div>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {feedConfigs.length === 0 && (
            <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-8 text-center">
              <div className="text-3xl mb-3">🔗</div>
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Geen feed configuraties</h3>
              <p className="text-sm text-gray-500">Voeg rows toe aan <code className="text-indigo-400">feed_market_configs</code> in Supabase.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Rules ────────────────────────────────────────────────────────────── */}
      {tab === 'rules' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-200">{rules.length} regels</h3>
              <p className="text-xs text-gray-500 mt-0.5">{rules.filter(r=>r.active).length} actief · worden op volgorde van prioriteit toegepast</p>
            </div>
            <button onClick={()=>setNewRuleOpen(o=>!o)} className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
              {newRuleOpen ? '✕ Annuleer' : '+ Nieuwe Regel'}
            </button>
          </div>

          {/* New rule form */}
          {newRuleOpen && (
            <div className="mb-4 bg-gray-900/70 border border-indigo-900/50 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-gray-200 mb-4">Nieuwe Feed Regel</h4>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Naam *</label>
                  <input value={ruleName} onChange={e=>setRuleName(e.target.value)} placeholder="bv. Geen EAN uitsluiten" className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Type *</label>
                  <select value={ruleType} onChange={e=>setRuleType(e.target.value as any)} className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200">
                    <option value="filter">Filter — uitsluit van feed</option>
                    <option value="transform">Transform — veld aanpassen</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-2 block">Als (alle condities gelden)</label>
                <div className="space-y-2">
                  {ruleConds.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select value={c.field} onChange={e=>updateCond(i,'field',e.target.value)} className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 w-32">
                        {FIELDS.map(f=><option key={f} value={f}>{FIELD_NL[f]}</option>)}
                      </select>
                      <select value={c.operator} onChange={e=>updateCond(i,'operator',e.target.value)} className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 w-36">
                        {OPS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                      {!NO_VAL_OPS.includes(c.operator) && (
                        <input value={c.value ?? ''} onChange={e=>updateCond(i,'value',e.target.value)} placeholder="waarde..." className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-indigo-500" />
                      )}
                      {ruleConds.length > 1 && (
                        <button onClick={()=>setRuleConds(prev=>prev.filter((_,j)=>j!==i))} className="text-gray-600 hover:text-red-400 text-lg leading-none">×</button>
                      )}
                      {/* Live count */}
                      {products.length > 0 && (
                        <span className="text-xs text-gray-600 whitespace-nowrap">
                          {products.filter(p=>evalCond(p,c)).length}p
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={()=>setRuleConds(prev=>[...prev,{...BLANK_COND}])} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300">+ Conditie toevoegen</button>
              </div>

              <div className="mb-4">
                {ruleType === 'filter' ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">Dan:</span>
                    <span className="px-2 py-1 bg-red-950/40 text-red-400 border border-red-900/50 rounded text-xs">Uitsluit van alle feeds</span>
                    {products.length > 0 && ruleConds.length > 0 && (
                      <span className="text-xs text-gray-500 ml-2">
                        → {countAffected({ conditions: ruleConds } as Rule, products)} producten worden uitgesloten
                      </span>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block">Dan: stel in</label>
                    <div className="flex items-center gap-2">
                      <select value={ruleSetField} onChange={e=>setRuleSetField(e.target.value)} className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 w-32">
                        {FIELDS.filter(f=>f!=='price').map(f=><option key={f} value={f}>{FIELD_NL[f]}</option>)}
                      </select>
                      <span className="text-gray-500 text-sm">op</span>
                      <input value={ruleSetValue} onChange={e=>setRuleSetValue(e.target.value)} placeholder="nieuwe waarde..." className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                )}
              </div>

              {ruleError && <p className="text-xs text-red-400 mb-3">{ruleError}</p>}

              <div className="flex gap-2">
                <button onClick={saveRule} disabled={savingRule} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors">
                  {savingRule ? 'Opslaan...' : 'Regel opslaan'}
                </button>
                <button onClick={()=>setNewRuleOpen(false)} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">Annuleren</button>
              </div>
            </div>
          )}

          {/* Rules list */}
          <div className="space-y-2">
            {rules.length === 0 && !newRuleOpen && (
              <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-8 text-center">
                <div className="text-3xl mb-3">📋</div>
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Geen regels</h3>
                <p className="text-sm text-gray-500">Maak regels aan om producten te filteren of transformeren.</p>
              </div>
            )}
            {rules.map(rule => {
              const affected = countAffected(rule, products);
              return (
                <div key={rule.id} className={'border rounded-xl p-4 transition-opacity ' + (rule.active ? 'bg-gray-900/50 border-gray-800/50' : 'bg-gray-900/20 border-gray-800/30 opacity-60')}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {/* Toggle */}
                      <button onClick={()=>toggleRule(rule.id, !rule.active)} className={'relative w-9 h-5 rounded-full shrink-0 mt-0.5 transition-colors ' + (rule.active ? 'bg-indigo-600' : 'bg-gray-700')}>
                        <span className={'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ' + (rule.active ? 'translate-x-4' : 'translate-x-0.5')} />
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-200">{rule.name}</span>
                          <span className={'text-xs px-1.5 py-0.5 rounded ' + (rule.type === 'filter' ? 'bg-amber-950/50 text-amber-400' : 'bg-indigo-950/50 text-indigo-400')}>
                            {rule.type === 'filter' ? 'Filter' : 'Transform'}
                          </span>
                          <span className="text-xs text-gray-600">p{rule.priority}</span>
                        </div>
                        <div className="mt-1.5 text-xs text-gray-500 space-y-0.5">
                          {(rule.conditions ?? []).map((c, i) => (
                            <span key={i} className="inline-flex items-center gap-1 mr-3">
                              <span className="text-gray-400">{FIELD_NL[c.field] ?? c.field}</span>
                              <span>{OPS.find(o=>o.v===c.operator)?.l ?? c.operator}</span>
                              {c.value && <span className="text-indigo-400 font-mono">"{c.value}"</span>}
                              {i < (rule.conditions.length - 1) && <span className="text-gray-600 ml-1">EN</span>}
                            </span>
                          ))}
                        </div>
                        <div className="mt-1 text-xs">
                          {rule.type === 'filter'
                            ? <span className="text-amber-500">→ Uitsluit van feed</span>
                            : <span className="text-indigo-400">→ Stel <span className="font-mono">{rule.actions?.set_field}</span> in op <span className="font-mono">"{rule.actions?.value}"</span></span>}
                          {affected > 0 && <span className="text-gray-600 ml-2">({affected} product{affected !== 1 ? 'en' : ''})</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={()=>deleteRule(rule.id)} disabled={deletingRule===rule.id} className="shrink-0 text-xs text-gray-600 hover:text-red-400 disabled:opacity-50 transition-colors px-2 py-1 rounded hover:bg-red-950/20">
                      {deletingRule === rule.id ? '...' : 'Verwijder'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Placeholder tabs ─────────────────────────────────────────────────── */}
      {tab === 'ai'         && <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-8 text-center"><div className="text-3xl mb-3">🤖</div><h3 className="text-lg font-semibold text-gray-300 mb-2">AI Enrichments</h3><p className="text-sm text-gray-500">Deel 3 — Claude titel & beschrijving optimalisatie per taal.</p></div>}
      {tab === 'ab_testing' && <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-8 text-center"><div className="text-3xl mb-3">🔬</div><h3 className="text-lg font-semibold text-gray-300 mb-2">A/B Testing</h3><p className="text-sm text-gray-500">Deel 4 — Simultane A/B tests op titels, beschrijvingen en afbeeldingen.</p></div>}
      {tab === 'versions'   && <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-8 text-center"><div className="text-3xl mb-3">🔖</div><h3 className="text-lg font-semibold text-gray-300 mb-2">Versie Beheer</h3><p className="text-sm text-gray-500">Deel 3 — Feed versie-historie met rollback.</p></div>}
      {tab === 'alerts'     && (
        alerts.length === 0
          ? <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-8 text-center"><div className="text-3xl mb-3">✓</div><h3 className="text-lg font-semibold text-gray-300 mb-2">Geen openstaande alerts</h3></div>
          : <div className="space-y-2">{alerts.map(a=><div key={a.id} className={'px-4 py-3 rounded-xl border '+(sevColor[a.severity]||sevColor.info)}><div className="flex items-center justify-between"><div><span className="text-sm font-medium">{a.message}</span><div className="text-xs opacity-60 mt-0.5">{a.channel&&(a.channel+' · ')}{timeAgo(a.created_at)}</div></div><span className="text-xs px-2 py-0.5 rounded bg-black/20">{a.severity}</span></div></div>)}</div>
      )}
    </div>
  );
}
