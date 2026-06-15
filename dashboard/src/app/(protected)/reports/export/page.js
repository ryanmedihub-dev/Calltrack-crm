'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';

const HISTORY_KEY = 'calltrack_export_history';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}
function pushHistory(entry) {
  const h = [entry, ...loadHistory()].slice(0, 20);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

function Svg({ children, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const DownloadIco = () => <Svg><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Svg>;
const PhoneIco   = () => <Svg><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Svg>;
const UsersIco   = () => <Svg><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg>;
const ChartIco   = () => <Svg><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></Svg>;
const FileIco    = () => <Svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></Svg>;

const EXPORT_CARDS = [
  {
    id: 'calls',
    title: 'Call Logs',
    desc: 'All call records with duration, type, employee name, and notes.',
    Icon: PhoneIco,
    color: '#1A6BFF',
    bg: '#EFF6FF',
    endpoint: '/api/calls/export',
    filename: 'call_logs',
  },
  {
    id: 'leads',
    title: 'Leads',
    desc: 'Full lead database including status, contact info, and follow-up dates.',
    Icon: UsersIco,
    color: '#10B981',
    bg: '#ECFDF5',
    endpoint: '/api/leads/export',
    filename: 'leads',
  },
  {
    id: 'report_today',
    title: 'Today\'s Report',
    desc: 'Stats summary for today: totals, breakdowns, and top dialers.',
    Icon: ChartIco,
    color: '#F59E0B',
    bg: '#FFFBEB',
    endpoint: null,
    filename: 'report_today',
    buildLocal: async () => {
      const res = await api.get('/api/calls/stats');
      const d = res.data.data?.today;
      if (!d) throw new Error('No data');
      const rows = [
        ['Metric', 'Value'],
        ['Total Calls', d.totalCalls],
        ['Incoming', d.incoming],
        ['Outgoing', d.outgoing],
        ['Missed', d.missed],
        ['Unique Contacts', d.uniqueClients],
        ['Connected Calls', d.connectedCalls],
        ['Total Duration (s)', d.totalDuration],
      ];
      return rows.map(r => r.join(',')).join('\n');
    },
  },
  {
    id: 'report_week',
    title: 'Weekly Report',
    desc: 'This week\'s performance stats across all agents.',
    Icon: FileIco,
    color: '#8B5CF6',
    bg: '#F5F3FF',
    endpoint: null,
    filename: 'report_week',
    buildLocal: async () => {
      const res = await api.get('/api/calls/stats');
      const d = res.data.data?.thisWeek;
      if (!d) throw new Error('No data');
      const rows = [
        ['Metric', 'Value'],
        ['Total Calls', d.totalCalls],
        ['Incoming', d.incoming],
        ['Outgoing', d.outgoing],
        ['Missed', d.missed],
        ['Unique Contacts', d.uniqueClients],
      ];
      return rows.map(r => r.join(',')).join('\n');
    },
  },
];

function downloadBlob(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportCenterPage() {
  const [loading, setLoading]   = useState({});
  const [history, setHistory]   = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  useEffect(() => { setHistory(loadHistory()); }, []);

  const doExport = async (card) => {
    setLoading(prev => ({ ...prev, [card.id]: true }));
    try {
      let csv;
      if (card.buildLocal) {
        csv = await card.buildLocal();
      } else {
        const params = {};
        if (dateFrom) params.from = dateFrom;
        if (dateTo)   params.to   = dateTo;
        const res = await api.get(card.endpoint, { params, responseType: 'text' });
        csv = res.data;
      }
      downloadBlob(csv, card.filename);
      const entry = {
        id:        card.id,
        title:     card.title,
        filename:  `${card.filename}_${new Date().toISOString().slice(0, 10)}.csv`,
        exportedAt: new Date().toISOString(),
        dateFrom:  dateFrom || '—',
        dateTo:    dateTo   || '—',
      };
      pushHistory(entry);
      setHistory(loadHistory());
      toast.success(`${card.title} exported`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      setLoading(prev => ({ ...prev, [card.id]: false }));
    }
  };

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
    toast.success('History cleared');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-textPrimary">Export Center</h2>
        <p className="text-textMuted text-sm mt-0.5">Download call logs, leads, and reports as CSV</p>
      </div>

      {/* Date range filter */}
      <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
        <h3 className="text-sm font-semibold text-textPrimary mb-3">Date Range Filter</h3>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-textMuted font-medium">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-border rounded-xl px-3 py-2 text-sm bg-bg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-textMuted font-medium">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-border rounded-xl px-3 py-2 text-sm bg-bg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <button onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs text-textMuted hover:text-danger transition-colors border border-dashed border-border hover:border-danger px-3 py-2 rounded-xl">
            Clear
          </button>
          <p className="text-xs text-textMuted ml-auto">Leave blank to export all records</p>
        </div>
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {EXPORT_CARDS.map(card => (
          <div key={card.id}
            className="bg-white border border-border rounded-2xl p-5 shadow-card hover:shadow-card-md transition-shadow flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: card.bg, color: card.color }}>
                <card.Icon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-textPrimary">{card.title}</p>
                <p className="text-xs text-textMuted mt-0.5 leading-relaxed">{card.desc}</p>
              </div>
            </div>
            <button
              onClick={() => doExport(card)}
              disabled={loading[card.id]}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
              style={{ background: card.bg, color: card.color, border: `1.5px solid ${card.color}40` }}
            >
              {loading[card.id] ? (
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <DownloadIco />
              )}
              {loading[card.id] ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        ))}
      </div>

      {/* Export history */}
      <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-bold text-textPrimary">Export History</h3>
          {history.length > 0 && (
            <button onClick={clearHistory}
              className="text-xs text-textMuted hover:text-danger transition-colors">
              Clear
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="flex items-center justify-center h-28 text-textMuted text-sm">
            No exports yet — your history will appear here
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg border-b border-border">
                  {['Type', 'Filename', 'Date Range', 'Exported At'].map((h, i) => (
                    <th key={h} className={`px-5 py-3 text-xs font-semibold text-textMuted uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((h, i) => (
                  <tr key={i} className="hover:bg-bg transition-colors">
                    <td className="px-5 py-3 font-medium text-textPrimary">{h.title}</td>
                    <td className="px-5 py-3 text-textSecondary font-mono text-xs">{h.filename}</td>
                    <td className="px-5 py-3 text-textMuted text-xs">{h.dateFrom} → {h.dateTo}</td>
                    <td className="px-5 py-3 text-textMuted text-xs">
                      {new Date(h.exportedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
