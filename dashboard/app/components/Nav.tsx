'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/',        label: 'Dashboard' },
  { href: '/orders',  label: 'Alle Orders' },
  { href: '/journey', label: 'Customer Journey' },
  { href: '/geo',       label: 'Geo' },
  { href: '/attributie', label: 'Attributie' },
  { href: '/inventory',  label: 'Voorraad' },
  { href: '/email-hub',   label: 'Email' },
  { href: '/prijzen',      label: 'Prijzen' },
  { href: '/cohort',       label: 'Cohort' },
  { href: '/strategie',    label: 'Strategie' },
  { href: '/finance',             label: 'Finance' },
  { href: '/competitor-prices', label: 'Competitors' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`relative px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
              active ? 'text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            {label}
            {active && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-white rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
