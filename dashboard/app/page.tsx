'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ShoppingCart, DollarSign, TrendingUp, Users, UserCheck,
  Target, BarChart3, RefreshCw, Share2, Search,
} from 'lucide-react';
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
  weekday: string;
  orders: number;
  revenue: number;
}

interface HourStat {
  hour: string;
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
  metaWindows: { total_1d: number; total_7d: number; total_28d: number; rev_1d: number; rev_7d: number; rev_28d: number };
  repeatPurchases: { first_channel: string; repeat_purchases: number; avg_days_between: number }[];
  pmTouchSummary: { total: number; single_touch: number; multi_touch: number };
  pmTouchRows: { total: number; first_touch: string; last_touch: string }[];
  vsJourneyByChannel: { channel: string; avg_sessions: number; avg_days: number; total: number }[];
  directSubchannels: { subchannel: string; orders: number; revenue: number }[];
  ga4ByChannel: { channel: string; sessions: number; users: number; new_users: number; bounce_rate: number; avg_session_duration: number }[];
  ga4Daily: { date: string; sessions: number; users: number }[];
  ga4DailyByChannel: { date: string; channel: string; sessions: number }[];
  ga4Journeys: { first_channel: string; session_channel: string; sessions: number; users: number }[];
  recentOrders: { id: string; order_number: string; created_at: string; total_price: number; channel: string; marketplace: string }[];
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
  marketplace?: string;
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

const WEEKDAY_NAMES: Record<string, string> = {
  '0': 'Zo', '1': 'Ma', '2': 'Di', '3': 'Wo', '4': 'Do', '5': 'Vr', '6': 'Za',
};
const WEEKDAY_ORDER = ['1','2','3','4','5','6','0'];

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

function KpiCard({ label, value, sub, loading, icon: Icon, iconBg, iconColor }: { label: string; value: string; sub?: string; loading?: boolean; icon?: React.ElementType; iconBg?: string; iconColor?: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-2 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
        {Icon && (
          <div className={`p-1.5 rounded-lg ${iconBg ?? 'bg-gray-100 dark:bg-gray-800'}`}>
            <Icon className={`w-4 h-4 ${iconColor ?? 'text-gray-500 dark:text-gray-400'}`} />
          </div>
        )}
      </div>
      {loading
        ? <span className="text-2xl font-bold text-gray-300 dark:text-gray-600 animate-pulse">Laden…</span>
        : <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
      }
      {sub && <span className="text-xs text-gray-400 dark:text-gray-500">{sub}</span>}
    </div>
  );
}

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm shadow-lg">
      <p className="text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-gray-900 dark:text-white font-semibold">{formatEuro(payload[0].value)}</p>
      {payload[1] && <p className="text-gray-500 dark:text-gray-400">{payload[1].value} orders</p>}
    </div>
  );
}

function RecentActivity({ orders }: { orders: any[] }) {
  if (!orders || orders.length === 0) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Recente Order Activiteit</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Live feed van de laatste transacties op alle platforms</p>
        </div>
        <Link href="/orders" className="text-xs text-blue-600 dark:text-indigo-400 hover:text-blue-500 dark:hover:text-indigo-300 font-medium transition-colors">
          Alle orders bekijken →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-950/50">
            <tr>
              <th className="px-6 py-3 font-medium">Order #</th>
              <th className="px-6 py-3 font-medium">Platform</th>
              <th className="px-6 py-3 font-medium">Bedrag</th>
              <th className="px-6 py-3 font-medium">Kanaal</th>
              <th className="px-6 py-3 font-medium">Tijd</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800/50">
            {orders.slice(0, 10).map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group">
                <td className="px-6 py-4 font-mono text-gray-700 dark:text-gray-300">#{order.order_number}</td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    order.marketplace === 'bol' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  }`}>
                    {order.marketplace || 'Shopify'}
                  </span>
                </td>
                <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{formatEuro(order.total_price)}</td>
                <td className="px-6 py-4">
                   <span className="text-xs text-gray-500 dark:text-gray-400">{formatLabel(order.channel || 'direct')}</span>
                </td>
                <td className="px-6 py-4 text-xs text-gray-400 dark:text-gray-500">
                  {new Date(order.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    const PERIOD_DAYS: Record<string, string> = { today: '1', week: '7', month: '30', quarter: '90', year: '365', all: 'all' };
    fetch(`/api/orders?channel=${encodeURIComponent(channel)}&period=${PERIOD_DAYS[period] ?? period}`)
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{formatLabel(channel)}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Orders van dit kanaal — klik buiten of druk Esc om te sluiten</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Sluiten"
          >
            ✕
          </button>
        </div>

        <div className="overflow-auto flex-1 min-h-0">
          {loading && (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm animate-pulse">
              Laden…
            </div>
          )}
          {!loading && fetchError && (
            <div className="flex items-center justify-center h-48 text-red-500 text-sm">
              Fout: {fetchError}
            </div>
          )}
          {!loading && !fetchError && orders.length === 0 && (
            <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
              Geen orders gevonden voor dit kanaal.
            </div>
          )}
          {!loading && !fetchError && orders.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10">
                <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
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
                    <tr key={o.id} className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap tabular-nums">
                        {d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                          {dagNaam}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-mono">#{o.order_number}</td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white font-medium tabular-nums">
                        {formatEuro(o.total_price)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {o.first_touch ? formatLabel(o.first_touch) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {o.last_touch ? formatLabel(o.last_touch) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {o.is_new_customer === 1
                          ? <span className="text-xs bg-green-100 dark:bg-emerald-900/50 text-green-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">Nieuw</span>
                          : <span className="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full">Terugkerend</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-500 text-xs max-w-[140px] truncate">
                        {o.utm_campaign ?? <span className="text-gray-300 dark:text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-500 text-xs max-w-[120px] truncate">
                        {o.utm_content ?? <span className="text-gray-300 dark:text-gray-700">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && orders.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 flex-shrink-0 text-xs text-gray-400 dark:text-gray-600">
            {orders.length} orders getoond
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const PERIOD_LABELS: { key: Period; label: string; short: string }[] = [
  { key: 'today',   label: 'Vandaag',      short: 'Vandaag' },
  { key: 'week',    label: 'Deze week',    short: 'Week' },
  { key: 'month',   label: 'Deze maand',   short: 'Maand' },
  { key: 'quarter', label: 'Dit kwartaal', short: 'Kwartaal' },
  { key: 'year',    label: 'Dit jaar',     short: 'Jaar' },
  { key: 'all',     label: 'Alles',        short: 'Alles' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [platform, setPlatform] = useState<Platform>('all');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);

  interface FunnelStep { step: string; sessions: number; orders?: number; dropoff_pct: number | null; cr_pct?: number | null; rage_clicks: number; dead_clicks: number; }
  interface FunnelData { funnel: FunnelStep[]; topRagePages: { page: string; rage_clicks: number; dead_clicks: number; channel: string | null }[]; frustrationByChannel: { channel: string; rage_clicks: number; dead_clicks: number }[]; clarityTotals: { rage_clicks: number; dead_clicks: number }; hasData: boolean; aiInsight: string | null; }
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDark = useIsDark();

  const tooltipStyle = {
    background: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
    borderRadius: 8,
  };
  const tooltipItemStyle = { color: isDark ? '#f3f4f6' : '#111827' };
  const tooltipLabelStyle = { color: isDark ? '#9ca3af' : '#6b7280' };

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }

  const loadStats = useCallback(async (p: Period, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stats?period=${p}&platform=${platform}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStats(data);
      setLastUpdated(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Onbekende fout');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [platform]);

  useEffect(() => { loadStats(period); }, [period, loadStats]);

  useEffect(() => {
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const timer = setInterval(() => loadStats(period, true), SIX_HOURS);
    return () => clearInterval(timer);
  }, [period, loadStats]);

  useEffect(() => {
    fetch('/api/insights')
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => setInsights(d.insights ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/funnel?days=30')
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => setFunnelData(d))
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-gray-400 text-sm animate-pulse">Loading dashboard…</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-red-500 text-sm">{error ?? 'No data'}</div>
      </div>
    );
  }

  const totalOrders = stats.totalOrders;
  const returningPct = totalOrders > 0
    ? ((stats.returningCustomers / totalOrders) * 100).toFixed(1)
    : '0.0';

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

  const weekdayMap = Object.fromEntries(stats.byWeekday.map((r) => [r.weekday, r]));
  const weekdayData = WEEKDAY_ORDER.map((wd) => ({
    dag: WEEKDAY_NAMES[wd],
    orders: weekdayMap[wd]?.orders ?? 0,
    revenue: weekdayMap[wd]?.revenue ?? 0,
  }));
  const maxWdRevenue = Math.max(...weekdayData.map((d) => d.revenue), 0);

  const hourMap = Object.fromEntries(stats.byHour.map((r) => [r.hour, r.orders]));
  const maxHourOrders = Math.max(...Object.values(hourMap), 0) || 1;
  const hourData = Array.from({ length: 24 }, (_, i) => {
    const h = String(i).padStart(2, '0');
    return { hour: h, orders: hourMap[h] ?? 0 };
  });

  return (
    <div className="text-gray-900 dark:text-gray-100">

      <ActionBanner />

      <div className="space-y-8">

                {/* Page Title + Filters */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Mvolo Attribution Dashboard</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Shopify order attribution by marketing channel</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {/* Search */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Order zoeken..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    window.location.href = `/orders?search=${encodeURIComponent(searchQuery.trim())}`;
                  }
                }}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all w-full max-w-xs"
              />
            </div>

            {/* Live indicator */}
            {lastUpdated && (() => {
              const minutesAgo = Math.round((Date.now() - lastUpdated.getTime()) / 60000);
              const isFresh = minutesAgo < 360;
              return (
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isFresh ? 'bg-emerald-500 animate-pulse' : 'bg-orange-500'}`} />
                  <span>
                    {lastUpdated.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })()}

            {/* Refresh */}
            <button
              onClick={() => loadStats(period, true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-500 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Laden…' : 'Verversen'}
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                copied
                  ? 'border-green-300 dark:border-emerald-700 text-green-600 dark:text-emerald-400 bg-green-50 dark:bg-emerald-900/20'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              {copied ? 'Gekopieerd!' : 'Deel'}
            </button>
          </div>
        </div>

        {/* Period & Platform Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1">
            {PERIOD_LABELS.map(({ key, label, short }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  period === key ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <span className="hidden md:inline">{label}</span>
                <span className="md:hidden">{short}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1">
            {([['all', 'Alle platforms'], ['shopify', 'Shopify'], ['bol', 'Bol.com']] as [Platform, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPlatform(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  platform === key ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {key === 'bol' && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
                {label}
              </button>
            ))}
          </div>
        </div>


        {/* KPI Cards — Row 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <KpiCard
            label="Totaal orders"
            value={totalOrders.toLocaleString('nl-NL')}
            loading={refreshing}
            icon={ShoppingCart}
            iconBg="bg-indigo-100 dark:bg-indigo-900/30"
            iconColor="text-indigo-600 dark:text-indigo-400"
          />
          <KpiCard
            label="Totale omzet"
            value={formatEuro(stats.totalRevenue)}
            loading={refreshing}
            icon={DollarSign}
            iconBg="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
          />
          <KpiCard
            label="Beste kanaal"
            value={formatLabel(stats.bestChannel)}
            sub={`${stats.channels[0]?.orders} orders`}
            loading={refreshing}
            icon={TrendingUp}
            iconBg="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <KpiCard
            label="Gem. orderwaarde"
            value={formatEuro(stats.avgOrderValue)}
            loading={refreshing}
            icon={BarChart3}
            iconBg="bg-purple-100 dark:bg-purple-900/30"
            iconColor="text-purple-600 dark:text-purple-400"
          />
          <KpiCard
            label="Nieuwe klanten"
            value={stats.newCustomers.toLocaleString('nl-NL')}
            sub="eerste bestelling"
            loading={refreshing}
            icon={Users}
            iconBg="bg-cyan-100 dark:bg-cyan-900/30"
            iconColor="text-cyan-600 dark:text-cyan-400"
          />
          <KpiCard
            label="% Terugkerend"
            value={`${returningPct}%`}
            sub={`${stats.returningCustomers} terugkerende orders`}
            loading={refreshing}
            icon={UserCheck}
            iconBg="bg-amber-100 dark:bg-amber-900/30"
            iconColor="text-amber-600 dark:text-amber-400"
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
                icon={Target}
                iconBg="bg-rose-100 dark:bg-rose-900/30"
                iconColor="text-rose-600 dark:text-rose-400"
              />
            );
          })()}
        </div>

        {/* KPI Cards — Row 2: Ad Spend */}
        {(stats.totalSpend > 0 || stats.overallRoas > 0) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Totale adspend"
              value={formatEuro(stats.totalSpend)}
              sub="Meta + Google Ads"
              icon={DollarSign}
              iconBg="bg-red-100 dark:bg-red-900/30"
              iconColor="text-red-600 dark:text-red-400"
            />
            <KpiCard
              label="ROAS"
              value={`${stats.overallRoas}×`}
              sub="omzet / adspend"
              icon={TrendingUp}
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
            />
            <KpiCard
              label="POAS"
              value={`${stats.overallPoas}×`}
              sub="winst / adspend"
              icon={BarChart3}
              iconBg="bg-violet-100 dark:bg-violet-900/30"
              iconColor="text-violet-600 dark:text-violet-400"
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
              icon={Users}
              iconBg="bg-orange-100 dark:bg-orange-900/30"
              iconColor="text-orange-600 dark:text-orange-400"
            />
          </div>
        )}

        <RecentActivity orders={stats.recentOrders} />

        {/* Charts Row: Pie + Line */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300 mb-4">Orders per kanaal</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={stats.channels} dataKey="orders" nameKey="channel" cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={2}>
                  {stats.channels.map((entry, i) => (
                    <Cell key={entry.channel} fill={channelColor(entry.channel, i)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    `${Number(value)} orders (${((Number(value) / totalOrders) * 100).toFixed(1)}%)`,
                    formatLabel(String(name ?? "")),
                  ]}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Legend formatter={(value) => (
                  <span className="text-gray-500 dark:text-gray-400 text-xs">{formatLabel(value)}</span>
                )} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Line Chart */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300 mb-4">Omzet per dag — laatste 30 dagen</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={stats.daily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} tickLine={false} axisLine={false} />
                <YAxis yAxisId="rev" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} width={48} />
                <YAxis yAxisId="ord" orientation="right" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
                <Tooltip content={<RevenueTooltip />} />
                <Line yAxisId="rev" type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line yAxisId="ord" type="monotone" dataKey="orders" stroke="#d1d5db" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spend / Revenue / Profit */}
        {stats.dailySpend.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300 mb-4">Adspend vs Omzet vs Winst — laatste 30 dagen</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.dailySpend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [formatEuro(Number(value)), name === 'spend' ? 'Adspend' : name === 'revenue' ? 'Omzet' : 'Winst']}
                  itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle}
                />
                <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="revenue" />
                <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="profit" />
                <Line type="monotone" dataKey="spend" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="spend" />
                <Legend formatter={(value) => (
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    {value === 'revenue' ? 'Omzet' : value === 'profit' ? 'Winst' : 'Adspend'}
                  </span>
                )} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Campaign Breakdown Table */}
        {stats.campaigns.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300">Campagne breakdown — laatste 30 dagen</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
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
                      <tr key={i} className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-3 text-gray-800 dark:text-gray-200 max-w-[220px] truncate">{c.campaign_name ?? <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                        <td className="px-6 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${CHANNEL_COLORS[c.channel] ?? '#6b7280'}20`, color: CHANNEL_COLORS[c.channel] ?? '#6b7280' }}>
                            {formatLabel(c.channel)}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">{formatEuro(c.spend)}</td>
                        <td className="px-6 py-3 text-right text-gray-500 dark:text-gray-500 tabular-nums">{c.impressions.toLocaleString('nl-NL')}</td>
                        <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-400 tabular-nums">{c.clicks.toLocaleString('nl-NL')}</td>
                        <td className="px-6 py-3 text-right text-gray-500 dark:text-gray-500 tabular-nums">{ctr}%</td>
                        <td className="px-6 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">{c.purchases}</td>
                        <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-400 tabular-nums">{c.clicks > 0 ? formatEuro(cpc) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Channel Table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300">Alle kanalen</h2>
            <span className="text-xs text-gray-400 dark:text-gray-600">klik een rij voor orderdetails →</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
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
                  const GA4_MAP: Record<string, string> = {
                    'Direct': 'direct', 'Organic Search': 'organic_search', 'Paid Social': 'meta_ads',
                    'Paid Search': 'google_search', 'Email': 'email', 'Organic Social': 'organic_social',
                    'Affiliates': 'awin_affiliate', 'Referral': 'other', 'Unassigned': 'other', 'Cross-network': 'other',
                  };
                  const ga4Map: Record<string, number> = {};
                  for (const row of (stats.ga4ByChannel ?? [])) {
                    const key = GA4_MAP[row.channel] ?? row.channel.toLowerCase().replace(/\s+/g, '_');
                    ga4Map[key] = (ga4Map[key] ?? 0) + row.sessions;
                  }
                  return stats.channels.map((ch, i) => {
                    const pctVal = ((ch.orders / totalOrders) * 100).toFixed(1);
                    const avg = ch.orders > 0 ? ch.revenue / ch.orders : 0;
                    const sess = ga4Map[ch.channel] ?? 0;
                    const conv = sess > 0 ? ((ch.orders / sess) * 100).toFixed(1) : null;
                    return (
                      <tr key={ch.channel} className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group" onClick={() => setSelectedChannel(ch.channel)}>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: channelColor(ch.channel, i) }} />
                            <span className="text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{formatLabel(ch.channel)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right text-gray-700 dark:text-gray-300 tabular-nums">{ch.orders}</td>
                        <td className="px-6 py-3.5 text-right text-gray-700 dark:text-gray-300 tabular-nums">{formatEuro(ch.revenue)}</td>
                        <td className="px-6 py-3.5 text-right tabular-nums">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                              <div className="h-1.5 rounded-full" style={{ width: `${pctVal}%`, background: channelColor(ch.channel, i) }} />
                            </div>
                            <span className="text-gray-500 dark:text-gray-400 w-10 text-right">{pctVal}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right text-gray-600 dark:text-gray-400 tabular-nums">{formatEuro(avg)}</td>
                        <td className="px-6 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-400">
                          {sess > 0 ? sess.toLocaleString('nl-NL') : <span className="text-gray-300 dark:text-gray-700">—</span>}
                        </td>
                        <td className="px-6 py-3.5 text-right tabular-nums">
                          {conv !== null
                            ? <span className={`text-xs font-medium ${parseFloat(conv) >= 2 ? 'text-emerald-600 dark:text-emerald-400' : parseFloat(conv) >= 0.5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500'}`}>{conv}%</span>
                            : <span className="text-gray-300 dark:text-gray-700 text-xs">—</span>
                          }
                        </td>
                        <td className="px-6 py-3.5 text-right tabular-nums">
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">{ch.new_customers}</span>
                        </td>
                        <td className="px-6 py-3.5 text-right tabular-nums">
                          <span className="text-xs text-indigo-600 dark:text-indigo-400">{ch.returning_customers}</span>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Direct Breakdown */}
        {stats.directSubchannels?.length > 0 && (() => {
          const DIRECT_COLORS: Record<string, string> = { direct_typed: '#6366f1', dark_social: '#ec4899', email_no_utm: '#a78bfa', meta_no_utm: '#f97316', ios_private: '#06b6d4', direct_unknown: '#6b7280' };
          const DIRECT_LABELS: Record<string, string> = { direct_typed: 'Direct getypt / bladwijzer', dark_social: 'Dark social (DM/WhatsApp)', email_no_utm: 'E-mail zonder UTM', meta_no_utm: 'Meta Ads (geen UTM)', ios_private: 'iOS privé', direct_unknown: 'Onbekend direct' };
          const totalDirect = stats.directSubchannels.reduce((s, r) => s + r.orders, 0) || 1;
          return (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300">Direct breakdown</h2>
                <span className="text-xs text-gray-400 dark:text-gray-600">{totalDirect} directe orders</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={stats.directSubchannels} dataKey="orders" nameKey="subchannel" cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={2}>
                      {stats.directSubchannels.map((entry, i) => (
                        <Cell key={`${entry.subchannel}-${i}`} fill={DIRECT_COLORS[entry.subchannel] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${Number(value)} orders (${((Number(value) / totalDirect) * 100).toFixed(1)}%)`, DIRECT_LABELS[String(name)] ?? String(name)]}
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle}
                    />
                    <Legend formatter={(value) => <span className="text-gray-500 dark:text-gray-400 text-xs">{DIRECT_LABELS[value] ?? value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {stats.directSubchannels.map((row, i) => {
                    const pct = ((row.orders / totalDirect) * 100).toFixed(1);
                    const color = DIRECT_COLORS[row.subchannel] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
                    return (
                      <div key={`${row.subchannel}-${i}`} className="flex items-center gap-3 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-gray-700 dark:text-gray-300 flex-1">{DIRECT_LABELS[row.subchannel] ?? row.subchannel}</span>
                        <span className="text-gray-600 dark:text-gray-400 tabular-nums">{row.orders}</span>
                        <div className="w-16 bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className="text-gray-500 dark:text-gray-500 text-xs w-10 text-right tabular-nums">{pct}%</span>
                        <span className="text-gray-400 dark:text-gray-600 text-xs w-20 text-right tabular-nums">{formatEuro(row.revenue)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Order Campaigns */}
        {stats.orderCampaigns?.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300">Campaign breakdown</h2>
              <span className="text-xs text-gray-400 dark:text-gray-600">op basis van ProfitMetrics campaign IDs</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
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
                    const pct = stats.totalRevenue > 0 ? ((c.revenue / stats.totalRevenue) * 100).toFixed(1) : '0.0';
                    const color = CHANNEL_COLORS[c.channel] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
                    return (
                      <tr key={`${c.utm_campaign}-${c.channel}`} className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs text-gray-700 dark:text-gray-300 max-w-[200px] truncate">{c.utm_campaign}</td>
                        <td className="px-6 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${color}20`, color }}>{formatLabel(c.channel)}</span>
                        </td>
                        <td className="px-6 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">{c.orders}</td>
                        <td className="px-6 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">{formatEuro(c.revenue)}</td>
                        <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-400 tabular-nums">{formatEuro(c.avg_order_value)}</td>
                        <td className="px-6 py-3 text-right tabular-nums">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-14 bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                              <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                            </div>
                            <span className="text-gray-500 dark:text-gray-500 w-10 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Nieuw vs Terugkerend */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300">Nieuw vs Terugkerend per kanaal</h2>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">% Nieuw vs % Terugkerend</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={customerSegmentData} margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} vertical={false} />
                <XAxis dataKey="channel" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} angle={-25} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} width={36} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value}%`, name === 'nieuw' ? 'Nieuw' : 'Terugkerend']} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} />
                <Bar dataKey="nieuw" name="nieuw" stackId="a" fill="#10b981" />
                <Bar dataKey="terugkerend" name="terugkerend" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Legend formatter={(value) => <span className="text-gray-500 dark:text-gray-400 text-xs">{value === 'nieuw' ? 'Nieuw' : 'Terugkerend'}</span>} wrapperStyle={{ paddingTop: 8 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Gem. orderwaarde — nieuw vs terugkerend</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={customerSegmentData} margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} vertical={false} />
                <XAxis dataKey="channel" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} angle={-25} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `€${Math.round(v)}`} width={48} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [formatEuro(Number(value)), name === 'avgNew' ? 'Gem. nieuw' : 'Gem. terugkerend']} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} />
                <Bar dataKey="avgNew" name="avgNew" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgReturning" name="avgReturning" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Legend formatter={(value) => <span className="text-gray-500 dark:text-gray-400 text-xs">{value === 'avgNew' ? 'Gem. nieuw' : 'Gem. terugkerend'}</span>} wrapperStyle={{ paddingTop: 8 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Beste Dagen Analyse */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300">Beste dagen analyse</h2>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Omzet per dag van de week</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekdayData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} vertical={false} />
                <XAxis dataKey="dag" tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`} width={44} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [name === 'revenue' ? formatEuro(Number(value)) : `${Number(value)} orders`, name === 'revenue' ? 'Omzet' : 'Orders']} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} />
                <Bar dataKey="revenue" name="revenue" radius={[4, 4, 0, 0]}>
                  {weekdayData.map((entry) => (
                    <Cell key={entry.dag} fill={entry.revenue === maxWdRevenue && maxWdRevenue > 0 ? '#f59e0b' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">Goud = beste dag</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Aantal orders per dag van de week</p>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="grid grid-cols-7 gap-2 min-w-[280px]">
              {weekdayData.map((d) => {
                const maxOrders = Math.max(...weekdayData.map((x) => x.orders), 1);
                const isBest = d.orders === Math.max(...weekdayData.map((x) => x.orders));
                return (
                  <div key={d.dag} className="flex flex-col items-center gap-1.5">
                    <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden h-20 flex items-end">
                      <div className="w-full rounded-t-lg transition-all" style={{ height: `${(d.orders / maxOrders) * 100}%`, background: isBest ? '#f59e0b' : '#9ca3af' }} />
                    </div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{d.dag}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-600 tabular-nums">{d.orders}</span>
                  </div>
                );
              })}
            </div>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Orders per uur van de dag (heatmap)</p>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="grid grid-cols-12 gap-1 min-w-[480px]">
              {hourData.map((h) => {
                const intensity = maxHourOrders > 0 ? h.orders / maxHourOrders : 0;
                const opacity = 0.08 + intensity * 0.92;
                return (
                  <div key={h.hour} className="relative group flex flex-col items-center" title={`${h.hour}:00 — ${h.orders} orders`}>
                    <div className="w-full h-10 rounded-md flex items-center justify-center text-xs font-medium cursor-default" style={{ background: `rgba(99, 102, 241, ${opacity})`, color: intensity > 0.5 ? '#e0e7ff' : '#6b7280' }}>
                      {h.orders > 0 ? h.orders : ''}
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">{h.hour}</span>
                  </div>
                );
              })}
            </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">Donkerder = meer orders — hover voor details</p>
          </div>
        </div>

        {/* Top 5 Days */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300">Top 5 dagen op omzet</h2>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                <th className="px-6 py-3 text-left font-medium">Datum</th>
                <th className="px-6 py-3 text-right font-medium">Orders</th>
                <th className="px-6 py-3 text-right font-medium">Omzet</th>
              </tr>
            </thead>
            <tbody>
              {stats.topDays.map((day, i) => (
                <tr key={day.date} className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-600 w-4">{i + 1}</span>
                      <span className="text-gray-800 dark:text-gray-200">{new Date(day.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-right text-gray-700 dark:text-gray-300 tabular-nums">{day.orders}</td>
                  <td className="px-6 py-3.5 text-right font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">{formatEuro(day.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Customer Journey */}
        {stats.journeyByChannel?.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300">Customer Journey</h2>
              <span className="text-xs text-gray-400 dark:text-gray-600">{stats.totalTracked} tracked aankopen</span>
            </div>
            <div className="space-y-2">
              {stats.journeyByChannel.map((j) => (
                <div key={j.channel} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/60 rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-700/40">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHANNEL_COLORS[j.channel] ?? '#6b7280' }} />
                    <span className="text-sm text-gray-800 dark:text-gray-200">{formatLabel(j.channel)}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-600">({j.total}×)</span>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-500">gem. sessies</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{j.avg_sessions}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-500">dagen tot aankoop</p>
                      <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">{j.avg_days}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {stats.journeyHistogram?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Sessies voor aankoop — verdeling</p>
                <div className="grid grid-cols-4 gap-3">
                  {(() => {
                    const total = stats.journeyHistogram.reduce((s, b) => s + b.count, 0) || 1;
                    const buckets = ['1 sessie', '2–3 sessies', '4–7 sessies', '8+ sessies'];
                    const map = Object.fromEntries(stats.journeyHistogram.map((b) => [b.bucket, b.count]));
                    return buckets.map((bucket) => {
                      const count = map[bucket] ?? 0;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={bucket} className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3 border border-gray-200 dark:border-gray-700/40 flex flex-col items-center gap-1">
                          <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{pct}%</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">{bucket}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-600">{count} aankopen</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* GA4 Verkeer & Journey */}
        {(stats.ga4ByChannel?.length > 0 || stats.ga4Daily?.length > 0) && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300">Verkeer & Journey — Google Analytics 4</h2>
              <span className="text-xs text-gray-400 dark:text-gray-600">afgelopen 30 dagen</span>
            </div>
            {stats.ga4Daily?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Sessies per dag</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={stats.ga4Daily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={36} />
                    <Tooltip contentStyle={{ ...tooltipStyle, fontSize: 12 }} labelStyle={tooltipLabelStyle} formatter={(v: unknown) => [(v as number).toLocaleString('nl-NL'), 'sessies']} />
                    <Line type="monotone" dataKey="sessions" stroke="#6366f1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {stats.ga4ByChannel?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Sessies per kanaal</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
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
                        const mins = Math.floor(row.avg_session_duration / 60);
                        const secs = Math.round(row.avg_session_duration % 60);
                        const dur = `${mins}:${String(secs).padStart(2, '0')}`;
                        return (
                          <tr key={row.channel} className="border-b border-gray-200 dark:border-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                            <td className="py-2.5 text-gray-800 dark:text-gray-200">{row.channel}</td>
                            <td className="py-2.5 text-right text-gray-700 dark:text-gray-300 tabular-nums">{row.sessions.toLocaleString('nl-NL')}</td>
                            <td className="py-2.5 text-right text-gray-600 dark:text-gray-400 tabular-nums">{row.users.toLocaleString('nl-NL')}</td>
                            <td className="py-2.5 text-right text-gray-600 dark:text-gray-400 tabular-nums">{newPct}%</td>
                            <td className="py-2.5 text-right tabular-nums">
                              <span className={row.bounce_rate > 0.6 ? 'text-red-500' : row.bounce_rate > 0.4 ? 'text-yellow-600 dark:text-yellow-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                {(row.bounce_rate * 100).toFixed(0)}%
                              </span>
                            </td>
                            <td className="py-2.5 text-right text-gray-600 dark:text-gray-400 tabular-nums">{dur}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {stats.ga4Journeys?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Journey: eerste kanaal → sessiekanaal (top paden)</p>
                <div className="space-y-1.5">
                  {stats.ga4Journeys.slice(0, 10).map((row, i) => {
                    const maxSess = stats.ga4Journeys[0]?.sessions || 1;
                    const pct = Math.round((row.sessions / maxSess) * 100);
                    const sameChannel = row.first_channel === row.session_channel;
                    return (
                      <div key={i} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg px-3 py-2 text-xs">
                        <span className="text-gray-700 dark:text-gray-300 w-32 truncate">{row.first_channel}</span>
                        <span className="text-gray-400 dark:text-gray-600">→</span>
                        <span className={`w-32 truncate ${sameChannel ? 'text-gray-500 dark:text-gray-500' : 'text-indigo-600 dark:text-indigo-400'}`}>{row.session_channel}</span>
                        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-gray-600 dark:text-gray-400 tabular-nums w-16 text-right">{row.sessions.toLocaleString('nl-NL')} sess.</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Meta Attribution Windows */}
        {stats.metaWindows && (stats.metaWindows.total_1d > 0 || stats.metaWindows.total_7d > 0 || stats.metaWindows.total_28d > 0) && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300">Meta Attributievensters (afgelopen 30d)</h2>
              <span className="text-xs text-gray-400 dark:text-gray-600">1d / 7d / 28d klik</span>
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
                  <div key={label} className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/40 rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{pct}%</span>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      <span className="text-gray-700 dark:text-gray-300">{purchases}</span> aankopen ·{' '}
                      <span className="text-gray-700 dark:text-gray-300">{formatEuro(revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-3">Toont hoeveel % van Meta aankopen werd geattribueerd op dezelfde dag (1d), binnen een week (7d) of binnen 28 dagen na klikken.</p>
          </div>
        )}

        {/* Repeat Purchase Analysis */}
        {stats.repeatPurchases?.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300">Herhaalaankopen per kanaal</h2>
              <span className="text-xs text-gray-400 dark:text-gray-600">gem. dagen tussen aankopen</span>
            </div>
            <div className="space-y-2">
              {stats.repeatPurchases.map((r) => {
                const maxDays = Math.max(...stats.repeatPurchases.map((x) => x.avg_days_between), 1);
                const pct = Math.round((r.avg_days_between / maxDays) * 100);
                const color = CHANNEL_COLORS[r.first_channel] ?? '#6b7280';
                return (
                  <div key={r.first_channel} className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800/40 rounded-lg px-4 py-2.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-sm text-gray-700 dark:text-gray-300 w-36 truncate">{formatLabel(r.first_channel)}</span>
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums w-20 text-right">{r.avg_days_between}d</span>
                    <span className="text-xs text-gray-400 dark:text-gray-600 w-24 text-right">{r.repeat_purchases}× herhaald</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PM First vs Last Touch */}
        {stats.pmTouchSummary?.total > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300">ProfitMetrics: First vs Last Touch</h2>
              <span className="text-xs text-gray-400 dark:text-gray-600">{stats.pmTouchSummary.total} orders geanalyseerd</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">Single-touch</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{Math.round((stats.pmTouchSummary.single_touch / (stats.pmTouchSummary.total || 1)) * 100)}%</p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{stats.pmTouchSummary.single_touch} orders — zelfde first &amp; last touch</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">Multi-touch</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{Math.round((stats.pmTouchSummary.multi_touch / (stats.pmTouchSummary.total || 1)) * 100)}%</p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{stats.pmTouchSummary.multi_touch} orders — meerdere kanalen betrokken</p>
              </div>
            </div>
            {stats.pmTouchRows?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Top touch-paden</p>
                <div className="space-y-1.5">
                  {stats.pmTouchRows.slice(0, 6).map((row, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs px-3 py-2 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
                      <span className="text-gray-600 dark:text-gray-400 w-28 truncate">{formatLabel(row.first_touch)}</span>
                      <span className="text-gray-400 dark:text-gray-600">→</span>
                      <span className="text-gray-600 dark:text-gray-400 w-28 truncate">{formatLabel(row.last_touch ?? row.first_touch)}</span>
                      <span className="ml-auto text-gray-500 dark:text-gray-500 tabular-nums">{row.total}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Funnel & Gedrag */}
        {funnelData && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300">Funnel & Gedrag</h2>
              <div className="flex items-center gap-3">
                {funnelData.clarityTotals.rage_clicks > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50">🔴 {funnelData.clarityTotals.rage_clicks} rage clicks</span>
                )}
                {funnelData.clarityTotals.dead_clicks > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">⚫ {funnelData.clarityTotals.dead_clicks} dead clicks</span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-600">GA4 + Clarity + orders · 30 dagen</span>
              </div>
            </div>
            {funnelData.funnel.length > 0 && (() => {
              const STEP_LABELS: Record<string, string> = { homepage: 'Homepage', product: 'Productpagina', cart: 'Winkelwagen', checkout: 'Afrekenen', besteld: 'Besteld' };
              const maxVal = Math.max(...funnelData.funnel.map((s) => s.sessions || s.orders || 0), 1);
              return (
                <div className="space-y-2">
                  {funnelData.funnel.map((step, i) => {
                    const val = step.step === 'besteld' ? (step.orders ?? 0) : step.sessions;
                    const width = Math.round((val / maxVal) * 100);
                    const isLast = step.step === 'besteld';
                    const gradients = ['from-indigo-600 to-indigo-500', 'from-violet-600 to-violet-500', 'from-purple-600 to-purple-500', 'from-fuchsia-600 to-fuchsia-500', 'from-emerald-600 to-emerald-500'];
                    return (
                      <div key={step.step} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-28 flex-shrink-0">{STEP_LABELS[step.step] ?? step.step}</span>
                            <div className="flex-1 h-8 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden">
                              <div className={`h-full bg-gradient-to-r ${gradients[i % gradients.length]} flex items-center px-3 transition-all`} style={{ width: `${width}%` }}>
                                <span className="text-xs font-semibold text-white whitespace-nowrap">
                                  {isLast ? `${val.toLocaleString('nl-NL')} orders${step.cr_pct != null ? ` · CR: ${step.cr_pct}%` : ''}` : val.toLocaleString('nl-NL')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 w-40 sm:w-52 flex-shrink-0">
                          {step.dropoff_pct !== null && step.dropoff_pct > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${step.dropoff_pct >= 60 ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400' : step.dropoff_pct >= 30 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                              -{step.dropoff_pct}%
                            </span>
                          )}
                          {step.rage_clicks > 0 && (<span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40">🔴 {step.rage_clicks}</span>)}
                          {step.dead_clicks > 0 && (<span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-500 border border-gray-200 dark:border-gray-700/40">⚫ {step.dead_clicks}</span>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {!funnelData.hasData && (
              <div className="text-xs text-gray-500 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/40 rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-700/40">
                GA4 paginadata nog niet gesynchroniseerd. Voer <code className="text-gray-600 dark:text-gray-400">npm run sync</code> uit om funneldata op te halen. Orders uit de database worden altijd als laatste stap getoond.
              </div>
            )}
            {funnelData.topRagePages.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Top frustratiepagina&apos;s</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 dark:text-gray-600 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                        <th className="py-2 text-left font-medium">Pagina</th>
                        <th className="py-2 text-right font-medium">Rage clicks</th>
                        <th className="py-2 text-right font-medium">Dead clicks</th>
                        <th className="py-2 text-left font-medium pl-4">Kanaal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funnelData.topRagePages.map((r, i) => (
                        <tr key={i} className="border-b border-gray-200 dark:border-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/20">
                          <td className="py-2 text-gray-700 dark:text-gray-300 font-mono max-w-[200px] truncate">{r.page}</td>
                          <td className="py-2 text-right">{r.rage_clicks > 0 ? <span className="text-red-500 font-medium">{r.rage_clicks}</span> : <span className="text-gray-300 dark:text-gray-700">—</span>}</td>
                          <td className="py-2 text-right">{r.dead_clicks > 0 ? <span className="text-gray-500 dark:text-gray-400">{r.dead_clicks}</span> : <span className="text-gray-300 dark:text-gray-700">—</span>}</td>
                          <td className="py-2 pl-4 text-gray-500 dark:text-gray-500">{r.channel ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {funnelData.frustrationByChannel.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Frustratie per kanaal</p>
                <div className="space-y-2">
                  {funnelData.frustrationByChannel.map((r, i) => {
                    const total = (r.rage_clicks + r.dead_clicks) || 1;
                    const color = CHANNEL_COLORS[r.channel] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
                    return (
                      <div key={r.channel} className="flex items-center gap-3 text-xs">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-gray-700 dark:text-gray-300 w-32 truncate">{formatLabel(r.channel)}</span>
                        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, total)}%`, background: color }} />
                        </div>
                        <span className="text-red-500 w-16 text-right tabular-nums">{r.rage_clicks > 0 ? `🔴 ${r.rage_clicks}` : ''}</span>
                        <span className="text-gray-500 dark:text-gray-500 w-16 text-right tabular-nums">{r.dead_clicks > 0 ? `⚫ ${r.dead_clicks}` : ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {funnelData.aiInsight && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Claude AI Analyse</span>
                  <span className="text-xs text-gray-400 dark:text-gray-600">funnel · 30 dagen · claude-haiku</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{funnelData.aiInsight}</p>
              </div>
            )}
          </div>
        )}

        {/* AI Conclusies */}
        {insights.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300 mb-4">Automatische conclusies</h2>
            <div className="space-y-3">
              {insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-4 py-3.5 border border-gray-200 dark:border-gray-700/50">
                  <span className="text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0 text-sm">→</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{ins.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Order detail modal */}
      {selectedChannel && (
        <OrderModal channel={selectedChannel} period={period} onClose={() => setSelectedChannel(null)} />
      )}
    </div>
  );
}