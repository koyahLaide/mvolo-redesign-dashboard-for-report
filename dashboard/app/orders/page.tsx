'use client';
import { useEffect, useState, useCallback } from 'react';

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v ?? 0);
}

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OrdersPage() {
  const [data, setData] = useState<any>(null);
  const [period, setPeriod] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ period, platform });
    if (search) params.set('q', search);
    const res = await fetch(`/api/orders?${params}`);
    setData(await res.json());
    setLoading(false);
  }, [period, platform, search]);

  useEffect(() => { load(); }, [load]);

  const orders = data?.orders ?? [];
  const totals = data?.totals ?? {};

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Totaal orders</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totals.total_orders ?? 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Totaal omzet</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{formatEuro(totals.total_revenue ?? 0)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Gem. orderwaarde</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{formatEuro(totals.avg_order_value ?? 0)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Unieke klanten</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totals.unique_customers ?? 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Period filter */}
        <div className="flex items-center gap-1.5">
          {[
            { key: '7', label: '7d' },
            { key: '30', label: '30d' },
            { key: '90', label: '90d' },
            { key: 'all', label: 'Alles' },
          ].map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Platform filter */}
        <div className="flex items-center gap-1.5">
          {[
            { key: 'all', label: 'Alle' },
            { key: 'shopify', label: 'Shopify' },
            { key: 'bol', label: 'Bol.com' },
          ].map(p => (
            <button key={p.key} onClick={() => setPlatform(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${platform === p.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs sm:ml-auto">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Zoek op ordernummer, klant…"
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Datum</th>
                <th className="px-4 py-3 text-left">Klant</th>
                <th className="px-4 py-3 text-left">Platform</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Omzet</th>
                <th className="px-4 py-3 text-right">Marge</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500 animate-pulse">
                    Laden…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                    Geen orders gevonden
                  </td>
                </tr>
              ) : (
                orders.map((o: any) => (
                  <tr key={o.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-indigo-600 dark:text-indigo-400">#{o.order_number ?? o.id}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(o.created_at)}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{o.customer_name ?? o.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        o.platform === 'bol' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {o.platform === 'bol' ? 'Bol.com' : 'Shopify'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        o.status === 'fulfilled' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : o.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {o.status === 'fulfilled' ? 'Verzonden' : o.status === 'cancelled' ? 'Geannuleerd' : o.status === 'pending' ? 'Open' : o.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100 tabular-nums">{formatEuro(o.total ?? o.revenue ?? 0)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-600 dark:text-green-400">{formatEuro(o.margin ?? 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination info */}
        {!loading && orders.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{orders.length} orders weergegeven</span>
            <span>Totaal: {totals.total_orders ?? 0} orders</span>
          </div>
        )}
      </div>
    </div>
  );
}
