'use client';

import { useEffect, useState, useCallback } from 'react';
import Nav from '../components/Nav';

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function pct(a: number, b: number) {
  if (!b) return '—';
  return `${Math.round((a / b) * 100)}%`;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

function KpiCard({ label, value, sub, color = '#6366f1' }: KpiCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-36 flex-shrink-0">{label}</span>
      <div className="flex-1 h-6 bg-gray-800 rounded-lg overflow-hidden relative">
        <div className="h-full rounded-lg transition-all" style={{ width: `${pct}%`, background: color }} />
        <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-white">
          {value.toLocaleString('nl-NL')}
        </span>
      </div>
      <span className="text-xs text-gray-500 w-12 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

export default function KlaviyoPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [tab, setTab] = useState<'email' | 'site' | 'forms' | 'campaigns' | 'flows'>('email');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/klaviyo?period=${period}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const t = data?.totals ?? {};

  // Email KPIs
  const received   = t.received_email?.total ?? 0;
  const opened     = t.opened_email?.total ?? 0;
  const clicked    = t.clicked_email?.total ?? 0;
  const ordered    = t.ordered_product?.total ?? 0;
  const revenue    = t.ordered_product?.revenue ?? 0;
  const subscribed = t.subscribed_email?.total ?? 0;
  const unsub      = t.unsubscribed_email?.total ?? 0;
  const bounced    = t.bounced_email?.total ?? 0;

  // Site KPIs
  const siteFunnelMap: Record<string, number> = {};
  (data?.siteFunnel ?? []).forEach((r: any) => { siteFunnelMap[r.metric_name] = r.total; });
  const viewedProduct  = siteFunnelMap['viewed_product'] ?? 0;
  const addedToCart    = siteFunnelMap['added_to_cart'] ?? 0;
  const checkoutStart  = siteFunnelMap['checkout_started'] ?? 0;
  const placedOrder    = siteFunnelMap['placed_order'] ?? 0;

  // Forms
  const formMap: Record<string, number> = {};
  (data?.formData ?? []).forEach((r: any) => { formMap[r.metric_name] = r.total; });
  const viewedForm    = formMap['viewed_form'] ?? 0;
  const submittedForm = formMap['submitted_form'] ?? 0;
  const closedForm    = formMap['closed_form'] ?? 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Mvolo Attribution Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">Klaviyo customer journey</p>
            </div>
            <Nav />
          </div>
          <div className="flex items-center gap-2">
            {['7', '30', '90', 'all'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {p === 'all' ? 'Alles' : `${p}d`}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">

        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {([
            ['email', '📧 Email'],
            ['site', '🛒 Site Journey'],
            ['forms', '📋 Forms'],
            ['campaigns', '📨 Campaigns'],
            ['flows', '🔄 Flows'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-600 animate-pulse">Laden…</div>
        ) : (

          <>
            {/* EMAIL TAB */}
            {tab === 'email' && (
              <div className="space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  <KpiCard label="Verzonden" value={received.toLocaleString('nl-NL')} sub="emails" color="#6366f1" />
                  <KpiCard label="Open rate" value={pct(opened, received)} sub={`${opened.toLocaleString()} geopend`} color="#22c55e" />
                  <KpiCard label="Click rate" value={pct(clicked, received)} sub={`${clicked.toLocaleString()} geklikt`} color="#3b82f6" />
                  <KpiCard label="Email omzet" value={formatEuro(revenue)} sub={`${ordered} orders`} color="#f59e0b" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <KpiCard label="Nieuwe abonnees" value={subscribed} color="#22c55e" />
                  <KpiCard label="Afmeldingen" value={unsub} sub={`${pct(unsub, subscribed)} van nieuw`} color="#ef4444" />
                  <KpiCard label="Bounces" value={bounced} sub={`${pct(bounced, received)} bounce rate`} color="#f97316" />
                </div>

                {/* Email funnel */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-300">Email funnel</h2>
                    <p className="text-xs text-gray-600 mt-0.5">Van verzonden naar conversie</p>
                  </div>
                  <div className="p-6 space-y-3">
                    {[
                      { label: 'Received Email', value: received, color: '#6366f1' },
                      { label: 'Opened Email', value: opened, color: '#22c55e' },
                      { label: 'Clicked Email', value: clicked, color: '#3b82f6' },
                      { label: 'Ordered Product', value: ordered, color: '#f59e0b' },
                    ].map(item => (
                      <FunnelBar key={item.label} label={item.label} value={item.value} max={received} color={item.color} />
                    ))}
                  </div>
                  <div className="px-6 pb-4 grid grid-cols-3 gap-4 text-xs text-gray-500">
                    <div>Open rate: <span className="text-white">{pct(opened, received)}</span></div>
                    <div>Click-to-open: <span className="text-white">{pct(clicked, opened)}</span></div>
                    <div>Click-to-order: <span className="text-white">{pct(ordered, clicked)}</span></div>
                  </div>
                </div>

                {/* Dagelijkse trend */}
                {data?.emailTrend?.length > 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-800">
                      <h2 className="text-sm font-semibold text-gray-300">Dagelijkse email activiteit (30d)</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-800">
                            <th className="px-4 py-2 text-left text-gray-500">Datum</th>
                            <th className="px-4 py-2 text-right text-gray-500">Verzonden</th>
                            <th className="px-4 py-2 text-right text-gray-500">Geopend</th>
                            <th className="px-4 py-2 text-right text-gray-500">Geklikt</th>
                            <th className="px-4 py-2 text-right text-gray-500">Orders</th>
                            <th className="px-4 py-2 text-right text-gray-500">Omzet</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.emailTrend.slice(-14).reverse().map((row: any) => (
                            <tr key={row.date} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                              <td className="px-4 py-2 text-gray-400">{new Date(row.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</td>
                              <td className="px-4 py-2 text-right text-gray-300 tabular-nums">{row.received || '—'}</td>
                              <td className="px-4 py-2 text-right tabular-nums" style={{ color: row.opened > 0 ? '#22c55e' : '#374151' }}>{row.opened || '—'}</td>
                              <td className="px-4 py-2 text-right tabular-nums" style={{ color: row.clicked > 0 ? '#3b82f6' : '#374151' }}>{row.clicked || '—'}</td>
                              <td className="px-4 py-2 text-right tabular-nums" style={{ color: row.ordered > 0 ? '#f59e0b' : '#374151' }}>{row.ordered || '—'}</td>
                              <td className="px-4 py-2 text-right tabular-nums text-indigo-400">{row.revenue > 0 ? formatEuro(row.revenue) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SITE JOURNEY TAB */}
            {tab === 'site' && (
              <div className="space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  <KpiCard label="Viewed Product" value={viewedProduct.toLocaleString('nl-NL')} color="#6366f1" />
                  <KpiCard label="Added to Cart" value={addedToCart.toLocaleString('nl-NL')} sub={`${pct(addedToCart, viewedProduct)} van views`} color="#3b82f6" />
                  <KpiCard label="Checkout Started" value={checkoutStart.toLocaleString('nl-NL')} sub={`${pct(checkoutStart, addedToCart)} van cart`} color="#f59e0b" />
                  <KpiCard label="Placed Order" value={placedOrder.toLocaleString('nl-NL')} sub={`${pct(placedOrder, checkoutStart)} van checkout`} color="#22c55e" />
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-300">Site conversie funnel</h2>
                    <p className="text-xs text-gray-600 mt-0.5">Van productweergave naar aankoop</p>
                  </div>
                  <div className="p-6 space-y-3">
                    {[
                      { label: 'Viewed Product', value: viewedProduct, color: '#6366f1' },
                      { label: 'Added to Cart', value: addedToCart, color: '#3b82f6' },
                      { label: 'Checkout Started', value: checkoutStart, color: '#f59e0b' },
                      { label: 'Placed Order', value: placedOrder, color: '#22c55e' },
                    ].map(item => (
                      <FunnelBar key={item.label} label={item.label} value={item.value} max={viewedProduct} color={item.color} />
                    ))}
                  </div>
                  <div className="px-6 pb-4 grid grid-cols-3 gap-4 text-xs text-gray-500">
                    <div>View → Cart: <span className="text-white">{pct(addedToCart, viewedProduct)}</span></div>
                    <div>Cart → Checkout: <span className="text-white">{pct(checkoutStart, addedToCart)}</span></div>
                    <div>Checkout → Order: <span className="text-white">{pct(placedOrder, checkoutStart)}</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* FORMS TAB */}
            {tab === 'forms' && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <KpiCard label="Form views" value={viewedForm.toLocaleString('nl-NL')} color="#6366f1" />
                  <KpiCard label="Ingediend" value={submittedForm.toLocaleString('nl-NL')} sub={`${pct(submittedForm, viewedForm)} conversie`} color="#22c55e" />
                  <KpiCard label="Gesloten" value={closedForm.toLocaleString('nl-NL')} sub={`${pct(closedForm, viewedForm)} verlaten`} color="#ef4444" />
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-300">Form funnel</h2>
                  </div>
                  <div className="p-6 space-y-3">
                    {[
                      { label: 'Viewed Form', value: viewedForm, color: '#6366f1' },
                      { label: 'Submitted Form', value: submittedForm, color: '#22c55e' },
                      { label: 'Closed Form', value: closedForm, color: '#ef4444' },
                    ].map(item => (
                      <FunnelBar key={item.label} label={item.label} value={item.value} max={viewedForm} color={item.color} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CAMPAIGNS TAB */}
            {tab === 'campaigns' && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-300">Recente campaigns ({data?.campaigns?.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider border-b border-gray-800">
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Naam</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Verzonden</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Onderwerp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.campaigns ?? []).map((c: any) => (
                        <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                          <td className="px-4 py-3 text-gray-300 max-w-xs truncate">{c.name}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'Sent' ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                            {c.sent_at ? new Date(c.sent_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{c.subject ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* FLOWS TAB */}
            {tab === 'flows' && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-300">Flows ({data?.flows?.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider border-b border-gray-800">
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Naam</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Trigger</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Aangemaakt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.flows ?? []).map((f: any) => (
                        <tr key={f.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                          <td className="px-4 py-3 text-gray-300 max-w-xs truncate">{f.name}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${f.status === 'live' ? 'bg-green-900/40 text-green-400' : f.status === 'draft' ? 'bg-gray-800 text-gray-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
                              {f.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{f.trigger_type ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {f.created ? new Date(f.created).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
