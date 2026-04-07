'use client';

import { useEffect, useState, useCallback } from 'react';
import Nav from '../components/Nav';

// ── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  total_price: number;
  channel: string;
  first_touch: string | null;
  last_touch: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  is_new_customer: number | null;
  marketplace: string | null;
  device_type: string | null;
  browser_language: string | null;
}

interface SessionEntry {
  ts: string;
  p: string;
  ref: string | null;
  src: string | null;
  med: string | null;
  cmp: string | null;
}

interface VisitorSession {
  visitor_id: string;
  order_id: string;
  session_count: number;
  first_touch_date: string;
  last_touch_date: string;
  days_to_convert: number;
  touch_path: string;
  session_history: string | null;
  received_at: string | null;
}

type Platform = 'all' | 'shopify' | 'bol';
type SortDir = 'asc' | 'desc';
type SortCol =
  | 'order_number' | 'created_at' | 'total_price' | 'channel'
  | 'first_touch'  | 'last_touch'  | 'utm_campaign' | 'utm_content'
  | 'utm_term' | 'is_new_customer';

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_NL = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

const CHANNEL_COLORS: Record<string, string> = {
  direct:              '#6366f1',
  organic_search:      '#22c55e',
  meta_ads:            '#ec4899',
  google_search:       '#3b82f6',
  google_shopping:     '#06b6d4',
  awin_affiliate:      '#f59e0b',
  ascendia_affiliate:  '#fbbf24',
  email:               '#a78bfa',
  organic_social:      '#f97316',
  bol_marketplace:     '#fb923c',
  ai_referral:         '#14b8a6',
  other:               '#6b7280',
};

function channelColor(ch: string) {
  return CHANNEL_COLORS[ch] ?? '#6b7280';
}

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v);
}

function formatLabel(s: string | null) {
  if (!s) return null;
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Sortable column header ────────────────────────────────────────────────────

function ColHead({ col, label, sort, dir, onSort }: {
  col: SortCol; label: string; sort: SortCol; dir: SortDir; onSort: (c: SortCol) => void;
}) {
  const active = sort === col;
  return (
    <th className="px-4 py-3 text-left font-medium cursor-pointer select-none whitespace-nowrap group" onClick={() => onSort(col)}>
      <span className={`flex items-center gap-1 ${active ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
        {label}
        <span className="text-xs opacity-60">{active ? (dir === 'desc' ? '↓' : '↑') : '↕'}</span>
      </span>
    </th>
  );
}

// ── Journey Drawer ────────────────────────────────────────────────────────────

function JourneyDrawer({ order, onClose }: { order: Order; onClose: () => void }) {
  const [session, setSession] = useState<VisitorSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/orders/session?order_id=${encodeURIComponent(order.id)}`)
      .then(r => r.json())
      .then(d => setSession(d.session ?? null))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, [order.id]);

  const touchPath = (() => {
    try { return JSON.parse(order.first_touch ?? '[]'); } catch { return []; }
  })();

  const sessionHistory: SessionEntry[] = (() => {
    try { return JSON.parse(session?.session_history ?? '[]'); } catch { return []; }
  })();

  const hasRealJourney = session && sessionHistory.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg h-full bg-gray-900 border-l border-gray-800 overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-sm font-semibold text-white">Order #{order.order_number}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Klik-journey & attributie</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg transition-colors">✕</button>
        </div>

        <div className="px-6 py-5 space-y-6">

          {/* Order samenvatting */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Bedrag', value: formatEuro(order.total_price) },
              { label: 'Klant', value: order.is_new_customer === 1 ? 'Nieuw' : 'Terugkerend' },
              { label: 'Platform', value: order.marketplace === 'bol' ? 'Bol.com' : 'Shopify' },
              { label: 'Datum', value: new Date(order.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) },
              { label: 'Device', value: order.device_type ? order.device_type.charAt(0).toUpperCase() + order.device_type.slice(1) : '—' },
              { label: 'Taal', value: order.browser_language ?? '—' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-gray-800/60 rounded-xl px-4 py-3 border border-gray-700/40">
                <p className="text-xs text-gray-500">{kpi.label}</p>
                <p className="text-sm font-semibold text-white mt-0.5">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Attributie */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Attributie</h3>
            <div className="space-y-2">
              {[
                { label: 'Kanaal (last touch)', value: order.channel },
                { label: 'First touch', value: order.first_touch },
                { label: 'Campaign', value: order.utm_campaign },
                { label: 'Adset', value: order.utm_term },
                { label: 'Ad', value: order.utm_content },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-gray-800/60">
                  <span className="text-xs text-gray-500">{row.label}</span>
                  {row.value ? (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: `${channelColor(row.value)}22`,
                        color: CHANNEL_COLORS[row.value] ? channelColor(row.value) : '#d1d5db',
                      }}
                    >
                      {formatLabel(row.value) ?? row.value}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-700">—</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Touch path (uit orders tabel) */}
          {touchPath.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Touch path</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {touchPath.map((touch: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: `${channelColor(touch)}22`, color: channelColor(touch) }}
                    >
                      {formatLabel(touch) ?? touch}
                    </span>
                    {i < touchPath.length - 1 && <span className="text-gray-700 text-xs">→</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Volledige klik-journey van tracker.js */}
          {loading && (
            <div className="text-xs text-gray-600 animate-pulse">Journey laden...</div>
          )}

          {!loading && hasRealJourney && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Klik-journey</h3>
                <span className="text-xs text-gray-600">
                  {session!.session_count} sessies · {session!.days_to_convert}d tot aankoop
                </span>
              </div>
              <div className="space-y-2">
                {sessionHistory.map((s, i) => (
                  <div key={i} className="bg-gray-800/40 rounded-lg px-4 py-3 border border-gray-700/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-300 font-medium truncate max-w-[240px]">{s.p}</span>
                      <span className="text-xs text-gray-600 flex-shrink-0 ml-2">
                        {new Date(s.ts).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {s.src && (
                        <span
                          className="px-1.5 py-0.5 rounded text-xs"
                          style={{ background: `${channelColor(s.src)}22`, color: channelColor(s.src) }}
                        >
                          {s.src}
                        </span>
                      )}
                      {s.med && <span className="text-gray-600">{s.med}</span>}
                      {s.cmp && <span className="text-gray-700 truncate max-w-[160px]">{s.cmp}</span>}
                      {s.ref && !s.src && <span className="text-gray-600 truncate max-w-[200px]">via {s.ref}</span>}
                      {!s.src && !s.ref && <span className="text-gray-700">direct</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !hasRealJourney && (
            <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl px-4 py-5 text-center space-y-2">
              <p className="text-sm text-gray-500">Geen klik-journey beschikbaar</p>
              <p className="text-xs text-gray-700">
                Journey data wordt verzameld via tracker.js voor nieuwe orders.
                Bestaande orders hebben alleen UTM-gebaseerde attributie.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<SortCol>('created_at');
  const [dir, setDir] = useState<SortDir>('desc');
  const [platform, setPlatform] = useState<Platform>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), search: debouncedSearch, sort, dir, platform });
    fetch(`/api/orders/all?${params}`)
      .then(r => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then(d => { setOrders(d.orders ?? []); setTotal(d.total ?? 0); setTotalPages(d.totalPages ?? 1); setLastUpdated(new Date()); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, sort, dir, platform]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const t = setInterval(() => fetchOrders(), 6 * 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  function handleSort(col: SortCol) {
    if (col === sort) { setDir(d => d === 'desc' ? 'asc' : 'desc'); }
    else { setSort(col); setDir('desc'); }
    setPage(1);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Journey drawer */}
      {selectedOrder && (
        <JourneyDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}

      {/* Header */}
      <header className="border-b border-gray-800 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Mvolo Attribution Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">Shopify order attribution by marketing channel</p>
            </div>
            <Nav />
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (() => {
              const minutesAgo = Math.round((Date.now() - lastUpdated.getTime()) / 60000);
              const isFresh = minutesAgo < 360;
              return (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isFresh ? 'bg-emerald-500 animate-pulse' : 'bg-orange-500'}`} />
                  <span>Laatste update: {lastUpdated.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              );
            })()}
            <button onClick={fetchOrders} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all">
              ↻ Nu verversen
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">

        {/* Platform filter */}
        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {([['all', 'Alle platforms'], ['shopify', 'Shopify'], ['bol', 'Bol.com']] as [Platform, string][]).map(([key, label]) => (
            <button key={key} onClick={() => { setPlatform(key); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${platform === key ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}>
              {key === 'bol' && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
              {label}
            </button>
          ))}
        </div>

        {/* Title + search */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Alle orders</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading ? 'Laden…' : `${total.toLocaleString('nl-NL')} orders · klik op rij voor journey`}
            </p>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">⌕</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Zoek op ordernummer, kanaal, campagne…"
              className="bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-80 transition-colors" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs">✕</button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">Fout: {error}</div>
        )}

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider border-b border-gray-800 bg-gray-900">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Platform</th>
                  <ColHead col="order_number"    label="Order #"     sort={sort} dir={dir} onSort={handleSort} />
                  <ColHead col="created_at"      label="Datum"       sort={sort} dir={dir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Dag</th>
                  <ColHead col="total_price"     label="Bedrag"      sort={sort} dir={dir} onSort={handleSort} />
                  <ColHead col="channel"         label="Kanaal"      sort={sort} dir={dir} onSort={handleSort} />
                  <ColHead col="first_touch"     label="First Touch" sort={sort} dir={dir} onSort={handleSort} />
                  <ColHead col="last_touch"      label="Last Touch"  sort={sort} dir={dir} onSort={handleSort} />
                  <ColHead col="utm_campaign"    label="Campaign"    sort={sort} dir={dir} onSort={handleSort} />
                  <ColHead col="utm_term"        label="Adset"       sort={sort} dir={dir} onSort={handleSort} />
                  <ColHead col="utm_content"     label="Ad"          sort={sort} dir={dir} onSort={handleSort} />
                  <ColHead col="is_new_customer" label="Klant"       sort={sort} dir={dir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Journey</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={13} className="px-4 py-16 text-center text-gray-600 text-sm animate-pulse">Laden…</td></tr>
                )}
                {!loading && orders.length === 0 && (
                  <tr><td colSpan={13} className="px-4 py-16 text-center text-gray-600 text-sm">Geen orders gevonden{search ? ` voor "${search}"` : ''}.</td></tr>
                )}
                {!loading && orders.map(o => {
                  const d = new Date(o.created_at);
                  const dag = DAY_NL[d.getDay()];
                  const color = channelColor(o.channel);
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedOrder(o)}
                    >
                      <td className="px-4 py-3">
                        {o.marketplace === 'bol'
                          ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-900/40 text-orange-400">Bol</span>
                          : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Shopify</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-300">#{o.order_number}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap tabular-nums">
                        {d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{dag}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-white whitespace-nowrap">{formatEuro(o.total_price)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full" style={{ background: `${color}22`, color }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                          {formatLabel(o.channel)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatLabel(o.first_touch) ?? <span className="text-gray-700">—</span>}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatLabel(o.last_touch) ?? <span className="text-gray-700">—</span>}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono max-w-[140px] truncate">{o.utm_campaign ?? <span className="text-gray-700">—</span>}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono max-w-[130px] truncate">{o.utm_term ?? <span className="text-gray-700">—</span>}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono max-w-[130px] truncate">{o.utm_content ?? <span className="text-gray-700">—</span>}</td>
                      <td className="px-4 py-3">
                        {o.is_new_customer === 1
                          ? <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full">Nieuw</span>
                          : o.is_new_customer === 0
                            ? <span className="text-xs bg-indigo-900/50 text-indigo-400 px-2 py-0.5 rounded-full">Terugkerend</span>
                            : <span className="text-xs text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-indigo-500 hover:text-indigo-400">→</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
              <span className="text-xs text-gray-600">Pagina {page} van {totalPages} ({total.toLocaleString('nl-NL')} orders)</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  ← Vorige
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.min(Math.max(page - 2 + i, 1), totalPages - Math.min(4, totalPages - 1) + i);
                  return p;
                }).filter((v, i, arr) => arr.indexOf(v) === i).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-7 text-xs rounded-lg transition-colors ${p === page ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  Volgende →
                </button>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
