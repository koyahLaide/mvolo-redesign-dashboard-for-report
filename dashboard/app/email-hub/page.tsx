'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import Nav from '../components/Nav';

// Lazy imports van bestaande pagina componenten
import dynamic from 'next/dynamic';
const KlaviyoPage    = dynamic(() => import('../klaviyo/page'),            { ssr: false });
const EmailIntelPage = dynamic(() => import('../email-intelligence/page'), { ssr: false });
const FlowsPage      = dynamic(() => import('../klaviyo-flows/page'),      { ssr: false });

const TABS = [
  { key: 'funnel',       label: '📊 Email Funnel' },
  { key: 'intelligence', label: '⏰ Timing & Advies' },
  { key: 'flows',        label: '🔄 Flows' },
];

function EmailHubContent() {
  const router = useRouter();
  const params = useSearchParams();
  const activeTab = params.get('tab') ?? 'funnel';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center gap-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Mvolo Attribution Dashboard</h1>
            <p className="text-xs text-gray-500 mt-0.5">Email Hub — funnel · timing · flows</p>
          </div>
          <Nav />
        </div>
        <div className="max-w-7xl mx-auto mt-4 flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button key={t.key}
              onClick={() => router.push(`/email-hub?tab=${t.key}`)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === t.key ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <div>
        {activeTab === 'funnel'       && <div className="[&>div:first-child]:hidden"><KlaviyoPage /></div>}
        {activeTab === 'intelligence' && <div className="[&>div:first-child]:hidden"><EmailIntelPage /></div>}
        {activeTab === 'flows'        && <div className="[&>div:first-child]:hidden"><FlowsPage /></div>}
      </div>
    </div>
  );
}

export default function EmailHubPage() {
  return (
    <Suspense>
      <EmailHubContent />
    </Suspense>
  );
}
