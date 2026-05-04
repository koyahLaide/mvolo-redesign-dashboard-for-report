"use client";

import { useState, useEffect, ReactNode } from "react";
import Sidebar from "./Sidebar";

export default function ClientShell({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  useEffect(() => {
    const saved = localStorage.getItem("mvolo-dark-mode") === "true";
    setDarkMode(saved);
    document.documentElement.classList.toggle("dark", saved);
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("mvolo-dark-mode", String(next));
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Mobile overlay backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          flex-shrink-0 transition-all duration-300 ease-in-out h-screen
          fixed inset-y-0 left-0 z-50 w-64
          lg:static lg:z-auto
          ${sidebarOpen
            ? "translate-x-0 lg:w-64 lg:translate-x-0"
            : "-translate-x-full lg:w-0 lg:translate-x-0 lg:overflow-hidden"
          }
        `}
      >
        <Sidebar
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Page content — removed header, adjusted top padding */}
        <div className="flex-1 p-4 sm:p-6 bg-[#F9FAFB] dark:bg-[#111827] overflow-y-auto">
          {children}
        </div>
      </main>

      {/* ── Floating hamburger — only shows when sidebar is closed on mobile ── */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-30 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors lg:hidden"
          aria-label="Open sidebar"
        >
          <svg
            className="w-5 h-5 text-gray-700 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
