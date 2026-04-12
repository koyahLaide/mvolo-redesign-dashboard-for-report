'use client'; // build: 1775896413.6295092

import { useEffect, useState, useCallback, useRef } from 'react';
import Nav from './components/Nav';
import ActionBanner from './components/ActionBanner';
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
  ResponsiveContainer,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────────────

type Period   = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';
type Platform = 'all' | 'shopify' | 'bol';

interface ChannelStat {
  channel: string;
  orders: number;
  revenue: number;
  new_customers: number;
  returning_customers: number;
}

interface DayStat {
  date: string;
  orders: number;
  revenue: number;
}

interface WeekdayStat {
  weekday: string; // '0'=Sun … '6'=Sat
  orders: number;
  revenue: number;
}

interface HourStat {
  hour: string; // '00'–'23'
  orders: number;
}

interface SpendChannelStat {
  channel: string;
  spend: number;
  roas: number;
  poas: number;
  cac: number;
}

interface CampaignStat {
  channel: string;
  campaign_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
}

interface DailySpendStat {
  date: string;
  spend: number;
  revenue: number;
  profit: number;
}

interface OrderCampaign {
  utm_campaign: string;
  channel: string;
  orders: number;
  revenue: number;
  avg_order_value: number;
}

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  bestChannel: string;
  newCustomers: number;
  returningCustomers: number;
  channels: ChannelStat[];
  daily: DayStat[];
  topDays: DayStat[];
  byWeekday: WeekdayStat[];
  byHour: HourStat[];
  totalSpend: number;
  overallRoas: number;
  overallPoas: number;
  spendByChannel: SpendChannelStat[];
  campaigns: CampaignStat[];
  dailySpend: DailySpendStat[];
  orderCampaigns: OrderCampaign[];
  journeyByChannel: { channel: string; avg_sessions: number; avg_days: number; total: number }[];
  journeyHistogram: { bucket: string; count: number }[];
  totalTracked: number;
  // journey reconstruction
  metaWindows: { total_1d: number; total_7d: number; total_28d: number; rev_1d: number; rev_7d: number; rev_28d: number };
  repeatPurchases: { first_channel: string; repeat_purchases: number; avg_days_between: number }[];
  pmTouchSummary: { total: number; single_touch: number; multi_touch: number };
  pmTouchRows: { total: number; first_touch: string; last_touch: string }[];
  vsJourneyByChannel: { channel: string; avg_sessions: number; avg_days: number; total: number }[];
  directSubchannels: { subchannel: string; orders: number; revenue: number }[];
  // ga4
  ga4ByChannel: { channel: string; sessions: number; users: number; new_users: number; bounce_rate: number; avg_session_duration: number }[];
  ga4Daily: { date: string; sessions: number; users: number }[];
  ga4DailyByChannel: { date: string; channel: string; sessions: number }[];
  ga4Journeys: { first_channel: string; session_channel: string; sessions: number; users: number }[];
}

interface OrderDetail {
  id: string;
  order_number: string;
  created_at: string;
  total_price: number;
  first_touch: string | null;
  last_touch: string | null;
  is_new_customer: number;
  utm_campaign: string | null;
  utm_content: string | null;
}

interface Insight {
  text: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  direct:            '#6366f1',
  organic_search:    '#22c55e',
  meta_ads:          '#ec4899',
  google_search:     '#3b82f6',
  google_shopping:   '#06b6d4',
  awin_affiliate:    '#f59e0b',
  email:             '#a78bfa',
  organic_social:    '#f97316',
  ai_referral:       '#14b8a6',
  bol_marketplace:   '#ff6600',
  other:             '#6b7280',
};
const FALLBACK_COLORS = ['#6366f1','#22c55e','#ec4899','#3b82f6','#06b6d4','#f59e0b','#a78bfa','#f97316','#6b7280'];

// 0=Zo, 1=Ma … 6=Za — in display order Ma–Zo we remap
const WEEKDAY_NAMES: Record<string, string> = {
  '0': 'Zo', '1': 'Ma', '2': 'Di', '3': 'Wo', '4': 'Do', '5': 'Vr', '6': 'Za',
};
const WEEKDAY_ORDER = ['1','2','3','4','5','6','0']; // Ma … Zo

// Dutch day abbreviation from Date weekday index (0=Sun)
const DAY_NL = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

function channelColor(channel: string, index: number) {
  return CHANNEL_COLORS[channel] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function formatEuro(value: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading?: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</span>
      {loading
        ? <span className="text-2xl font-bold text-gray-600 animate-pulse">Laden…</span>
        : <span className="text-2xl font-bold text-white">{value}</span>
      }
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className="text-white font-semibold">{formatEuro(payload[0].value)}</p>
      {payload[1] && <p className="text-gray-400">{payload[1].value} orders</p>}
    </div>
  );
}

// ── Order Detail Modal ────────────────────────────────────────────────────────

function OrderModal({ channel, period, onClose }: { channel: string; period: Period; onClose: () => void }) {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    fetch(`/api/orders?channel=${encodeURIComponent(channel)}&period=${period}`)
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setOrders(data.orders ?? []);
      })
      .catch((e: Error) => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, [channel, period]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-5xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">{formatLabel(channel)}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Orders van dit kanaal — klik buiten of druk Esc om te sluiten</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Sluiten"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-auto flex-1 min-h-0">
          {loading && (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm animate-pulse">
              Laden…
            </div>
          )}
          {!loading && fetchError && (
            <div className="flex items-center justify-center h-48 text-red-400 text-sm">
              Fout: {fetchError}
            </div>
          )}
          {!loading && !fetchError && orders.length === 0 && (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              Geen orders gevonden voor dit kanaal.
            </div>
          )}
          {!loading && !fetchError && orders.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900 z-10">
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  <th className="px-4 py-3 text-left font-medium">Datum</th>
                  <th className="px-4 py-3 text-left font-medium">Dag</th>
                  <th className="px-4 py-3 text-left font-medium">Order #</th>
                  <th className="px-4 py-3 text-right font-medium">Bedrag</th>
                  <th className="px-4 py-3 text-left font-medium">First touch</th>
                  <th className="px-4 py-3 text-left font-medium">Last touch</th>
                  <th className="px-4 py-3 text-left font-medium">Klant</th>
                  <th className="px-4 py-3 text-left font-medium">Campagne</th>
                  <th className="px-4 py-3 text-left font-medium">Content</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const d = new Date(o.created_at);
                  const dagNaam = DAY_NL[d.getDay()];
                  return (
                    <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap tabular-nums">
                        {d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                          {dagNaam}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-200 font-mono">#{o.order_number}</td>
                      <td className="px-4 py-3 text-right text-white font-medium tabular-nums">
                        {formatEuro(o.total_price)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {o.first_touch ? formatLabel(o.first_touch) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {o.last_touch ? formatLabel(o.last_touch) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {o.is_new_customer === 1
                          ? <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full">Nieuw</span>
                          : <span className="text-xs bg-indigo-900/50 text-indigo-400 px-2 py-0.5 rounded-full">Terugkerend</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">
                        {o.utm_campaign ?? <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">
                        {o.utm_content ?? <span className="text-gray-700">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {!loading && orders.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-800 flex-shrink-0 text-xs text-gray-600">
            {orders.length} orders getoond
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PERIOD_LABELS: { key: Period; label: string }[] = [
  { key: 'today',   label: 'Vandaag' },
  { key: 'week',    label: 'Deze week' },
  { key: 'month',   label: 'Deze maand' },
  { key: 'quarter', label: 'Dit kwartaal' },
  { key: 'year',    label: 'Dit jaar' },
  { key: 'all',     label: 'Alles' },
];

function MaandMargeGrafiek() { return null; }

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [period, setPeriod] = useState<Period>('all');
  const [platform, setPlatform] = useState<Platform>('all');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);

  // Funnel state
  interface FunnelStep { step: string; sessions: number; orders?: number; dropoff_pct: number | null; cr_pct?: number | null; rage_clicks: number; dead_clicks: number; }
  interface FunnelData { funnel: FunnelStep[]; topRagePages: { page: string; rage_clicks: number; dead_clicks: number; channel: string | null }[]; frustrationByChannel: { channel: string; rage_clicks: number; dead_clicks: number }[]; clarityTotals: { rage_clicks: number; dead_clicks: number }; hasData: boolean; aiInsight: string | null; }
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }

  const loadStats = useCallback((p: Period, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    fetch(`/api/stats?period=${p}&platform=${platform}`)
      .then((r) => {
        if (!r.ok) throw new Error(`API error ${r.status}`);
        return r.json();
      })
      .then((data) => { setStats(data); setLastUpdated(new Date()); })
      .catch((e: Error) => setError(e.message))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [platform]);

  useEffect(() => { loadStats(period); }, [period, platform, loadStats]);

  // Auto-refresh every 6 hours
  useEffect(() => {
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const timer = setInterval(() => loadStats(period, true), SIX_HOURS);
    return () => clearInterval(timer);
  }, [period, loadStats]);

  useEffect(() => {
    fetch('/api/insights')
      .then((r) => r.json())
      .then((d) => setInsights(d.insights ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/funnel?days=30')
      .then((r) => r.json())
      .then((d) => setFunnelData(d))
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading dashboard…</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-red-400 text-sm">{error ?? 'No data'}</div>
      </div>
    );
  }

  const totalOrders = stats.totalOrders;
  const returningPct = totalOrders > 0
    ? ((stats.returningCustomers / totalOrders) * 100).toFixed(1)
    : '0.0';

  // Customer segment data for stacked bar chart
  const customerSegmentData = stats.channels.map((ch) => {
    const total = (ch.new_customers + ch.returning_customers) || 1;
    return {
      channel: formatLabel(ch.channel),
      nieuw: Math.round((ch.new_customers / total) * 100),
      terugkerend: Math.round((ch.returning_customers / total) * 100),
      avgNew: ch.new_customers > 0 ? ch.revenue / ch.new_customers : 0,
      avgReturning: ch.returning_customers > 0 ? ch.revenue / ch.returning_customers : 0,
    };
  });

  // Weekday chart data — sorted Ma…Zo
  const weekdayMap = Object.fromEntries(stats.byWeekday.map((r) => [r.weekday, r]));
  const weekdayData = WEEKDAY_ORDER.map((wd) => ({
    dag: WEEKDAY_NAMES[wd],
    orders: weekdayMap[wd]?.orders ?? 0,
    revenue: weekdayMap[wd]?.revenue ?? 0,
  }));
  const maxWdRevenue = Math.max(...weekdayData.map((d) => d.revenue), 0);

  // Hour heatmap data — fill gaps
  const hourMap = Object.fromEntries(stats.byHour.map((r) => [r.hour, r.orders]));
  const maxHourOrders = Math.max(...Object.values(hourMap), 0) || 1;
  const hourData = Array.from({ length: 24 }, (_, i) => {
    const h = String(i).padStart(2, '0');
    return { hour: h, orders: hourMap[h] ?? 0 };
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white">

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
            {/* Live update indicator */}
            {lastUpdated && (() => {
              const minutesAgo = Math.round((Date.now() - lastUpdated.getTime()) / 60000);
              const isFresh = minutesAgo < 360;
              return (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isFresh ? 'bg-emerald-500 animate-pulse' : 'bg-orange-500'}`} />
                  <span>
                    Laatste update:{' '}
                    {lastUpdated.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })()}
            <button
              onClick={() => loadStats(period, true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all disabled:opacity-50"
            >
              <span className={refreshing ? 'animate-spin inline-block' : ''}>↻</span>
              {refreshing ? 'Laden…' : 'Nu verversen'}
            </button>
            <button
              onClick={handleShare}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                copied
                  ? 'border-emerald-700 text-emerald-400 bg-emerald-900/20'
                  : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
              }`}
            >
              {copied ? '✓ Gekopieerd!' : '⬡ Deel'}
            </button>
          </div>
        </div>
      </header>

      <ActionBanner />
      <main className="max-w-7xl mx-auto px-8 py-8 space-y-8">

        {/* Filters row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Period filter */}
          <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
            {PERIOD_LABELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  period === key ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Platform filter */}
          <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
            {([['all', 'Alle platforms'], ['shopify', 'Shopify'], ['bol', 'Bol.com']] as [Platform, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPlatform(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  platform === key ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {key === 'bol' && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards — row 1: orders / revenue */}
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
          <KpiCard label="Totaal orders" value={totalOrders.toLocaleString('nl-NL')} loading={refreshing} />
          <KpiCard label="Totale omzet" value={formatEuro(stats.totalRevenue)} loading={refreshing} />
          <KpiCard
            label="Beste kanaal"
            value={formatLabel(stats.bestChannel)}
            sub={`${stats.channels[0]?.orders} orders`}
            loading={refreshing}
          />
          <KpiCard label="Gem. orderwaarde" value={formatEuro(stats.avgOrderValue)} loading={refreshing} />
          <KpiCard
            label="Nieuwe klanten"
            value={stats.newCustomers.toLocaleString('nl-NL')}
            sub="eerste bestelling"
            loading={refreshing}
          />
          <KpiCard
            label="% Terugkerend"
            value={`${returningPct}%`}
            sub={`${stats.returningCustomers} terugkerende orders`}
            loading={refreshing}
          />
          {(() => {
            const totalGA4Sess = (stats.ga4ByChannel ?? []).reduce((s, r) => s + r.sessions, 0);
            const cr = totalGA4Sess > 0
              ? ((totalOrders / totalGA4Sess) * 100).toFixed(1)
              : null;
            return (
              <KpiCard
                label="Gem. CR"
                value={cr !== null ? `${cr}%` : 'n/b'}
                sub={cr !== null ? `${totalOrders} orders / ${totalGA4Sess.toLocaleString('nl-NL')} sessies` : 'geen GA4 data'}
                loading={refreshing}
              />
            );
          })()}
        </div>

        {/* KPI Cards — row 2: ad spend / ROAS / POAS / CAC */}
        {(stats.totalSpend > 0 || stats.overallRoas > 0) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Totale advertentiekosten"
              value={formatEuro(stats.totalSpend)}
              sub="Meta + Google Ads"
            />
            <KpiCard
              label="ROAS"
              value={`${stats.overallRoas}×`}
              sub="omzet / adspend"
            />
            <KpiCard
              label="POAS"
              value={`${stats.overallPoas}×`}
              sub="winst / adspend"
            />
            <KpiCard
              label="CAC (gem.)"
              value={stats.spendByChannel.length > 0
                ? formatEuro(
                    stats.spendByChannel.reduce((s, c) => s + (c.cac > 0 ? c.cac : 0), 0) /
                    (stats.spendByChannel.filter(c => c.cac > 0).length || 1)
                  )
                : '—'
              }
              sub="kosten per nieuwe klant"
            />
          </div>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Pie */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Orders per kanaal</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={stats.channels}
                  dataKey="orders"
                  nameKey="channel"
                  cx="50%" cy="50%"
                  outerRadius={100} innerRadius={55}
                  paddingAngle={2}
                >
                  {stats.channels.map((entry, i) => (
                    <Cell key={entry.channel} fill={channelColor(entry.channel, i)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    `${Number(value)} orders (${((Number(value) / totalOrders) * 100).toFixed(1)}%)`,
                    formatLabel(String(name ?? "")),
                  ]}
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#f9fafb' }}
                />
                <Legend formatter={(value) => (
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>{formatLabel(value)}</span>
                )} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Line */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Omzet per dag — laatste 30 dagen</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={stats.daily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickFormatter={(d: string) => d.slice(5)} tickLine={false} axisLine={false} />
                <YAxis yAxisId="rev" tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} width={48} />
                <YAxis yAxisId="ord" orientation="right" tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false} axisLine={false} width={32} />
                <Tooltip content={<RevenueTooltip />} />
                <Line yAxisId="rev" type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line yAxisId="ord" type="monotone" dataKey="orders" stroke="#374151" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>


        {/* Spend / Revenue / Profit line chart */}
        {stats.dailySpend.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Adspend vs Omzet vs Winst — laatste 30 dagen</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.dailySpend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickFormatter={(d: string) => d.slice(5)} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={(value, name) => [
                    formatEuro(Number(value)),
                    name === 'spend' ? 'Adspend' : name === 'revenue' ? 'Omzet' : 'Winst',
                  ]}
                  itemStyle={{ color: '#f9fafb' }} labelStyle={{ color: '#9ca3af' }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="revenue" />
                <Line type="monotone" dataKey="profit"  stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="profit" />
                <Line type="monotone" dataKey="spend"   stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="spend" />
                <Legend formatter={(value) => (
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>
                    {value === 'revenue' ? 'Omzet' : value === 'profit' ? 'Winst' : 'Adspend'}
                  </span>
                )} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Campaign breakdown table */}
        {stats.campaigns.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-300">Campagne breakdown — laatste 30 dagen</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  <th className="px-6 py-3 text-left font-medium">Campagne</th>
                  <th className="px-6 py-3 text-left font-medium">Kanaal</th>
                  <th className="px-6 py-3 text-right font-medium">Spend</th>
                  <th className="px-6 py-3 text-right font-medium">Imp.</th>
                  <th className="px-6 py-3 text-right font-medium">Clicks</th>
                  <th className="px-6 py-3 text-right font-medium">CTR</th>
                  <th className="px-6 py-3 text-right font-medium">Aank.</th>
                  <th className="px-6 py-3 text-right font-medium">CPC</th>
                </tr>
              </thead>
              <tbody>
                {stats.campaigns.map((c, i) => {
                  const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0.00';
                  const cpc = c.clicks > 0 ? c.spend / c.clicks : 0;
                  return (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors">
                      <td className="px-6 py-3 text-gray-200 max-w-[220px] truncate">
                        {c.campaign_name ?? <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            background: `${CHANNEL_COLORS[c.channel] ?? '#6b7280'}20`,
                            color: CHANNEL_COLORS[c.channel] ?? '#9ca3af',
                          }}
                        >
                          {formatLabel(c.channel)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-gray-300 tabular-nums">{formatEuro(c.spend)}</td>
                      <td className="px-6 py-3 text-right text-gray-500 tabular-nums">{c.impressions.toLocaleString('nl-NL')}</td>
                      <td className="px-6 py-3 text-right text-gray-400 tabular-nums">{c.clicks.toLocaleString('nl-NL')}</td>
                      <td className="px-6 py-3 text-right text-gray-500 tabular-nums">{ctr}%</td>
                      <td className="px-6 py-3 text-right text-gray-300 tabular-nums">{c.purchases}</td>
                      <td className="px-6 py-3 text-right text-gray-400 tabular-nums">{c.clicks > 0 ? formatEuro(cpc) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Channel table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">
              Alle kanalen
            </h2>
            <span className="text-xs text-gray-600">klik een rij voor orderdetails →</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                <th className="px-6 py-3 text-left font-medium">Kanaal</th>
                <th className="px-6 py-3 text-right font-medium">Orders</th>
                <th className="px-6 py-3 text-right font-medium">Omzet</th>
                <th className="px-6 py-3 text-right font-medium">% totaal</th>
                <th className="px-6 py-3 text-right font-medium">Gem. waarde</th>
                <th className="px-6 py-3 text-right font-medium">GA4 Sessies</th>
                <th className="px-6 py-3 text-right font-medium">Conv.%</th>
                <th className="px-6 py-3 text-right font-medium">Nieuw</th>
                <th className="px-6 py-3 text-right font-medium">Terugkerend</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Map GA4 channel group names → our internal channel keys
                const GA4_MAP: Record<string, string> = {
                  'Direct':          'direct',
                  'Organic Search':  'organic_search',
                  'Paid Social':     'meta_ads',
                  'Paid Search':     'google_search',
                  'Email':           'email',
                  'Organic Social':  'organic_social',
                  'Affiliates':      'awin_affiliate',
                  'Referral':        'other',
                  'Unassigned':      'other',
                  'Cross-network':   'other',
                };
                const ga4Map: Record<string, number> = {};
                for (const row of (stats.ga4ByChannel ?? [])) {
                  const key = GA4_MAP[row.channel] ?? row.channel.toLowerCase().replace(/\s+/g, '_');
                  ga4Map[key] = (ga4Map[key] ?? 0) + row.sessions;
                }
                return stats.channels.map((ch, i) => {
                  const pctVal = ((ch.orders / totalOrders) * 100).toFixed(1);
                  const avg    = ch.orders > 0 ? ch.revenue / ch.orders : 0;
                  const sess   = ga4Map[ch.channel] ?? 0;
                  const conv   = sess > 0 ? ((ch.orders / sess) * 100).toFixed(1) : null;
                  return (
                    <tr
                      key={ch.channel}
                      className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors cursor-pointer group"
                      onClick={() => setSelectedChannel(ch.channel)}
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: channelColor(ch.channel, i) }} />
                          <span className="text-gray-200 group-hover:text-white transition-colors">
                            {formatLabel(ch.channel)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right text-gray-300 tabular-nums">{ch.orders}</td>
                      <td className="px-6 py-3.5 text-right text-gray-300 tabular-nums">{formatEuro(ch.revenue)}</td>
                      <td className="px-6 py-3.5 text-right tabular-nums">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                            <div className="h-1.5 rounded-full"
                              style={{ width: `${pctVal}%`, background: channelColor(ch.channel, i) }} />
                          </div>
                          <span className="text-gray-400 w-10 text-right">{pctVal}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right text-gray-400 tabular-nums">{formatEuro(avg)}</td>
                      <td className="px-6 py-3.5 text-right tabular-nums text-gray-400">
                        {sess > 0 ? sess.toLocaleString('nl-NL') : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-6 py-3.5 text-right tabular-nums">
                        {conv !== null
                          ? <span className={`text-xs font-medium ${parseFloat(conv) >= 2 ? 'text-emerald-400' : parseFloat(conv) >= 0.5 ? 'text-yellow-400' : 'text-gray-500'}`}>{conv}%</span>
                          : <span className="text-gray-700 text-xs">—</span>
                        }
                      </td>
                      <td className="px-6 py-3.5 text-right tabular-nums">
                        <span className="text-xs text-emerald-400">{ch.new_customers}</span>
                      </td>
                      <td className="px-6 py-3.5 text-right tabular-nums">
                        <span className="text-xs text-indigo-400">{ch.returning_customers}</span>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>

        {/* Direct breakdown */}
        {stats.directSubchannels?.length > 0 && (() => {
          const DIRECT_COLORS: Record<string, string> = {
            direct_typed:   '#6366f1',
            dark_social:    '#ec4899',
            email_no_utm:   '#a78bfa',
            meta_no_utm:    '#f97316',
            ios_private:    '#06b6d4',
            direct_unknown: '#6b7280',
          };
          const DIRECT_LABELS: Record<string, string> = {
            direct_typed:   'Direct getypt / bladwijzer',
            dark_social:    'Dark social (DM/WhatsApp)',
            email_no_utm:   'E-mail zonder UTM',
            meta_no_utm:    'Meta Ads (geen UTM)',
            ios_private:    'iOS privé',
            direct_unknown: 'Onbekend direct',
          };
          const totalDirect = stats.directSubchannels.reduce((s, r) => s + r.orders, 0) || 1;
          return (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-300">Direct breakdown</h2>
                <span className="text-xs text-gray-600">{totalDirect} directe orders</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                {/* Pie chart */}
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={stats.directSubchannels}
                      dataKey="orders"
                      nameKey="subchannel"
                      cx="50%" cy="50%"
                      outerRadius={85} innerRadius={45}
                      paddingAngle={2}
                    >
                      {stats.directSubchannels.map((entry, i) => (
                        <Cell key={entry.subchannel} fill={DIRECT_COLORS[entry.subchannel] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        `${Number(value)} orders (${((Number(value) / totalDirect) * 100).toFixed(1)}%)`,
                        DIRECT_LABELS[String(name)] ?? String(name),
                      ]}
                      contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                      labelStyle={{ color: '#9ca3af' }}
                      itemStyle={{ color: '#f9fafb' }}
                    />
                    <Legend formatter={(value) => (
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>{DIRECT_LABELS[value] ?? value}</span>
                    )} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Table */}
                <div className="space-y-2">
                  {stats.directSubchannels.map((row, i) => {
                    const pct = ((row.orders / totalDirect) * 100).toFixed(1);
                    const color = DIRECT_COLORS[row.subchannel] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
                    return (
                      <div key={row.subchannel} className="flex items-center gap-3 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-gray-300 flex-1">{DIRECT_LABELS[row.subchannel] ?? row.subchannel}</span>
                        <span className="text-gray-400 tabular-nums">{row.orders}</span>
                        <div className="w-16 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className="text-gray-500 text-xs w-10 text-right tabular-nums">{pct}%</span>
                        <span className="text-gray-600 text-xs w-20 text-right tabular-nums">{formatEuro(row.revenue)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Campaign breakdown — orders grouped by utm_campaign */}
        {stats.orderCampaigns?.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300">Campaign breakdown</h2>
              <span className="text-xs text-gray-600">op basis van ProfitMetrics campaign IDs</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  <th className="px-6 py-3 text-left font-medium">Campaign ID</th>
                  <th className="px-6 py-3 text-left font-medium">Kanaal</th>
                  <th className="px-6 py-3 text-right font-medium">Orders</th>
                  <th className="px-6 py-3 text-right font-medium">Omzet</th>
                  <th className="px-6 py-3 text-right font-medium">Gem. waarde</th>
                  <th className="px-6 py-3 text-right font-medium">% omzet</th>
                </tr>
              </thead>
              <tbody>
                {stats.orderCampaigns.map((c, i) => {
                  const pct = stats.totalRevenue > 0
                    ? ((c.revenue / stats.totalRevenue) * 100).toFixed(1)
                    : '0.0';
                  const color = CHANNEL_COLORS[c.channel] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
                  return (
                    <tr key={`${c.utm_campaign}-${c.channel}`} className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors">
                      <td className="px-6 py-3 font-mono text-xs text-gray-300 max-w-[200px] truncate">
                        {c.utm_campaign}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: `${color}20`, color }}
                        >
                          {formatLabel(c.channel)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-gray-300 tabular-nums">{c.orders}</td>
                      <td className="px-6 py-3 text-right text-gray-300 tabular-nums">{formatEuro(c.revenue)}</td>
                      <td className="px-6 py-3 text-right text-gray-400 tabular-nums">{formatEuro(c.avg_order_value)}</td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-14 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                          </div>
                          <span className="text-gray-500 w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Nieuw vs Terugkerend */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
          <h2 className="text-sm font-semibold text-gray-300">Nieuw vs Terugkerend per kanaal</h2>
          <div>
            <p className="text-xs text-gray-500 mb-3">% Nieuw vs % Terugkerend</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={customerSegmentData} margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="channel" tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false} axisLine={false} angle={-25} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} width={36} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={(value, name) => [`${value}%`, name === 'nieuw' ? 'Nieuw' : 'Terugkerend']}
                  itemStyle={{ color: '#f9fafb' }} labelStyle={{ color: '#9ca3af' }} />
                <Bar dataKey="nieuw" name="nieuw" stackId="a" fill="#10b981" />
                <Bar dataKey="terugkerend" name="terugkerend" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Legend formatter={(value) => (
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>
                    {value === 'nieuw' ? 'Nieuw' : 'Terugkerend'}
                  </span>
                )} wrapperStyle={{ paddingTop: 8 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-3">Gem. orderwaarde — nieuw vs terugkerend</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={customerSegmentData} margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="channel" tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false} axisLine={false} angle={-25} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => `€${Math.round(v)}`} width={48} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={(value, name) => [
                    formatEuro(Number(value)), name === 'avgNew' ? 'Gem. nieuw' : 'Gem. terugkerend',
                  ]} itemStyle={{ color: '#f9fafb' }} labelStyle={{ color: '#9ca3af' }} />
                <Bar dataKey="avgNew" name="avgNew" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgReturning" name="avgReturning" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Legend formatter={(value) => (
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>
                    {value === 'avgNew' ? 'Gem. nieuw' : 'Gem. terugkerend'}
                  </span>
                )} wrapperStyle={{ paddingTop: 8 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Beste Dagen Analyse */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
          <h2 className="text-sm font-semibold text-gray-300">Beste dagen analyse</h2>

          {/* Weekday bar chart */}
          <div>
            <p className="text-xs text-gray-500 mb-3">Omzet per dag van de week</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekdayData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="dag" tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`} width={44} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={(value, name) => [
                    name === 'revenue' ? formatEuro(Number(value)) : `${Number(value)} orders`,
                    name === 'revenue' ? 'Omzet' : 'Orders',
                  ]}
                  itemStyle={{ color: '#f9fafb' }} labelStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="revenue" name="revenue" radius={[4, 4, 0, 0]}
                  label={false}>
                  {weekdayData.map((entry) => (
                    <Cell
                      key={entry.dag}
                      fill={entry.revenue === maxWdRevenue && maxWdRevenue > 0 ? '#f59e0b' : '#6366f1'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-600 mt-2">Goud = beste dag</p>
          </div>

          {/* Orders per weekday */}
          <div>
            <p className="text-xs text-gray-500 mb-3">Aantal orders per dag van de week</p>
            <div className="grid grid-cols-7 gap-2">
              {weekdayData.map((d) => {
                const maxOrders = Math.max(...weekdayData.map((x) => x.orders), 1);
                const isBest = d.orders === Math.max(...weekdayData.map((x) => x.orders));
                return (
                  <div key={d.dag} className="flex flex-col items-center gap-1.5">
                    <div className="w-full bg-gray-800 rounded-lg overflow-hidden h-20 flex items-end">
                      <div
                        className="w-full rounded-t-lg transition-all"
                        style={{
                          height: `${(d.orders / maxOrders) * 100}%`,
                          background: isBest ? '#f59e0b' : '#4b5563',
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-400">{d.dag}</span>
                    <span className="text-xs text-gray-600 tabular-nums">{d.orders}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hour heatmap */}
          <div>
            <p className="text-xs text-gray-500 mb-3">Orders per uur van de dag (heatmap)</p>
            <div className="grid grid-cols-12 gap-1">
              {hourData.map((h) => {
                const intensity = maxHourOrders > 0 ? h.orders / maxHourOrders : 0;
                const opacity = 0.08 + intensity * 0.92;
                return (
                  <div
                    key={h.hour}
                    className="relative group flex flex-col items-center"
                    title={`${h.hour}:00 — ${h.orders} orders`}
                  >
                    <div
                      className="w-full h-10 rounded-md flex items-center justify-center text-xs font-medium cursor-default"
                      style={{
                        background: `rgba(99, 102, 241, ${opacity})`,
                        color: intensity > 0.5 ? '#e0e7ff' : '#6b7280',
                      }}
                    >
                      {h.orders > 0 ? h.orders : ''}
                    </div>
                    <span className="text-[10px] text-gray-600 mt-0.5">{h.hour}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-600 mt-2">Donkerder = meer orders — hover voor details</p>
          </div>
        </div>

        {/* Top 5 days */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300">Top 5 dagen op omzet</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                <th className="px-6 py-3 text-left font-medium">Datum</th>
                <th className="px-6 py-3 text-right font-medium">Orders</th>
                <th className="px-6 py-3 text-right font-medium">Omzet</th>
              </tr>
            </thead>
            <tbody>
              {stats.topDays.map((day, i) => (
                <tr key={day.date} className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-600 w-4">{i + 1}</span>
                      <span className="text-gray-200">
                        {new Date(day.date).toLocaleDateString('nl-NL', {
                          weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-right text-gray-300 tabular-nums">{day.orders}</td>
                  <td className="px-6 py-3.5 text-right font-semibold text-indigo-400 tabular-nums">
                    {formatEuro(day.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Customer Journey */}
        {stats.journeyByChannel?.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300">Customer Journey</h2>
              <span className="text-xs text-gray-600">{stats.totalTracked} tracked aankopen</span>
            </div>

            {/* Insights per channel */}
            <div className="space-y-2">
              {stats.journeyByChannel.map((j) => (
                <div
                  key={j.channel}
                  className="flex items-center justify-between bg-gray-800/60 rounded-lg px-4 py-3 border border-gray-700/40"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: CHANNEL_COLORS[j.channel] ?? '#6b7280' }}
                    />
                    <span className="text-sm text-gray-200">{formatLabel(j.channel)}</span>
                    <span className="text-xs text-gray-600">({j.total}×)</span>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-xs text-gray-500">gem. sessies</p>
                      <p className="text-sm font-semibold text-white tabular-nums">{j.avg_sessions}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">dagen tot aankoop</p>
                      <p className="text-sm font-semibold text-indigo-400 tabular-nums">{j.avg_days}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Session count histogram */}
            {stats.journeyHistogram?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-3">Sessies voor aankoop — verdeling</p>
                <div className="grid grid-cols-4 gap-3">
                  {(() => {
                    const total = stats.journeyHistogram.reduce((s, b) => s + b.count, 0) || 1;
                    const buckets = ['1 sessie', '2–3 sessies', '4–7 sessies', '8+ sessies'];
                    const map = Object.fromEntries(stats.journeyHistogram.map((b) => [b.bucket, b.count]));
                    return buckets.map((bucket) => {
                      const count = map[bucket] ?? 0;
                      const pct   = Math.round((count / total) * 100);
                      return (
                        <div key={bucket} className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/40 flex flex-col items-center gap-1">
                          <span className="text-lg font-bold text-white tabular-nums">{pct}%</span>
                          <span className="text-xs text-gray-400">{bucket}</span>
                          <span className="text-xs text-gray-600">{count} aankopen</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* GA4: Verkeer & Journey */}
        {(stats.ga4ByChannel?.length > 0 || stats.ga4Daily?.length > 0) && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300">Verkeer & Journey — Google Analytics 4</h2>
              <span className="text-xs text-gray-600">afgelopen 30 dagen</span>
            </div>

            {/* Sessies per dag lijndiagram */}
            {stats.ga4Daily?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-3">Sessies per dag</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={stats.ga4Daily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={36} />
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#9ca3af' }}
                      formatter={(v: unknown) => [(v as number).toLocaleString('nl-NL'), 'sessies']}
                    />
                    <Line type="monotone" dataKey="sessions" stroke="#6366f1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Kanaal breakdown tabel */}
            {stats.ga4ByChannel?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-3">Sessies per kanaal</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                        <th className="py-2 text-left font-medium">Kanaal (GA4)</th>
                        <th className="py-2 text-right font-medium">Sessies</th>
                        <th className="py-2 text-right font-medium">Gebruikers</th>
                        <th className="py-2 text-right font-medium">Nieuw %</th>
                        <th className="py-2 text-right font-medium">Bounce</th>
                        <th className="py-2 text-right font-medium">Gem. duur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.ga4ByChannel.map((row) => {
                        const newPct = row.users > 0 ? Math.round((row.new_users / row.users) * 100) : 0;
                        const mins   = Math.floor(row.avg_session_duration / 60);
                        const secs   = Math.round(row.avg_session_duration % 60);
                        const dur    = `${mins}:${String(secs).padStart(2, '0')}`;
                        return (
                          <tr key={row.channel} className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors">
                            <td className="py-2.5 text-gray-200">{row.channel}</td>
                            <td className="py-2.5 text-right text-gray-300 tabular-nums">{row.sessions.toLocaleString('nl-NL')}</td>
                            <td className="py-2.5 text-right text-gray-400 tabular-nums">{row.users.toLocaleString('nl-NL')}</td>
                            <td className="py-2.5 text-right text-gray-400 tabular-nums">{newPct}%</td>
                            <td className="py-2.5 text-right tabular-nums">
                              <span className={row.bounce_rate > 0.6 ? 'text-red-400' : row.bounce_rate > 0.4 ? 'text-yellow-400' : 'text-emerald-400'}>
                                {(row.bounce_rate * 100).toFixed(0)}%
                              </span>
                            </td>
                            <td className="py-2.5 text-right text-gray-400 tabular-nums">{dur}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* First-touch → session-channel journey matrix */}
            {stats.ga4Journeys?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-3">Journey: eerste kanaal → sessiekanaal (top paden)</p>
                <div className="space-y-1.5">
                  {stats.ga4Journeys.slice(0, 10).map((row, i) => {
                    const maxSess = stats.ga4Journeys[0]?.sessions || 1;
                    const pct = Math.round((row.sessions / maxSess) * 100);
                    const sameChannel = row.first_channel === row.session_channel;
                    return (
                      <div key={i} className="flex items-center gap-3 bg-gray-800/40 rounded-lg px-3 py-2 text-xs">
                        <span className="text-gray-300 w-32 truncate">{row.first_channel}</span>
                        <span className="text-gray-600">→</span>
                        <span className={`w-32 truncate ${sameChannel ? 'text-gray-500' : 'text-indigo-400'}`}>
                          {row.session_channel}
                        </span>
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-gray-400 tabular-nums w-16 text-right">
                          {row.sessions.toLocaleString('nl-NL')} sess.
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Card 1: Meta Attribution Windows */}
        {stats.metaWindows && (stats.metaWindows.total_1d > 0 || stats.metaWindows.total_7d > 0 || stats.metaWindows.total_28d > 0) && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-300">Meta Attributievensters (afgelopen 30d)</h2>
              <span className="text-xs text-gray-600">1d / 7d / 28d klik</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: '1d klik', purchases: stats.metaWindows.total_1d, revenue: stats.metaWindows.rev_1d, color: '#ec4899' },
                { label: '7d klik', purchases: stats.metaWindows.total_7d, revenue: stats.metaWindows.rev_7d, color: '#a78bfa' },
                { label: '28d klik', purchases: stats.metaWindows.total_28d, revenue: stats.metaWindows.rev_28d, color: '#6366f1' },
              ].map(({ label, purchases, revenue, color }) => {
                const totalPurchases = (stats.metaWindows.total_1d + stats.metaWindows.total_7d + stats.metaWindows.total_28d) || 1;
                const pct = Math.round((purchases / totalPurchases) * 100);
                return (
                  <div key={label} className="bg-gray-800/60 border border-gray-700/40 rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs font-medium text-gray-400">{label}</span>
                    </div>
                    <span className="text-2xl font-bold text-white tabular-nums">{pct}%</span>
                    <div className="text-xs text-gray-500">
                      <span className="text-gray-300">{purchases}</span> aankopen ·{' '}
                      <span className="text-gray-300">{formatEuro(revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-600 mt-3">
              Toont hoeveel % van Meta aankopen werd geattribueerd op dezelfde dag (1d), binnen een week (7d) of binnen 28 dagen na klikken.
            </p>
          </div>
        )}

        {/* Card 2: Repeat Purchase Analysis */}
        {stats.repeatPurchases?.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-300">Herhaalaankopen per kanaal</h2>
              <span className="text-xs text-gray-600">gem. dagen tussen aankopen</span>
            </div>
            <div className="space-y-2">
              {stats.repeatPurchases.map((r) => {
                const maxDays = Math.max(...stats.repeatPurchases.map((x) => x.avg_days_between), 1);
                const pct = Math.round((r.avg_days_between / maxDays) * 100);
                const color = CHANNEL_COLORS[r.first_channel] ?? '#6b7280';
                return (
                  <div key={r.first_channel} className="flex items-center gap-4 bg-gray-800/40 rounded-lg px-4 py-2.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-sm text-gray-300 w-36 truncate">{formatLabel(r.first_channel)}</span>
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="text-sm font-semibold text-white tabular-nums w-20 text-right">
                      {r.avg_days_between}d
                    </span>
                    <span className="text-xs text-gray-600 w-24 text-right">
                      {r.repeat_purchases}× herhaald
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Card 3: PM First vs Last Touch */}
        {stats.pmTouchSummary?.total > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-300">ProfitMetrics: First vs Last Touch</h2>
              <span className="text-xs text-gray-600">{stats.pmTouchSummary.total} orders geanalyseerd</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-gray-800/60 border border-gray-700/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Single-touch</p>
                <p className="text-2xl font-bold text-white tabular-nums">
                  {Math.round((stats.pmTouchSummary.single_touch / (stats.pmTouchSummary.total || 1)) * 100)}%
                </p>
                <p className="text-xs text-gray-600 mt-1">{stats.pmTouchSummary.single_touch} orders — zelfde first &amp; last touch</p>
              </div>
              <div className="bg-gray-800/60 border border-gray-700/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Multi-touch</p>
                <p className="text-2xl font-bold text-indigo-400 tabular-nums">
                  {Math.round((stats.pmTouchSummary.multi_touch / (stats.pmTouchSummary.total || 1)) * 100)}%
                </p>
                <p className="text-xs text-gray-600 mt-1">{stats.pmTouchSummary.multi_touch} orders — meerdere kanalen betrokken</p>
              </div>
            </div>
            {stats.pmTouchRows?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Top touch-paden</p>
                <div className="space-y-1.5">
                  {stats.pmTouchRows.slice(0, 6).map((row, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs px-3 py-2 bg-gray-800/40 rounded-lg">
                      <span className="text-gray-400 w-28 truncate">{formatLabel(row.first_touch)}</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-gray-400 w-28 truncate">{formatLabel(row.last_touch ?? row.first_touch)}</span>
                      <span className="ml-auto text-gray-500 tabular-nums">{row.total}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Funnel & Gedrag */}
        {funnelData && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300">Funnel & Gedrag</h2>
              <div className="flex items-center gap-3">
                {funnelData.clarityTotals.rage_clicks > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800/50">
                    🔴 {funnelData.clarityTotals.rage_clicks} rage clicks
                  </span>
                )}
                {funnelData.clarityTotals.dead_clicks > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                    ⚫ {funnelData.clarityTotals.dead_clicks} dead clicks
                  </span>
                )}
                <span className="text-xs text-gray-600">GA4 + Clarity + orders · 30 dagen</span>
              </div>
            </div>

            {/* Visual funnel */}
            {funnelData.funnel.length > 0 && (() => {
              const STEP_LABELS: Record<string, string> = {
                homepage: 'Homepage',
                product:  'Productpagina',
                cart:     'Winkelwagen',
                checkout: 'Afrekenen',
                besteld:  'Besteld',
              };
              const maxVal = Math.max(...funnelData.funnel.map((s) => s.sessions || s.orders || 0), 1);

              return (
                <div className="space-y-2">
                  {funnelData.funnel.map((step, i) => {
                    const val    = step.step === 'besteld' ? (step.orders ?? 0) : step.sessions;
                    const width  = Math.round((val / maxVal) * 100);
                    const isLast = step.step === 'besteld';
                    const gradients = [
                      'from-indigo-600 to-indigo-500',
                      'from-violet-600 to-violet-500',
                      'from-purple-600 to-purple-500',
                      'from-fuchsia-600 to-fuchsia-500',
                      'from-emerald-600 to-emerald-500',
                    ];
                    return (
                      <div key={step.step} className="flex items-center gap-3">
                        {/* Bar */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-400 w-28 flex-shrink-0">
                              {STEP_LABELS[step.step] ?? step.step}
                            </span>
                            <div className="flex-1 h-8 bg-gray-800 rounded-lg overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${gradients[i % gradients.length]} flex items-center px-3 transition-all`}
                                style={{ width: `${width}%` }}
                              >
                                <span className="text-xs font-semibold text-white whitespace-nowrap">
                                  {isLast
                                    ? `${val.toLocaleString('nl-NL')} orders${step.cr_pct != null ? ` · CR: ${step.cr_pct}%` : ''}`
                                    : val.toLocaleString('nl-NL')
                                  }
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Drop-off + Clarity badges */}
                        <div className="flex items-center gap-1.5 w-52 flex-shrink-0">
                          {step.dropoff_pct !== null && step.dropoff_pct > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${step.dropoff_pct >= 60 ? 'bg-red-900/50 text-red-400' : step.dropoff_pct >= 30 ? 'bg-orange-900/40 text-orange-400' : 'bg-gray-800 text-gray-500'}`}>
                              -{step.dropoff_pct}%
                            </span>
                          )}
                          {step.rage_clicks > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-800/40">
                              🔴 {step.rage_clicks}
                            </span>
                          )}
                          {step.dead_clicks > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-500 border border-gray-700/40">
                              ⚫ {step.dead_clicks}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* No GA4 funnel data yet */}
            {!funnelData.hasData && (
              <div className="text-xs text-gray-600 bg-gray-800/40 rounded-lg px-4 py-3 border border-gray-700/40">
                GA4 paginadata nog niet gesynchroniseerd. Voer <code className="text-gray-400">npm run sync</code> uit om funneldata op te halen.
                Orders uit de database worden altijd als laatste stap getoond.
              </div>
            )}

            {/* Top frustration pages */}
            {funnelData.topRagePages.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-3">Top frustratiepagina&apos;s</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-600 uppercase tracking-wider border-b border-gray-800">
                        <th className="py-2 text-left font-medium">Pagina</th>
                        <th className="py-2 text-right font-medium">Rage clicks</th>
                        <th className="py-2 text-right font-medium">Dead clicks</th>
                        <th className="py-2 text-left font-medium pl-4">Kanaal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funnelData.topRagePages.map((r, i) => (
                        <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                          <td className="py-2 text-gray-300 font-mono max-w-[200px] truncate">{r.page}</td>
                          <td className="py-2 text-right">
                            {r.rage_clicks > 0
                              ? <span className="text-red-400 font-medium">{r.rage_clicks}</span>
                              : <span className="text-gray-700">—</span>
                            }
                          </td>
                          <td className="py-2 text-right">
                            {r.dead_clicks > 0
                              ? <span className="text-gray-400">{r.dead_clicks}</span>
                              : <span className="text-gray-700">—</span>
                            }
                          </td>
                          <td className="py-2 pl-4 text-gray-500">{r.channel ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Frustration by channel */}
            {funnelData.frustrationByChannel.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-3">Frustratie per kanaal</p>
                <div className="space-y-2">
                  {funnelData.frustrationByChannel.map((r, i) => {
                    const total = (r.rage_clicks + r.dead_clicks) || 1;
                    const color = CHANNEL_COLORS[r.channel] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
                    return (
                      <div key={r.channel} className="flex items-center gap-3 text-xs">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-gray-300 w-32 truncate">{formatLabel(r.channel)}</span>
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, total)}%`, background: color }} />
                        </div>
                        <span className="text-red-400 w-16 text-right tabular-nums">{r.rage_clicks > 0 ? `🔴 ${r.rage_clicks}` : ''}</span>
                        <span className="text-gray-500 w-16 text-right tabular-nums">{r.dead_clicks > 0 ? `⚫ ${r.dead_clicks}` : ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI Conclusie */}
            {funnelData.aiInsight && (
              <div className="bg-gray-800/50 border border-indigo-900/40 rounded-xl px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Claude AI Analyse</span>
                  <span className="text-xs text-gray-600">funnel · 30 dagen · claude-haiku</span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{funnelData.aiInsight}</p>
              </div>
            )}
          </div>
        )}

        {/* AI Conclusies */}
        {insights.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Automatische conclusies</h2>
            <div className="space-y-3">
              {insights.map((ins, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-gray-800/60 rounded-lg px-4 py-3.5 border border-gray-700/50"
                >
                  <span className="text-indigo-400 mt-0.5 flex-shrink-0 text-sm">→</span>
                  <p className="text-sm text-gray-300 leading-relaxed">{ins.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Order detail modal */}
      {selectedChannel && (
        <OrderModal
          channel={selectedChannel}
          period={period}
          onClose={() => setSelectedChannel(null)}
        />
      )}
    </div>
  );
}
