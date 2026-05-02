'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { name: 'Dashboard', href: '/', icon: '◉' },
  { name: 'Alle Orders', href: '/orders', icon: '▦' },
  { name: 'Customer Journey', href: '/journey', icon: '⟿' },
  { name: 'Geo', href: '/geo', icon: '◎' },
  { name: 'Attributie', href: '/attributie', icon: '◎' },
  { name: 'Voorraad', href: '/inventory', icon: '▣' },
  { name: 'Email', href: '/email-hub', icon: '✉' },
  { name: 'Prijzen', href: '/prijzen', icon: '€' },
  { name: 'Cohort', href: '/cohort', icon: ' Aberdeen' },
  { name: 'Strategie', href: '/strategie', icon: '⊕' },
  { name: 'Finance', href: '/finance', icon: '◈' },
  { name: 'Competitors', href: '/competitor-prices', icon: '⇔' },
  { name: 'Feed Suite', href: '/feed', icon: '≡' },
];

export default function Sidebar({ darkMode, toggleDarkMode }: { darkMode: boolean; toggleDarkMode: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="w-60 min-h-screen bg-[#1F2937] flex flex-col text-white shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <h1 className="text-lg font-bold tracking-tight">Mvolo</h1>
        <p className="text-[10px] text-gray-400 uppercase tracking-widest">Dashboard</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-[#3B82F6] text-white font-semibold'
                  : 'text-gray-300 hover:bg-[#374151] hover:text-white'
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Dark Mode Toggle */}
      <div className="px-5 py-4 border-t border-white/10">
        <button
          onClick={toggleDarkMode}
          className="flex items-center justify-between w-full text-sm text-gray-300"
        >
          <span>Dark Mode</span>
          <div className={`w-10 h-5 rounded-full transition-colors ${darkMode ? 'bg-[#3B82F6]' : 'bg-gray-600'} relative`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
        </button>
      </div>
    </aside>
  );
}