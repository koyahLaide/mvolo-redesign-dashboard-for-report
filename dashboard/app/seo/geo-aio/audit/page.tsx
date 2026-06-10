'use client';

import { useState } from 'react';
import {
  CheckCircle, AlertTriangle, XCircle,
  Loader2, Info, ChevronDown,
} from 'lucide-react';
import { GEO_AUDIT_RESULTS } from '@/lib/seo/mock-data';

type State = 'idle' | 'loading' | 'results';

// ── Score ring ─────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const mid = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="#e5e7eb" strokeWidth="6"
        className="dark:stroke-gray-700" />
      <circle cx={mid} cy={mid} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${mid} ${mid})`}
        className="transition-all duration-700" />
      <text x={mid} y={mid + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={size >= 120 ? 28 : 14} fontWeight="700" fill="currentColor">
        {score}
      </text>
    </svg>
  );
}

// ── Status icon ────────────────────────────────────────────────────────────────

const STATUS_ICON = {
  good:    <CheckCircle   className="w-4 h-4 text-green-500 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
  bad:     <XCircle       className="w-4 h-4 text-red-500   shrink-0" />,
};

const LEVEL_CLS = {
  HIGH:   'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-400',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  LOW:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GeoAuditPage() {
  const [url, setUrl]         = useState('https://mvolo.nl/products/mvolo-pro');
  const [state, setState]     = useState<State>('idle');
  const [expanded, setExpanded] = useState(false);

  function runAudit() {
    setState('loading');
    setTimeout(() => setState('results'), 2000);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">GEO/AIO Audit</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Analyseer hoe goed een pagina presteert voor AI-zoekmachines en GEO-signalen.
        </p>
      </div>

      {/* Input card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Voer URL in voor audit
        </label>
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://mvolo.nl/products/…"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={runAudit}
            disabled={state === 'loading' || !url.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shrink-0"
          >
            {state === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
            {state === 'loading' ? 'Analyseren…' : 'Audit uitvoeren'}
          </button>
        </div>

        {state === 'idle' && (
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1.5">
              <Info className="w-4 h-4 shrink-0" /> Wat wordt er gecontroleerd?
            </p>
            <ul className="text-sm text-blue-700/80 dark:text-blue-300/80 space-y-1 list-disc list-inside">
              <li>Crawlability — laadt de pagina zonder JavaScript?</li>
              <li>Schema — aanwezig en volledig JSON-LD?</li>
              <li>Answer-First — staat het kernantwoord hoog op de pagina?</li>
              <li>Informatiedichtheid — zijn er feiten, maten en specificaties?</li>
              <li>Heading hiërarchie — correcte H1→H2→H3 opbouw?</li>
              <li>Versheid — wanneer werd de pagina voor het laatst bijgewerkt?</li>
            </ul>
          </div>
        )}
      </div>

      {/* Loading */}
      {state === 'loading' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Pagina analyseren…</p>
        </div>
      )}

      {/* Results */}
      {state === 'results' && (
        <div className="space-y-4">
          {/* Composite score */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-5">
            <ScoreRing score={GEO_AUDIT_RESULTS.compositeScore} size={80} />
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                Totaalscore: {GEO_AUDIT_RESULTS.compositeScore}/100
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 break-all">{url}</p>
            </div>
          </div>

          {/* 2×3 checks grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {GEO_AUDIT_RESULTS.checks.map(check => (
              <div
                key={check.name}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                    {check.name}
                  </p>
                  <ScoreRing score={check.score} size={48} />
                </div>
                <div className="flex items-start gap-2">
                  {STATUS_ICON[check.status]}
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {check.message}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Issues expandable */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
            >
              <span>Gevonden problemen ({GEO_AUDIT_RESULTS.issues.length})</span>
              <ChevronDown
                className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              />
            </button>

            {expanded && (
              <div className="divide-y divide-gray-100 dark:divide-gray-700 px-5 pb-4">
                {GEO_AUDIT_RESULTS.issues.map((issue, i) => (
                  <div key={i} className="py-3 flex items-start gap-3">
                    <span className={`mt-0.5 shrink-0 px-2 py-0.5 text-xs font-bold rounded-full ${LEVEL_CLS[issue.level]}`}>
                      {issue.level}
                    </span>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{issue.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
