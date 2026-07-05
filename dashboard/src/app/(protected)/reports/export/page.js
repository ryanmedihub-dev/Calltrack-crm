'use client';
import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../../lib/api';
import { triggerServerExport, triggerLocalExport } from '../../../../lib/downloads';
import { Field, ChevronIco, DownloadIco, CalendarIco } from '../../../../components/report-shared';

function Ico({ d, s = 20 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const EXPORT_CARDS = [
  {
    id: 'calls', title: 'Call Logs',
    desc: 'All call records with duration, type, employee name, and notes.',
    icon: <Ico d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />,
    extra: <><polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="1.75" fill="none" /><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="1.75" /></>,
    color: '#2563EB', bg: '#EFF6FF',
    endpoint: '/api/calls/export', filename: 'call_logs',
  },
  {
    id: 'leads', title: 'Leads',
    desc: 'Full lead database including status, contact info, and follow-up dates.',
    icon: <Ico d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />,
    color: '#16A34A', bg: '#F0FDF4',
    endpoint: '/api/leads/export', filename: 'leads',
  },
  {
    id: 'report_today', title: "Today's Report",
    desc: 'Stats summary for today: totals, breakdowns, and top dialers.',
    icon: <Ico d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    color: '#D97706', bg: '#FFFBEB',
    endpoint: null, filename: 'report_today',
    buildLocal: async () => {
      const res = await api.get('/api/calls/stats');
      const d = res.data.data?.today;
      if (!d) throw new Error('No data');
      return [
        ['Metric', 'Value'],
        ['Total Calls', d.totalCalls], ['Incoming', d.incoming], ['Outgoing', d.outgoing],
        ['Missed', d.missed], ['Unique Contacts', d.uniqueClients],
        ['Connected Calls', d.connectedCalls], ['Total Duration (s)', d.totalDuration],
      ].map((r) => r.join(',')).join('\n');
    },
  },
  {
    id: 'report_week', title: 'Weekly Report',
    desc: "This week's performance stats across all agents.",
    icon: <Ico d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />,
    color: '#7C3AED', bg: '#F5F3FF',
    endpoint: null, filename: 'report_week',
    buildLocal: async () => {
      const res = await api.get('/api/calls/stats');
      const d = res.data.data?.thisWeek;
      if (!d) throw new Error('No data');
      return [
        ['Metric', 'Value'],
        ['Total Calls', d.totalCalls], ['Incoming', d.incoming], ['Outgoing', d.outgoing],
        ['Missed', d.missed], ['Unique Contacts', d.uniqueClients],
      ].map((r) => r.join(',')).join('\n');
    },
  },
];

export default function ExportCenterPage() {
  const [loadingMap, setLoadingMap] = useState({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);

  const doExport = async (card) => {
    setLoadingMap((p) => ({ ...p, [card.id]: true }));
    const fname = `${card.filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    try {
      if (card.buildLocal) {
        const csv = await card.buildLocal();
        await triggerLocalExport({ label: card.title, filename: fname, csv });
      } else {
        const params = {};
        if (dateFrom) params.startDate = dateFrom;
        if (dateTo) params.endDate = dateTo;
        await triggerServerExport({ endpoint: card.endpoint, params, filename: fname });
      }
    } catch (err) {
      toast.error(err.message === 'No data' ? `No data available for ${card.title}` : 'Export failed');
    } finally {
      setLoadingMap((p) => ({ ...p, [card.id]: false }));
    }
  };

  return (
    <div className="min-h-screen">
      <div className="space-y-5 max-w-4xl">

        {/* Header */}
        <div>
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            Reports <span className="text-gray-300">/</span> <span className="text-gray-500">Export Center</span>
          </p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">Export Center</h1>
        </div>

        {/* Date filter */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <button onClick={() => setFiltersOpen((o) => !o)} className="w-full flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-800">Date Range Filter</span>
              <span className="text-xs text-gray-400">{dateFrom || 'Any date'} – {dateTo || 'today'}</span>
            </div>
            <ChevronIco open={filtersOpen} />
          </button>
          <AnimatePresence initial={false}>
            {filtersOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="From">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><CalendarIco /></span>
                        <input type="date" className="input pl-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                      </div>
                    </Field>
                    <Field label="To">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><CalendarIco /></span>
                        <input type="date" className="input pl-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                      </div>
                    </Field>
                  </div>
                  <p className="text-xs text-gray-400">Leave blank to export all records (applies to Call Logs and Leads only)</p>
                  <div className="flex justify-end pt-2 border-t border-gray-100">
                    <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                      Clear
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Export cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {EXPORT_CARDS.map((card) => (
            <div key={card.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4 hover:border-gray-300 hover:shadow-sm transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: card.bg, color: card.color }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    {card.icon}{card.extra}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{card.title}</p>
                  <p className="text-xs mt-0.5 leading-relaxed text-gray-400">{card.desc}</p>
                </div>
              </div>
              <button onClick={() => doExport(card)} disabled={loadingMap[card.id]}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-70"
                style={{ background: card.bg, color: card.color, border: `1.5px solid ${card.color}40` }}>
                {loadingMap[card.id] ? (
                  <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <DownloadIco />
                )}
                {loadingMap[card.id] ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
          ))}
        </div>

        {/* Downloads Center pointer */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-bold text-sm text-gray-900">Looking for a past export?</p>
            <p className="text-xs mt-0.5 text-gray-400">Every export above is saved for 2 days in the Downloads Center.</p>
          </div>
          <Link href="/downloads" className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
            View Downloads →
          </Link>
        </div>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #E5E7EB;
          font-size: 0.8125rem;
          outline: none;
          background: white;
          transition: border-color 0.15s;
        }
        .input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
      `}</style>
    </div>
  );
}
