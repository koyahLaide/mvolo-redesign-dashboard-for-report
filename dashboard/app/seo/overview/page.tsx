'use client';

import { CheckCircle, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import { RANKINGS, HEALTH_SCORE } from '@/lib/seo/mock-data';

function HealthGauge({ score }: { score: number }) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <svg width="160" height="160" viewBox="0 0 160 160">
      <circle cx="80" cy="80" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
      <circle
        cx="80" cy="80" r={radius}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 80 80)"
        className="transition-all duration-700"
      />
      <text x="80" y="74" textAnchor="middle" fontSize="34" fontWeight="700" fill="currentColor">
        {score}
      </text>
      <text x="80" y="96" textAnchor="middle" fontSize="13" fill="#9ca3af">
        / 100
      </text>
    </svg>
  );
}

const RANK_CARDS = [
  { label: 'TOP 1–3',    key: 'top1to3'    as const },
  { label: 'TOP 4–10',   key: 'top4to10'   as const },
  { label: 'TOP 11–25',  key: 'top11to25'  as const },
  { label: 'TOP 25–100', key: 'top25to100' as const },
];

export default function SeoOverviewPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">SEO Overzicht</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Rankingsdistributie &amp; sitegezondheid
        </p>
      </div>

      {/* Rankings Distribution */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Rankingsdistributie
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {RANK_CARDS.map(({ label, key }) => {
            const { count, change } = RANKINGS[key];
            const up = change >= 0;
            return (
              <div
                key={key}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
              >
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  {label}
                </p>
                <p className="text-4xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
                  {count}
                </p>
                <div
                  className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${
                    up ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                  }`}
                >
                  {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  <span>{Math.abs(change)} vs vorige periode</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Laatste verwerking: {RANKINGS.lastProcessed} · Vergelijking: {RANKINGS.comparison}
        </p>
      </section>

      {/* Site Health Score */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-5">
          Sitegezondheidsscore
        </h2>
        <div className="flex flex-col md:flex-row items-start gap-8">
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <HealthGauge score={HEALTH_SCORE.score} />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Gezondheidscore</p>
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div>
              <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                Sterktes
              </h3>
              <ul className="space-y-2.5">
                {HEALTH_SCORE.strengths.map(s => (
                  <li key={s} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Verbeterpunten
              </h3>
              <ul className="space-y-2.5">
                {HEALTH_SCORE.weaknesses.map(w => (
                  <li key={w} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
