'use client';
import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { triggerServerExport } from '../../../../lib/downloads';
import { parseUTC } from '../../../../lib/timezone';
import Pagination from '../../../../components/Pagination';
import {
  StatCard, DataTable, Field, ActiveFilterChips, Ico,
  CalendarIco, DownloadIco, ChevronIco,
} from '../../../../components/report-shared';
import EngagementBadge from '../../../../components/EngagementBadge';
import MultiSelect from '../../../../components/MultiSelect';

const ENGAGEMENT_OPTIONS = [
  ['', 'All Bands'],
  ['NOT_CONNECTED', 'Not Connected'],
  ['LOW', 'Low'],
  ['CONTACTED', 'Contacted'],
  ['ENGAGED', 'Engaged'],
  ['INTERESTED', 'Interested'],
  ['WARM', 'Warm'],
  ['HOT', 'Hot'],
  ['HIGH_ENGAGEMENT', 'High Engagement'],
];

const PrintIco = () => <Ico size={14}><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></Ico>;

function formatDur(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function fmtDate(ts) {
  return parseUTC(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}
function fmtTime(ts) {
  return parseUTC(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

const TYPE_COLORS = {
  incoming: { bg: 'rgba(7,148,85,0.08)', color: '#079455' },
  outgoing: { bg: 'rgba(181,71,8,0.08)', color: '#B54708' },
  missed: { bg: 'rgba(217,45,32,0.08)', color: '#D92D20' },
  rejected: { bg: 'rgba(71,84,103,0.08)', color: '#524F63' },
};

export default function LogsReportPage() {
  const [calls, setCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const today = todayIST();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [callType, setCallType] = useState('');
  const [engagement, setEngagement] = useState('');

  const fetchData = async (p = page, sd = startDate, ed = endDate, ct = callType, eng = engagement) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 25, startDate: sd, endDate: ed };
      if (ct) params.callType = ct;
      if (eng) params.engagement = eng;
      const [callsRes, statsRes] = await Promise.all([
        api.get('/api/calls', { params }),
        api.get('/api/calls/stats'),
      ]);
      setCalls(callsRes.data.data.calls);
      setTotal(callsRes.data.data.total);
      setPages(callsRes.data.data.pages);
      setStats(statsRes.data.data);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page]);

  const applyFilter = () => { setPage(1); fetchData(1, startDate, endDate, callType, engagement); };
  const resetFilter = () => { setStartDate(today); setEndDate(today); setCallType(''); setEngagement(''); setPage(1); fetchData(1, today, today, '', ''); };
  const clearCallType = () => { setCallType(''); setPage(1); fetchData(1, startDate, endDate, '', engagement); };
  const clearEngagement = () => { setEngagement(''); setPage(1); fetchData(1, startDate, endDate, callType, ''); };

  const handleExport = () => {
    // /api/calls/export doesn't parse `engagement` — B7 only wired the filter into the list
    // endpoint (GET /api/calls), so the export intentionally stays unfiltered by band rather
    // than silently ignoring a param the table implies it's honouring.
    const params = { startDate, endDate };
    if (callType) params.callType = callType;
    return triggerServerExport({ endpoint: '/api/calls/export', params, filename: `logs_report_${startDate}_${endDate}.csv` });
  };

  const today_d = stats?.today;
  const summaryStats = [
    { label: 'Total in Range', value: total, color: '#7C3AED' },
    { label: 'Today Total', value: today_d?.totalCalls ?? '—', color: '#1A1726' },
    { label: 'Today Connected', value: today_d?.connectedCalls ?? '—', color: '#079455' },
    { label: 'Today Missed', value: today_d?.missed ?? '—', color: '#D92D20' },
  ];

  const rows = calls.map((log, idx) => ({ ...log, id: log._id, rowNum: (page - 1) * 25 + idx + 1 }));

  return (
    <div className="min-h-screen">
      <div className="space-y-5">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-title">Logs Report</h1>
            <p className="text-xs text-gray-500 mt-0.5">Detailed call log report with full metrics · IST timezone</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              <PrintIco /> Print
            </button>
            <button onClick={handleExport} className="flex items-center gap-2 px-3.5 py-2 bg-[var(--blue)] text-white rounded-lg hover:bg-[var(--blue-600)] transition-colors text-sm font-medium shadow-sm">
              <DownloadIco /> Export CSV
            </button>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {summaryStats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} color={s.color} icon={<CalendarIco s={16} />} />
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <button onClick={() => setFiltersOpen((o) => !o)} className="w-full flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-800">Filters</span>
              <span className="text-xs text-gray-500">{startDate} – {endDate}</span>
            </div>
            <ChevronIco open={filtersOpen} />
          </button>

          {filtersOpen && (
            <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="From Date">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><CalendarIco s={14} /></span>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
                  </div>
                </Field>
                <Field label="To Date">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><CalendarIco s={14} /></span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
                  </div>
                </Field>
                <Field label="Call Type">
                  <MultiSelect value={callType} onChange={setCallType} placeholder="All types" noun="types" ariaLabel="Call type"
                    options={[['incoming', 'Incoming'], ['outgoing', 'Outgoing'], ['missed', 'Missed'], ['rejected', 'Rejected']]} />
                </Field>
                <Field label="Engagement">
                  <MultiSelect value={engagement} onChange={setEngagement} placeholder="All bands" noun="bands" ariaLabel="Engagement"
                    options={ENGAGEMENT_OPTIONS.filter(([v]) => v)} />
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-100">
                <div className="flex gap-2 ml-auto">
                  <button onClick={resetFilter} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                    Reset
                  </button>
                  <button onClick={applyFilter} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <ActiveFilterChips
          filters={{ callType, engagement }}
          labels={{ callType: 'Type', engagement: 'Engagement' }}
          onClear={(key) => (key === 'engagement' ? clearEngagement() : clearCallType())}
          onClearAll={() => { clearCallType(); clearEngagement(); }}
        />

        {/* ── Report table ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Call Records</h3>
              <p className="text-xs text-gray-500 mt-0.5">{total.toLocaleString()} records · {startDate} to {endDate}</p>
            </div>
          </div>

          <DataTable
            loading={loading}
            pageSize={25}
            emptyTitle="No records found for this date range"
            columns={[
              { key: 'rowNum', label: '#', align: 'left', sortable: false, searchable: false, render: (r) => <span className="text-gray-300">{r.rowNum}</span> },
              { key: 'date', label: 'Date (IST)', searchable: false, render: (r) => fmtDate(r.timestamp) },
              { key: 'time', label: 'Time (IST)', searchable: false, render: (r) => fmtTime(r.timestamp) },
              {
                key: 'employeeName', label: 'Agent',
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0 bg-blue-600">
                      {(r.employeeName || '?')[0].toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-gray-900">{r.employeeName}</span>
                  </div>
                ),
              },
              { key: 'contactName', label: 'Contact', render: (r) => (r.contactName && r.contactName !== 'Unknown' ? r.contactName : '—') },
              { key: 'contactNumber', label: 'Number', render: (r) => <span className="tabular-nums text-gray-600">{r.contactNumber}</span> },
              {
                key: 'callType', label: 'Type', searchable: false,
                render: (r) => (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize"
                    style={{ background: TYPE_COLORS[r.callType]?.bg || '#F4F3F8', color: TYPE_COLORS[r.callType]?.color || '#6B6880' }}>
                    {r.callType}
                  </span>
                ),
              },
              { key: 'duration', label: 'Duration', align: 'right', searchable: false, render: (r) => <span className={r.duration ? 'text-gray-900' : 'text-gray-300'}>{formatDur(r.duration)}</span> },
              { key: 'engagement', label: 'Engagement', searchable: false, render: (r) => <EngagementBadge engagement={r.engagement} /> },
              { key: 'notes', label: 'Notes', searchable: false, render: (r) => <p className={`truncate max-w-[160px] ${r.notes ? 'text-gray-600' : 'text-gray-300'}`}>{r.notes || '—'}</p> },
            ]}
            rows={rows}
          />
        </div>

        <Pagination page={page} pages={pages} onPage={setPage} />
      </div>
    </div>
  );
}
