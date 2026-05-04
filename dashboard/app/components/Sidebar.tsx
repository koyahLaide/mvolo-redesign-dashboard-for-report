"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Route,
  Globe,
  Link2,
  Package,
  Mail,
  DollarSign,
  Users,
  Lightbulb,
  BarChart3,
  Crosshair,
  ClipboardList,
  RotateCcw,
  CreditCard,
  Sun,
  Moon,
  X,
} from "lucide-react";

interface SidebarProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

/* ── Navigation links matching the real Mvolo routes ── */
const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Alle Orders", icon: ShoppingCart, href: "/orders" },
  { label: "Customer Journey", icon: Route, href: "/journey" },
  { label: "Geo", icon: Globe, href: "/geo" },
  { label: "Attributie", icon: Link2, href: "/attributie" },
  { label: "Voorraad", icon: Package, href: "/inventory" },
  { label: "Email", icon: Mail, href: "/email-hub" },
  { label: "Prijzen", icon: DollarSign, href: "/prijzen" },
  { label: "Cohort", icon: Users, href: "/cohort" },
  { label: "Strategie", icon: Lightbulb, href: "/strategie" },
  { label: "Finance", icon: BarChart3, href: "/finance" },
  { label: "Competitors", icon: Crosshair, href: "/competitor-prices" },
];

const feedSuiteItems = [
  { label: "Orders Feed", icon: ClipboardList, href: "/feed/orders" },
  { label: "Returns Feed", icon: RotateCcw, href: "/feed/returns" },
  { label: "Ad Spend Feed", icon: CreditCard, href: "/feed/ad-spend" },
];

/* ── Component ── */
export default function Sidebar({
  darkMode,
  toggleDarkMode,
  sidebarOpen,
  setSidebarOpen,
}: SidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");
  }

  function linkClass(href: string) {
    return isActive(href)
      ? "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white shadow-sm shadow-blue-600/25"
      : "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors";
  }

  return (
    <div className="h-full bg-white dark:bg-gray-900 flex flex-col border-r border-gray-200 dark:border-gray-800">
      {/* ── Logo area ── */}
      <div className="flex items-center justify-between px-4 h-16 flex-shrink-0">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="text-gray-900 dark:text-white font-bold text-xl">
            Mvolo
          </span>
        </Link>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-white transition-colors"
          aria-label="Sluit sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => {
                // Auto-close sidebar on mobile after navigation
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={linkClass(item.href)}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* ── Feed Suite section ── */}
        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Feed Suite
          </p>
          {feedSuiteItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => {
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={linkClass(item.href)}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* ── Dark Mode Toggle ── */}
        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
          <div className="mx-1 p-3 rounded-lg bg-gray-50 border border-gray-200 dark:bg-gray-950 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 font-medium">
              Appearance
            </p>
            <button
              onClick={toggleDarkMode}
              className="flex items-center justify-between w-full px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <span className={darkMode ? "hidden" : "block"}>
                  <Sun className="w-4 h-4" />
                </span>
                <span className={darkMode ? "block" : "hidden"}>
                  <Moon className="w-4 h-4" />
                </span>
                {darkMode ? "Dark Mode" : "Light Mode"}
              </span>
              {/* Toggle switch */}
              <div
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                  darkMode ? "bg-blue-500" : "bg-gray-300"
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    darkMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
