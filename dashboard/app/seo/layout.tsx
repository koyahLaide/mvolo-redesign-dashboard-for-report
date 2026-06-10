'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Tags, Users, FileText, Zap, Link2,
  TrendingUp, Globe, Search, Activity, Bell, Wrench,
  ChevronDown, Menu, X, Bot,
} from 'lucide-react';
import { DomainProvider, useDomain } from './domain-context';
import { DOMAINS } from '@/lib/seo/mock-data';

const mainNav = [
  { label: 'Overzicht',    href: '/seo/overview',          icon: LayoutDashboard },
  { label: 'Keywords',     href: '/seo/keywords',          icon: Tags            },
  { label: 'Concurrentie', href: '/seo/competitors',       icon: Users           },
  { label: 'Content',      href: '/seo/content',           icon: FileText        },
  { label: 'Optimaliseer', href: '/seo/optimize',          icon: Zap             },
  { label: 'Backlinks',    href: '/seo/backlinks',         icon: Link2           },
  { label: 'Posities',     href: '/seo/positions',         icon: TrendingUp      },
  { label: 'AI Health',    href: '/seo/ai-agent-health',   icon: Bot             },
];

const geoSubNav = [
  { label: 'Audit',        href: '/seo/geo-aio/audit',        icon: Search   },
  { label: 'Gereedheid',   href: '/seo/geo-aio/readiness',    icon: Activity },
  { label: 'Monitoring',   href: '/seo/geo-aio/monitoring',   icon: Bell     },
  { label: 'Build-Assist', href: '/seo/geo-aio/build-assist', icon: Wrench   },
];

function SeoSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { domain, setDomain } = useDomain();
  const [geoOpen, setGeoOpen] = useState(false);

  useEffect(() => {
    if (pathname.startsWith('/seo/geo-aio')) setGeoOpen(true);
  }, [pathname]);

  function linkClass(href: string) {
    const active = pathname === href || pathname.startsWith(href + '/');
    return active
      ? 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
      : 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors';
  }

  const isGeoActive = pathname.startsWith('/seo/geo-aio');

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          shrink-0 flex flex-col gap-3 w-52
          md:static md:flex md:translate-x-0
          fixed inset-y-0 left-0 z-50 bg-gray-50 dark:bg-gray-950 p-4 overflow-y-auto
          transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:bg-transparent md:p-0
        `}
      >
        {/* Mobile close */}
        <button
          onClick={onClose}
          className="md:hidden self-end p-1.5 rounded text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Domain selector */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
            Domein
          </p>
          <select
            value={domain}
            onChange={e => setDomain(e.target.value)}
            className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DOMAINS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Nav */}
        <nav className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-2 flex flex-col gap-0.5">
          {mainNav.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href} onClick={onClose} className={linkClass(href)}>
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </Link>
          ))}

          {/* GEO/AIO collapsible */}
          <button
            onClick={() => setGeoOpen(o => !o)}
            className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isGeoActive
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
            }`}
          >
            <Globe className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">GEO/AIO</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${geoOpen || isGeoActive ? 'rotate-180' : ''}`}
            />
          </button>

          {(geoOpen || isGeoActive) && (
            <div className="pl-3 pt-0.5 space-y-0.5">
              {geoSubNav.map(({ label, href, icon: Icon }) => (
                <Link key={href} href={href} onClick={onClose} className={linkClass(href)}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}

function SeoLayoutInner({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex gap-5 min-h-full">
      {/* Mobile hamburger — only visible on small screens */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-30 p-2.5 rounded-lg bg-blue-600 text-white shadow-lg"
        aria-label="Open SEO menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <SeoSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Page content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DomainProvider>
      <SeoLayoutInner>{children}</SeoLayoutInner>
    </DomainProvider>
  );
}
