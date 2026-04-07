'use client';

import { useEffect, useState, useCallback } from 'react';
import Nav from '../components/Nav';

const URGENCY_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  'KRITIEK':    { label: 'Kritiek',     color: '#ef4444', bg: '#7f1d1d22', dot: 'bg-red-500' },
  'AIR URGENT': { label: 'Air Urgent',  color: '#f97316', bg: '#7c2d1222', dot: 'bg-orange-500' },
  'BESTEL AIR': { label: 'Bestel AIR',  color: '#eab308', bg: '#71350222', dot: 'bg-yellow-500' },
  'BESTEL SEA': { label: 'Bestel SEA',  color: '#3b82f6', bg: '#1e3a5f22', dot: 'bg-blue-500' },
  'OK':         { label: 'OK',          color: '#22c55e', bg: '#14532d22', dot: 'bg-green-500' },
  'GEEN DATA':  { label: 'Geen data',   color: '#6b7280', bg: '#1f293722', dot: 'bg-gray-500' },
};

interface Product {
  name: string;
  sku: string;
  stock: number;
  price: number;
  cogs_sea: number | null;
  cogs_air: number | null;
  air_allowed: boolean;
  velocity_30d: number;
  velocity_90d: number;
  days_left: number | null;
  urgency: string;
  method: string;
  reorder_qty: number;
  reorder_cost: number;
  sea_lead: number;
  air_lead: number;
}

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function DaysBar({ days_left, sea_lead, air_lead }: { days_left: number | null; sea_lead: number; air_lead: number }) {
  if (days_left === null) return <span className="text-xs text-gray-600">∞</span>;
  const max = sea_lead + 30;
  const pct = Math.min(100, Math.max(0, (days_left / max) * 100));
  const color = days_left <= 0 ? '#ef4444' : days_left < air_lead ? '#f97316' : days_left < sea_lead ? '#eab308' : '#22c55e';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs tabular-nums" style={{ color }}>{days_left <= 0 ? days_left : `${days_left}d`}</span>
    </div>
  );
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProducts(data.products ?? []);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? products : products.filter(p => p.urgency === filter);

  const counts = {
    KRITIEK:      products.filter(p => p.urgency === 'KRITIEK').length,
    'AIR URGENT': products.filter(p => p.urgency === 'AIR URGENT').length,
    'BESTEL AIR': products.filter(p => p.urgency === 'BESTEL AIR').length,
    'BESTEL SEA': products.filter(p => p.urgency === 'BESTEL SEA').length,
    OK:           products.filter(p => p.urgency === 'OK').length,
  };

  const totalReorderCost = products
    .filter(p => p.urgency !== 'OK' && p.urgency !== 'GEEN DATA')
    .reduce((sum, p) => sum + p.reorder_cost, 0);

  const urgentCount = counts.KRITIEK + counts['AIR URGENT'] + counts['BESTEL AIR'];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Mvolo Attribution Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">Voorraad & reorder calculator</p>
            </div>
            <Nav />
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                {lastUpdated.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button onClick={load} className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all">
              ↻ Verversen
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">

        {/* KPI rij */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
            <p className="text-xs text-gray-500">Totaal producten</p>
            <p className="text-3xl font-bold text-white mt-1">{products.length}</p>
            <p className="text-xs text-gray-600 mt-1">in COGS database</p>
          </div>
          <div className="bg-gray-900 border border-red-900/40 rounded-xl px-5 py-4">
            <p className="text-xs text-gray-500">Kritiek / Urgent</p>
            <p className="text-3xl font-bold text-red-400 mt-1">{urgentCount}</p>
            <p className="text-xs text-gray-600 mt-1">direct actie nodig</p>
          </div>
          <div className="bg-gray-900 border border-blue-900/40 rounded-xl px-5 py-4">
            <p className="text-xs text-gray-500">Bestel binnenkort</p>
            <p className="text-3xl font-bold text-blue-400 mt-1">{counts['BESTEL SEA']}</p>
            <p className="text-xs text-gray-600 mt-1">via SEA</p>
          </div>
          <div className="bg-gray-900 border border-yellow-900/40 rounded-xl px-5 py-4">
            <p className="text-xs text-gray-500">Totale reorder kosten</p>
            <p className="text-3xl font-bold text-yellow-400 mt-1">{formatEuro(totalReorderCost)}</p>
            <p className="text-xs text-gray-600 mt-1">urgente producten</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          <button onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === 'all' ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}>
            Alle ({products.length})
          </button>
          {Object.entries(URGENCY_CONFIG).slice(0, 5).map(([key, cfg]) => {
            const count = products.filter(p => p.urgency === key).length;
            if (count === 0) return null;
            return (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${filter === key ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">Fout: {error}</div>
        )}

        {/* Tabel */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider border-b border-gray-800">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Voorraad</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Dagen over</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Vel. 30d</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Vel. 90d</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Verkoopprijs</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">COGS SEA</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Reorder advies</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-600 animate-pulse">Laden…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-600">Geen producten gevonden.</td></tr>
                )}
                {!loading && filtered.map(p => {
                  const cfg = URGENCY_CONFIG[p.urgency] ?? URGENCY_CONFIG['GEEN DATA'];
                  const margin = p.cogs_sea && p.price > 0 ? Math.round(((p.price - p.cogs_sea) / p.price) * 100) : null;
                  return (
                    <tr key={p.sku} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm text-white font-medium">{p.name}</p>
                        <p className="text-xs text-gray-600 font-mono">{p.sku}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
                          style={{ background: cfg.bg, color: cfg.color }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-bold tabular-nums ${p.stock < 0 ? 'text-red-400' : p.stock === 0 ? 'text-orange-400' : p.stock <= 5 ? 'text-yellow-400' : 'text-white'}`}>
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <DaysBar days_left={p.days_left} sea_lead={p.sea_lead} air_lead={p.air_lead} />
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums text-gray-400">
                        {p.velocity_30d > 0 ? p.velocity_30d.toFixed(2) : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums text-gray-400">
                        {p.velocity_90d > 0 ? p.velocity_90d.toFixed(2) : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-white tabular-nums">
                        {p.price > 0 ? formatEuro(p.price) : <span className="text-gray-700">—</span>}
                        {margin !== null && (
                          <p className="text-xs text-gray-500">{margin}% marge</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400 tabular-nums">
                        {p.cogs_sea ? formatEuro(p.cogs_sea) : <span className="text-gray-700">—</span>}
                        {p.cogs_air && <p className="text-gray-600">AIR: {formatEuro(p.cogs_air)}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {p.reorder_qty > 0 ? (
                          <div>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ background: p.method === 'AIR' ? '#78350f22' : '#1e3a5f22', color: p.method === 'AIR' ? '#f59e0b' : '#60a5fa' }}>
                              {p.method} · {p.reorder_qty} stuks
                            </span>
                            <p className="text-xs text-gray-600 mt-0.5">{formatEuro(p.reorder_cost)}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-700">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lead time uitleg */}
        <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl px-6 py-4 text-xs text-gray-500 flex items-center gap-8">
          <span>Lead times: <span className="text-gray-300">SEA {products[0]?.sea_lead ?? 77}d</span> · <span className="text-gray-300">AIR {products[0]?.air_lead ?? 38}d</span></span>
          <span>Veiligheidsvoorraad: <span className="text-gray-300">14 dagen</span></span>
          <span>Velocity gebaseerd op 30d (primair) of 90d (fallback)</span>
        </div>

      </main>
    </div>
  );
}
