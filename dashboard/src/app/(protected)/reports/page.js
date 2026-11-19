'use client';
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../lib/api';
import { getAllEmployeesSafe } from '../../../lib/employees';
import Pagination from '../../../components/Pagination';
import { parseUTC } from '../../../lib/timezone';
import MultiSelect from '../../../components/MultiSelect';
import {
  DataTable, Skeleton, EmptyState, Field, ActiveFilterChips, ChartTip, CallBadge, TYPE_META,
  CalendarIco, ChevronIco, GridIco, BarChartTabIco, CalendarTabIco, ClockTabIco,
  NoEntryIco, PhoneTabIco, PersonTabIco, ClipboardIco,
} from '../../../components/report-shared';

const TABS = [
  { key: 'summary', label: 'Summary', icon: <GridIco /> },
  { key: 'analysis', label: 'Analysis', icon: <BarChartTabIco /> },
  { key: 'daywise', label: 'Day-wise', icon: <CalendarTabIco /> },
  { key: 'hourly', label: 'Hourly', icon: <ClockTabIco /> },
  { key: 'neverAttended', label: 'Never Attended', icon: <NoEntryIco /> },
  { key: 'notPickupByClient', label: 'Not Picked Up', icon: <PhoneTabIco /> },
  { key: 'uniqueClients', label: 'Unique Clients', icon: <PersonTabIco /> },
  { key: 'callHistory', label: 'Call History', icon: <ClipboardIco /> },
];

function fmtDate(d) {
  if (!d) return '—';
  return parseUTC(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function fmtTime(d) {
  return parseUTC(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [filters, setFilters] = useState({ startDate: today, endDate: today, employeeId: '', callType: '' });
  const [activeTab, setActiveTab] = useState('summary');
  const [employees, setEmployees] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);

  useEffect(() => { getAllEmployeesSafe(api).then(setEmployees).catch(() => {}); }, []);

  const fetchReport = async (tab = activeTab, p = 1) => {
    setLoading(true);
    try {
      const params = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), tab, page: p, limit: 100 };
      const res = await api.get('/api/reports/periodic', { params });
      setData(res.data.data);
    } catch {}
    finally { setLoading(false); }
  };

  const handleApply = () => { setPage(1); setApplied(true); fetchReport(activeTab, 1); };
  const handleReset = () => { setFilters({ startDate: today, endDate: today, employeeId: '', callType: '' }); setPage(1); setData(null); setApplied(false); };
  const handleTab = (tab) => { setActiveTab(tab); setPage(1); if (applied) fetchReport(tab, 1); };
  const handlePage = (p) => { setPage(p); fetchReport(activeTab, p); };

  const dateLabel = filters.startDate === filters.endDate
    ? fmtDate(filters.startDate)
    : `${fmtDate(filters.startDate)} – ${fmtDate(filters.endDate)}`;

  const employeeName = filters.employeeId ? filters.employeeId.split(',').map((id) => employees.find((e) => e._id === id)?.name || id).join(', ') : undefined;

  return (
    <div className="min-h-screen">
      <div className="space-y-5">

        {/* ── Header ── */}
        <div>
          <h1 className="page-title">Periodic Reports</h1>
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <button onClick={() => setFiltersOpen((o) => !o)} className="w-full flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-800">Filters</span>
              <span className="text-xs text-gray-500">{dateLabel}</span>
            </div>
            <ChevronIco open={filtersOpen} />
          </button>

          <AnimatePresence initial={false}>
            {filtersOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Field label="From Date">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><CalendarIco /></span>
                        <input type="date" className="form-input pl-9" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
                      </div>
                    </Field>
                    <Field label="To Date">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><CalendarIco /></span>
                        <input type="date" className="form-input pl-9" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
                      </div>
                    </Field>
                    <Field label="Employee">
                      <MultiSelect value={filters.employeeId} onChange={(v) => setFilters({ ...filters, employeeId: v })}
                        placeholder="All employees" noun="employees" ariaLabel="Employee" options={employees.map((e) => [e._id, e.name])} />
                    </Field>
                    <Field label="Call Type">
                      <MultiSelect value={filters.callType} onChange={(v) => setFilters({ ...filters, callType: v })}
                        placeholder="All types" noun="types" ariaLabel="Call type" options={[['incoming', 'Incoming'], ['outgoing', 'Outgoing'], ['missed', 'Missed'], ['rejected', 'Rejected']]} />
                    </Field>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-100">
                    <div className="flex gap-2 ml-auto">
                      <button onClick={handleReset} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                        Reset
                      </button>
                      <button onClick={handleApply} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
                        Generate Report
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {applied && (
          <ActiveFilterChips
            filters={{ employee: filters.employeeId ? (employeeName || filters.employeeId) : '', callType: filters.callType }}
            labels={{ employee: 'Employee', callType: 'Type' }}
            onClear={(k) => setFilters((f) => ({ ...f, [k === 'employee' ? 'employeeId' : 'callType']: '' }))}
            onClearAll={handleReset}
          />
        )}

        {/* ── Empty state before Generate ── */}
        {!applied && !loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <EmptyState title="No report generated yet" hint="Select your filters above and click Generate Report to view data." />
          </div>
        )}

        {applied && (
          <>
            {/* ── Tab nav ── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
              <div className="flex gap-1 px-4 py-3 overflow-hidden">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => handleTab(tab.key)}
                    className={`relative px-2 py-3.5 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
 activeTab === tab.key ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
 }`}
                  >
                    <span className={`flex items-center justify-center transition-transform ${activeTab === tab.key ? 'scale-110' : ''}`}>
                      {tab.icon}
                    </span>
                    {tab.label}
                    {activeTab === tab.key && (
                      <motion.span layoutId="reportsTabUnderline" className="absolute left-3 right-3 -bottom-px h-[2.5px] bg-blue-600 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <Skeleton className="h-72 w-full" />
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-5">
                  {data && activeTab === 'summary' && <SummaryTab data={data} />}
                  {data && activeTab === 'analysis' && <AnalysisTab data={data} />}
                  {data && activeTab === 'daywise' && <DaywiseTab data={data} />}
                  {data && activeTab === 'hourly' && <HourlyTab data={data} />}
                  {data && activeTab === 'neverAttended' && <NeverAttendedTab data={data} page={page} onPage={handlePage} />}
                  {data && activeTab === 'notPickupByClient' && <NotPickupTab data={data} page={page} onPage={handlePage} />}
                  {data && activeTab === 'uniqueClients' && <UniqueClientsTab data={data} page={page} onPage={handlePage} />}
                  {data && activeTab === 'callHistory' && <CallHistoryTab data={data} page={page} onPage={handlePage} />}
                </motion.div>
              </AnimatePresence>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Summary ─────────────────────────────────── */
function SummaryTab({ data }) {
  const { summary, sidebarStats, pieData, employeeSummary } = data;
  if (!summary) return null;
  const grandTotal = summary.total?.calls || 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Call Type Breakdown</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 ">
                <th className="text-left pb-2">Call Type</th>
                <th className="text-right pb-2">Calls</th>
                <th className="text-right pb-2">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {['incoming', 'outgoing', 'missed', 'rejected'].map((k) => (
                <tr key={k}>
                  <td className="py-2.5"><CallBadge type={k} /></td>
                  <td className="py-2.5 text-right font-semibold text-gray-900">{summary[k]?.calls || 0}</td>
                  <td className="py-2.5 text-right text-gray-500">{summary[k]?.duration || '—'}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-100">
                <td className="py-2.5 font-bold text-gray-900">Total</td>
                <td className="py-2.5 text-right font-bold text-gray-900">{grandTotal}</td>
                <td className="py-2.5 text-right font-bold text-gray-900">{summary.total?.duration || '—'}</td>
              </tr>
            </tbody>
          </table>

          {sidebarStats && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
              {[
                { label: 'Never Attended', value: sidebarStats.neverAttended, color: '#D92D20' },
                { label: 'Not Pickup by Client', value: sidebarStats.notPickupByClient, color: '#B54708' },
                { label: 'Connected Calls', value: sidebarStats.connectedCalls, color: '#079455' },
                { label: 'Unique Connected', value: sidebarStats.uniqueConnectedCalls, color: '#0E9384' },
                { label: 'Unique Clients', value: sidebarStats.uniqueClients, color: '#524F63' },
                { label: 'Working Hours', value: sidebarStats.workingHours, color: '#B54708' },
              ].map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: s.color }}>{s.value ?? '—'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {pieData?.length > 0 && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Distribution</h3>
            <p className="text-xs text-gray-500 mb-3">Overall split by call type</p>
            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={54} outerRadius={80} paddingAngle={4} dataKey="value">
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: -8 }}>
                <p className="text-2xl font-bold text-gray-900">{grandTotal.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Calls</p>
              </div>
              <div className="flex justify-center gap-4 mt-2 flex-wrap">
                {pieData.map((d, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} /> {d.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {employeeSummary?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Employee Summary</h3>
          <p className="text-xs text-gray-500 mb-3">Per-employee call performance</p>
          <EmployeeSummaryTable rows={employeeSummary} />
        </div>
      )}
    </div>
  );
}

/* ── Analysis ────────────────────────────────── */
function AnalysisTab({ data }) {
  if (!data?.employeeSummary) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-1">Employee Analysis</h3>
      <p className="text-xs text-gray-500 mb-3">Per-employee call performance</p>
      <EmployeeSummaryTable rows={data.employeeSummary} />
    </div>
  );
}

function EmployeeSummaryTable({ rows }) {
  return (
    <DataTable
      rows={rows}
      pageSize={rows.length || 10}
      columns={[
        {
          key: 'employeeName', label: 'Employee', render: (r) => (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: '#7C3AED' }}>
                {(r.employeeName || '?')[0].toUpperCase()}
              </div>
              <span className="font-medium text-gray-900">{r.employeeName}</span>
            </div>
          ),
        },
        { key: 'totalCalls', label: 'Total', align: 'right', searchable: false },
        { key: 'totalDuration', label: 'Duration', align: 'right', searchable: false },
        { key: 'connectedCalls', label: 'Connected', align: 'right', searchable: false, render: (r) => <span className="text-emerald-600 font-semibold">{r.connectedCalls || 0}</span> },
        { key: 'incoming', label: 'In', align: 'right', searchable: false, render: (r) => <span className="text-emerald-600">{r.incoming}</span> },
        { key: 'incomingConnected', label: 'In Conn.', align: 'right', searchable: false, render: (r) => <span className="text-emerald-600">{r.incomingConnected || 0}</span> },
        { key: 'outgoing', label: 'Out', align: 'right', searchable: false, render: (r) => <span className="text-amber-600">{r.outgoing}</span> },
        { key: 'outgoingConnected', label: 'Out Conn.', align: 'right', searchable: false, render: (r) => <span className="text-amber-600">{r.outgoingConnected || 0}</span> },
        { key: 'missed', label: 'Missed', align: 'right', searchable: false, render: (r) => <span className="text-red-600">{r.missed}</span> },
        { key: 'rejected', label: 'Rejected', align: 'right', searchable: false, render: (r) => <span className="text-violet-600">{r.rejected}</span> },
        { key: 'neverAttended', label: 'Never Att.', align: 'right', searchable: false },
        { key: 'notPickupByClient', label: 'Not Pickup', align: 'right', searchable: false },
        { key: 'lastSyncTime', label: 'Last Sync', searchable: false, render: (r) => (r.lastSyncTime ? parseUTC(r.lastSyncTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—') },
      ]}
    />
  );
}

/* ── Day-wise ────────────────────────────────── */
function DaywiseTab({ data }) {
  if (!data?.daywise) return null;
  const rows = data.daywise.map((r) => ({ ...r, id: r.date }));
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Daily Call Volume</h3>
        <p className="text-xs text-gray-500 mb-4">Calls per day, split by type</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.daywise}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F4F3F8" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#A19DB2', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#A19DB2', fontSize: 10 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
            <Tooltip content={<ChartTip />} />
            <Bar dataKey="incoming" fill={TYPE_META.incoming.color} radius={[3, 3, 0, 0]} name="Incoming" />
            <Bar dataKey="outgoing" fill={TYPE_META.outgoing.color} radius={[3, 3, 0, 0]} name="Outgoing" />
            <Bar dataKey="missed" fill={TYPE_META.missed.color} radius={[3, 3, 0, 0]} name="Missed" />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 flex-wrap">
          {[
            { label: 'Incoming', color: TYPE_META.incoming.color },
            { label: 'Outgoing', color: TYPE_META.outgoing.color },
            { label: 'Missed', color: TYPE_META.missed.color },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full" style={{ background: l.color }} /> {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Day-wise Totals</h3>
        <p className="text-xs text-gray-500 mb-3">Daily totals within the selected date range</p>
        <DataTable
          rows={rows}
          pageSize={rows.length || 10}
          columns={[
            { key: 'date', label: 'Date', render: (r) => <span className="font-bold text-gray-900">{r.date}</span> },
            { key: 'totalCalls', label: 'Total', align: 'right', render: (r) => <span className="font-semibold text-blue-600">{r.totalCalls}</span> },
            { key: 'incoming', label: 'Incoming', align: 'right', searchable: false, render: (r) => <span className="text-emerald-600">{r.incoming}</span> },
            { key: 'outgoing', label: 'Outgoing', align: 'right', searchable: false, render: (r) => <span className="text-amber-600">{r.outgoing}</span> },
            { key: 'missed', label: 'Missed', align: 'right', searchable: false, render: (r) => <span className="text-red-600">{r.missed}</span> },
            { key: 'rejected', label: 'Rejected', align: 'right', searchable: false, render: (r) => <span className="text-violet-600">{r.rejected}</span> },
            { key: 'duration', label: 'Duration', align: 'right', searchable: false },
          ]}
        />
      </div>
    </div>
  );
}

/* ── Hourly ──────────────────────────────────── */
function HourlyTab({ data }) {
  if (!data?.hourly) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-1">Hourly Call Distribution</h3>
      <p className="text-xs text-gray-500 mb-4">Call volume by hour (IST)</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data.hourly} barCategoryGap="40%">
          <defs>
            <linearGradient id="hbar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.25} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F4F3F8" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#A19DB2', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#A19DB2', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<ChartTip />} />
          <Bar dataKey="totalCalls" fill="url(#hbar)" radius={[4, 4, 0, 0]} name="Total Calls" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Never Attended ──────────────────────────── */
function NeverAttendedTab({ data, page, onPage }) {
  const records = (data?.records || []).map((r) => ({ ...r, id: r.contactNumber, employeesLabel: (r.employees || []).join(', ') }));
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-900">Never Attended</h3>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-semibold">{data?.total || 0} records</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">Missed calls with zero follow-up outgoing call</p>
      <DataTable
        rows={records}
        pageSize={100}
        emptyTitle="No records"
        columns={[
          { key: 'contactNumber', label: 'Contact Number', render: (r) => <span className="font-medium text-blue-600">{r.contactNumber}</span> },
          { key: 'contactName', label: 'Contact Name' },
          { key: 'missedCount', label: 'Missed Count', align: 'right', searchable: false, render: (r) => <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold">{r.missedCount}×</span> },
          { key: 'lastMissedAt', label: 'Last Missed', searchable: false, render: (r) => (r.lastMissedAt ? `${fmtDate(r.lastMissedAt)} ${fmtTime(r.lastMissedAt)}` : '—') },
          { key: 'employeesLabel', label: 'Employees', searchable: false },
        ]}
      />
      <div className="mt-2"><Pagination page={page} pages={data?.pages || 1} onPage={onPage} /></div>
    </div>
  );
}

/* ── Not Picked Up ───────────────────────────── */
function NotPickupTab({ data, page, onPage }) {
  const records = data?.records || [];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-900">Not Picked Up by Client</h3>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-semibold">{data?.total || 0} records</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">Outbound attempts that went unanswered</p>
      <DataTable
        rows={records}
        pageSize={100}
        emptyTitle="No records"
        columns={[
          { key: 'employeeName', label: 'Employee' },
          { key: 'contactNumber', label: 'Contact Number', render: (r) => <span className="font-medium text-blue-600">{r.contactNumber}</span> },
          { key: 'contactName', label: 'Contact Name' },
          { key: 'date', label: 'Date', searchable: false, render: (r) => fmtDate(r.timestamp) },
          { key: 'time', label: 'Time', searchable: false, render: (r) => fmtTime(r.timestamp) },
        ]}
      />
      <div className="mt-2"><Pagination page={page} pages={data?.pages || 1} onPage={onPage} /></div>
    </div>
  );
}

/* ── Unique Clients ──────────────────────────── */
function UniqueClientsTab({ data, page, onPage }) {
  const records = (data?.records || []).map((r) => ({ ...r, id: r.contactNumber, employeesLabel: (r.employees || []).slice(0, 2).join(', ') }));
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-900">Unique Clients</h3>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">{data?.total || 0}</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">Every distinct client contacted this period</p>
      <DataTable
        rows={records}
        pageSize={100}
        emptyTitle="No records"
        columns={[
          {
            key: 'contactNumber', label: 'Contact', render: (r) => (
              <div><p className="font-medium text-blue-600">{r.contactNumber}</p><p className="text-xs text-gray-500">{r.contactName || ''}</p></div>
            ),
          },
          { key: 'totalCalls', label: 'Total', align: 'right', render: (r) => <span className="font-semibold text-gray-900">{r.totalCalls}</span> },
          { key: 'connectedCalls', label: 'Connected', align: 'right', searchable: false, render: (r) => <span className="text-emerald-600 font-semibold">{r.connectedCalls}</span> },
          { key: 'incoming', label: 'Incoming', align: 'right', searchable: false, render: (r) => <span className="text-emerald-600">{r.incoming}</span> },
          { key: 'outgoing', label: 'Outgoing', align: 'right', searchable: false, render: (r) => <span className="text-amber-600">{r.outgoing}</span> },
          { key: 'missed', label: 'Missed', align: 'right', searchable: false, render: (r) => <span className="text-red-600">{r.missed}</span> },
          { key: 'totalDuration', label: 'Duration', align: 'right', searchable: false },
          { key: 'lastCallAt', label: 'Last Call', searchable: false, render: (r) => (r.lastCallAt ? fmtDate(r.lastCallAt) : '—') },
          { key: 'employeesLabel', label: 'Employees', searchable: false },
        ]}
      />
      <div className="mt-2"><Pagination page={page} pages={data?.pages || 1} onPage={onPage} /></div>
    </div>
  );
}

/* ── Call History ────────────────────────────── */
function CallHistoryTab({ data, page, onPage }) {
  const calls = data?.calls || [];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-900">Call History</h3>
        <span className="text-xs text-gray-500">{calls.length} of {data?.total || 0}</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">Every individual call record</p>
      <DataTable
        rows={calls}
        pageSize={100}
        emptyTitle="No records"
        columns={[
          {
            key: 'employeeName', label: 'Employee', render: (r) => (
              <div><p className="font-medium text-gray-900">{r.employeeName}</p>{r.employeePhone && <p className="text-xs text-gray-500">{r.employeePhone}</p>}</div>
            ),
          },
          { key: 'contactNumber', label: 'Contact', render: (r) => <span className="text-blue-600">{r.contactNumber}</span> },
          { key: 'date', label: 'Date', searchable: false, render: (r) => fmtDate(r.timestamp) },
          { key: 'time', label: 'Time', searchable: false, render: (r) => fmtTime(r.timestamp) },
          { key: 'duration', label: 'Duration', align: 'right', searchable: false, render: (r) => (r.duration ? `${Math.floor(r.duration / 60)}m ${r.duration % 60}s` : '—') },
          { key: 'callType', label: 'Call Type', searchable: false, render: (r) => <CallBadge type={r.callType} /> },
          { key: 'notes', label: 'Notes', searchable: false, render: (r) => r.notes || '—' },
        ]}
      />
      <div className="mt-2"><Pagination page={page} pages={data?.pages || 1} onPage={onPage} /></div>
    </div>
  );
}
