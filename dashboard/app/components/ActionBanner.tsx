'use client';

import { useEffect, useState } from 'react';

function formatEuro(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function ChangeChip({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${up ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
      {up ? '↑' : '↓'}{Math.abs(pct)}%
    </span>
  );
}

export default function ActionBanner() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch('/api/actions')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  const { wow, today, critical_products, channel_wow, email_advice } = data;
  const criticalCount = critical_products?.filter((p: any) => p.urgency === 'KRITIEK').length ?? 0;
  const urgentCount   = critical_products?.filter((p: any) => p.urgency !== 'KRITIEK').length ?? 0;
  const anomalies     = (channel_wow ?? []).filter((c: any) => c.change_pct !== null && Math.abs(c.change_pct) >= 30 && c.last_week >= 3);

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/50 mb-2">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/60">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-white uppercase tracking-wider">Actie vereist</span>
          {criticalCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/50 text-red-400 font-semibold">
              {criticalCount} kritiek
            </span>
          )}
          {urgentCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900/50 text-orange-400 font-semibold">
              {urgentCount} urgent
            </span>
          )}
          {anomalies.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-400 font-semibold">
              {anomalies.length} kanaal anomalie
            </span>
          )}
        </div>
        <button onClick={() => setCollapsed(c => !c)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          {collapsed ? 'Uitklappen ↓' : 'Inklappen ↑'}
        </button>
      </div>

      {!collapsed && (
        <div className="grid grid-cols-4 divide-x divide-gray-800/60">

          {/* Vandaag + WoW */}
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Vandaag</p>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-white">{formatEuro(today?.revenue ?? 0)}</span>
                <ChangeChip pct={today?.yesterday_revenue > 0 ? Math.round(((today.revenue - today.yesterday_revenue) / today.yesterday_revenue) * 100) : null} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{today?.orders ?? 0} orders · gisteren {formatEuro(today?.yesterday_revenue ?? 0)}</p>
            </div>
            <div className="border-t border-gray-800/60 pt-2">
              <p className="text-xs text-gray-500">Deze week</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-semibold text-white">{formatEuro(wow?.this_week_rev ?? 0)}</span>
                <ChangeChip pct={wow?.rev_change_pct ?? null} />
              </div>
              <p className="text-xs text-gray-600">{wow?.this_week_orders} orders · vorige week {formatEuro(wow?.last_week_rev ?? 0)}</p>
            </div>
          </div>

          {/* Kritieke voorraad */}
          <div className="px-5 py-4 space-y-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
              Voorraad alerts
              {critical_products?.length > 0 && (
                <a href="/inventory" className="ml-2 text-indigo-500 hover:text-indigo-400 normal-case">→ Bekijk alle</a>
              )}
            </p>
            {critical_products?.length === 0 ? (
              <p className="text-xs text-green-400">✓ Alle voorraden OK</p>
            ) : (
              critical_products.slice(0, 4).map((p: any) => (
                <div key={p.sku} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-300 truncate">{p.name}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-xs font-bold tabular-nums ${p.stock < 0 ? 'text-red-400' : p.stock === 0 ? 'text-orange-400' : 'text-yellow-400'}`}>
                      {p.stock}
                    </span>
                    <span className={`text-xs px-1 py-0.5 rounded ${p.urgency === 'KRITIEK' ? 'bg-red-900/40 text-red-400' : 'bg-orange-900/40 text-orange-400'}`}>
                      {p.urgency === 'KRITIEK' ? '!' : p.days_left ? `${p.days_left}d` : '?'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Kanaal WoW */}
          <div className="px-5 py-4 space-y-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Kanaal week-over-week</p>
            {(channel_wow ?? []).filter((c: any) => c.last_week > 0 || c.this_week > 0).slice(0, 5).map((c: any) => (
              <div key={c.channel} className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-300 truncate capitalize">{c.channel?.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-500 tabular-nums">{c.this_week} orders</span>
                  <ChangeChip pct={c.change_pct} />
                </div>
              </div>
            ))}
          </div>

          {/* Email advies */}
          <div className="px-5 py-4 space-y-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
              Email advies
              <a href="/email-intelligence" className="ml-2 text-indigo-500 hover:text-indigo-400 normal-case">→ Details</a>
            </p>
            {email_advice ? (
              <div className="space-y-2">
                <div className="bg-indigo-950/40 border border-indigo-800/30 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-400">Beste moment</p>
                  <p className="text-sm font-semibold text-indigo-300 mt-0.5">
                    {email_advice.best_day} · {email_advice.best_times?.[1] ?? '16:00–18:00'}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">€{email_advice.rev_per_email} per email</p>
                </div>
                <p className="text-xs text-gray-500">{email_advice.best_campaign_type}</p>
                <a href="/inventory" className="text-xs text-yellow-500 hover:text-yellow-400 block">
                  ⚠ Check voorraad voor campagne planning
                </a>
              </div>
            ) : (
              <p className="text-xs text-gray-600">Nog geen timing rapport beschikbaar</p>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
