'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
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
type Market     = { id: string; code: string; name: string; language: string; language_code: string; status: string };
type FeedConfig = { id: string; market_id: string; channel: string; feed_name: string; is_active: boolean; last_fetched_at: string | null };
type Alert      = { id: string; type: string; severity: string; message: string; product_id: string | null; channel: string | null; created_at: string };
type Stats      = { totalProducts: number; feedReady: number; withIssues: number; activeFeeds: number; activeRules: number };
type Condition  = { field: string; operator: string; value?: string };
type Rule       = { id: string; name: string; type: 'filter'|'transform'; scope: 'master'|'partner'; channel: string|null; conditions: Condition[]; actions: Record<string,any>; priority: number; active: boolean; created_at: string };
type ActionType = 'set_field'|'find_replace'|'prepend_if_missing'|'append_if_missing'|'copy_field';
type FeedPreview= { total_before_rules: number; total_after_rules: number; excluded: number; products: { id:string; title:string; price:number|null; ean:string|null; sku:string|null; image:string|null }[] };
type Variant    = { id: string; label: string; compliance: 'green'|'orange'; channel?: string; season?: string; title: string; description_short?: string; description_long?: string };
type ReviewItem = { id: string; product_id: string; language: string; title: string|null; description: string|null; description_short: string|null; description_long: string|null; ai_variants: Variant[]|null; ai_status: string; selected_variant_id: string|null; channel_optimized_for: string|null; season: string|null; ctr_14d: number|null; product: { id:string; name_nl:string; image_url:string|null; category:string|null; price_eur:number|null }|null };
type Batch      = { id: string; language: string; field: string; channel: string; season: string|null; status: string; product_count: number; tokens_input: number; tokens_output: number; cost_usd: number; created_at: string; completed_at: string|null };
type Version    = { id: string; channel: string; version_number: number; product_count: number; note: string|null; created_at: string; markets: { code: string; name: string } | null };
type ChangelogEntry = { id: string; field: string; old_value: string|null; new_value: string|null; source: string; language: string|null; created_at: string; product_id: string|null; product_name: string|null };
type TabKey     = 'overview'|'products'|'feeds'|'rules'|'ai'|'ab_testing'|'versions'|'alerts'|'labels';
type ABTest     = { id:string; name:string; field:'title'|'description'|'image'; status:'draft'|'active'|'completed'|'paused'; product_count:number; variant_a_label:string; variant_b_label:string; created_at:string; started_at:string|null; ended_at:string|null; winner:string|null; metrics:{ A:{impressions:number;clicks:number;conversions:number;revenue:number}; B:{impressions:number;clicks:number;conversions:number;revenue:number} }; significance:{ significant:boolean; p_value:number; ctrA:number; ctrB:number; needs_more_data:boolean } };
type CustomLabel= { product_id:string; custom_label_0:string|null; custom_label_1:string|null; custom_label_2:string|null; custom_label_3:string|null; custom_label_4:string|null; label_0_override:boolean; label_1_override:boolean; label_2_override:boolean; label_3_override:boolean; label_4_override:boolean };
type PanelTab   = 'status'|'content'|'rules'|'images'|'changelog';
type PanelData  = { content:Record<string,any>; images:any[]; changelog:any[]; feed_status:any[]; ab_assignments:any[] };

// ── Constants ─────────────────────────────────────────────────────────────────
const FLAGS: Record<string,string> = { NL:'🇳🇱', BE:'🇧🇪', DE:'🇩🇪', FR:'🇫🇷', AT:'🇦🇹', CH:'🇨🇭' };
const CHANNEL_ICONS: Record<string,string> = { google:'G', meta:'M', awin:'A', bol:'B' };
const FIELDS = ['title','price','ean','sku','category','brand','description'] as const;
const FIELD_NL: Record<string,string> = { title:'Titel', price:'Prijs', ean:'EAN', sku:'SKU', category:'Categorie', brand:'Merk', description:'Beschrijving' };
const OPS = [
  { v:'contains',l:'bevat' }, { v:'not_contains',l:'bevat niet' }, { v:'equals',l:'gelijk aan' },
  { v:'not_equals',l:'niet gelijk aan' }, { v:'is_empty',l:'is leeg' }, { v:'is_not_empty',l:'is niet leeg' },
  { v:'greater_than',l:'groter dan' }, { v:'less_than',l:'kleiner dan' },
];
const NO_VAL_OPS = ['is_empty','is_not_empty'];
const FIELD_MAP: Record<string, keyof Product> = {
  title:'name_nl', name:'name_nl', price:'price_eur',
  ean:'ean', sku:'sku', category:'category', description:'description_nl', brand:'brand',
};
const COMPLIANCE_STYLE: Record<string,string> = {
  green:  'bg-emerald-950/40 border-emerald-900/50 text-emerald-400',
  orange: 'bg-amber-950/40 border-amber-900/50 text-amber-400',
};
const BLANK_COND: Condition = { field:'title', operator:'contains', value:'' };
const LABEL_OPTIONS = [
  ['Hero','Sidekick','Villain','Zombie'],
  ['Budget','Mid','Premium','Ultra'],
  ['Winterfavoriet','Zomerhit','Altijd groen'],
  ['Hoge marge >60%','Normale marge','Lage marge <30%'],
  ['Push','Maintain','Phase out'],
];
const LABEL_HEADS = ['Tier','Prijs','Seizoen','Marge','Strategie'];
const LABEL_STYLES: Record<string,string> = {
  Hero:'border-yellow-700/60 bg-yellow-950/30 text-yellow-400',
  Sidekick:'border-blue-700/60 bg-blue-950/20 text-blue-400',
  Villain:'border-red-700/60 bg-red-950/20 text-red-400',
  Zombie:'border-gray-700/60 bg-gray-800/30 text-gray-500',
  Budget:'border-gray-700/60 text-gray-400',
  Mid:'border-indigo-700/60 text-indigo-400',
  Premium:'border-purple-700/60 text-purple-400',
  Ultra:'border-amber-700/60 text-amber-400',
  Winterfavoriet:'border-blue-700/60 text-blue-400',
  Zomerhit:'border-yellow-700/60 text-yellow-400',
  'Altijd groen':'border-emerald-700/60 text-emerald-400',
  'Hoge marge >60%':'border-emerald-700/60 text-emerald-400',
  'Normale marge':'border-gray-700/60 text-gray-400',
  'Lage marge <30%':'border-red-700/60 text-red-400',
  Push:'border-emerald-700/60 text-emerald-400',
  Maintain:'border-gray-700/60 text-gray-400',
  'Phase out':'border-red-700/60 text-red-400',
};

function evalCond(p: Product, c: Condition): boolean {
  const val = p[FIELD_MAP[c.field] ?? c.field as keyof Product] as unknown;
  switch (c.operator) {
    case 'contains':     return String(val??'').toLowerCase().includes(String(c.value??'').toLowerCase());
    case 'not_contains': return !String(val??'').toLowerCase().includes(String(c.value??'').toLowerCase());
    case 'equals':       return val == c.value;
    case 'not_equals':   return val != c.value;
    case 'is_empty':     return val===null||val===undefined||val===''||val===0;
    case 'is_not_empty': return val!==null&&val!==undefined&&val!==''&&val!==0;
    case 'greater_than': return Number(val)>Number(c.value);
    case 'less_than':    return Number(val)<Number(c.value);
    default:             return false;
  }
}

export default function FeedSuitePage() {
  // Core data
  const [products,      setProducts]      = useState<Product[]>([]);
  const [markets,       setMarkets]        = useState<Market[]>([]);
  const [feedConfigs,   setFeedConfigs]    = useState<FeedConfig[]>([]);
  const [alerts,        setAlerts]         = useState<Alert[]>([]);
  const [stats,         setStats]          = useState<Stats>({ totalProducts:0, feedReady:0, withIssues:0, activeFeeds:0, activeRules:0 });
  const [rules,         setRules]          = useState<Rule[]>([]);
  const [loading,       setLoading]        = useState(true);
  const [syncing,       setSyncing]        = useState(false);
  const [syncResult,    setSyncResult]     = useState<string|null>(null);
  const [tab,           setTab]            = useState<TabKey>('overview');
  // Products tab
  const [search,        setSearch]         = useState('');
  const [filterStatus,  setFilterStatus]   = useState<'all'|'ready'|'issues'>('all');
  const [filterCat,     setFilterCat]      = useState('all');
  const [expandedProd,  setExpandedProd]   = useState<string|null>(null);
  // Feeds tab
  const [feedPreviews,  setFeedPreviews]   = useState<Record<string,FeedPreview>>({});
  const [prevLoading,   setPrevLoading]    = useState<string|null>(null);
  const [copied,        setCopied]         = useState<string|null>(null);
  // Rules tab
  const [newRuleOpen,   setNewRuleOpen]    = useState(false);
  const [editingRule,   setEditingRule]    = useState<Rule|null>(null);
  const [partnerCh,     setPartnerCh]      = useState('google');
  const [ruleName,      setRuleName]       = useState('');
  const [ruleType,      setRuleType]       = useState<'filter'|'transform'>('filter');
  const [ruleScope,     setRuleScope]      = useState<'master'|'partner'>('master');
  const [ruleCh,        setRuleCh]         = useState('google');
  const [ruleConds,     setRuleConds]      = useState<Condition[]>([{...BLANK_COND}]);
  const [ruleActionType,setRuleActionType] = useState<ActionType>('set_field');
  const [ruleSetField,  setRuleSetField]   = useState('title');
  const [ruleSetValue,  setRuleSetValue]   = useState('');
  const [ruleFindVal,   setRuleFindVal]    = useState('');
  const [ruleReplaceVal,setRuleReplaceVal] = useState('');
  const [ruleUseRegex,  setRuleUseRegex]   = useState(false);
  const [ruleCopyFrom,  setRuleCopyFrom]   = useState('title');
  const [ruleCopyTo,    setRuleCopyTo]     = useState('description');
  const [savingRule,    setSavingRule]     = useState(false);
  const [ruleError,     setRuleError]      = useState<string|null>(null);
  const [deletingRule,  setDeletingRule]   = useState<string|null>(null);
  const [copyingAll,    setCopyingAll]     = useState(false);
  // AI tab
  const [aiLang,        setAiLang]         = useState('nl');
  const [aiChannel,     setAiChannel]      = useState('all');
  const [aiSeason,      setAiSeason]       = useState('');
  const [selectedProds, setSelectedProds]  = useState<Set<string>>(new Set());
  const [enriching,     setEnriching]      = useState(false);
  const [enrichResult,  setEnrichResult]   = useState<{enriched:number; total:number; cost_usd:number; tokens_input:number; tokens_output:number}|null>(null);
  const [reviewItems,   setReviewItems]    = useState<ReviewItem[]>([]);
  const [reviewLoading, setReviewLoading]  = useState(false);
  const [batches,       setBatches]        = useState<Batch[]>([]);
  const [approving,     setApproving]      = useState<string|null>(null);
  const [changelog,     setChangelog]      = useState<ChangelogEntry[]>([]);
  const [changelogOpen, setChangelogOpen]  = useState(false);
  // Versions tab
  const [versions,      setVersions]       = useState<Version[]>([]);
  const [versionsLoading,setVersionsLoading]=useState(false);
  const [snapMarket,    setSnapMarket]     = useState('NL');
  const [snapChannel,   setSnapChannel]    = useState('google');
  const [snapNote,      setSnapNote]       = useState('');
  const [snapshotting,  setSnapshotting]   = useState(false);
  const [rollingBack,   setRollingBack]    = useState<string|null>(null);
  const [rollbackResult,setRollbackResult] = useState<string|null>(null);
  // Product panel (slide-over)
  const [panelProductId,setPanelProductId] = useState<string|null>(null);
  const [panelTab,      setPanelTab]       = useState<PanelTab>('status');
  const [panelData,     setPanelData]      = useState<PanelData|null>(null);
  const [panelLoading,  setPanelLoading]   = useState(false);
  const [panelLang,     setPanelLang]      = useState('nl');
  const [panelEdit,     setPanelEdit]      = useState<Record<string,{title?:string;description_short?:string;description_long?:string}>>({});
  const [panelSaving,   setPanelSaving]    = useState(false);
  // A/B Testing
  const [abTests,       setAbTests]        = useState<ABTest[]>([]);
  const [abLoading,     setAbLoading]      = useState(false);
  const [newTestOpen,   setNewTestOpen]    = useState(false);
  const [testName,      setTestName]       = useState('');
  const [testField,     setTestField]      = useState<'title'|'description'|'image'>('title');
  const [testProductIds,setTestProductIds] = useState<Set<string>>(new Set());
  const [creatingTest,  setCreatingTest]   = useState(false);
  const [testError,     setTestError]      = useState<string|null>(null);
  const [applyingWinner,setApplyingWinner] = useState<string|null>(null);
  // Alerts
  const [alertTypeFilter,setAlertTypeFilter]=useState('all');
  const [acknowledging, setAcknowledging]  = useState<string|null>(null);
  // AI inline edit
  const [editingVariant,setEditingVariant] = useState<{itemId:string;variantId:string}|null>(null);
  const [editVariantVal,setEditVariantVal] = useState('');
  const [savingVariant, setSavingVariant]  = useState(false);
  // Custom labels
  const [customLabels,    setCustomLabels]    = useState<CustomLabel[]>([]);
  const [labelsLoading,   setLabelsLoading]   = useState(false);
  const [calculatingLbls, setCalculatingLbls] = useState(false);
  const [calcResult,      setCalcResult]      = useState<string|null>(null);
  const [editingLbl,      setEditingLbl]      = useState<{productId:string;key:string;idx:number}|null>(null);
  const [editLblValue,    setEditLblValue]     = useState('');
  const [savingLbl,       setSavingLbl]        = useState(false);

  // ── Load core data ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [pRes, rRes] = await Promise.all([fetch('/api/feed/products'), fetch('/api/feed/rules')]);
      if (!pRes.ok) throw new Error('Producten laden mislukt');
      const pData = await pRes.json();
      setProducts(pData.products??[]); setMarkets(pData.markets??[]);
      setFeedConfigs(pData.feedConfigs??[]); setAlerts(pData.alerts??[]);
      setStats(pData.stats??{ totalProducts:0, feedReady:0, withIssues:0, activeFeeds:0, activeRules:0 });
      if (rRes.ok) { const rData = await rRes.json(); setRules(rData.rules??[]); }
    } catch(e) { console.error('Load error:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSync() {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch('/api/feed/sync', { method:'POST' });
      const d   = await res.json();
      setSyncResult(d.success ? `${d.synced}/${d.total} producten gesynchroniseerd` : 'Fout: '+d.error);
      if (d.success) await loadData();
    } catch(e:any) { setSyncResult('Sync gefaald: '+e.message); }
    finally { setSyncing(false); }
  }

  // ── Feed preview ─────────────────────────────────────────────────────────────
  async function loadFeedPreview(mkt:string, ch:string) {
    const key = `${mkt}_${ch}`; setPrevLoading(key);
    try {
      const res = await fetch(`/api/feed/output?market=${mkt}&channel=${ch}&preview=true`);
      const d   = await res.json();
      if (!res.ok) throw new Error(d.error??'Preview mislukt');
      setFeedPreviews(prev => ({ ...prev, [key]: d }));
    } catch(e:any) {
      setFeedPreviews(prev => ({ ...prev, [key]: { total_before_rules:0, total_after_rules:0, excluded:0, products:[], _error:e.message } as any }));
    } finally { setPrevLoading(null); }
  }

  function copyUrl(url:string, key:string) {
    navigator.clipboard.writeText(`${window.location.origin}${url}`).then(() => {
      setCopied(key); setTimeout(() => setCopied(c => c===key?null:c), 2000);
    });
  }

  // ── Rule CRUD ─────────────────────────────────────────────────────────────────
  async function toggleRule(id:string, active:boolean) {
    await fetch('/api/feed/rules', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, active }) });
    setRules(prev => prev.map(r => r.id===id?{...r,active}:r));
  }
  async function deleteRule(id:string) {
    setDeletingRule(id);
    await fetch(`/api/feed/rules?id=${id}`, { method:'DELETE' });
    setRules(prev => prev.filter(r => r.id!==id)); setDeletingRule(null);
  }
  function updateCond(i:number, k:keyof Condition, v:string) {
    setRuleConds(prev => prev.map((c,j) => j===i?{...c,[k]:v}:c));
  }
  function buildRuleActions(): Record<string,any> {
    if (ruleType === 'filter') return { type: 'exclude' };
    if (ruleActionType === 'set_field')          return { action_type:'set_field',          set_field:ruleSetField, value:ruleSetValue };
    if (ruleActionType === 'find_replace')       return { action_type:'find_replace',       field:ruleSetField, find:ruleFindVal, replace:ruleReplaceVal, use_regex:ruleUseRegex };
    if (ruleActionType === 'prepend_if_missing') return { action_type:'prepend_if_missing', field:ruleSetField, value:ruleSetValue };
    if (ruleActionType === 'append_if_missing')  return { action_type:'append_if_missing',  field:ruleSetField, value:ruleSetValue };
    if (ruleActionType === 'copy_field')         return { action_type:'copy_field',         from_field:ruleCopyFrom, to_field:ruleCopyTo };
    return {};
  }

  function resetRuleForm() {
    setRuleName(''); setRuleType('filter'); setRuleScope('master'); setRuleCh('google');
    setRuleConds([{...BLANK_COND}]); setRuleActionType('set_field');
    setRuleSetField('title'); setRuleSetValue(''); setRuleFindVal(''); setRuleReplaceVal('');
    setRuleUseRegex(false); setRuleCopyFrom('title'); setRuleCopyTo('description');
    setEditingRule(null); setNewRuleOpen(false);
  }

  function openEditRule(rule: Rule) {
    setEditingRule(rule); setRuleName(rule.name); setRuleType(rule.type);
    setRuleScope(rule.scope ?? 'master'); setRuleCh(rule.channel ?? 'google');
    setRuleConds((rule.conditions ?? []).length ? rule.conditions : [{...BLANK_COND}]);
    const at: ActionType = rule.actions?.action_type ?? (rule.actions?.set_field ? 'set_field' : 'set_field');
    setRuleActionType(at);
    setRuleSetField(rule.actions?.set_field ?? rule.actions?.field ?? 'title');
    setRuleSetValue(rule.actions?.value ?? '');
    setRuleFindVal(rule.actions?.find ?? ''); setRuleReplaceVal(rule.actions?.replace ?? '');
    setRuleUseRegex(rule.actions?.use_regex ?? false);
    setRuleCopyFrom(rule.actions?.from_field ?? 'title'); setRuleCopyTo(rule.actions?.to_field ?? 'description');
    setNewRuleOpen(true);
  }

  async function saveRule() {
    if (!ruleName.trim()) { setRuleError('Geef een naam op'); return; }
    setSavingRule(true); setRuleError(null);
    try {
      const payload = {
        name: ruleName.trim(), type: ruleType, scope: ruleScope,
        channel: ruleScope === 'partner' ? ruleCh : null,
        conditions: ruleConds, actions: buildRuleActions(),
        priority: editingRule ? editingRule.priority : rules.filter(r=>r.scope===ruleScope).length*10+10,
        active: editingRule ? editingRule.active : true,
        ...(editingRule ? { id: editingRule.id } : {}),
      };
      const method = editingRule ? 'PATCH' : 'POST';
      const res = await fetch('/api/feed/rules', { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (editingRule) setRules(prev => prev.map(r => r.id===editingRule.id ? d.rule : r));
      else setRules(prev => [...prev, d.rule]);
      resetRuleForm();
    } catch(e:any) { setRuleError(e.message); }
    finally { setSavingRule(false); }
  }

  async function duplicateRule(rule: Rule, targetScope?: 'master'|'partner', targetChannel?: string) {
    const res = await fetch('/api/feed/rules?action=duplicate', { method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ id:rule.id, scope:targetScope??rule.scope, channel:targetChannel??rule.channel }) });
    const d = await res.json();
    if (res.ok) setRules(prev => [...prev, d.rule]);
  }

  async function moveRule(rule: Rule, dir: 'up'|'down') {
    await fetch('/api/feed/rules', { method:'PATCH', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ id:rule.id, action:`move_${dir}` }) });
    const res = await fetch('/api/feed/rules');
    const d = await res.json();
    if (res.ok) setRules(d.rules??[]);
  }

  async function copyAllToPartner() {
    setCopyingAll(true);
    try {
      const res = await fetch('/api/feed/rules?action=copy_all_to_partner', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ channel: partnerCh }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setRules(prev => [...prev, ...(d.rules??[])]);
    } finally { setCopyingAll(false); }
  }

  // ── AI enrichment ─────────────────────────────────────────────────────────────
  async function runEnrichment() {
    if (!selectedProds.size) return;
    setEnriching(true); setEnrichResult(null);
    try {
      const res = await fetch('/api/feed/ai-enrich', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ product_ids:[...selectedProds], language:aiLang, field:'both', channel:aiChannel, season:aiSeason||null }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setEnrichResult({ enriched:d.enriched, total:d.total, cost_usd:d.cost_usd, tokens_input:d.tokens_input, tokens_output:d.tokens_output });
      setSelectedProds(new Set());
      await loadReviewQueue();
      await loadBatches();
    } catch(e:any) { setEnrichResult({ enriched:0, total:0, cost_usd:0, tokens_input:0, tokens_output:0 }); }
    finally { setEnriching(false); }
  }

  async function loadReviewQueue() {
    setReviewLoading(true);
    try {
      const res = await fetch(`/api/feed/ai-review?language=${aiLang}&status=pending`);
      const d   = await res.json();
      setReviewItems(d.items??[]);
    } finally { setReviewLoading(false); }
  }

  async function loadBatches() {
    const res = await fetch('/api/feed/ai-enrich');
    const d   = await res.json();
    setBatches(d.batches??[]);
  }

  async function loadChangelog() {
    const res = await fetch('/api/feed/ai-review?action=changelog');
    const d   = await res.json();
    setChangelog(d.entries??[]);
  }

  useEffect(() => {
    if (tab === 'ai') { loadReviewQueue(); loadBatches(); }
    if (tab === 'versions') { loadVersions(); }
    if (tab === 'ab_testing') { loadABTests(); }
    if (tab === 'labels') { loadLabels(); }
  }, [tab, aiLang]);

  async function approveVariant(item:ReviewItem, variantId:string) {
    const key = `${item.product_id}_${variantId}`; setApproving(key);
    try {
      await fetch('/api/feed/ai-review', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'approve', items:[{ product_id:item.product_id, language:item.language, variant_id:variantId }] }) });
      setReviewItems(prev => prev.filter(i => i.product_id!==item.product_id));
    } finally { setApproving(null); }
  }

  async function rejectAll(item:ReviewItem) {
    await fetch('/api/feed/ai-review', { method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ action:'reject', items:[{ product_id:item.product_id, language:item.language }] }) });
    setReviewItems(prev => prev.filter(i => i.product_id!==item.product_id));
  }

  async function bulkApproveAll() {
    if (!reviewItems.length) return;
    await fetch('/api/feed/ai-review', { method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ action:'approve', items:reviewItems.map(i => ({ product_id:i.product_id, language:i.language })) }) });
    setReviewItems([]);
  }

  // ── Versions ──────────────────────────────────────────────────────────────────
  async function loadVersions() {
    setVersionsLoading(true);
    try {
      const res = await fetch('/api/feed/versions');
      const d   = await res.json();
      setVersions(d.versions??[]);
    } finally { setVersionsLoading(false); }
  }

  async function createSnapshot() {
    setSnapshotting(true); setRollbackResult(null);
    try {
      const res = await fetch('/api/feed/versions', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ market:snapMarket, channel:snapChannel, note:snapNote||null }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setRollbackResult(`Versie ${d.version_number} aangemaakt — ${d.product_count} producten`);
      setSnapNote(''); await loadVersions();
    } catch(e:any) { setRollbackResult('Fout: '+e.message); }
    finally { setSnapshotting(false); }
  }

  async function rollback(versionId:string, versionNum:number) {
    setRollingBack(versionId); setRollbackResult(null);
    try {
      const res = await fetch(`/api/feed/versions?action=rollback&version_id=${versionId}`, { method:'POST' });
      const d   = await res.json();
      if (!res.ok) throw new Error(d.error);
      setRollbackResult(`Rollback naar v${versionNum}: ${d.restored} producten hersteld`);
    } catch(e:any) { setRollbackResult('Fout: '+e.message); }
    finally { setRollingBack(null); }
  }

  // ── Product panel ─────────────────────────────────────────────────────────────
  async function openPanel(productId:string) {
    setPanelProductId(productId); setPanelTab('status'); setPanelData(null); setPanelEdit({});
    setPanelLoading(true);
    try {
      const res = await fetch(`/api/feed/product-panel?product_id=${productId}`);
      const d = await res.json();
      if (res.ok) setPanelData(d);
    } finally { setPanelLoading(false); }
  }
  function closePanel() { setPanelProductId(null); setPanelData(null); }
  async function savePanelContent(lang:string) {
    if (!panelProductId) return;
    setPanelSaving(true);
    const edit = panelEdit[lang] ?? {};
    try {
      await fetch('/api/feed/product-panel', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ product_id:panelProductId, language:lang, ...edit }) });
      const res = await fetch(`/api/feed/product-panel?product_id=${panelProductId}`);
      const d = await res.json();
      if (res.ok) { setPanelData(d); setPanelEdit(prev => { const n={...prev}; delete n[lang]; return n; }); }
    } finally { setPanelSaving(false); }
  }

  // ── A/B Tests ─────────────────────────────────────────────────────────────────
  async function loadABTests() {
    setAbLoading(true);
    try { const res=await fetch('/api/feed/ab-tests'); const d=await res.json(); setAbTests(d.tests??[]); }
    finally { setAbLoading(false); }
  }
  async function createTest() {
    if (!testName.trim()||!testProductIds.size) { setTestError('Naam en minimaal 1 product zijn verplicht'); return; }
    setCreatingTest(true); setTestError(null);
    try {
      const res=await fetch('/api/feed/ab-tests', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:testName.trim(), field:testField, product_ids:[...testProductIds] }) });
      const d=await res.json();
      if (!res.ok) throw new Error(d.error);
      setAbTests(prev=>[d.test,...prev]); setNewTestOpen(false); setTestName(''); setTestProductIds(new Set());
    } catch(e:any) { setTestError(e.message); }
    finally { setCreatingTest(false); }
  }
  async function patchTest(id:string, body:Record<string,any>) {
    const res=await fetch('/api/feed/ab-tests', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, ...body }) });
    const d=await res.json();
    if (res.ok && d.test) setAbTests(prev=>prev.map(t=>t.id===id?d.test:t));
  }
  async function doApplyWinner(testId:string) {
    setApplyingWinner(testId);
    try { await patchTest(testId,{action:'apply_winner'}); }
    finally { setApplyingWinner(null); }
  }

  // ── Alerts ─────────────────────────────────────────────────────────────────────
  async function acknowledgeAlert(id:string) {
    setAcknowledging(id);
    try {
      await fetch('/api/feed/alerts', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id }) });
      setAlerts(prev=>prev.filter(a=>a.id!==id));
    } finally { setAcknowledging(null); }
  }
  async function acknowledgeAll() {
    setAcknowledging('all');
    try {
      await fetch('/api/feed/alerts', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ acknowledge_all:true }) });
      setAlerts([]);
    } finally { setAcknowledging(null); }
  }

  // ── Custom labels ─────────────────────────────────────────────────────────────
  async function loadLabels() {
    setLabelsLoading(true);
    try { const res=await fetch('/api/feed/labels'); const d=await res.json(); setCustomLabels(d.labels??[]); }
    finally { setLabelsLoading(false); }
  }
  async function calculateLabels() {
    setCalculatingLbls(true); setCalcResult(null);
    try {
      const res=await fetch('/api/feed/labels', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'calculate'}) });
      const d=await res.json();
      if (!res.ok) throw new Error(d.error);
      setCalcResult(`${d.calculated} labels berekend (Hero threshold: €${Number(d.hero_threshold).toFixed(0)})`);
      await loadLabels();
    } catch(e:any) { setCalcResult('Fout: '+e.message); }
    finally { setCalculatingLbls(false); }
  }
  async function saveLabelEdit(productId:string, labelKey:string) {
    setSavingLbl(true);
    try {
      await fetch('/api/feed/labels', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ product_id:productId, label_key:labelKey, value:editLblValue||null }) });
      setCustomLabels(prev => {
        const idx = prev.findIndex(l => l.product_id === productId);
        const overrideKey = `label_${editingLbl!.idx}_override` as keyof CustomLabel;
        const updated = { ...( idx>=0 ? prev[idx] : { product_id:productId } as any ), [labelKey]: editLblValue||null, [overrideKey]: !!editLblValue };
        return idx>=0 ? prev.map((l,i) => i===idx ? updated : l) : [...prev, updated];
      });
      setEditingLbl(null);
    } finally { setSavingLbl(false); }
  }

  // ── AI inline variant edit ────────────────────────────────────────────────────
  async function saveVariantEdit(item:ReviewItem) {
    if (!editingVariant) return;
    setSavingVariant(true);
    try {
      const updatedVariants=(item.ai_variants??[]).map(v=>v.id===editingVariant.variantId?{...v,title:editVariantVal}:v);
      await fetch('/api/feed/product-panel', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ product_id:item.product_id, language:item.language, ai_variants:updatedVariants }) });
      setReviewItems(prev=>prev.map(i=>i.product_id===item.product_id?{...i,ai_variants:updatedVariants}:i));
      setEditingVariant(null);
    } finally { setSavingVariant(false); }
  }
  function addManualVariant(item:ReviewItem) {
    const newId=`manual_${Date.now()}`;
    const nv:Variant={id:newId,label:'Eigen variant',compliance:'orange',title:''};
    setReviewItems(prev=>prev.map(i=>i.product_id===item.product_id?{...i,ai_variants:[...(i.ai_variants??[]),nv]}:i));
    setEditingVariant({itemId:item.product_id,variantId:newId}); setEditVariantVal('');
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))] as string[];
  const panelProd  = panelProductId ? (products.find(p=>p.id===panelProductId)??null) : null;
  const filtered   = products.filter(p => {
    if (search) { const q=search.toLowerCase(); if (!p.name_nl.toLowerCase().includes(q)&&!(p.ean??'').includes(q)&&!(p.sku??'').includes(q)) return false; }
    if (filterStatus==='ready'  && !p.feed_ready) return false;
    if (filterStatus==='issues' &&  p.feed_ready) return false;
    if (filterCat!=='all' && p.category!==filterCat) return false;
    return true;
  });
  const timeAgo  = (d:string) => { const m=Math.floor((Date.now()-new Date(d).getTime())/60000); if(m<60)return m+'m'; const h=Math.floor(m/60); if(h<24)return h+'u'; return Math.floor(h/24)+'d'; };
  const fmtPrice = (p:number|null) => p ? '€'+p.toFixed(2).replace('.',',') : '—';
  const fmtCost  = (c:number) => '$'+Number(c).toFixed(4);
  const sevColor: Record<string,string> = {
    critical:'text-red-400 bg-red-950/40 border-red-900/50',
    warning:'text-amber-400 bg-amber-950/40 border-amber-900/50',
    info:'text-blue-400 bg-blue-950/40 border-blue-900/50',
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center"><div className="text-gray-500">Feed Suite laden...</div></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Feed Suite</h1>
          <p className="text-sm text-gray-500 mt-1">{stats.totalProducts} producten · {feedConfigs.filter(f=>f.is_active).length} feeds live · {rules.filter(r=>r.active).length} regels actief</p>
        </div>
        <button onClick={handleSync} disabled={syncing} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors">
          {syncing ? '⟳ Synchroniseren...' : '⟳ Shopify Sync'}
        </button>
      </div>

      {syncResult && <div className={'mb-4 px-4 py-2 rounded-lg text-sm '+(syncResult.includes('Fout')||syncResult.includes('gefaald')?'bg-red-950/40 text-red-400 border border-red-900/50':'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50')}>{syncResult}</div>}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label:'Producten',    value:stats.totalProducts,               sub:'actief',               color:'text-white' },
          { label:'Feed-ready',   value:stats.feedReady,                   sub:'van '+stats.totalProducts, color:'text-emerald-400' },
          { label:'Met issues',   value:stats.withIssues,                  sub:'producten',            color:stats.withIssues>0?'text-amber-400':'text-gray-500' },
          { label:'Feeds live',   value:feedConfigs.filter(f=>f.is_active).length, sub:'kanalen',      color:'text-indigo-400' },
          { label:'AI pending',   value:reviewItems.length,                sub:'te reviewen',          color:reviewItems.length>0?'text-purple-400':'text-gray-500' },
        ].map((c,i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{c.label}</div>
            <div className={'text-2xl font-bold tabular-nums '+c.color}>{c.value}</div>
            <div className="text-xs text-gray-600 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {([['overview','📊 Overzicht'],['products','📦 Producten'],['feeds','🔗 Feeds'],['rules','📋 Regels'],['ai','🤖 AI Enrichments'],['ab_testing','🔬 A/B'],['labels','🏷 Labels'],['versions','🔖 Versies'],['alerts','🔔 Alerts']] as [TabKey,string][]).map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)} className={'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors '+(tab===key?'bg-gray-800 text-white':'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50')}>
            {label}
            {key==='alerts'&&alerts.length>0&&<span className="ml-1.5 px-1.5 py-0.5 text-xs bg-red-600 text-white rounded-full">{alerts.length}</span>}
            {key==='ai'&&reviewItems.length>0&&<span className="ml-1.5 px-1.5 py-0.5 text-xs bg-purple-600 text-white rounded-full">{reviewItems.length}</span>}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Overview                                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab==='overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Live Feeds</h3>
            {feedConfigs.length===0?<p className="text-sm text-gray-600">Geen feed configuraties.</p>:(
              <div className="space-y-2">{feedConfigs.map(fc => { const mkt=markets.find(m=>m.id===fc.market_id); return (
                <div key={fc.id} className="flex items-center justify-between py-2">
                  <div><div className="text-sm font-medium text-gray-200">{fc.feed_name||(mkt?.code+' '+fc.channel)}</div><div className="text-xs text-gray-500">{mkt?.name} · {fc.channel}</div></div>
                  <span className={'px-2 py-0.5 rounded text-xs font-medium '+(fc.is_active?'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50':'bg-gray-800 text-gray-500 border border-gray-700')}>{fc.is_active?'Live':'Inactief'}</span>
                </div>); })}</div>
            )}
          </div>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Product Readiness</h3>
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1"><span className="text-gray-400">Feed-ready</span><span className="text-emerald-400 font-medium">{stats.totalProducts>0?Math.round((stats.feedReady/stats.totalProducts)*100):0}%</span></div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{width:(stats.totalProducts>0?(stats.feedReady/stats.totalProducts)*100:0)+'%'}} /></div>
            </div>
            {stats.withIssues>0&&<div className="space-y-1"><div className="text-xs text-gray-500 mb-2">Issues:</div>
              {(()=>{ const ic:Record<string,number>={}; products.forEach(p=>p.feed_issues.forEach(i=>{ic[i]=(ic[i]||0)+1;})); return Object.entries(ic).sort(([,a],[,b])=>b-a).map(([issue,count])=><div key={issue} className="flex justify-between text-xs"><span className="text-amber-400">⚠ {issue}</span><span className="text-gray-500">{count}p</span></div>); })()}
            </div>}
          </div>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Markten</h3>
            <div className="space-y-2">{markets.map(m => { const cfgs=feedConfigs.filter(fc=>fc.market_id===m.id); const ac=cfgs.filter(c=>c.is_active).length; return (
              <div key={m.id} className="flex items-center justify-between py-1"><div className="flex items-center gap-2"><span className="text-lg">{FLAGS[m.code]??'🌐'}</span><div><div className="text-sm text-gray-200">{m.name}</div><div className="text-xs text-gray-500">{m.language} · {ac} feeds actief</div></div></div>
              <span className={'text-xs px-2 py-0.5 rounded '+(m.status==='primary'?'bg-emerald-950/50 text-emerald-400':'bg-gray-800 text-gray-500')}>{m.status}</span></div>); })}</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-gray-300">Recente Alerts</h3>{alerts.length>0&&<button onClick={()=>setTab('alerts')} className="text-xs text-indigo-400 hover:text-indigo-300">Alle →</button>}</div>
            {alerts.length===0?<p className="text-sm text-gray-600">Geen openstaande alerts.</p>:<div className="space-y-2">{alerts.slice(0,5).map(a=><div key={a.id} className={'px-3 py-2 rounded-lg border text-sm '+(sevColor[a.severity]||sevColor.info)}><div className="flex items-center justify-between"><span>{a.message}</span><span className="text-xs opacity-60 ml-2">{timeAgo(a.created_at)}</span></div></div>)}</div>}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Products                                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab==='products' && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input type="text" placeholder="Zoek naam, EAN of SKU..." value={search} onChange={e=>setSearch(e.target.value)} className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-64" />
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value as any)} className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200">
              <option value="all">Alle</option><option value="ready">Ready</option><option value="issues">Issues</option>
            </select>
            <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200">
              <option value="all">Alle categorieën</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-xs text-gray-500 ml-auto">{filtered.length} producten</span>
          </div>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-800">{['Product','EAN / SKU','Prijs','Foto\'s','Talen','Status'].map(h=><th key={h} className={'px-4 py-3 text-xs font-medium text-gray-500 uppercase text-left'}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-800/50">
                  {filtered.map(p => (
                    <tr key={p.id} onClick={()=>openPanel(p.id)} className="hover:bg-gray-800/30 cursor-pointer transition-colors">
                      <td className="px-4 py-3"><div className="flex items-center gap-3">
                        {p.image_url?<img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-800"/>:<div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-600 text-xs">?</div>}
                        <div><div className="text-sm font-medium text-gray-200">{p.name_nl}</div><div className="text-xs text-gray-500">{p.category||'—'}</div></div>
                      </div></td>
                      <td className="px-4 py-3"><div className="text-xs text-gray-300 font-mono">{p.ean||<span className="text-red-400">—</span>}</div><div className="text-xs text-gray-500 font-mono">{p.sku||<span className="text-red-400">geen SKU</span>}</div></td>
                      <td className="px-4 py-3 text-right"><div className="text-sm text-gray-200">{fmtPrice(p.price_eur)}</div></td>
                      <td className="px-4 py-3 text-center"><span className={'text-sm '+((p.additional_images?.length||0)+(p.image_url?1:0)>3?'text-emerald-400':'text-amber-400')}>{(p.additional_images?.length||0)+(p.image_url?1:0)}</span></td>
                      <td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-1">{['nl','en','de','fr'].map(lang=>{const has=p.content_languages.some(c=>c.language===lang);return<span key={lang} className={'text-xs px-1.5 py-0.5 rounded '+(has?'bg-indigo-950/50 text-indigo-400':'bg-gray-800/50 text-gray-600')}>{lang.toUpperCase()}</span>;})}</div></td>
                      <td className="px-4 py-3 text-center">{p.feed_ready?<span className="px-2 py-0.5 text-xs font-medium bg-emerald-950/50 text-emerald-400 border border-emerald-900/50 rounded">✓ Ready</span>:<span className="px-2 py-0.5 text-xs font-medium bg-amber-950/50 text-amber-400 border border-amber-900/50 rounded">{p.feed_issues.length} issues</span>}</td>
                    </tr>
                  ))}
                  {filtered.length===0&&<tr><td colSpan={6} className="px-4 py-12 text-center text-gray-600">{products.length===0?'Geen producten. Klik "Shopify Sync".':'Geen producten voor filters.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Feeds                                                                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab==='feeds' && (
        <div className="space-y-5">
          {markets.map(mkt => {
            const cfgs = feedConfigs.filter(fc=>fc.market_id===mkt.id);
            if (!cfgs.length) return null;
            return (
              <div key={mkt.id} className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4"><span className="text-xl">{FLAGS[mkt.code]??'🌐'}</span><h3 className="font-semibold text-gray-200">{mkt.name}</h3><span className="text-xs text-gray-500">{mkt.language_code?.toUpperCase()}</span></div>
                <div className="space-y-3">
                  {cfgs.map(cfg => {
                    const feedPath = `/api/feed/output?market=${mkt.code}&channel=${cfg.channel}`;
                    const key      = `${mkt.code}_${cfg.channel}`;
                    const preview  = feedPreviews[key] as any;
                    const isLoad   = prevLoading===key;
                    return (
                      <div key={cfg.id} className="border border-gray-800 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded bg-gray-800 text-gray-300 text-xs font-bold flex items-center justify-center">{CHANNEL_ICONS[cfg.channel]??cfg.channel[0].toUpperCase()}</span>
                              <span className="font-medium text-gray-200 capitalize">{cfg.feed_name||cfg.channel}</span>
                              <span className={'text-xs px-1.5 py-0.5 rounded '+(cfg.is_active?'bg-emerald-950/50 text-emerald-400':'bg-gray-800 text-gray-500')}>{cfg.is_active?'Live':'Inactief'}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <code className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 font-mono truncate max-w-xs">{feedPath}</code>
                              <button onClick={()=>copyUrl(feedPath,key)} className={'text-xs px-2 py-1 rounded transition-colors '+(copied===key?'bg-emerald-900/40 text-emerald-400':'bg-gray-800 text-gray-400 hover:text-gray-200')}>{copied===key?'✓ Gekopieerd':'Kopieer'}</button>
                              <a href={feedPath} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-gray-200">Open ↗</a>
                            </div>
                            {cfg.last_fetched_at&&<div className="text-xs text-gray-600 mt-1">Opgehaald: {timeAgo(cfg.last_fetched_at)} geleden</div>}
                          </div>
                          <button onClick={()=>loadFeedPreview(mkt.code,cfg.channel)} disabled={isLoad} className="shrink-0 text-xs px-3 py-1.5 bg-indigo-900/40 text-indigo-400 hover:bg-indigo-900/60 disabled:opacity-50 rounded-lg">{isLoad?'...':'Preview'}</button>
                        </div>
                        {preview && (
                          <div className="mt-4 pt-4 border-t border-gray-800">
                            {preview._error?<p className="text-xs text-red-400">{preview._error}</p>:(
                              <>
                                <div className="flex gap-4 text-xs mb-3"><span className="text-gray-500">{preview.total_before_rules} totaal</span><span className="text-amber-400">−{preview.excluded} uitgesloten</span><span className="text-emerald-400 font-medium">{preview.total_after_rules} in feed</span></div>
                                <div className="grid grid-cols-5 gap-2">
                                  {preview.products.map((p:any) => (
                                    <div key={p.id} className="bg-gray-800/50 rounded-lg p-2">
                                      {p.image?<img src={p.image} alt="" className="w-full h-14 object-cover rounded mb-1.5"/>:<div className="w-full h-14 bg-gray-700 rounded mb-1.5"/>}
                                      <div className="text-xs text-gray-300 truncate">{p.title}</div>
                                      <div className="text-xs text-gray-500">{p.price!=null?'€'+Number(p.price).toFixed(2):'—'}</div>
                                    </div>
                                  ))}
                                </div>
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Rules — ProductCaster-stijl twee kolommen                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab==='rules' && (()=>{
        const masterRules  = rules.filter(r=>(r.scope??'master')==='master').sort((a,b)=>a.priority-b.priority);
        const partnerRules = rules.filter(r=>r.scope==='partner'&&r.channel===partnerCh).sort((a,b)=>a.priority-b.priority);

        const describeAction = (r:Rule) => {
          const a = r.actions??{};
          const at = a.action_type;
          if (r.type==='filter') return <span className="text-amber-500">→ Uitsluit van feed</span>;
          if (at==='find_replace') return <span className="text-indigo-400">→ Vervang <span className="font-mono text-xs">"{a.find}"</span> door <span className="font-mono text-xs">"{a.replace}"</span>{a.use_regex?' (regex)':''} in {FIELD_NL[a.field]??a.field}</span>;
          if (at==='prepend_if_missing') return <span className="text-indigo-400">→ Prepend <span className="font-mono text-xs">"{a.value}"</span> in {FIELD_NL[a.field]??a.field}</span>;
          if (at==='append_if_missing') return <span className="text-indigo-400">→ Append <span className="font-mono text-xs">"{a.value}"</span> in {FIELD_NL[a.field]??a.field}</span>;
          if (at==='copy_field') return <span className="text-indigo-400">→ Kopieer {FIELD_NL[a.from_field]??a.from_field} → {FIELD_NL[a.to_field]??a.to_field}</span>;
          const sf = a.set_field??a.field; const val = a.value;
          if (sf) return <span className="text-indigo-400">→ Stel <span className="font-mono text-xs">{FIELD_NL[sf]??sf}</span> op <span className="font-mono text-xs">"{val}"</span></span>;
          return <span className="text-gray-500">—</span>;
        };

        const RuleCard = ({ rule, isLast, isFirst }: { rule:Rule; isLast:boolean; isFirst:boolean }) => {
          const aff = products.filter(p=>(rule.conditions??[]).every(c=>evalCond(p,c))).length;
          return (
            <div className={'border rounded-lg p-3 transition-all '+(rule.active?'bg-gray-900/60 border-gray-700/60':'bg-gray-900/20 border-gray-800/30 opacity-50')}>
              <div className="flex items-start gap-2">
                {/* Toggle */}
                <button onClick={()=>toggleRule(rule.id,!rule.active)} className={'relative w-8 h-4 rounded-full shrink-0 mt-0.5 transition-colors '+(rule.active?'bg-indigo-600':'bg-gray-700')}>
                  <span className={'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform '+(rule.active?'translate-x-4':'translate-x-0.5')} />
                </button>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-gray-200 truncate">{rule.name}</span>
                    <span className={'text-xs px-1.5 py-0.5 rounded shrink-0 '+(rule.type==='filter'?'bg-amber-950/50 text-amber-400':'bg-indigo-950/50 text-indigo-400')}>{rule.type==='filter'?'Filter':'Transform'}</span>
                    <span className="text-xs text-gray-600 shrink-0">#{rule.priority}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500 truncate">
                    {(rule.conditions??[]).map((c,i)=><span key={i}>{i>0&&<span className="text-gray-700 mx-1">EN</span>}<span className="text-gray-400">{FIELD_NL[c.field]??c.field}</span> {OPS.find(o=>o.v===c.operator)?.l??c.operator}{c.value&&<span className="text-indigo-400"> "{c.value}"</span>}</span>)}
                  </div>
                  <div className="mt-0.5 text-xs">{describeAction(rule)}{aff>0&&<span className="text-gray-600 ml-1">· {aff}p</span>}</div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={()=>moveRule(rule,'up')} disabled={isFirst} className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-gray-300 disabled:opacity-20 text-xs">↑</button>
                  <button onClick={()=>moveRule(rule,'down')} disabled={isLast} className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-gray-300 disabled:opacity-20 text-xs">↓</button>
                  <button onClick={()=>openEditRule(rule)} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-indigo-400 text-xs rounded hover:bg-indigo-950/30" title="Bewerken">✎</button>
                  <button onClick={()=>duplicateRule(rule)} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-gray-300 text-xs rounded hover:bg-gray-800" title="Dupliceer">⎘</button>
                  {(rule.scope??'master')==='master'
                    ? <button onClick={()=>duplicateRule(rule,'partner',partnerCh)} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-amber-400 text-xs rounded hover:bg-amber-950/20" title={`Kopieer naar ${partnerCh}`}>→P</button>
                    : <button onClick={()=>duplicateRule(rule,'master')} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-blue-400 text-xs rounded hover:bg-blue-950/20" title="Kopieer naar Master">→M</button>}
                  <button onClick={()=>deleteRule(rule.id)} disabled={deletingRule===rule.id} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-red-400 disabled:opacity-50 text-xs rounded hover:bg-red-950/20">✕</button>
                </div>
              </div>
            </div>
          );
        };

        return (
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="font-semibold text-gray-200">{rules.length} regels totaal</h3><p className="text-xs text-gray-500 mt-0.5">{rules.filter(r=>r.active).length} actief · {masterRules.length} master · {rules.filter(r=>r.scope==='partner').length} partner</p></div>
              <button onClick={()=>{resetRuleForm();setNewRuleOpen(o=>!o);}} className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">{newRuleOpen&&!editingRule?'✕ Annuleer':'+ Nieuwe Regel'}</button>
            </div>

            {/* Rule form */}
            {(newRuleOpen||editingRule) && (
              <div className="mb-5 bg-gray-900/70 border border-indigo-900/50 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-gray-200 mb-4">{editingRule?'Regel bewerken':'Nieuwe Feed Regel'}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div><label className="text-xs text-gray-400 mb-1 block">Naam *</label><input value={ruleName} onChange={e=>setRuleName(e.target.value)} className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500" /></div>
                  <div><label className="text-xs text-gray-400 mb-1 block">Type</label><select value={ruleType} onChange={e=>setRuleType(e.target.value as any)} className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200"><option value="filter">Filter — uitsluit</option><option value="transform">Transform</option></select></div>
                  <div><label className="text-xs text-gray-400 mb-1 block">Scope</label><select value={ruleScope} onChange={e=>setRuleScope(e.target.value as any)} className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200"><option value="master">Master (alle feeds)</option><option value="partner">Partner (per kanaal)</option></select></div>
                  {ruleScope==='partner'&&<div><label className="text-xs text-gray-400 mb-1 block">Kanaal</label><select value={ruleCh} onChange={e=>setRuleCh(e.target.value)} className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200"><option value="google">Google Shopping</option><option value="meta">Meta Catalog</option><option value="awin">Awin</option></select></div>}
                </div>
                {/* Conditions */}
                <div className="mb-4">
                  <label className="text-xs text-gray-400 mb-2 block">Als (alle condities gelden)</label>
                  {ruleConds.map((c,i)=>(
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <select value={c.field} onChange={e=>updateCond(i,'field',e.target.value)} className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 w-28">{FIELDS.map(f=><option key={f} value={f}>{FIELD_NL[f]}</option>)}</select>
                      <select value={c.operator} onChange={e=>updateCond(i,'operator',e.target.value)} className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 w-36">{OPS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
                      {!NO_VAL_OPS.includes(c.operator)&&<input value={c.value??''} onChange={e=>updateCond(i,'value',e.target.value)} placeholder="waarde..." className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-indigo-500"/>}
                      {ruleConds.length>1&&<button onClick={()=>setRuleConds(prev=>prev.filter((_,j)=>j!==i))} className="text-gray-600 hover:text-red-400">×</button>}
                      <span className="text-xs text-gray-600 w-8 shrink-0">{products.filter(p=>evalCond(p,c)).length}p</span>
                    </div>
                  ))}
                  <button onClick={()=>setRuleConds(prev=>[...prev,{...BLANK_COND}])} className="text-xs text-indigo-400 hover:text-indigo-300">+ EN-conditie</button>
                </div>
                {/* Action */}
                <div className="mb-4">
                  {ruleType==='filter'
                    ? <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Dan:</span><span className="px-2 py-1 bg-red-950/40 text-red-400 border border-red-900/50 rounded text-xs">Uitsluit van feed</span></div>
                    : <div>
                        <label className="text-xs text-gray-400 mb-2 block">Dan</label>
                        <div className="flex flex-wrap items-start gap-2">
                          <select value={ruleActionType} onChange={e=>setRuleActionType(e.target.value as ActionType)} className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200">
                            <option value="set_field">Stel veld in op waarde</option>
                            <option value="find_replace">Find &amp; Replace in veld</option>
                            <option value="prepend_if_missing">Prepend als niet aanwezig</option>
                            <option value="append_if_missing">Append als niet aanwezig</option>
                            <option value="copy_field">Kopieer veld naar veld</option>
                          </select>
                          {ruleActionType==='copy_field' ? <>
                            <select value={ruleCopyFrom} onChange={e=>setRuleCopyFrom(e.target.value)} className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200">{FIELDS.map(f=><option key={f} value={f}>{FIELD_NL[f]}</option>)}</select>
                            <span className="text-gray-500 text-sm py-1.5">→</span>
                            <select value={ruleCopyTo} onChange={e=>setRuleCopyTo(e.target.value)} className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200">{FIELDS.map(f=><option key={f} value={f}>{FIELD_NL[f]}</option>)}</select>
                          </> : ruleActionType==='find_replace' ? <>
                            <span className="text-xs text-gray-400 py-1.5">in</span>
                            <select value={ruleSetField} onChange={e=>setRuleSetField(e.target.value)} className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200">{FIELDS.map(f=><option key={f} value={f}>{FIELD_NL[f]}</option>)}</select>
                            <input value={ruleFindVal} onChange={e=>setRuleFindVal(e.target.value)} placeholder="zoek..." className="w-28 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-indigo-500"/>
                            <span className="text-gray-500 text-sm py-1.5">→</span>
                            <input value={ruleReplaceVal} onChange={e=>setRuleReplaceVal(e.target.value)} placeholder="vervang..." className="w-28 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-indigo-500"/>
                            <label className="flex items-center gap-1 text-xs text-gray-400 py-1.5 cursor-pointer"><input type="checkbox" checked={ruleUseRegex} onChange={e=>setRuleUseRegex(e.target.checked)} className="accent-indigo-500"/>regex</label>
                          </> : <>
                            <span className="text-xs text-gray-400 py-1.5">veld</span>
                            <select value={ruleSetField} onChange={e=>setRuleSetField(e.target.value)} className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200">{FIELDS.map(f=><option key={f} value={f}>{FIELD_NL[f]}</option>)}</select>
                            <span className="text-xs text-gray-400 py-1.5">{ruleActionType==='set_field'?'op':ruleActionType==='prepend_if_missing'?'prepend':'append'}</span>
                            <input value={ruleSetValue} onChange={e=>setRuleSetValue(e.target.value)} placeholder="waarde..." className="flex-1 min-w-32 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-indigo-500"/>
                          </>}
                        </div>
                      </div>}
                </div>
                {ruleError&&<p className="text-xs text-red-400 mb-3">{ruleError}</p>}
                <div className="flex gap-2">
                  <button onClick={saveRule} disabled={savingRule} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg">{savingRule?'Opslaan...':(editingRule?'Bijwerken':'Opslaan')}</button>
                  <button onClick={resetRuleForm} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg">Annuleer</button>
                </div>
              </div>
            )}

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* ── Master Feed ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-200">Master Feed</h4>
                    <p className="text-xs text-gray-500">{masterRules.length} regels · geldt voor alle kanalen</p>
                  </div>
                  <button onClick={()=>{resetRuleForm();setRuleScope('master');setNewRuleOpen(true);}} className="text-xs px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg">+ Regel</button>
                </div>
                <div className="space-y-2">
                  {masterRules.length===0&&<div className="bg-gray-900/30 border border-gray-800/30 rounded-lg p-6 text-center text-xs text-gray-600">Geen master regels</div>}
                  {masterRules.map((r,i)=><RuleCard key={r.id} rule={r} isFirst={i===0} isLast={i===masterRules.length-1}/>)}
                </div>
              </div>

              {/* ── Partner Feed ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-200">Partner Feed</h4>
                    <p className="text-xs text-gray-500">{partnerRules.length} regels · kanaal-specifiek</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={partnerCh} onChange={e=>setPartnerCh(e.target.value)} className="text-xs px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-gray-300">
                      <option value="google">Google Shopping</option>
                      <option value="meta">Meta Catalog</option>
                      <option value="awin">Awin</option>
                    </select>
                    <button onClick={()=>{resetRuleForm();setRuleScope('partner');setRuleCh(partnerCh);setNewRuleOpen(true);}} className="text-xs px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg">+ Regel</button>
                  </div>
                </div>
                <div className="space-y-2">
                  {partnerRules.length===0&&(
                    <div className="bg-gray-900/30 border border-gray-800/30 border-dashed rounded-lg p-6 text-center">
                      <p className="text-xs text-gray-600 mb-3">Geen {partnerCh} partner regels</p>
                      <button onClick={copyAllToPartner} disabled={copyingAll||masterRules.length===0} className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-lg">
                        {copyingAll?'Kopiëren...`':'⎘ Kopieer alle Master regels'}
                      </button>
                    </div>
                  )}
                  {partnerRules.length>0&&<>
                    <div className="flex justify-end mb-1">
                      <button onClick={copyAllToPartner} disabled={copyingAll||masterRules.length===0} className="text-xs text-gray-600 hover:text-gray-300 disabled:opacity-50">
                        {copyingAll?'..':'⎘ Kopieer alle Master'}
                      </button>
                    </div>
                    {partnerRules.map((r,i)=><RuleCard key={r.id} rule={r} isFirst={i===0} isLast={i===partnerRules.length-1}/>)}
                  </>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* AI Enrichments                                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab==='ai' && (
        <div className="space-y-5">
          {/* Controls */}
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Genereer AI-titels en beschrijvingen</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div><label className="text-xs text-gray-400 mb-1 block">Taal</label>
                <select value={aiLang} onChange={e=>setAiLang(e.target.value)} className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200">
                  {[['nl','Nederlands'],['de','Deutsch'],['fr','Français'],['en','English']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-gray-400 mb-1 block">Kanaal</label>
                <select value={aiChannel} onChange={e=>setAiChannel(e.target.value)} className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200">
                  <option value="all">Alle kanalen</option>
                  <option value="google">Google Shopping</option>
                  <option value="meta">Meta Catalog</option>
                  <option value="awin">Awin</option>
                </select>
              </div>
              <div><label className="text-xs text-gray-400 mb-1 block">Seizoen (optioneel)</label>
                <select value={aiSeason} onChange={e=>setAiSeason(e.target.value)} className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200">
                  <option value="">— geen seizoen —</option>
                  <option value="winter">❄️ Winter</option>
                  <option value="summer">☀️ Zomer</option>
                  <option value="christmas">🎄 Kerst</option>
                  <option value="spring">🌷 Lente</option>
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={runEnrichment} disabled={enriching||selectedProds.size===0} className="w-full px-4 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium">
                  {enriching ? '⟳ Genereren...' : `🤖 Optimaliseer ${selectedProds.size>0?`(${selectedProds.size})`:''}`}
                </button>
              </div>
            </div>
            {enrichResult && (
              <div className={'px-4 py-2 rounded-lg text-sm '+(enrichResult.enriched>0?'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50':'bg-red-950/40 text-red-400 border border-red-900/50')}>
                {enrichResult.enriched}/{enrichResult.total} producten verrijkt · {enrichResult.tokens_input+enrichResult.tokens_output} tokens · kosten {fmtCost(enrichResult.cost_usd)}
              </div>
            )}
            {/* Product selection */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">{selectedProds.size} geselecteerd</span>
                <div className="flex gap-2">
                  <button onClick={()=>setSelectedProds(new Set(products.map(p=>p.id)))} className="text-xs text-indigo-400 hover:text-indigo-300">Alles</button>
                  <button onClick={()=>setSelectedProds(new Set())} className="text-xs text-gray-500 hover:text-gray-300">Geen</button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                {products.map(p => (
                  <label key={p.id} className={'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors '+(selectedProds.has(p.id)?'bg-purple-950/40 border border-purple-900/50':'bg-gray-800/50 border border-transparent hover:bg-gray-800')}>
                    <input type="checkbox" checked={selectedProds.has(p.id)} onChange={e=>{const s=new Set(selectedProds);e.target.checked?s.add(p.id):s.delete(p.id);setSelectedProds(s);}} className="accent-purple-500" />
                    <div className="min-w-0"><div className="text-xs text-gray-300 truncate">{p.name_nl}</div><div className="text-xs text-gray-600">{p.category||'—'}</div></div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Review queue */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">{reviewItems.length} pending suggesties</h3>
              <div className="flex gap-2">
                {reviewItems.length>0&&<button onClick={bulkApproveAll} className="text-xs px-3 py-1.5 bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60 rounded-lg border border-emerald-900/50">✓ Alles goedkeuren (variant A)</button>}
                <button onClick={loadReviewQueue} disabled={reviewLoading} className="text-xs px-3 py-1.5 bg-gray-800 text-gray-400 hover:text-gray-200 rounded-lg">{reviewLoading?'...':'↻ Vernieuwen'}</button>
              </div>
            </div>
            {reviewItems.length===0&&!reviewLoading&&<div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-6 text-center"><div className="text-2xl mb-2">✓</div><p className="text-sm text-gray-500">Geen pending suggesties{enriching?' — genereren...':''}.</p></div>}
            <div className="space-y-4">
              {reviewItems.map(item => {
                const variants = item.ai_variants ?? [];
                return (
                  <div key={item.id} className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
                    <div className="flex items-start gap-3 mb-3">
                      {item.product?.image_url&&<img src={item.product.image_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-800 shrink-0"/>}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-200">{item.product?.name_nl ?? item.product_id}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.product?.category||'—'} · {item.language.toUpperCase()}{item.channel_optimized_for&&item.channel_optimized_for!=='all'?` · ${item.channel_optimized_for}`:''}{item.season?` · ${item.season}`:''}</div>
                        {item.title&&<div className="text-xs text-gray-600 mt-1 truncate">Huidig: "{item.title}"</div>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={()=>addManualVariant(item)} className="text-xs text-gray-600 hover:text-indigo-400 px-2 py-1 rounded hover:bg-indigo-950/20">+ Variant</button>
                        <button onClick={()=>rejectAll(item)} className="text-xs text-gray-600 hover:text-red-400 px-2 py-1 rounded hover:bg-red-950/20">✕ Afwijzen</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {variants.map(v => {
                        const key = `${item.product_id}_${v.id}`;
                        const isApp = approving===key;
                        const isEditing = editingVariant?.itemId===item.product_id && editingVariant?.variantId===v.id;
                        return (
                          <div key={v.id} className={'border rounded-lg p-3 '+(v.compliance==='green'?'border-emerald-900/40 bg-emerald-950/10':'border-amber-900/40 bg-amber-950/10')}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-400">{v.id}</span>
                                <span className={'text-xs px-1.5 py-0.5 rounded border '+COMPLIANCE_STYLE[v.compliance]}>{v.compliance==='green'?'✓ Veilig':'⚠ Grens'}</span>
                                {v.season&&<span className="text-xs px-1.5 py-0.5 rounded bg-blue-950/40 text-blue-400 border border-blue-900/50">🍂 {v.season}</span>}
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={()=>{if(isEditing){setEditingVariant(null);}else{setEditingVariant({itemId:item.product_id,variantId:v.id});setEditVariantVal(v.title);}}} className="text-xs w-6 h-6 flex items-center justify-center text-gray-600 hover:text-indigo-400 rounded hover:bg-indigo-950/20">✎</button>
                                <button onClick={()=>approveVariant(item, v.id)} disabled={isApp} className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium">{isApp?'...':'✓'}</button>
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 mb-1 font-medium">{v.label}</div>
                            {isEditing ? (
                              <div>
                                <input value={editVariantVal} onChange={e=>setEditVariantVal(e.target.value)} className="w-full px-2 py-1.5 bg-gray-800 border border-indigo-600 rounded text-sm text-gray-200 focus:outline-none mb-2" autoFocus />
                                <div className="flex gap-2">
                                  <button onClick={()=>saveVariantEdit(item)} disabled={savingVariant} className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded">{savingVariant?'...':'Opslaan'}</button>
                                  <button onClick={()=>setEditingVariant(null)} className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">Annuleer</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="text-sm text-gray-200 font-medium leading-snug mb-2">"{v.title}"</div>
                                {v.description_short&&<div className="text-xs text-gray-500 mb-1.5 italic">Short: {v.description_short}</div>}
                                {v.description_long&&<div className="text-xs text-gray-600 line-clamp-3">{v.description_long.substring(0,200)}...</div>}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Batch costs */}
          {batches.length>0&&(
            <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Recente batches</h3>
              <div className="space-y-2">
                {batches.slice(0,5).map(b => (
                  <div key={b.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className={'px-1.5 py-0.5 rounded '+(b.status==='completed'?'bg-emerald-950/50 text-emerald-400':b.status==='failed'?'bg-red-950/50 text-red-400':'bg-amber-950/50 text-amber-400')}>{b.status}</span>
                      <span className="text-gray-400">{b.product_count}p · {b.language.toUpperCase()}{b.channel!=='all'?` · ${b.channel}`:''}{b.season?` · ${b.season}`:''}</span>
                    </div>
                    <div className="flex items-center gap-4 text-gray-500">
                      <span>{(b.tokens_input+b.tokens_output).toLocaleString()} tokens</span>
                      <span className="text-amber-400 font-medium">{fmtCost(b.cost_usd)}</span>
                      <span>{timeAgo(b.created_at)} geleden</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-500 flex justify-between">
                <span>Totaal {batches.length} batches</span>
                <span className="text-amber-400">Totaal {fmtCost(batches.reduce((s,b)=>s+Number(b.cost_usd),0))}</span>
              </div>
            </div>
          )}

          {/* Changelog toggle */}
          <div>
            <button onClick={async()=>{ if(!changelogOpen){await loadChangelog();} setChangelogOpen(o=>!o); }} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
              <span>{changelogOpen?'▲':'▼'}</span><span>Wijzigingslog ({changelog.length>0?changelog.length:'laden...'})</span>
            </button>
            {changelogOpen&&(
              <div className="mt-3 bg-gray-900/50 border border-gray-800/50 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead><tr className="border-b border-gray-800">{['Tijd','Product','Veld','Bron','Nieuw'].map(h=><th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-800/30">
                    {changelog.slice(0,20).map(e=>(
                      <tr key={e.id} className="text-xs">
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{timeAgo(e.created_at)}</td>
                        <td className="px-3 py-2 text-gray-300 truncate max-w-xs">{e.product_name??e.product_id?.substring(0,8)??'—'}</td>
                        <td className="px-3 py-2 text-gray-400">{e.field}</td>
                        <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{e.source}</span></td>
                        <td className="px-3 py-2 text-gray-300 truncate max-w-sm">{e.new_value?.substring(0,80)??'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Versions                                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab==='versions' && (
        <div className="space-y-5">
          {/* Create snapshot */}
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Nieuwe Feed Snapshot</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div><label className="text-xs text-gray-400 mb-1 block">Markt</label>
                <select value={snapMarket} onChange={e=>setSnapMarket(e.target.value)} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200">
                  {markets.map(m=><option key={m.code} value={m.code}>{FLAGS[m.code]} {m.name}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-gray-400 mb-1 block">Kanaal</label>
                <select value={snapChannel} onChange={e=>setSnapChannel(e.target.value)} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200">
                  <option value="google">Google Shopping</option>
                  <option value="meta">Meta Catalog</option>
                  <option value="awin">Awin</option>
                </select>
              </div>
              <div className="flex-1 min-w-48"><label className="text-xs text-gray-400 mb-1 block">Notitie (optioneel)</label>
                <input value={snapNote} onChange={e=>setSnapNote(e.target.value)} placeholder="bv. na AI enrichment batch 3" className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500" />
              </div>
              <button onClick={createSnapshot} disabled={snapshotting} className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium">
                {snapshotting?'Opslaan...':'📸 Snapshot maken'}
              </button>
            </div>
            {rollbackResult&&<div className={'mt-3 px-3 py-2 rounded-lg text-sm '+(rollbackResult.includes('Fout')?'bg-red-950/40 text-red-400 border border-red-900/50':'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50')}>{rollbackResult}</div>}
          </div>

          {/* Versions list */}
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl overflow-hidden">
            {versionsLoading ? <div className="p-8 text-center text-gray-500">Laden...</div>
            : versions.length===0 ? <div className="p-8 text-center"><div className="text-2xl mb-2">🔖</div><p className="text-sm text-gray-500">Nog geen versies. Maak een snapshot aan.</p></div>
            : (
              <table className="w-full">
                <thead><tr className="border-b border-gray-800">{['Versie','Markt','Kanaal','Producten','Notitie','Aangemaakt','Actie'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-800/50">
                  {versions.map(v => {
                    const mkt = v.markets as any;
                    return (
                      <tr key={v.id} className="hover:bg-gray-800/20">
                        <td className="px-4 py-3"><span className="text-sm font-bold text-indigo-400">v{v.version_number}</span></td>
                        <td className="px-4 py-3 text-sm text-gray-300">{mkt?<span>{FLAGS[mkt.code]??''} {mkt.code}</span>:'—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-400 capitalize">{v.channel}</td>
                        <td className="px-4 py-3 text-sm text-gray-400 tabular-nums">{v.product_count}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{v.note||'—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{timeAgo(v.created_at)} geleden</td>
                        <td className="px-4 py-3">
                          <button onClick={()=>rollback(v.id, v.version_number)} disabled={rollingBack===v.id} className="text-xs px-3 py-1.5 bg-amber-900/40 text-amber-400 hover:bg-amber-900/60 disabled:opacity-50 rounded-lg border border-amber-900/50">
                            {rollingBack===v.id?'...':'↩ Herstel'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Placeholder tabs ── */}
      {tab==='ab_testing' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-200">A/B Tests</h3>
              <p className="text-xs text-gray-500 mt-0.5">{abTests.length} tests · {abTests.filter(t=>t.status==='active').length} actief</p>
            </div>
            <button onClick={()=>setNewTestOpen(o=>!o)} className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">{newTestOpen?'✕ Annuleer':'+ Nieuwe Test'}</button>
          </div>

          {newTestOpen && (
            <div className="bg-gray-900/70 border border-indigo-900/50 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-gray-200 mb-4">Nieuwe A/B Test</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <div><label className="text-xs text-gray-400 mb-1 block">Testnaam *</label><input value={testName} onChange={e=>setTestName(e.target.value)} className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500" placeholder="bv. Titels zomer 2025"/></div>
                <div><label className="text-xs text-gray-400 mb-1 block">Veld</label><select value={testField} onChange={e=>setTestField(e.target.value as any)} className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200"><option value="title">Titel</option><option value="description">Beschrijving</option><option value="image">Afbeelding</option></select></div>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-400">Producten selecteren *</label><div className="flex gap-2"><button onClick={()=>setTestProductIds(new Set(products.map(p=>p.id)))} className="text-xs text-indigo-400">Alles</button><button onClick={()=>setTestProductIds(new Set())} className="text-xs text-gray-500">Geen</button></div></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                  {products.map(p=>(
                    <label key={p.id} className={'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer '+(testProductIds.has(p.id)?'bg-indigo-950/40 border border-indigo-900/50':'bg-gray-800/50 border border-transparent hover:bg-gray-800')}>
                      <input type="checkbox" checked={testProductIds.has(p.id)} onChange={e=>{const s=new Set(testProductIds);e.target.checked?s.add(p.id):s.delete(p.id);setTestProductIds(s);}} className="accent-indigo-500"/>
                      <span className="text-xs text-gray-300 truncate">{p.name_nl}</span>
                    </label>
                  ))}
                </div>
              </div>
              {testError&&<p className="text-xs text-red-400 mb-3">{testError}</p>}
              <div className="flex gap-2">
                <button onClick={createTest} disabled={creatingTest} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg">{creatingTest?'Aanmaken...':'Test aanmaken'}</button>
                <button onClick={()=>setNewTestOpen(false)} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg">Annuleer</button>
              </div>
            </div>
          )}

          {abLoading ? (
            <div className="text-center py-8 text-gray-500">Laden...</div>
          ) : abTests.length===0 ? (
            <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-8 text-center"><div className="text-3xl mb-3">🔬</div><p className="text-sm text-gray-500">Nog geen A/B tests. Maak een test aan.</p></div>
          ) : (
            <div className="space-y-3">
              {abTests.map(test => {
                const grpA = test.metrics?.A ?? null;
                const grpB = test.metrics?.B ?? null;
                const statusColor: Record<string,string> = { draft:'text-gray-400 bg-gray-800', active:'text-emerald-400 bg-emerald-950/50 border border-emerald-900/50', completed:'text-blue-400 bg-blue-950/50 border border-blue-900/50', paused:'text-amber-400 bg-amber-950/50 border border-amber-900/50' };
                return (
                  <div key={test.id} className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-200">{test.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${statusColor[test.status]??statusColor.draft}`}>{test.status}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{test.field}</span>
                          <span className="text-xs text-gray-600">{test.product_count}p</span>
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">{timeAgo(test.created_at)} geleden aangemaakt{test.started_at&&` · gestart ${timeAgo(test.started_at)} geleden`}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {test.status==='draft' && <button onClick={()=>patchTest(test.id,{action:'start'})} className="text-xs px-3 py-1.5 bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60 rounded-lg border border-emerald-900/50">▶ Start</button>}
                        {test.status==='active' && <button onClick={()=>patchTest(test.id,{action:'stop'})} className="text-xs px-3 py-1.5 bg-amber-900/40 text-amber-400 hover:bg-amber-900/60 rounded-lg border border-amber-900/50">⏹ Stop</button>}
                      </div>
                    </div>

                    {(grpA||grpB) && (
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        {[{grp:grpA,label:test.variant_a_label||'Variant A',col:'text-blue-400'},{grp:grpB,label:test.variant_b_label||'Variant B',col:'text-purple-400'}].map(({grp,label,col})=>(
                          <div key={label} className="bg-gray-800/50 rounded-lg p-3">
                            <div className={`text-xs font-semibold mb-2 ${col}`}>{label}</div>
                            {grp ? (
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-gray-500">Impressies</span><span className="text-gray-300 tabular-nums">{grp.impressions.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Kliks</span><span className="text-gray-300 tabular-nums">{grp.clicks.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">CTR</span><span className="font-bold text-gray-200 tabular-nums">{grp.impressions>0?((grp.clicks/grp.impressions)*100).toFixed(2):'0.00'}%</span></div>
                              </div>
                            ) : <div className="text-xs text-gray-600">Geen data</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    {test.significance?.significant && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-900/50 mb-3">
                        <div><span className="text-xs font-semibold text-emerald-400">✓ Statistisch significant</span>{test.significance.p_value!=null&&<span className="text-xs text-gray-500 ml-2">p={test.significance.p_value.toFixed(3)}</span>}</div>
                        {test.winner ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Winnaar: <span className="text-emerald-400 font-bold">{test.winner==='A'?(test.variant_a_label||'Variant A'):(test.variant_b_label||'Variant B')}</span></span>
                            {test.status!=='completed' && <button onClick={()=>doApplyWinner(test.id)} disabled={applyingWinner===test.id} className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg">{applyingWinner===test.id?'...':'Toepassen'}</button>}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={()=>patchTest(test.id,{action:'declare_winner',winner:'A'})} className="text-xs px-2 py-1 bg-blue-900/40 text-blue-400 hover:bg-blue-900/60 rounded border border-blue-900/50">A</button>
                            <button onClick={()=>patchTest(test.id,{action:'declare_winner',winner:'B'})} className="text-xs px-2 py-1 bg-purple-900/40 text-purple-400 hover:bg-purple-900/60 rounded border border-purple-900/50">B</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {tab==='alerts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-200">Alerts</h3>
              <p className="text-xs text-gray-500 mt-0.5">{alerts.length} openstaand</p>
            </div>
            <div className="flex items-center gap-3">
              <select value={alertTypeFilter} onChange={e=>setAlertTypeFilter(e.target.value)} className="text-xs px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300">
                <option value="all">Alle types</option>
                <option value="missing_ean">Geen EAN</option>
                <option value="missing_image">Geen afbeelding</option>
                <option value="low_ctr">Lage CTR</option>
                <option value="feed_error">Feed fout</option>
              </select>
              {alerts.length>0&&<button onClick={acknowledgeAll} disabled={acknowledging==='all'} className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-lg">{acknowledging==='all'?'...':'✓ Alles bevestigen'}</button>}
            </div>
          </div>
          {(()=>{
            const filtered=alertTypeFilter==='all'?alerts:alerts.filter(a=>a.type===alertTypeFilter);
            if (filtered.length===0) return (
              <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-8 text-center">
                <div className="text-3xl mb-3">✓</div>
                <h3 className="text-lg font-semibold text-gray-300 mb-1">{alerts.length===0?'Geen openstaande alerts':'Geen alerts voor dit filter'}</h3>
                <p className="text-sm text-gray-600">{alerts.length===0?'Feed Suite loopt zonder problemen.':'Wijzig het filter om andere alerts te zien.'}</p>
              </div>
            );
            return (
              <div className="space-y-2">
                {filtered.map(a=>(
                  <div key={a.id} className={'flex items-start justify-between gap-3 px-4 py-3 rounded-xl border '+(sevColor[a.severity]||sevColor.info)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-black/20 font-medium uppercase">{a.severity}</span>
                        {a.type&&<span className="text-xs text-current opacity-60">{a.type.replace(/_/g,' ')}</span>}
                      </div>
                      <div className="text-sm font-medium mt-1">{a.message}</div>
                      <div className="text-xs opacity-50 mt-0.5">{a.channel&&a.channel+' · '}{timeAgo(a.created_at)} geleden</div>
                    </div>
                    <button onClick={()=>acknowledgeAlert(a.id)} disabled={acknowledging===a.id} className="shrink-0 text-xs px-3 py-1.5 bg-black/20 hover:bg-black/40 disabled:opacity-50 rounded-lg">
                      {acknowledging===a.id?'...':'✓ OK'}
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Custom Labels — Supplemental Feed                                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab==='labels' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-200">Custom Labels</h3>
              <p className="text-xs text-gray-500 mt-0.5">Google Shopping supplemental feed · gele ster = handmatig override</p>
            </div>
            <div className="flex items-center gap-3">
              <a href="/api/feed/output/supplemental?market=NL" target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700">↗ CSV</a>
              <button onClick={calculateLabels} disabled={calculatingLbls} className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium">
                {calculatingLbls?'⟳ Berekenen...':'⟳ Herbereken'}
              </button>
            </div>
          </div>
          {calcResult&&<div className={'px-4 py-2 rounded-lg text-sm '+(calcResult.startsWith('Fout')?'bg-red-950/40 text-red-400 border border-red-900/50':'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50')}>{calcResult}</div>}

          {labelsLoading ? <div className="text-center py-8 text-gray-500">Laden...</div> : (
            <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-gray-800">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    {LABEL_HEADS.map(h=><th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {products.map(p => {
                      const lbl = customLabels.find(l=>l.product_id===p.id);
                      const vals = [lbl?.custom_label_0, lbl?.custom_label_1, lbl?.custom_label_2, lbl?.custom_label_3, lbl?.custom_label_4];
                      const overrides = [lbl?.label_0_override, lbl?.label_1_override, lbl?.label_2_override, lbl?.label_3_override, lbl?.label_4_override];
                      const keys = ['custom_label_0','custom_label_1','custom_label_2','custom_label_3','custom_label_4'];
                      return (
                        <tr key={p.id} className="hover:bg-gray-800/20">
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-200 truncate max-w-[180px]">{p.name_nl}</div>
                            <div className="text-xs text-gray-600 font-mono">{p.sku||p.ean||'—'}</div>
                          </td>
                          {vals.map((val, idx) => {
                            const key = keys[idx];
                            const isEdit = editingLbl?.productId===p.id && editingLbl?.key===key;
                            const isOverride = overrides[idx];
                            return (
                              <td key={key} className="px-3 py-3">
                                {isEdit ? (
                                  <div className="flex items-center gap-1">
                                    <select value={editLblValue} onChange={e=>setEditLblValue(e.target.value)} className="px-1.5 py-1 text-xs bg-gray-800 border border-indigo-600 rounded text-gray-200 focus:outline-none">
                                      <option value="">— leeg —</option>
                                      {LABEL_OPTIONS[idx].map(o=><option key={o} value={o}>{o}</option>)}
                                    </select>
                                    <button onClick={()=>saveLabelEdit(p.id,key)} disabled={savingLbl} className="text-xs px-1.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded">✓</button>
                                    <button onClick={()=>setEditingLbl(null)} className="text-xs px-1 py-1 bg-gray-700 text-gray-400 rounded">✕</button>
                                  </div>
                                ) : (
                                  <button onClick={()=>{setEditingLbl({productId:p.id,key,idx});setEditLblValue(val??'');}}
                                    className={`text-xs px-2 py-0.5 rounded border transition-colors hover:opacity-80 ${val ? (LABEL_STYLES[val]??'border-gray-700 text-gray-400') : 'border-gray-800 text-gray-700'} ${isOverride?'ring-1 ring-amber-500/50':''}`}>
                                    {isOverride&&<span className="mr-0.5 text-amber-500/70">★</span>}{val??'—'}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {products.length===0&&<tr><td colSpan={6} className="px-4 py-12 text-center text-gray-600">Geen producten. Klik "Shopify Sync".</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="text-xs text-gray-600 px-1">
            Supplemental feed URL: <code className="bg-gray-800 px-1.5 py-0.5 rounded">/api/feed/output/supplemental?market=NL</code> — koppel dit als aparte data source in Google Merchant Center.
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Slide-over product panel                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {panelProductId && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={closePanel} />
          <div className="fixed right-0 top-0 h-full w-[520px] bg-[#0f0f17] border-l border-gray-800 z-50 flex flex-col shadow-2xl">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
              {panelProd ? (
                <div className="flex items-center gap-3 min-w-0">
                  {panelProd.image_url&&<img src={panelProd.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-800 shrink-0"/>}
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-200 truncate">{panelProd.name_nl}</div>
                    <div className="text-xs text-gray-500">{panelProd.category||'—'} · {fmtPrice(panelProd.price_eur)}</div>
                  </div>
                </div>
              ) : <div className="text-sm text-gray-400">Laden...</div>}
              <button onClick={closePanel} className="text-gray-500 hover:text-gray-300 ml-3 shrink-0 text-lg leading-none">✕</button>
            </div>

            {/* Panel sub-tabs */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 overflow-x-auto shrink-0">
              {(['status','content','rules','images','changelog'] as PanelTab[]).map(t=>(
                <button key={t} onClick={()=>setPanelTab(t)} className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-colors ${panelTab===t?'bg-gray-800 text-white':'text-gray-500 hover:text-gray-300'}`}>
                  {t==='status'?'📊 Status':t==='content'?'✏️ Content':t==='rules'?'📋 Regels':t==='images'?'🖼 Foto\'s':'📝 Log'}
                </button>
              ))}
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-4">
              {panelLoading ? (
                <div className="text-center py-8 text-gray-500">Laden...</div>
              ) : panelData ? (
                <>
                  {panelTab==='status' && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Feed Status per kanaal</h4>
                      {panelData.feed_status.length===0 ? <p className="text-sm text-gray-600">Geen actieve feeds.</p>
                      : panelData.feed_status.map((s:any)=>(
                        <div key={s.config_id} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${s.included?'border-emerald-900/50 bg-emerald-950/20':'border-red-900/50 bg-red-950/20'}`}>
                          <div>
                            <div className="text-sm text-gray-200">{s.feed_name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{s.market_code} · {s.channel}</div>
                            {!s.included&&<div className="text-xs text-red-400 mt-0.5">Uitgesloten door: {s.excluded_by}</div>}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${s.included?'text-emerald-400':'text-red-400'}`}>{s.included?'✓ Opgenomen':'✕ Uitgesloten'}</span>
                        </div>
                      ))}
                      {panelProd&&panelProd.feed_issues.length>0&&(
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Issues</h4>
                          {panelProd.feed_issues.map(issue=><div key={issue} className="px-3 py-2 rounded-lg border border-amber-900/50 bg-amber-950/20 text-xs text-amber-400 mb-1">⚠ {issue}</div>)}
                        </div>
                      )}
                    </div>
                  )}

                  {panelTab==='content' && (
                    <div>
                      <div className="flex gap-1 mb-4">
                        {['nl','en','de','fr'].map(lang=>(
                          <button key={lang} onClick={()=>setPanelLang(lang)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${panelLang===lang?'bg-gray-800 text-white':'text-gray-500 hover:text-gray-300'}`}>{lang.toUpperCase()}</button>
                        ))}
                      </div>
                      {(()=>{
                        const curr=panelData.content[panelLang]??{};
                        const edit=panelEdit[panelLang]??{};
                        return (
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-gray-400 mb-1 block">Titel</label>
                              <input value={edit.title??curr.title??''} onChange={e=>setPanelEdit(prev=>({...prev,[panelLang]:{...prev[panelLang],title:e.target.value}}))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500"/>
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 mb-1 block">Korte beschrijving</label>
                              <textarea value={edit.description_short??curr.description_short??''} onChange={e=>setPanelEdit(prev=>({...prev,[panelLang]:{...prev[panelLang],description_short:e.target.value}}))} rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500 resize-none"/>
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 mb-1 block">Lange beschrijving</label>
                              <textarea value={edit.description_long??curr.description_long??curr.description??''} onChange={e=>setPanelEdit(prev=>({...prev,[panelLang]:{...prev[panelLang],description_long:e.target.value}}))} rows={6} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500 resize-none"/>
                            </div>
                            <button onClick={()=>savePanelContent(panelLang)} disabled={panelSaving} className="w-full px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium">{panelSaving?'Opslaan...':'💾 Opslaan'}</button>
                            {curr.ai_variants&&curr.ai_variants.length>0&&(
                              <div className="mt-4 pt-4 border-t border-gray-800">
                                <h5 className="text-xs font-semibold text-gray-400 mb-2">AI Varianten</h5>
                                {curr.ai_variants.map((v:any)=>(
                                  <div key={v.id} className="px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 mb-2">
                                    <div className="text-xs text-gray-400 font-medium mb-0.5">{v.label} ({v.id})</div>
                                    <div className="text-xs text-gray-200">"{v.title}"</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {panelTab==='rules' && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Toepasselijke Regels</h4>
                      {(()=>{
                        const matching=rules.filter(r=>r.active&&panelProd&&(r.conditions??[]).every(c=>evalCond(panelProd,c)));
                        if (!matching.length) return <p className="text-sm text-gray-600">Geen actieve regels van toepassing op dit product.</p>;
                        return matching.map(r=>(
                          <div key={r.id} className={`px-3 py-2 rounded-lg border ${r.type==='filter'?'border-red-900/50 bg-red-950/10':'border-indigo-900/50 bg-indigo-950/10'}`}>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${r.type==='filter'?'bg-amber-950/50 text-amber-400':'bg-indigo-950/50 text-indigo-400'}`}>{r.type}</span>
                              <span className="text-sm text-gray-200">{r.name}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{(r.scope??'master')==='master'?'Master':'Partner '+r.channel}</div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}

                  {panelTab==='images' && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Image Bank</h4>
                      {panelData.images.length===0 ? <p className="text-sm text-gray-600">Geen afbeeldingen in image bank.</p>
                      : <div className="grid grid-cols-3 gap-2">{panelData.images.map((img:any)=>(
                        <div key={img.id} className="relative">
                          <img src={img.storage_url} alt={img.filename} className="w-full aspect-square object-cover rounded-lg bg-gray-800"/>
                          <div className="absolute bottom-1 left-1"><span className={`text-xs px-1.5 py-0.5 rounded ${img.is_active?'bg-emerald-900/80 text-emerald-300':'bg-gray-900/80 text-gray-400'}`}>{img.image_type||'main'}</span></div>
                        </div>
                      ))}</div>}
                      {panelProd?.image_url&&(
                        <div className="mt-4 pt-4 border-t border-gray-800">
                          <div className="text-xs text-gray-500 mb-2">Shopify hoofdafbeelding</div>
                          <img src={panelProd.image_url} alt="" className="w-24 h-24 rounded-lg object-cover"/>
                        </div>
                      )}
                    </div>
                  )}

                  {panelTab==='changelog' && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Recente Wijzigingen</h4>
                      {panelData.changelog.length===0 ? <p className="text-sm text-gray-600">Geen wijzigingen.</p>
                      : <div className="space-y-2">{panelData.changelog.map((e:any)=>(
                        <div key={e.id} className="flex items-start gap-2 text-xs">
                          <div className="shrink-0 text-gray-600 w-14">{timeAgo(e.created_at)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{e.field}</span>
                              {e.language&&<span className="text-gray-600">{e.language.toUpperCase()}</span>}
                              <span className="px-1.5 py-0.5 rounded bg-gray-800/50 text-gray-500">{e.source}</span>
                            </div>
                            {e.new_value&&<div className="text-gray-300 mt-0.5 truncate">"{e.new_value.substring(0,80)}"</div>}
                          </div>
                        </div>
                      ))}</div>}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
