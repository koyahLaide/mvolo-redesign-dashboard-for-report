'use client';
import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false });
const LeafletTooltip = dynamic(() => import('react-leaflet').then(m => m.Tooltip), { ssr: false });

const CITY_COORDS: Record<string, [number, number]> = {
  'Amsterdam': [4.9041, 52.3676], 'Rotterdam': [4.4777, 51.9244],
  'Utrecht': [5.1214, 52.0907], 'Den Haag': [4.3007, 52.0705],
  "'s-Gravenhage": [4.3007, 52.0705], 'Eindhoven': [5.4697, 51.4416],
  'Tilburg': [5.0919, 51.5555], 'Groningen': [6.5665, 53.2194],
  'Almere': [5.2647, 52.3508], 'Breda': [4.7753, 51.5719],
  'Nijmegen': [5.8523, 51.8426], 'Enschede': [6.8936, 52.2215],
  'Apeldoorn': [5.9699, 52.2112], 'Haarlem': [4.6462, 52.3873],
  'Arnhem': [5.8987, 51.9851], 'Zaandam': [4.8145, 52.4390],
  'Amersfoort': [5.3878, 52.1561], 'Zwolle': [6.0919, 52.5168],
  'Maastricht': [5.6909, 50.8514], 'Leiden': [4.4979, 52.1601],
  'Delft': [4.3571, 52.0116], 'Deventer': [6.1552, 52.2552],
  'Helmond': [5.6611, 51.4812], 'Leeuwarden': [5.7999, 53.2012],
  'Brussel': [4.3517, 50.8503], 'Antwerpen': [4.4025, 51.2194],
  'Gent': [3.7174, 51.0543], 'Brugge': [3.2247, 51.2093],
};

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v ?? 0);
}

export default function GeoPage() {
  const [data, setData] = useState<any>(null);
  const [period, setPeriod] = useState('all');
  const [activeTab, setActiveTab] = useState<'kaart' | 'visitors'>('kaart');

  const load = useCallback(async () => {
    const res = await fetch(`/api/geo?period=${period}`);
    setData(await res.json());
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const maxOrders = Math.max(...(data?.cities ?? []).map((c: any) => c.orders), 1);
  const topCities = (data?.cities ?? []).slice(0, 20);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">

      {/* Filters & tab nav */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1.5">
          {[{ key: 'all', label: 'Alles' }, { key: '7', label: '7d' }, { key: '30', label: '30d' }, { key: '90', label: '90d' }].map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1 sm:ml-auto">
          {(['kaart', 'visitors'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === t ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
              {t === 'kaart' ? 'Kaart' : 'Visitors'}
            </button>
          ))}
        </div>
      </div>

        {activeTab === 'kaart' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Totaal orders</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{data?.totals?.total_orders ?? 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Orders met stadsdata</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{data?.totals?.orders_with_city ?? 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Totaal omzet</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{formatEuro(data?.totals?.total_revenue ?? 0)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Orders per stad (NL + BE)</h2>
                </div>
                <div className="p-4" style={{ height: 500 }}>
                  <MapContainer center={[52.3, 5.3]} zoom={7} style={{ height: '100%', width: '100%', borderRadius: 8 }}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    {topCities.map((city: any) => {
                      const coords = CITY_COORDS[city.city];
                      if (!coords) return null;
                      const r = Math.max(5, Math.min(20, 5 + (city.orders / maxOrders) * 15));
                      return (
                        <CircleMarker
                          key={city.city}
                          center={[coords[1], coords[0]]}
                          radius={r}
                          pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.8, weight: 1 }}
                        >
                          <LeafletTooltip>
                            <span className="font-bold">{city.city}</span><br />
                            {city.orders} orders · {formatEuro(city.revenue)}
                          </LeafletTooltip>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Per land</h2>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                        <th className="px-4 py-2 text-left">Land</th>
                        <th className="px-4 py-2 text-right">Orders</th>
                        <th className="px-4 py-2 text-right">Omzet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.countries ?? []).slice(0, 8).map((c: any) => (
                        <tr key={c.shipping_country} className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20">
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{c.shipping_country}</td>
                          <td className="px-4 py-2 text-right text-indigo-600 dark:text-indigo-400 tabular-nums">{c.orders}</td>
                          <td className="px-4 py-2 text-right text-green-600 dark:text-green-400 tabular-nums">{formatEuro(c.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Top steden</h2>
                  </div>
                  <div className="p-4 space-y-2">
                    {topCities.slice(0, 8).map((city: any) => {
                      const pct = Math.round((city.orders / maxOrders) * 100);
                      return (
                        <div key={city.city} className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-28 flex-shrink-0 truncate">{city.city}</span>
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-700 dark:text-gray-300 tabular-nums w-6 text-right">{city.orders}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'visitors' && (
          <>
            {data?.sessionStats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Getrackte sessies</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{data.sessionStats.total_sessions}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{data.sessionStats.unique_visitors} unieke bezoekers</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Gem. sessies voor aankoop</p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{data.sessionStats.avg_sessions_before_purchase}x</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">max {data.sessionStats.max_sessions} sessies</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Rage clicks</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: (data.sessionStats.total_rage_clicks ?? 0) > 0 ? '#ef4444' : '#22c55e' }}>
                    {data.sessionStats.total_rage_clicks ?? 0}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">frustratie signaal</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Dead clicks</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: (data.sessionStats.total_dead_clicks ?? 0) > 5 ? '#f59e0b' : '#22c55e' }}>
                    {data.sessionStats.total_dead_clicks ?? 0}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">UX probleem signaal</p>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Visitors vs orders per land</h2>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Op basis van tracker.js sessies gekoppeld aan orders</p>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-5 py-2 text-left">Land</th>
                    <th className="px-5 py-2 text-right">Visitors</th>
                    <th className="px-5 py-2 text-right">Orders</th>
                    <th className="px-5 py-2 text-right">Conv.</th>
                    <th className="px-5 py-2 text-right">Sessies</th>
                    <th className="px-5 py-2 text-right">Rage</th>
                    <th className="px-5 py-2 text-right">Dead</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.visitorGeo ?? []).map((r: any) => (
                    <tr key={r.country} className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20">
                      <td className="px-5 py-2.5 text-gray-700 dark:text-gray-300 font-medium">{r.country}</td>
                      <td className="px-5 py-2.5 text-right text-gray-700 dark:text-gray-300 tabular-nums">{r.visitors}</td>
                      <td className="px-5 py-2.5 text-right text-indigo-600 dark:text-indigo-400 tabular-nums">{r.orders}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-green-600 dark:text-green-400">{r.visitors > 0 ? Math.round((r.orders / r.visitors) * 100) : 0}%</td>
                      <td className="px-5 py-2.5 text-right text-gray-500 dark:text-gray-400 tabular-nums">{r.avg_sessions_before_purchase}x</td>
                      <td className="px-5 py-2.5 text-right tabular-nums" style={{ color: r.rage_clicks > 0 ? '#ef4444' : '#9ca3af' }}>{r.rage_clicks || '—'}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums" style={{ color: r.dead_clicks > 0 ? '#f59e0b' : '#9ca3af' }}>{r.dead_clicks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {(data?.returnVisits ?? []).length > 0 && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sessies voor aankoop</h2>
                </div>
                <div className="p-6 space-y-3">
                  {(data?.returnVisits ?? []).map((r: any) => {
                    const maxV = Math.max(...(data?.returnVisits ?? []).map((x: any) => x.visitors), 1);
                    return (
                      <div key={r.bucket} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">{r.bucket}</span>
                        <div className="flex-1 h-5 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden relative">
                          <div className="h-full bg-indigo-500/60 dark:bg-indigo-600/60 rounded" style={{ width: `${(r.visitors / maxV) * 100}%` }} />
                          <span className="absolute inset-0 flex items-center px-2 text-xs text-gray-900 dark:text-white font-semibold">{r.visitors} bezoekers</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

    </div>
  );
}

