'use client';

import { useState, useEffect, Fragment } from 'react';
import {
  CheckCircle, AlertTriangle, XCircle, Clock, RefreshCw,
  Copy, Eye, ChevronDown, ChevronUp, ExternalLink, ArrowUpRight,
  ArrowDownRight, Minus, CheckCheck, X, Bot,
} from 'lucide-react';
import {
  REMEDIATION_QUEUE, CHECK_HISTORY, FAQ_QUESTIONS,
  type RemediationItem, type RemediationType, type QueueStatus,
  type FaqScore, type RunType,
} from '@/lib/seo/mcp-mock-data';

// ── Badge helpers ─────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<RemediationType, string> = {
  kb_new:               'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-400',
  kb_update:            'bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-400',
  kb_fix_urgent:        'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
  content_new:          'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  product_data_gap:     'bg-gray-100   text-gray-600   dark:bg-gray-800      dark:text-gray-400',
  product_data_critical:'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
};

const TYPE_LABELS: Record<RemediationType, string> = {
  kb_new:               'kb_new',
  kb_update:            'kb_update',
  kb_fix_urgent:        'kb_fix_urgent',
  content_new:          'content_new',
  product_data_gap:     'product_data_gap',
  product_data_critical:'product_data_critical',
};

const PRIORITY_STYLES: Record<string, string> = {
  Critical: 'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-400',
  High:     'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Medium:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const STATUS_STYLES: Record<QueueStatus, string> = {
  Pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Approved:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Published: 'bg-blue-100  text-blue-700  dark:bg-blue-900/30  dark:text-blue-400',
  Rejected:  'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-400',
};

const SCORE_STYLES: Record<FaqScore, string> = {
  Pass:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Fail:    'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-400',
};

const REMEDIATION_STYLES: Record<string, string> = {
  'In Queue':  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Published': 'bg-blue-100  text-blue-700  dark:bg-blue-900/30  dark:text-blue-400',
  'N/A':       'bg-gray-100  text-gray-500  dark:bg-gray-800     dark:text-gray-400',
};

function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
}

function ScoreDelta({ curr, prev }: { curr: FaqScore; prev: FaqScore | null }) {
  if (!prev) return <span className="text-gray-400 text-xs">—</span>;
  const ORDER: Record<FaqScore, number> = { Pass: 2, Partial: 1, Fail: 0 };
  const diff = ORDER[curr] - ORDER[prev];
  return (
    <div className="flex items-center gap-1">
      <Badge cls={SCORE_STYLES[prev]}>{prev}</Badge>
      {diff > 0 && <ArrowUpRight className="w-3 h-3 text-green-500 shrink-0" />}
      {diff < 0 && <ArrowDownRight className="w-3 h-3 text-red-500 shrink-0" />}
      {diff === 0 && <Minus className="w-3 h-3 text-gray-400 shrink-0" />}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function OverviewCard({
  title, value, sub, borderColor, icon: Icon, iconColor,
}: {
  title: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  borderColor: string;
  icon: React.ElementType;
  iconColor: string;
}) {
  return (
    <div
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 flex flex-col gap-2"
      style={{ borderLeftWidth: 4, borderLeftColor: borderColor, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: iconColor + '1a' }}>
          <Icon size={14} style={{ color: iconColor }} />
        </div>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">{title}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>
    </div>
  );
}

// ── Remediation detail ────────────────────────────────────────────────────────

function RemediationDetail({ item, onClose }: { item: RemediationItem; onClose: () => void }) {
  const [editContent, setEditContent] = useState(item.generatedImprovement ?? item.fullContent);
  const [actionDone, setActionDone] = useState<'approved' | 'rejected' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [copied, setCopied] = useState(false);

  const isKb = ['kb_new', 'kb_update', 'kb_fix_urgent'].includes(item.type);
  const isContent = item.type === 'content_new';
  const isProduct = item.type === 'product_data_gap' || item.type === 'product_data_critical';

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{item.question}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* KB types: side-by-side diff */}
      {isKb && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Current MCP Response</p>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed min-h-[80px]">
              {item.currentResponse}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Generated Improvement</p>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg p-3 text-xs text-gray-700 dark:text-gray-200 leading-relaxed min-h-[80px]">
              {item.generatedImprovement}
            </div>
          </div>
        </div>
      )}

      {/* KB edit + actions */}
      {isKb && !actionDone && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Edit before approving</p>
          <textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            rows={4}
            className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Destination: <span className="font-medium text-gray-600 dark:text-gray-300">Shopify Knowledge Base &gt; FAQs</span>
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActionDone('approved')}
              className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5 inline mr-1" />Approve
            </button>
            <button
              onClick={() => setActionDone('rejected')}
              className="px-3 py-1.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5 inline mr-1" />Reject
            </button>
            <button
              onClick={() => copy(editContent)}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg transition-colors"
            >
              {copied ? <CheckCheck className="w-3.5 h-3.5 inline mr-1 text-green-500" /> : <Copy className="w-3.5 h-3.5 inline mr-1" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {actionDone === 'rejected' && (
            <div className="space-y-1.5">
              <input
                type="text"
                placeholder="Reason for rejection..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                onClick={() => setActionDone('rejected')}
                className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Confirm Rejection
              </button>
            </div>
          )}
        </div>
      )}

      {isKb && actionDone && (
        <div className={`rounded-lg p-3 text-xs font-medium ${actionDone === 'approved' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
          {actionDone === 'approved' ? '✓ Approved — content will be published to Knowledge Base' : '✕ Rejected — item moved to archived queue'}
        </div>
      )}

      {/* Content new: blog outline */}
      {isContent && item.blogOutline && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.blogOutline.title}</p>
            <div className="space-y-2">
              {item.blogOutline.sections.map((s, i) => (
                <div key={i} className="border-l-2 border-blue-300 dark:border-blue-700 pl-3">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">H2: {s.h2}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.summary}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">FAQ Summary</p>
            <p className="text-xs text-gray-600 dark:text-gray-300">{item.blogOutline.faqSummary}</p>
          </div>
          {!actionDone && (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setActionDone('approved')} className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors">
                <CheckCheck className="w-3.5 h-3.5 inline mr-1" />Approve
              </button>
              <button onClick={() => setActionDone('rejected')} className="px-3 py-1.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 hover:bg-red-200 text-red-700 dark:text-red-400 rounded-lg transition-colors">
                <X className="w-3.5 h-3.5 inline mr-1" />Reject
              </button>
              <button onClick={() => copy(item.blogOutline!.sections.map(s => `## ${s.h2}\n${s.summary}`).join('\n\n'))} className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-600 dark:text-gray-300 rounded-lg transition-colors">
                <Copy className="w-3.5 h-3.5 inline mr-1" />{copied ? 'Copied!' : 'Copy blog outline'}
              </button>
              <button onClick={() => copy(item.blogOutline!.faqSummary)} className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-600 dark:text-gray-300 rounded-lg transition-colors">
                <Copy className="w-3.5 h-3.5 inline mr-1" />Copy FAQ
              </button>
            </div>
          )}
          {actionDone && (
            <div className={`rounded-lg p-3 text-xs font-medium ${actionDone === 'approved' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
              {actionDone === 'approved' ? '✓ Approved — outline sent to content team' : '✕ Rejected — outline archived'}
            </div>
          )}
        </div>
      )}

      {/* Product data: missing fields + fix */}
      {isProduct && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Missing Fields</p>
            <ul className="space-y-1">
              {item.missingFields?.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />{f}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Suggested Fix</p>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {item.suggestedFix}
            </div>
          </div>
          <a
            href="#"
            onClick={e => e.preventDefault()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />Open in Shopify Admin
          </a>
        </div>
      )}
    </div>
  );
}

// ── Tab 1: Dashboard ──────────────────────────────────────────────────────────

function DashboardTab() {
  const [statusFilter, setStatusFilter] = useState<QueueStatus | 'All'>('All');
  const [typeFilter, setTypeFilter] = useState<RemediationType | 'All'>('All');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = REMEDIATION_QUEUE.filter(item => {
    if (statusFilter !== 'All' && item.status !== statusFilter) return false;
    if (typeFilter !== 'All' && item.type !== typeFilter) return false;
    if (search && !item.question.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCount = REMEDIATION_QUEUE.filter(i => i.status === 'Pending').length;
  const pendingReview = REMEDIATION_QUEUE.filter(i => i.status === 'Approved').length;

  const byType = REMEDIATION_QUEUE.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <OverviewCard
          title="FAQ Health Score"
          value={<span className="text-green-600 dark:text-green-400">78%</span>}
          sub={<span className="flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5 text-green-500" /><span className="text-green-600 dark:text-green-400">+5% vs last week</span> · Last run: Jun 8, 2026</span>}
          borderColor="#22c55e"
          icon={CheckCircle}
          iconColor="#22c55e"
        />
        <OverviewCard
          title="Catalog Completeness"
          value={<span className="text-blue-600 dark:text-blue-400">92%</span>}
          sub={<span className="flex items-center gap-1"><ArrowDownRight className="w-3.5 h-3.5 text-red-500" /><span className="text-red-500">-2% vs last week</span> · Last run: Jun 8, 2026</span>}
          borderColor="#3b82f6"
          icon={CheckCircle}
          iconColor="#3b82f6"
        />
        <OverviewCard
          title="Open Remediation Items"
          value={openCount}
          sub={
            <div className="flex flex-wrap gap-1 mt-0.5">
              <Badge cls={TYPE_STYLES.kb_new}>{byType.kb_new ?? 0} kb_new</Badge>
              <Badge cls={TYPE_STYLES.kb_update}>{byType.kb_update ?? 0} kb_update</Badge>
              <Badge cls={TYPE_STYLES.product_data_gap}>{byType.product_data_gap ?? 0} data_gap</Badge>
              <Badge cls={TYPE_STYLES.content_new}>{byType.content_new ?? 0} content</Badge>
            </div>
          }
          borderColor="#f59e0b"
          icon={AlertTriangle}
          iconColor="#f59e0b"
        />
        <OverviewCard
          title="Pending Review"
          value={pendingReview}
          sub={<span className="flex items-center gap-1"><Clock className="w-3 h-3" />Oldest: 3 days ago</span>}
          borderColor="#ef4444"
          icon={Clock}
          iconColor="#ef4444"
        />
      </div>

      {/* Remediation queue */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex-1">Remediation Queue</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as QueueStatus | 'All')}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Published">Published</option>
              <option value="Rejected">Rejected</option>
            </select>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as RemediationType | 'All')}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Types</option>
              <option value="kb_new">kb_new</option>
              <option value="kb_update">kb_update</option>
              <option value="kb_fix_urgent">kb_fix_urgent</option>
              <option value="content_new">content_new</option>
              <option value="product_data_gap">product_data_gap</option>
              <option value="product_data_critical">product_data_critical</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left font-medium">Date</th>
                <th className="px-4 py-2.5 text-left font-medium">Type</th>
                <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Priority</th>
                <th className="px-4 py-2.5 text-left font-medium">Question / Product</th>
                <th className="px-4 py-2.5 text-left font-medium hidden lg:table-cell">Content</th>
                <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Destination</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <Fragment key={item.id}>
                  <tr
                    className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{item.date}</td>
                    <td className="px-4 py-2.5">
                      <Badge cls={TYPE_STYLES[item.type]}>{TYPE_LABELS[item.type]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      <Badge cls={PRIORITY_STYLES[item.priority]}>{item.priority}</Badge>
                    </td>
                    <td className="px-4 py-2.5 max-w-[180px]">
                      <span className="block truncate font-medium text-gray-800 dark:text-gray-200">{item.question}</span>
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell max-w-[200px]">
                      <span className="block truncate text-gray-500 dark:text-gray-400">
                        {item.contentSnippet.substring(0, 80)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-gray-500 dark:text-gray-400 whitespace-nowrap">{item.destination}</td>
                    <td className="px-4 py-2.5">
                      <Badge cls={STATUS_STYLES[item.status]}>{item.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                          className="px-2 py-1 rounded text-[11px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-0.5"
                        >
                          <Eye className="w-3 h-3" />View
                          {expandedId === item.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={() => navigator.clipboard.writeText(item.fullContent)}
                          className="px-2 py-1 rounded text-[11px] font-medium bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <RemediationDetail item={item} onClose={() => setExpandedId(null)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                    No items match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Sparkline bar chart ────────────────────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-6 w-20">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm opacity-80"
          style={{ height: `${Math.max(3, (v / max) * 24)}px`, backgroundColor: color }}
        />
      ))}
    </div>
  );
}

// ── Tab 2: Check History ──────────────────────────────────────────────────────

function HistoryTab() {
  const [typeFilter, setTypeFilter] = useState<RunType | 'All'>('All');

  const filtered = CHECK_HISTORY.filter(r => typeFilter === 'All' || r.type === typeFilter);

  const faqRates = CHECK_HISTORY.filter(r => r.type === 'FAQ').map(r => r.passRate);
  const catRates = CHECK_HISTORY.filter(r => r.type === 'Catalog').map(r => r.passRate);

  function rateColor(rate: number) {
    if (rate >= 80) return 'text-green-600 dark:text-green-400';
    if (rate >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-500 dark:text-red-400';
  }

  function deltaEl(delta: number | null) {
    if (delta === null) return <span className="text-gray-400">—</span>;
    if (delta === 0) return <span className="text-gray-400 flex items-center gap-0.5"><Minus className="w-3 h-3" />0%</span>;
    return delta > 0
      ? <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />+{delta}%</span>
      : <span className="text-red-500 dark:text-red-400 flex items-center gap-0.5"><ArrowDownRight className="w-3 h-3" />{delta}%</span>;
  }

  return (
    <div className="space-y-5">
      {/* Trend sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 flex items-center gap-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-0.5">FAQ Pass Rate Trend</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{faqRates[0]}%</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Latest run</p>
          </div>
          <Sparkline values={[...faqRates].reverse()} color="#22c55e" />
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 flex items-center gap-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-0.5">Catalog Pass Rate Trend</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{catRates[0]}%</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Latest run</p>
          </div>
          <Sparkline values={[...catRates].reverse()} color="#3b82f6" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex-1">Check Run History</h2>
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {(['All', 'FAQ', 'Catalog'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t as RunType | 'All')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${typeFilter === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left font-medium">Run Date</th>
                <th className="px-4 py-2.5 text-left font-medium">Type</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 text-right font-medium">Pass</th>
                <th className="px-4 py-2.5 text-right font-medium hidden sm:table-cell">Partial</th>
                <th className="px-4 py-2.5 text-right font-medium hidden sm:table-cell">Fail</th>
                <th className="px-4 py-2.5 text-right font-medium">Pass Rate</th>
                <th className="px-4 py-2.5 text-right font-medium hidden md:table-cell">vs Prev</th>
                <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Triggered By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(run => (
                <tr key={run.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">{run.date}</td>
                  <td className="px-4 py-2.5">
                    <Badge cls={run.type === 'FAQ' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}>
                      {run.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{run.totalChecks}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-green-600 dark:text-green-400">{run.pass}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400 hidden sm:table-cell">{run.partial}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-red-500 dark:text-red-400 hidden sm:table-cell">{run.fail}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${rateColor(run.passRate)}`}>{run.passRate}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums hidden md:table-cell">{deltaEl(run.delta)}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <Badge cls={run.triggeredBy === 'Cron' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}>
                      {run.triggeredBy}
                    </Badge>
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

// ── Tab 3: FAQ Details ────────────────────────────────────────────────────────

function FaqTab() {
  const [scoreFilter, setScoreFilter] = useState<FaqScore | 'All'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = FAQ_QUESTIONS.filter(q => scoreFilter === 'All' || q.score === scoreFilter);

  const counts = {
    pass:    FAQ_QUESTIONS.filter(q => q.score === 'Pass').length,
    partial: FAQ_QUESTIONS.filter(q => q.score === 'Partial').length,
    fail:    FAQ_QUESTIONS.filter(q => q.score === 'Fail').length,
  };

  return (
    <div className="space-y-4">
      {/* Summary + filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500 dark:text-gray-400">{FAQ_QUESTIONS.length} questions:</span>
          <Badge cls={SCORE_STYLES.Pass}>{counts.pass} Pass</Badge>
          <Badge cls={SCORE_STYLES.Partial}>{counts.partial} Partial</Badge>
          <Badge cls={SCORE_STYLES.Fail}>{counts.fail} Fail</Badge>
        </div>
        <div className="sm:ml-auto flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {(['All', 'Pass', 'Partial', 'Fail'] as const).map(s => (
            <button
              key={s}
              onClick={() => setScoreFilter(s as FaqScore | 'All')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${scoreFilter === s ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left font-medium">Question</th>
                <th className="px-4 py-2.5 text-left font-medium">Score</th>
                <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Previous</th>
                <th className="px-4 py-2.5 text-left font-medium hidden lg:table-cell">MCP Response</th>
                <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Missing Info</th>
                <th className="px-4 py-2.5 text-left font-medium">Remediation</th>
                <th className="px-4 py-2.5 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => (
                <Fragment key={q.id}>
                  <tr className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-2.5 max-w-[200px]">
                      <span className="block truncate font-medium text-gray-800 dark:text-gray-200">{q.question}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge cls={SCORE_STYLES[q.score]}>{q.score}</Badge>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      <ScoreDelta curr={q.score} prev={q.prevScore} />
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell max-w-[200px]">
                      <span className="block truncate text-gray-500 dark:text-gray-400">{q.mcpResponseSnippet.substring(0, 80)}</span>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell max-w-[180px]">
                      {q.missingInfo
                        ? <span className="block truncate text-amber-600 dark:text-amber-400">{q.missingInfo}</span>
                        : <span className="text-gray-300 dark:text-gray-600">—</span>
                      }
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge cls={REMEDIATION_STYLES[q.remediationStatus]}>{q.remediationStatus}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                        className="px-2 py-1 rounded text-[11px] font-medium bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-0.5"
                      >
                        {expandedId === q.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {expandedId === q.id ? 'Hide' : 'Expand'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === q.id && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Full MCP Response</p>
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                              {q.mcpResponseFull}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Expected Answer</p>
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                              {q.expectedAnswerFull}
                            </div>
                            {q.missingInfo && (
                              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg p-2.5">
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">Missing</p>
                                <p className="text-xs text-amber-700 dark:text-amber-400">{q.missingInfo}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-lg flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
      <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
      <p className="text-sm text-gray-700 dark:text-gray-200">{msg}</p>
      <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'history' | 'faq';

export default function AiAgentHealthPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function runHealthCheck() {
    setRunning(true);
    setTimeout(() => {
      setRunning(false);
      setToast('Health check completed! FAQ: 78% pass rate, Catalog: 92% complete');
    }, 3000);
  }

  const TAB_ITEMS: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'history',   label: 'Check History' },
    { key: 'faq',       label: 'FAQ Details' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI Agent Health Monitor</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">What AI agents see when they query the Mvolo store</p>
            </div>
          </div>
        </div>
        <button
          onClick={runHealthCheck}
          disabled={running}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white rounded-xl transition-colors shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Running check...' : 'Run health check now'}
        </button>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {TAB_ITEMS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'history'   && <HistoryTab />}
      {tab === 'faq'       && <FaqTab />}

      {/* Loading overlay */}
      {running && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 rounded-2xl px-8 py-6 shadow-xl flex items-center gap-4 border border-gray-200 dark:border-gray-700">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Running health check...</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Querying FAQ, catalog &amp; product data</p>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
