'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Search, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp,
  CheckCircle, XCircle,
} from 'lucide-react';

function useIsDark() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

type Intent = 'Informatief' | 'Transactioneel' | 'Commercieel' | 'Navigatie';

interface SerpFeatures {
  featuredSnippet: boolean;
  peopleAlsoAsk: boolean;
  imagePack: boolean;
  knowledgePanel: boolean;
  shoppingResults: boolean;
}

interface KwData {
  keyword: string;
  pos: number;
  volume: number;
  change: number;
  ctr: number;
  clicks: number;
  url: string;
  intent: Intent;
  history: number[];
  serp: SerpFeatures;
  related: { keyword: string; pos: number }[];
}

const ALL_KEYWORDS: KwData[] = [
  {
    keyword: 'lichttherapie lamp', pos: 3, volume: 3200, change: 2, ctr: 8.2, clicks: 263,
    url: '/products/lichttherapie-lamp-10000-lux', intent: 'Transactioneel',
    history: [8, 7, 7, 6, 5, 5, 4, 4, 3, 3, 3, 3],
    serp: { featuredSnippet: false, peopleAlsoAsk: true, imagePack: true, knowledgePanel: false, shoppingResults: true },
    related: [{ keyword: 'lichttherapie lamp kopen', pos: 6 }, { keyword: 'lichttherapie lamp test', pos: 12 }, { keyword: 'beste lichttherapie lamp', pos: 8 }],
  },
  {
    keyword: 'daglichtlamp kopen', pos: 5, volume: 2100, change: 4, ctr: 6.1, clicks: 128,
    url: '/products/daglichtlamp', intent: 'Transactioneel',
    history: [12, 11, 10, 9, 8, 7, 6, 6, 5, 5, 5, 5],
    serp: { featuredSnippet: false, peopleAlsoAsk: false, imagePack: true, knowledgePanel: false, shoppingResults: true },
    related: [{ keyword: 'daglichtlamp aanbieding', pos: 9 }, { keyword: 'daglichtlamp goedkoop', pos: 14 }, { keyword: 'daglichtlamp vergelijken', pos: 11 }],
  },
  {
    keyword: 'SAD lamp', pos: 2, volume: 1800, change: 0, ctr: 9.4, clicks: 169,
    url: '/products/sad-lamp', intent: 'Commercieel',
    history: [4, 3, 3, 2, 2, 2, 3, 2, 2, 2, 2, 2],
    serp: { featuredSnippet: false, peopleAlsoAsk: true, imagePack: true, knowledgePanel: false, shoppingResults: true },
    related: [{ keyword: 'SAD lamp kopen', pos: 10 }, { keyword: 'SAD lamp effectief', pos: 7 }, { keyword: 'SAD lamp werking', pos: 5 }],
  },
  {
    keyword: 'winterdepressie lamp', pos: 7, volume: 1400, change: 3, ctr: 4.8, clicks: 67,
    url: '/blog/winterdepressie-lichttherapie', intent: 'Informatief',
    history: [14, 13, 12, 11, 10, 9, 9, 8, 7, 7, 7, 7],
    serp: { featuredSnippet: true, peopleAlsoAsk: true, imagePack: false, knowledgePanel: false, shoppingResults: false },
    related: [{ keyword: 'winterdepressie behandeling', pos: 18 }, { keyword: 'winterdepressie symptomen', pos: 22 }, { keyword: 'winterdepressie lichttherapie ervaringen', pos: 9 }],
  },
  {
    keyword: 'lichttherapie apparaten', pos: 4, volume: 1200, change: -1, ctr: 7.2, clicks: 86,
    url: '/collections/lichttherapie', intent: 'Transactioneel',
    history: [5, 5, 4, 4, 4, 5, 5, 4, 4, 5, 4, 4],
    serp: { featuredSnippet: false, peopleAlsoAsk: false, imagePack: true, knowledgePanel: false, shoppingResults: true },
    related: [{ keyword: 'lichttherapie apparaat prijs', pos: 8 }, { keyword: 'lichttherapie apparaat test', pos: 13 }],
  },
  {
    keyword: 'wake-up light', pos: 8, volume: 980, change: 5, ctr: 3.9, clicks: 38,
    url: '/products/wake-up-light', intent: 'Transactioneel',
    history: [18, 17, 15, 14, 13, 12, 11, 10, 9, 8, 8, 8],
    serp: { featuredSnippet: false, peopleAlsoAsk: true, imagePack: true, knowledgePanel: false, shoppingResults: true },
    related: [{ keyword: 'wake-up light kopen', pos: 11 }, { keyword: 'wake-up light vergelijken', pos: 16 }, { keyword: 'wake-up light alternatief', pos: 14 }],
  },
  {
    keyword: 'UV-vrije lichttherapie', pos: 1, volume: 650, change: 0, ctr: 12.1, clicks: 79,
    url: '/products/uv-vrije-lamp', intent: 'Informatief',
    history: [3, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    serp: { featuredSnippet: true, peopleAlsoAsk: true, imagePack: false, knowledgePanel: false, shoppingResults: false },
    related: [{ keyword: 'UV-vrij daglicht', pos: 4 }, { keyword: 'veilige lichttherapie', pos: 7 }],
  },
  {
    keyword: 'bioptic lamp', pos: 6, volume: 540, change: 2, ctr: 5.3, clicks: 29,
    url: '/products/bioptic-lamp', intent: 'Transactioneel',
    history: [10, 9, 9, 8, 7, 7, 6, 6, 6, 6, 6, 6],
    serp: { featuredSnippet: false, peopleAlsoAsk: false, imagePack: true, knowledgePanel: false, shoppingResults: true },
    related: [{ keyword: 'bioptic lamp kopen', pos: 9 }, { keyword: 'bioptic lichttherapie', pos: 14 }],
  },
  {
    keyword: 'lichttherapie tegen depressie', pos: 11, volume: 890, change: 8, ctr: 2.1, clicks: 19,
    url: '/blog/lichttherapie-depressie', intent: 'Informatief',
    history: [22, 21, 20, 18, 17, 16, 15, 13, 12, 11, 11, 11],
    serp: { featuredSnippet: false, peopleAlsoAsk: true, imagePack: false, knowledgePanel: false, shoppingResults: false },
    related: [{ keyword: 'lichttherapie depressie werkt het', pos: 15 }, { keyword: 'lichttherapie depressie ervaringen', pos: 8 }, { keyword: 'lichttherapie winterdepressie', pos: 7 }],
  },
  {
    keyword: 'daglichtlamp test', pos: 9, volume: 720, change: -3, ctr: 3.2, clicks: 23,
    url: '/blog/daglichtlamp-test', intent: 'Commercieel',
    history: [6, 6, 7, 7, 8, 8, 9, 9, 9, 9, 9, 9],
    serp: { featuredSnippet: false, peopleAlsoAsk: true, imagePack: false, knowledgePanel: false, shoppingResults: false },
    related: [{ keyword: 'daglichtlamp test 2024', pos: 18 }, { keyword: 'daglichtlamp vergelijk', pos: 12 }],
  },
  {
    keyword: 'goede daglichtlamp', pos: 12, volume: 680, change: 6, ctr: 1.8, clicks: 12,
    url: '/blog/beste-daglichtlamp', intent: 'Commercieel',
    history: [21, 20, 19, 17, 16, 15, 14, 13, 13, 12, 12, 12],
    serp: { featuredSnippet: false, peopleAlsoAsk: true, imagePack: false, knowledgePanel: false, shoppingResults: false },
    related: [{ keyword: 'beste daglichtlamp 2024', pos: 8 }, { keyword: 'top daglichtlampen', pos: 16 }],
  },
  {
    keyword: 'lichttherapie ervaringen', pos: 3, volume: 1100, change: 0, ctr: 7.8, clicks: 86,
    url: '/blog/lichttherapie-ervaringen', intent: 'Informatief',
    history: [5, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    serp: { featuredSnippet: false, peopleAlsoAsk: true, imagePack: false, knowledgePanel: false, shoppingResults: false },
    related: [{ keyword: 'lichttherapie werkt het', pos: 6 }, { keyword: 'lichttherapie resultaten', pos: 9 }],
  },
  {
    keyword: 'Philips wake-up light alternatief', pos: 14, volume: 450, change: 12, ctr: 1.2, clicks: 5,
    url: '/blog/philips-alternatief', intent: 'Transactioneel',
    history: [28, 26, 25, 23, 22, 21, 19, 18, 17, 15, 14, 14],
    serp: { featuredSnippet: false, peopleAlsoAsk: false, imagePack: false, knowledgePanel: false, shoppingResults: false },
    related: [{ keyword: 'goedkoop wake-up light', pos: 11 }, { keyword: 'wake-up light zonder Philips', pos: 19 }],
  },
  {
    keyword: 'lichttherapie medisch', pos: 6, volume: 380, change: 1, ctr: 5.9, clicks: 22,
    url: '/blog/lichttherapie-medisch', intent: 'Informatief',
    history: [8, 8, 7, 7, 6, 6, 6, 6, 6, 6, 6, 6],
    serp: { featuredSnippet: true, peopleAlsoAsk: true, imagePack: false, knowledgePanel: true, shoppingResults: false },
    related: [{ keyword: 'lichttherapie arts', pos: 14 }, { keyword: 'medische lichttherapie vergoeding', pos: 22 }],
  },
  {
    keyword: 'winter blues lamp', pos: 4, volume: 920, change: 2, ctr: 6.8, clicks: 63,
    url: '/products/winter-blues-lamp', intent: 'Commercieel',
    history: [9, 8, 7, 6, 5, 5, 4, 4, 4, 4, 4, 4],
    serp: { featuredSnippet: false, peopleAlsoAsk: true, imagePack: true, knowledgePanel: false, shoppingResults: true },
    related: [{ keyword: 'winter blues behandeling', pos: 12 }, { keyword: 'winter blues lichttherapie', pos: 6 }],
  },
  {
    keyword: 'lichttherapie seizoensgebonden', pos: 13, volume: 320, change: 3, ctr: 1.6, clicks: 5,
    url: '/blog/seizoensgebonden-depressie', intent: 'Informatief',
    history: [18, 17, 16, 16, 15, 14, 14, 13, 13, 13, 13, 13],
    serp: { featuredSnippet: false, peopleAlsoAsk: true, imagePack: false, knowledgePanel: false, shoppingResults: false },
    related: [{ keyword: 'SAD seizoensgebonden', pos: 17 }, { keyword: 'seizoensgebonden depressie behandeling', pos: 24 }],
  },
  {
    keyword: 'zonlichtlamp kopen', pos: 18, volume: 290, change: 7, ctr: 0.9, clicks: 3,
    url: '/products/daglichtlamp', intent: 'Transactioneel',
    history: [28, 27, 26, 24, 23, 22, 21, 20, 19, 18, 18, 18],
    serp: { featuredSnippet: false, peopleAlsoAsk: false, imagePack: false, knowledgePanel: false, shoppingResults: true },
    related: [{ keyword: 'zonlicht simulatie', pos: 23 }],
  },
  {
    keyword: 'energielamp vermoeidheid', pos: 15, volume: 720, change: 4, ctr: 1.4, clicks: 10,
    url: '/blog/energielamp', intent: 'Informatief',
    history: [22, 21, 20, 19, 18, 17, 16, 16, 15, 15, 15, 15],
    serp: { featuredSnippet: false, peopleAlsoAsk: true, imagePack: false, knowledgePanel: false, shoppingResults: false },
    related: [{ keyword: 'lamp tegen vermoeidheid', pos: 9 }, { keyword: 'energieverhogende lamp', pos: 21 }],
  },
  {
    keyword: 'lichttherapie slaap verbetering', pos: 19, volume: 480, change: 9, ctr: 0.7, clicks: 3,
    url: '/blog/lichttherapie-slaap', intent: 'Informatief',
    history: [28, 27, 26, 25, 24, 23, 23, 22, 21, 20, 19, 19],
    serp: { featuredSnippet: false, peopleAlsoAsk: true, imagePack: false, knowledgePanel: false, shoppingResults: false },
    related: [{ keyword: 'lichttherapie betere slaap', pos: 14 }, { keyword: 'licht slaap ritme', pos: 27 }],
  },
  {
    keyword: 'daglichtlamp bureau', pos: 16, volume: 590, change: 2, ctr: 1.1, clicks: 6,
    url: '/products/bureau-lamp', intent: 'Transactioneel',
    history: [20, 19, 18, 18, 17, 17, 16, 16, 16, 16, 16, 16],
    serp: { featuredSnippet: false, peopleAlsoAsk: false, imagePack: true, knowledgePanel: false, shoppingResults: true },
    related: [{ keyword: 'bureau daglichtlamp compact', pos: 11 }, { keyword: 'thuis kantoor lichtlamp', pos: 24 }],
  },
  {
    keyword: 'lichttherapie bijwerkingen', pos: 8, volume: 680, change: -1, ctr: 3.6, clicks: 24,
    url: '/blog/lichttherapie-bijwerkingen', intent: 'Informatief',
    history: [7, 7, 8, 8, 8, 9, 8, 8, 8, 8, 8, 8],
    serp: { featuredSnippet: true, peopleAlsoAsk: true, imagePack: false, knowledgePanel: false, shoppingResults: false },
    related: [{ keyword: 'lichttherapie gevaar', pos: 12 }, { keyword: 'lichttherapie veiligheid', pos: 6 }],
  },
  {
    keyword: 'mvolo lichttherapie', pos: 1, volume: 480, change: 0, ctr: 14.2, clicks: 68,
    url: '/', intent: 'Navigatie',
    history: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    serp: { featuredSnippet: false, peopleAlsoAsk: false, imagePack: false, knowledgePanel: true, shoppingResults: false },
    related: [{ keyword: 'mvolo lamp', pos: 1 }, { keyword: 'mvolo reviews', pos: 3 }],
  },
  {
    keyword: 'SAD lamp kopen', pos: 10, volume: 560, change: 3, ctr: 2.8, clicks: 16,
    url: '/products/sad-lamp', intent: 'Transactioneel',
    history: [16, 15, 14, 13, 12, 11, 11, 10, 10, 10, 10, 10],
    serp: { featuredSnippet: false, peopleAlsoAsk: false, imagePack: false, knowledgePanel: false, shoppingResults: true },
    related: [{ keyword: 'SAD lamp goedkoop', pos: 14 }, { keyword: 'SAD lamp aanbieding', pos: 18 }],
  },
  {
    keyword: 'lichttherapie 10000 lux', pos: 5, volume: 840, change: 1, ctr: 6.4, clicks: 54,
    url: '/products/lichttherapie-lamp-10000-lux', intent: 'Transactioneel',
    history: [7, 7, 6, 6, 5, 5, 5, 5, 5, 5, 5, 5],
    serp: { featuredSnippet: false, peopleAlsoAsk: true, imagePack: true, knowledgePanel: false, shoppingResults: true },
    related: [{ keyword: 'lux waarde lichttherapie', pos: 8 }, { keyword: '10000 lux lamp', pos: 4 }],
  },
  {
    keyword: 'daglicht simulatie lamp', pos: 22, volume: 240, change: 5, ctr: 0.6, clicks: 1,
    url: '/products/daglichtlamp', intent: 'Transactioneel',
    history: [30, 29, 28, 27, 26, 25, 24, 24, 23, 22, 22, 22],
    serp: { featuredSnippet: false, peopleAlsoAsk: false, imagePack: false, knowledgePanel: false, shoppingResults: false },
    related: [{ keyword: 'daglicht simulatie', pos: 18 }],
  },
  {
    keyword: 'lichttherapie voordelen', pos: 7, volume: 1600, change: -2, ctr: 4.2, clicks: 67,
    url: '/blog/lichttherapie-voordelen', intent: 'Informatief',
    history: [5, 5, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7],
    serp: { featuredSnippet: true, peopleAlsoAsk: true, imagePack: false, knowledgePanel: false, shoppingResults: false },
    related: [{ keyword: 'lichttherapie effect', pos: 11 }, { keyword: 'lichttherapie resultaat', pos: 9 }],
  },
  {
    keyword: 'natuurlijk daglicht lamp', pos: 24, volume: 180, change: 3, ctr: 0.5, clicks: 1,
    url: '/products/daglichtlamp', intent: 'Transactioneel',
    history: [30, 29, 28, 27, 26, 26, 25, 25, 25, 24, 24, 24],
    serp: { featuredSnippet: false, peopleAlsoAsk: false, imagePack: false, knowledgePanel: false, shoppingResults: false },
    related: [{ keyword: 'natuurlijk licht simulatie', pos: 19 }],
  },
];

const POS_FILTERS = [
  { key: 'all',   label: 'Alle'   },
  { key: 'top3',  label: 'Top 3'  },
  { key: 'top10', label: 'Top 10' },
  { key: 'top20', label: 'Top 20' },
  { key: 'top50', label: 'Top 50' },
  { key: '50+',   label: '50+'    },
];

const INTENT_FILTERS: { key: string; label: Intent | 'Alle' }[] = [
  { key: 'all',          label: 'Alle'          },
  { key: 'Informatief',  label: 'Informatief'   },
  { key: 'Transactioneel', label: 'Transactioneel' },
  { key: 'Commercieel',  label: 'Commercieel'   },
  { key: 'Navigatie',    label: 'Navigatie'     },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function PosBadge({ pos }: { pos: number }) {
  if (pos <= 3)  return <span className="inline-flex items-center justify-center w-7 h-5 rounded text-[11px] font-semibold bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400">{pos}</span>;
  if (pos <= 10) return <span className="inline-flex items-center justify-center w-7 h-5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">{pos}</span>;
  if (pos <= 20) return <span className="inline-flex items-center justify-center w-7 h-5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-500">{pos}</span>;
  return <span className="inline-flex items-center justify-center w-7 h-5 rounded text-[11px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">{pos}</span>;
}

const INTENT_STYLES: Record<Intent, string> = {
  Informatief:    'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
  Transactioneel: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
  Commercieel:    'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-500',
  Navigatie:      'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400',
};

function IntentBadge({ intent }: { intent: Intent }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${INTENT_STYLES[intent]}`}>
      {intent}
    </span>
  );
}

function SerpItem({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {active
        ? <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
        : <XCircle size={12} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
      }
      <span className={`text-xs ${active ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'}`}>{label}</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function KeywordsPage() {
  const [search, setSearch]           = useState('');
  const [posFilter, setPosFilter]     = useState('all');
  const [intentFilter, setIntentFilter] = useState('all');
  const [sortBy, setSortBy]           = useState('pos');
  const [expandedKw, setExpandedKw]   = useState<string | null>(null);
  const isDark = useIsDark();

  const tooltipStyle = {
    background:   isDark ? '#1f2937' : '#ffffff',
    border:       isDark ? '1px solid #374151' : '1px solid #e5e7eb',
    borderRadius: '8px',
    color:        isDark ? '#f3f4f6' : '#111827',
    fontSize:     '12px',
  };
  const gridStroke = isDark ? '#374151' : '#e5e7eb';
  const tickColor  = isDark ? '#9CA3AF' : '#6b7280';

  const filtered = useMemo(() => {
    let data = [...ALL_KEYWORDS];
    if (search) data = data.filter(k => k.keyword.toLowerCase().includes(search.toLowerCase()));
    if (posFilter === 'top3')  data = data.filter(k => k.pos <= 3);
    if (posFilter === 'top10') data = data.filter(k => k.pos <= 10);
    if (posFilter === 'top20') data = data.filter(k => k.pos <= 20);
    if (posFilter === 'top50') data = data.filter(k => k.pos <= 50);
    if (posFilter === '50+')   data = data.filter(k => k.pos > 50);
    if (intentFilter !== 'all') data = data.filter(k => k.intent === intentFilter);
    if (sortBy === 'pos')    data.sort((a, b) => a.pos - b.pos);
    if (sortBy === 'volume') data.sort((a, b) => b.volume - a.volume);
    if (sortBy === 'change') data.sort((a, b) => b.change - a.change);
    if (sortBy === 'clicks') data.sort((a, b) => b.clicks - a.clicks);
    return data;
  }, [search, posFilter, intentFilter, sortBy]);

  const btnCls = (active: boolean) =>
    `px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
      active ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
    }`;

  return (
    <div className="space-y-6">

      {/* Back link */}
      <Link
        href="/seo"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        ← Terug naar SEO Overzicht
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Keyword Analyse</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Alle gerankte keywords in detail</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Totale Keywords',  value: '1.247', sub: 'Getrackt in Google.nl'         },
          { label: 'Gem. Positie',     value: '12,4',  sub: '↑ 2,1 vs vorige maand'         },
          { label: 'Totale Clicks',    value: '8.234', sub: 'Via organische resultaten'      },
          { label: 'Gem. CTR',         value: '3,2%',  sub: 'Boven branchegemiddelde'        },
        ].map(kpi => (
          <div
            key={kpi.label}
            className="bg-white dark:bg-gray-900 rounded-lg p-4 flex flex-col gap-2 border border-gray-100 dark:border-gray-800"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
          >
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">{kpi.label}</span>
            <span className="text-[22px] font-bold text-gray-900 dark:text-white leading-tight">{kpi.value}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Zoek keyword…"
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </div>
          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
          >
            <option value="pos">Sorteer: Positie</option>
            <option value="volume">Sorteer: Volume</option>
            <option value="change">Sorteer: Verandering</option>
            <option value="clicks">Sorteer: Clicks</option>
          </select>
        </div>

        {/* Pos + Intent filters (horizontal scroll on mobile) */}
        <div className="overflow-x-auto pb-0.5">
          <div className="flex items-center gap-2 min-w-max">
            <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {POS_FILTERS.map(f => (
                <button key={f.key} onClick={() => setPosFilter(f.key)} className={btnCls(posFilter === f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {INTENT_FILTERS.map(f => (
                <button key={f.key} onClick={() => setIntentFilter(f.key)} className={btnCls(intentFilter === f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Keywords table */}
      <div
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Keywords</h2>
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            {filtered.length} van 1.247
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left font-medium w-8">#</th>
                <th className="px-4 py-2.5 text-left font-medium">Keyword</th>
                <th className="px-4 py-2.5 text-center font-medium">Pos.</th>
                <th className="px-4 py-2.5 text-right font-medium">Volume</th>
                <th className="px-4 py-2.5 text-center font-medium">+/−</th>
                <th className="px-4 py-2.5 text-right font-medium">CTR</th>
                <th className="px-4 py-2.5 text-right font-medium">Clicks</th>
                <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">URL</th>
                <th className="px-4 py-2.5 text-left font-medium">Intent</th>
                <th className="px-4 py-2.5 text-center font-medium hidden lg:table-cell">Trend</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((kw, i) => (
                <React.Fragment key={kw.keyword}>
                  {/* Main row */}
                  <tr
                    onClick={() => setExpandedKw(expandedKw === kw.keyword ? null : kw.keyword)}
                    className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors cursor-pointer select-none"
                  >
                    <td className="px-4 py-2.5 text-gray-400 dark:text-gray-600">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-900 dark:text-gray-100 max-w-[180px] truncate block">{kw.keyword}</span>
                        {expandedKw === kw.keyword
                          ? <ChevronUp size={12} className="text-gray-400 flex-shrink-0" />
                          : <ChevronDown size={12} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
                        }
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center"><PosBadge pos={kw.pos} /></td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">
                      {kw.volume.toLocaleString('nl-NL')}
                    </td>
                    <td className="px-4 py-2.5 text-center tabular-nums">
                      {kw.change > 0
                        ? <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400"><ArrowUpRight size={10} />{kw.change}</span>
                        : kw.change < 0
                        ? <span className="inline-flex items-center gap-0.5 text-red-500 dark:text-red-400"><ArrowDownRight size={10} />{Math.abs(kw.change)}</span>
                        : <span className="text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{kw.ctr}%</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">{kw.clicks.toLocaleString('nl-NL')}</td>
                    <td className="px-4 py-2.5 hidden sm:table-cell max-w-[160px]">
                      <span className="block truncate text-gray-400 dark:text-gray-600">{kw.url}</span>
                    </td>
                    <td className="px-4 py-2.5"><IntentBadge intent={kw.intent} /></td>
                    <td className="px-4 py-2.5 text-center hidden lg:table-cell">
                      {kw.change > 2
                        ? <span className="text-green-500 font-bold">↑↑</span>
                        : kw.change > 0
                        ? <span className="text-green-400">↑</span>
                        : kw.change < -1
                        ? <span className="text-red-400">↓↓</span>
                        : kw.change < 0
                        ? <span className="text-red-300">↓</span>
                        : <span className="text-gray-400">→</span>
                      }
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expandedKw === kw.keyword && (
                    <tr className="bg-gray-50 dark:bg-gray-800/40">
                      <td colSpan={10} className="px-4 py-4">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                          {/* Position history chart */}
                          <div className="lg:col-span-1">
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                              Positie Geschiedenis (12 weken)
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-600 mb-1">Lager = beter</p>
                            <div className="h-[120px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={kw.history.map((pos, idx) => ({ week: `W${idx + 1}`, pos }))}
                                  margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                                  <XAxis dataKey="week" tick={{ fill: tickColor, fontSize: 9 }} axisLine={false} tickLine={false} interval={2} />
                                  <YAxis
                                    tick={{ fill: tickColor, fontSize: 9 }}
                                    axisLine={false}
                                    tickLine={false}
                                    domain={['dataMax + 2', 1]}
                                    reversed={true}
                                    width={24}
                                  />
                                  <Tooltip contentStyle={tooltipStyle} />
                                  <Line type="monotone" dataKey="pos" name="Positie" stroke="#3B82F6" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* SERP features */}
                          <div>
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                              SERP Kenmerken
                            </p>
                            <div className="space-y-1.5">
                              <SerpItem label="Featured Snippet"  active={kw.serp.featuredSnippet}  />
                              <SerpItem label="People Also Ask"   active={kw.serp.peopleAlsoAsk}    />
                              <SerpItem label="Image Pack"        active={kw.serp.imagePack}         />
                              <SerpItem label="Knowledge Panel"   active={kw.serp.knowledgePanel}    />
                              <SerpItem label="Shopping Results"  active={kw.serp.shoppingResults}   />
                            </div>
                          </div>

                          {/* Related keywords */}
                          <div>
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                              Gerelateerde Keywords
                            </p>
                            <div className="space-y-1.5">
                              {kw.related.map(r => (
                                <div key={r.keyword} className="flex items-center justify-between gap-3">
                                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{r.keyword}</span>
                                  <PosBadge pos={r.pos} />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Toon 1–{filtered.length} van 1.247 keywords</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, '…', 50].map((p, i) => (
              <button
                key={i}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                  p === 1 ? 'bg-blue-600 text-white font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
