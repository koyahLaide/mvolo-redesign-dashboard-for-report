"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
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
  Rss,
  Sun,
  Moon,
  ChevronDown,
  Search,
  FileText,
  Shield,
  Menu,
} from "lucide-react";

interface SidebarProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

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
  { label: "Feed Suite", icon: Rss, href: "/feed" },
];

const seoSubItems = [
  { label: "Keywords", icon: Globe, href: "/seo/keywords" },
  { label: "Concurrentie", icon: Crosshair, href: "/seo/competitors" },
  { label: "Content Audit", icon: FileText, href: "/seo/content" },
  { label: "Technisch", icon: Shield, href: "/seo/technical" },
];

export default function Sidebar({
  darkMode,
  toggleDarkMode,
  sidebarOpen,
  setSidebarOpen,
}: SidebarProps) {
  const pathname = usePathname();
  const [seoOpen, setSeoOpen] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/seo")) {
      setSeoOpen(true);
    }
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/seo") return pathname === "/seo";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function linkClass(href: string) {
    return isActive(href)
      ? "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white shadow-sm shadow-blue-600/25"
      : "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors";
  }

  function handleNavClick() {
    if (window.innerWidth < 1024) setSidebarOpen(false);
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
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
          aria-label="Sluit sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" translate="no">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={handleNavClick}
              className={linkClass(item.href)}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* ── SEO Module (collapsible) ── */}
        <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
          {/* Main SEO link */}
          <Link
            href="/seo"
            onClick={handleNavClick}
            className={linkClass("/seo")}
          >
            <Search className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="flex-1">SEO</span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSeoOpen(!seoOpen);
              }}
              className="p-0.5 rounded hover:bg-white/20 dark:hover:bg-white/10 transition-colors"
              aria-label={seoOpen ? "Sluit SEO menu" : "Open SEO menu"}
            >
              <ChevronDown
                className={`w-4 h-4 text-current transition-transform duration-200 ${
                  seoOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </Link>

          {/* Collapsible sub-items */}
          <div
            className={`overflow-hidden transition-all duration-200 ease-in-out ${
              seoOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="pl-4 pt-1 space-y-0.5">
              {seoSubItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={handleNavClick}
                    className={linkClass(item.href)}
                  >
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
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
