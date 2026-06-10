'use client';

import { useEffect, useState, useCallback } from 'react';

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v ?? 0);
}

const CATEGORY_LABELS: Record<string, string> = {
  led_face_mask:        '😷 LED Face Mask',
  infrared_double_head: '💡 Infrarood Dubbel',
  infrared_double:      '💡 Infrarood Dubbel',
  infrared_single_head: '💡 Infrarood Enkel',
  infrared_single:      '💡 Infrarood Enkel',
  rlt_panel:            '🔴 RLT Panel',
  infrared_rugband:     '🎽 Infrarood Rugband',
  sauna_blanket:        '🧖 Sauna Deken',
  daylight_lamp:        '☀️ Daglichtlamp',
  daylight_glasses:     '👓 Daglichtbril',
  ems_device:           '⚡ EMS Device',
};

const COMPETITOR_COLORS: Record<string, string> = {
  Liroma:         '#6366f1',
  Vitalwave:      '#22c55e',
  Nuvibody:       '#f59e0b',
  Panacea:        '#ec4899',
  Platinum:       '#a78bfa',
  Rojo:           '#ef4444',
  Hooga:          '#06b6d4',
  MitoRed:        '#f97316',
  Amarapure:      '#14b8a6',
  Solawave:       '#eab308',
  Blockbluelight: '#8b5cf6',
};

function compColor(name: string) {
  return COMPETITOR_COLORS[name] ?? '#6b7280';
}

export default function CompetitorPrijzenPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncDebug, setSyncDebug] = useState<string[] | null>(null);
  const [tab, setTab] = useState<'overzicht' | 'wijzigingen' | 'analyse'>('overzicht');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/competitor-prices');
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const syncNow = async () => {
    setSyncing(true);
    setSyncMsg(null);
    setSyncDebug(null);
    try {
      const res = await fetch('/api/competitor-prices/sync', { method: 'POST' });
      const json = await res.json();
      if (json.error) {
        setSyncMsg(`Fout: ${json.error}`);
      } else if (json.synced === 0) {
        setSyncMsg(`Bol.com: 0 producten gevonden. Zie debug hieronder.`);
        setSyncDebug(json.debug ?? []);
      } else {
        setSyncMsg(`✓ ${json.synced} producten gesynchroniseerd van Bol.com`);
        setSyncDebug(null);
        await load();
      }
    } catch (e: any) {
      setSyncMsg(`Fout: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const products = data?.products ?? [];
  const priceChanges = data?.priceChanges ?? [];
  const alerts = data?.alerts ?? [];
  const mvoloPrices = data?.mvoloPrices ?? [];
  const tablesMissing = data?._tablesMissing;
  const apiError = data?.error;

  const categories = [...new Set(products.map((p: any) => p.category))].filter(Boolean) as string[];
  const byCategory: Record<string, any[]> = {};
  products.forEach((p: any) => {
    if (!p.category) return;
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  });

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Competitor Prijzen</h1>
            {data?.lastSync && <p className="text-xs text-gray-500 mt-0.5">Laatste sync: {data.lastSync}</p>}
          </div>
          <div className="flex items-center gap-3">
            {syncMsg && <span className={`text-xs ${syncMsg.startsWith('Fout') ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{syncMsg}</span>}
            <button
              onClick={syncNow}
              disabled={syncing}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 text-white rounded-lg transition-colors"
            >
              {syncing ? '⟳ Bezig met scrapen…' : '⟳ Sync van Bol.com'}
            </button>
          </div>
        </div>

        {/* Sync debug output (shown when 0 products found) */}
        {syncDebug && syncDebug.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl px-5 py-3">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Scraper diagnose (stuur dit naar je developer):</p>
            <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-5">{syncDebug.join('\n')}</pre>
          </div>
        )}

        {/* Alerts banner */}
        {!loading && alerts.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl px-5 py-4 space-y-2">
            <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">⚠ {alerts.length} competitors goedkoper dan Mvolo</p>
            {alerts.slice(0, 3).map((a: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-300">
                  <span className="font-semibold" style={{ color: compColor(a.competitor) }}>{a.competitor}</span>
                  {' '}verkoopt{' '}
                  <span className="text-gray-500 dark:text-gray-400">{a.category?.replace(/_/g, ' ')}</span>
                  {' '}voor{' '}
                  <span className="text-red-600 dark:text-red-400 font-semibold">{formatEuro(a.competitor_price)}</span>
                  {' '}vs Mvolo{' '}
                  <span className="text-gray-900 dark:text-white font-semibold">{formatEuro(a.mvolo_price)}</span>
                </span>
                <span className="text-red-600 dark:text-red-400 font-semibold">{a.diff_pct}%</span>
              </div>
            ))}
          </div>
        )}

        {/* Prijswijzigingen banner */}
        {!loading && priceChanges.length > 0 && (
          <div className="bg-amber-50 dark:bg-yellow-950/20 border border-amber-200 dark:border-yellow-900/30 rounded-xl px-5 py-4 space-y-2">
            <p className="text-xs font-semibold text-amber-600 dark:text-yellow-400 uppercase tracking-wider">📊 {priceChanges.length} prijswijzigingen afgelopen 14 dagen</p>
            {priceChanges.slice(0, 3).map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-300">
                  <span className="font-semibold" style={{ color: compColor(c.competitor) }}>{c.competitor}</span>
                  {' — '}
                  <span className="text-gray-500 dark:text-gray-400 truncate">{c.product_name?.substring(0, 40)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-gray-400 dark:text-gray-500">{formatEuro(c.prev_price)}</span>
                  <span className="text-gray-500 dark:text-gray-600">→</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatEuro(c.price)}</span>
                  <span className={c.price_change_pct < 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {c.price_change_pct > 0 ? '+' : ''}{Math.round(c.price_change_pct)}%
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* KPI banner */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
              <p className="text-xs text-gray-500">Competitors gemonitord</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{data?.totalCompetitors}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
              <p className="text-xs text-gray-500">Producten getrackt</p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{data?.totalProducts}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30 rounded-xl px-5 py-4">
              <p className="text-xs text-gray-500">Goedkoper dan Mvolo</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{alerts.length}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600">categorieën</p>
            </div>
            <div className="bg-amber-50 dark:bg-yellow-950/20 border border-amber-200 dark:border-yellow-900/20 rounded-xl px-5 py-4">
              <p className="text-xs text-gray-500">Prijswijzigingen (14d)</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-yellow-400 mt-1">{priceChanges.length}</p>
            </div>
          </div>
        )}

        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1 w-fit">
          {([
            ['overzicht',    '📊 Per categorie'],
            ['wijzigingen',  '📈 Prijswijzigingen'],
            ['analyse',      '🎯 Analyse vs Mvolo'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key ? 'bg-gray-100 dark:bg-white text-gray-900 dark:text-gray-900' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500 animate-pulse">Laden…</div>
        ) : apiError ? (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl px-6 py-8 text-center">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">API fout</p>
            <p className="text-xs text-gray-500">{apiError}</p>
          </div>
        ) : tablesMissing ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-6 py-12 text-center space-y-3">
            <p className="text-2xl">🔍</p>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Geen competitor data gevonden</p>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">De <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">competitor_prices</code> tabel bestaat nog niet in de database. Voer de SQL-migratie uit in Supabase om te beginnen met het tracken van competitor prijzen.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-6 py-12 text-center space-y-3">
            <p className="text-3xl">📭</p>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nog geen competitor prijzen</p>
            <p className="text-xs text-gray-500 max-w-md mx-auto">Klik op <strong>Sync from Bol.com</strong> om prijzen op te halen van Bol.com.</p>
          </div>
        ) : (
          <>
            {/* OVERZICHT TAB */}
            {tab === 'overzicht' && (
              <div className="space-y-4">
                {/* Categorie filter */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium ${selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                    Alle categorieën
                  </button>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                      {CATEGORY_LABELS[cat] ?? cat}
                    </button>
                  ))}
                </div>

                {/* Per categorie blok */}
                {Object.entries(byCategory)
                  .filter(([cat]) => selectedCategory === 'all' || cat === selectedCategory)
                  .map(([category, catProducts]) => {
                    const mvolo = mvoloPrices.find((m: any) => {
                      const t = (m.title || '').toLowerCase();
                      if (category === 'led_face_mask') return t.includes('led') || t.includes('face mask');
                      if (category === 'rlt_panel') return t.includes('rood licht') || t.includes('panel') || t.includes('elite');
                      if (category === 'infrared_double_head') return t.includes('dubbel') || t.includes('double');
                      if (category === 'infrared_single_head') return t.includes('enkel') || t.includes('single');
                      if (category === 'infrared_rugband') return t.includes('rugband');
                      return false;
                    });
                    const mvoloPrice = mvolo?.avg_price ?? null;
                    const cheapest = catProducts.sort((a: any, b: any) => a.price - b.price)[0];

                    return (
                      <div key={category} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{CATEGORY_LABELS[category] ?? category}</h2>
                            <span className="text-xs text-gray-400 dark:text-gray-600">{catProducts.length} producten</span>
                          </div>
                          {mvoloPrice && (
                            <span className="text-xs text-gray-500">
                              Mvolo: <span className="text-gray-900 dark:text-white font-semibold">{formatEuro(mvoloPrice)}</span>
                              {cheapest.price < mvoloPrice * 0.85 && (
                                <span className="ml-2 text-red-600 dark:text-red-400">⚠ {cheapest.competitor} is goedkoper</span>
                              )}
                            </span>
                          )}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase tracking-wider">
                                <th className="px-4 py-2 text-left">Competitor</th>
                                <th className="px-4 py-2 text-left">Product</th>
                                <th className="px-4 py-2 text-right">Prijs</th>
                                {mvoloPrice && <th className="px-4 py-2 text-right">vs Mvolo</th>}
                                <th className="px-4 py-2 text-right">Wijziging</th>
                                <th className="px-4 py-2 text-left">Link</th>
                              </tr>
                            </thead>
                            <tbody>
                              {catProducts.sort((a: any, b: any) => a.price - b.price).map((p: any, i: number) => {
                                const diff = mvoloPrice ? Math.round(((p.price - mvoloPrice) / mvoloPrice) * 100) : null;
                                return (
                                  <tr key={i} className={`border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 ${p.price_changed ? 'bg-amber-50 dark:bg-yellow-950/10' : ''}`}>
                                    <td className="px-4 py-2">
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
                                        style={{ background: `${compColor(p.competitor)}22`, color: compColor(p.competitor) }}>
                                        {p.competitor}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 max-w-xs truncate">{p.product_name}</td>
                                    <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white tabular-nums">
                                      {formatEuro(p.price)}
                                      {p.compare_price > p.price && (
                                        <span className="text-gray-400 line-through ml-1 text-xs">{formatEuro(p.compare_price)}</span>
                                      )}
                                    </td>
                                    {mvoloPrice && (
                                      <td className="px-4 py-2 text-right tabular-nums">
                                        <span style={{ color: diff! < -15 ? '#dc2626' : diff! < 0 ? '#d97706' : '#16a34a' }}>
                                          {diff! > 0 ? '+' : ''}{diff}%
                                        </span>
                                      </td>
                                    )}
                                    <td className="px-4 py-2 text-right tabular-nums">
                                      {p.price_changed ? (
                                        <span style={{ color: (p.price_change_pct ?? 0) < 0 ? '#16a34a' : '#dc2626' }}>
                                          {(p.price_change_pct ?? 0) > 0 ? '+' : ''}{Math.round(p.price_change_pct ?? 0)}%
                                        </span>
                                      ) : <span className="text-gray-400 dark:text-gray-700">—</span>}
                                    </td>
                                    <td className="px-4 py-2">
                                      <a href={p.url} target="_blank" rel="noopener noreferrer"
                                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 text-xs">↗</a>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* WIJZIGINGEN TAB */}
            {tab === 'wijzigingen' && (
              <div className="space-y-4">
                {priceChanges.length === 0 ? (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-8 text-center text-gray-500 dark:text-gray-600">
                    Nog geen prijswijzigingen gedetecteerd. Data wordt dagelijks bijgewerkt.
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prijswijzigingen afgelopen 14 dagen</h2>
                      <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Groen = daling (concurrent goedkoper geworden) · Rood = stijging</p>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase tracking-wider">
                          <th className="px-4 py-2 text-left">Datum</th>
                          <th className="px-4 py-2 text-left">Competitor</th>
                          <th className="px-4 py-2 text-left">Product</th>
                          <th className="px-4 py-2 text-right">Was</th>
                          <th className="px-4 py-2 text-right">Nu</th>
                          <th className="px-4 py-2 text-right">Wijziging</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceChanges.map((c: any, i: number) => (
                          <tr key={i} className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20">
                            <td className="px-4 py-2 text-gray-500">{c.date}</td>
                            <td className="px-4 py-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                                style={{ background: `${compColor(c.competitor)}22`, color: compColor(c.competitor) }}>
                                {c.competitor}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400 max-w-xs truncate">{c.product_name}</td>
                            <td className="px-4 py-2 text-right text-gray-400 dark:text-gray-500 tabular-nums line-through">{formatEuro(c.prev_price)}</td>
                            <td className="px-4 py-2 text-right text-gray-900 dark:text-white font-semibold tabular-nums">{formatEuro(c.price)}</td>
                            <td className="px-4 py-2 text-right tabular-nums">
                              <span style={{ color: c.price_change_pct < 0 ? '#16a34a' : '#dc2626' }}>
                                {c.price_change_pct > 0 ? '+' : ''}{Math.round(c.price_change_pct)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ANALYSE TAB */}
            {tab === 'analyse' && (
              <div className="space-y-4">
                {data?.categorySummary?.map((cat: any) => {
                  const mvolo = mvoloPrices.find((m: any) => {
                    const t = (m.title || '').toLowerCase();
                    if (cat.category === 'led_face_mask') return t.includes('led') || t.includes('face');
                    if (cat.category === 'rlt_panel') return t.includes('rood licht') || t.includes('panel') || t.includes('elite');
                    return false;
                  });
                  const mvoloPrice = mvolo?.avg_price;
                  const positionPct = mvoloPrice
                    ? Math.round(((mvoloPrice - cat.min_price) / (cat.max_price - cat.min_price)) * 100)
                    : null;

                  return (
                    <div key={cat.category} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{CATEGORY_LABELS[cat.category] ?? cat.category}</h2>
                        <span className="text-xs text-gray-400 dark:text-gray-600">{cat.competitor_count} competitors</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs mb-3">
                        <span className="text-gray-500">Min: <span className="text-green-600 dark:text-green-400 font-semibold">{formatEuro(cat.min_price)}</span></span>
                        <span className="text-gray-500">Gem: <span className="text-gray-700 dark:text-gray-300 font-semibold">{formatEuro(cat.avg_price)}</span></span>
                        <span className="text-gray-500">Max: <span className="text-red-600 dark:text-red-400 font-semibold">{formatEuro(cat.max_price)}</span></span>
                        {mvoloPrice && <span className="text-gray-500">Mvolo: <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{formatEuro(mvoloPrice)}</span></span>}
                      </div>
                      <div className="relative h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-visible">
                        <div className="absolute inset-y-0 left-0 right-0 bg-linear-to-r from-green-900/40 to-red-900/40 rounded-full" />
                        {positionPct !== null && positionPct >= 0 && positionPct <= 100 && (
                          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-900 z-10"
                            style={{ left: `${positionPct}%` }}
                            title={`Mvolo: ${formatEuro(mvoloPrice!)}`} />
                        )}
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Goedkoopst</span>
                        <span>Duurste</span>
                      </div>
                      {positionPct !== null && (
                        <p className="text-xs text-gray-500 mt-2">
                          Mvolo zit op <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{positionPct}%</span> van de prijsrange —
                          {positionPct < 30 ? ' 🟢 goed gepositioneerd' : positionPct < 60 ? ' 🟡 middensegment' : ' 🔴 premium segment'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
