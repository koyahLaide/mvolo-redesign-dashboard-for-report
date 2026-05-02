'use client';

import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('mvolo-dark-mode');
    if (saved === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('mvolo-dark-mode', String(next));
  };

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && (
        <Sidebar darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white dark:bg-[#1F2937] border-b border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between px-6 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-lg cursor-pointer"
          >
            ☰
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">ProfitMetrics</span>
            <div className="w-8 h-8 rounded-full bg-[#3B82F6] text-white flex items-center justify-center text-xs font-bold">
              N
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 bg-[#F9FAFB] dark:bg-[#111827]">
          {children}
        </main>
      </div>
    </div>
  );
}