'use client';

import { Link2, ArrowUpRight, TrendingUp, Shield, ExternalLink } from 'lucide-react';

const BACKLINKS_DATA = [
  { domain: 'gezondheidsplein.nl',   url: 'https://gezondheidsplein.nl/lichttherapie',          da: 62, type: 'Editorial',   anchor: 'lichttherapie lamp',       date: '2 jun 2026',  dofollow: true  },
  { domain: 'thuisarts.nl',          url: 'https://thuisarts.nl/winterdepressie',                da: 71, type: 'Editorial',   anchor: 'mvolo daglichtlamp',       date: '28 mei 2026', dofollow: true  },
  { domain: 'medisch.nl',            url: 'https://medisch.nl/rood-licht-therapie-review',       da: 58, type: 'Review',      anchor: 'rood licht therapie',      date: '21 mei 2026', dofollow: true  },
  { domain: 'consumentenbond.nl',    url: 'https://consumentenbond.nl/lichttherapie-test',       da: 79, type: 'Editorial',   anchor: 'beste lichttherapielamp',  date: '15 mei 2026', dofollow: true  },
  { domain: 'fitnessblog.nl',        url: 'https://fitnessblog.nl/herstel-na-training',          da: 44, type: 'Guest post',  anchor: 'infrarood lamp herstel',   date: '10 mei 2026', dofollow: true  },
  { domain: 'slaapdokter.nl',        url: 'https://slaapdokter.nl/wake-up-light-advies',         da: 51, type: 'Editorial',   anchor: 'wake-up light mvolo',      date: '3 mei 2026',  dofollow: true  },
  { domain: 'huidtherapie.nl',       url: 'https://huidtherapie.nl/led-therapie-thuis',          da: 47, type: 'Editorial',   anchor: 'LED face mask',            date: '27 apr 2026', dofollow: false },
  { domain: 'sportnieuws.nl',        url: 'https://sportnieuws.nl/sporttechnologie',             da: 55, type: 'Mention',     anchor: 'mvolo.nl',                 date: '20 apr 2026', dofollow: true  },
  { domain: 'beautyinsider.nl',      url: 'https://beautyinsider.nl/roodlicht-huid',             da: 39, type: 'Review',      anchor: 'led gezichtsmasker',       date: '14 apr 2026', dofollow: true  },
  { domain: 'gezondeliving.nl',      url: 'https://gezondeliving.nl/infrarood-therapie-thuis',   da: 33, type: 'Guest post',  anchor: 'infrarood therapie thuis', date: '7 apr 2026',  dofollow: true  },
  { domain: 'relaxatieguide.nl',     url: 'https://relaxatieguide.nl/sauna-alternatief',         da: 28, type: 'Mention',     anchor: 'sauna deken mvolo',        date: '1 apr 2026',  dofollow: false },
  { domain: 'biohack.nl',            url: 'https://biohack.nl/rood-licht-protocol',              da: 42, type: 'Editorial',   anchor: 'rood licht paneel',        date: '25 mrt 2026', dofollow: true  },
];

const TYPE_STYLES: Record<string, string> = {
  Editorial:  'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-400',
  Review:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Guest post':'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Mention:    'bg-gray-100   text-gray-600   dark:bg-gray-800      dark:text-gray-400',
};

function daBadge(da: number) {
  if (da >= 60) return 'text-green-600 dark:text-green-400 font-semibold';
  if (da >= 40) return 'text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-gray-600 dark:text-gray-400';
}

export default function BacklinksPage() {
  const totalDA  = Math.round(BACKLINKS_DATA.reduce((s, b) => s + b.da, 0) / BACKLINKS_DATA.length);
  const dofollow = BACKLINKS_DATA.filter(b => b.dofollow).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
          <Link2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Backlinks</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Inkomende links en domeinautoriteit</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Totaal backlinks', value: BACKLINKS_DATA.length, icon: Link2,      color: '#8b5cf6' },
          { label: 'Gem. DA',          value: totalDA,                icon: TrendingUp, color: '#3b82f6' },
          { label: 'Dofollow',         value: dofollow,               icon: Shield,     color: '#22c55e' },
          { label: 'Nieuwe (30d)',     value: 7,                      icon: ArrowUpRight, color: '#f59e0b' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: color + '1a' }}>
                <Icon size={12} style={{ color }} />
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Recente backlinks</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{BACKLINKS_DATA.length} links</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left font-medium">Domein</th>
                <th className="px-4 py-2.5 text-center font-medium">DA</th>
                <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Type</th>
                <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Anchor</th>
                <th className="px-4 py-2.5 text-center font-medium hidden sm:table-cell">Dofollow</th>
                <th className="px-4 py-2.5 text-left font-medium hidden lg:table-cell">Datum</th>
                <th className="px-4 py-2.5 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {BACKLINKS_DATA.map((b) => (
                <tr key={b.url} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{b.domain}</td>
                  <td className={`px-4 py-2.5 text-center tabular-nums ${daBadge(b.da)}`}>{b.da}</td>
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${TYPE_STYLES[b.type] ?? TYPE_STYLES.Mention}`}>
                      {b.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-gray-500 dark:text-gray-400 max-w-[160px]">
                    <span className="block truncate">{b.anchor}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                    {b.dofollow
                      ? <span className="text-green-600 dark:text-green-400 font-medium">✓</span>
                      : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-gray-400 dark:text-gray-500 whitespace-nowrap">{b.date}</td>
                  <td className="px-4 py-2.5">
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />Link
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
