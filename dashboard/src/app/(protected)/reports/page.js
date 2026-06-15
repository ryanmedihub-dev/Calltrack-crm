'use client';
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../../../lib/api';
import Pagination from '../../../components/Pagination';
import CallTypeBadge from '../../../components/CallTypeBadge';

const TABS = [
  { key: 'summary', label: 'Summary' },
  { key: 'analysis', label: 'Analysis' },
  { key: 'daywise', label: 'Day-wise Analysis' },
  { key: 'hourly', label: 'Hourly Analysis' },
  { key: 'neverAttended', label: 'Never Attended' },
  { key: 'notPickupByClient', label: 'Not Pickup by Client' },
  { key: 'uniqueClients', label: 'Unique Clients' },
  { key: 'callHistory', label: 'Call History' }
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [filters, setFilters] = useState({
    startDate: today, endDate: today, employeeId: '', callType: ''
  });
  const [activeTab, setActiveTab] = useState('summary');
  const [employees, setEmployees] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/api/employees').then((r) => setEmployees(r.data.data)).catch(() => {});
  }, []);

  const fetchReport = async (tab = activeTab, p = 1) => {
    setLoading(true);
    try {
      const params = {
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
        tab,
        page: p,
        limit: 100
      };
      const res = await api.get('/api/reports/periodic', { params });
      setData(res.data.data);
    } catch {}
    finally { setLoading(false); }
  };

  const handleApply = () => {
    setPage(1);
    fetchReport(activeTab, 1);
  };

  const handleReset = () => {
    const f = { startDate: today, endDate: today, employeeId: '', callType: '' };
    setFilters(f);
    setPage(1);
    setData(null);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
    fetchReport(tab, 1);
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetchReport(activeTab, p);
  };

  const dateLabel = filters.startDate === filters.endDate
    ? new Date(filters.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : `${fmtDate(filters.startDate)} to ${fmtDate(filters.endDate)}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-textPrimary">Periodic Reports</h2>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-textMuted text-xs font-medium mb-1">From Date</label>
            <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
          <div>
            <label className="block text-textMuted text-xs font-medium mb-1">To Date</label>
            <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
          <div>
            <label className="block text-textMuted text-xs font-medium mb-1">Select Employees</label>
            <select value={filters.employeeId} onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
              className="bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
              <option value="">All</option>
              {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-textMuted text-xs font-medium mb-1">Select Call Type</label>
            <select value={filters.callType} onChange={(e) => setFilters({ ...filters, callType: e.target.value })}
              className="bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
              <option value="">All Types</option>
              <option value="incoming">Incoming</option>
              <option value="outgoing">Outgoing</option>
              <option value="missed">Missed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <button onClick={handleApply}
            className="bg-warning text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-orange-600 transition-colors">
            Apply
          </button>
          <button onClick={handleReset}
            className="border border-border text-textMuted text-sm px-4 py-2 rounded-xl hover:border-danger hover:text-danger transition-colors">
            Reset
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* Date label */}
          <div className="flex items-center gap-2">
            <span className="text-xs bg-orange-50 border border-orange-200 text-warning px-3 py-1 rounded-full font-semibold">
              📅 {dateLabel}
            </span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-border pb-0">
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? 'border-warning text-warning'
                    : 'border-transparent text-textSecondary hover:text-textPrimary'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center h-40 text-textMuted text-sm">Loading…</div>
          )}

          {!loading && activeTab === 'summary' && <SummaryTab data={data} />}
          {!loading && activeTab === 'analysis' && <AnalysisTab data={data} />}
          {!loading && activeTab === 'daywise' && <DaywiseTab data={data} />}
          {!loading && activeTab === 'hourly' && <HourlyTab data={data} />}
          {!loading && activeTab === 'neverAttended' && <NeverAttendedTab data={data} page={page} onPage={handlePageChange} />}
          {!loading && activeTab === 'notPickupByClient' && <NotPickupTab data={data} page={page} onPage={handlePageChange} />}
          {!loading && activeTab === 'uniqueClients' && <UniqueClientsTab data={data} page={page} onPage={handlePageChange} />}
          {!loading && activeTab === 'callHistory' && <CallHistoryTab data={data} page={page} onPage={handlePageChange} />}
        </>
      )}

      {!data && !loading && (
        <div className="bg-white rounded-2xl border border-border shadow-card flex flex-col items-center justify-center h-64 text-textMuted">
          <span className="text-4xl mb-3">📊</span>
          <p className="text-sm">Select filters and click Apply to load report</p>
        </div>
      )}
    </div>
  );
}

function SummaryTab({ data }) {
  const { summary, sidebarStats, pieData, employeeSummary } = data;
  if (!summary) return null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Summary table */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-border shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg border-b border-border text-textMuted text-xs font-semibold uppercase">
                <th className="px-5 py-3 text-left">Call Type</th>
                <th className="px-5 py-3 text-right">Calls</th>
                <th className="px-5 py-3 text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Incoming', key: 'incoming', color: 'text-success' },
                { label: 'Outgoing', key: 'outgoing', color: 'text-warning' },
                { label: 'Missed', key: 'missed', color: 'text-danger' },
                { label: 'Rejected', key: 'rejected', color: 'text-purple' }
              ].map((row) => (
                <tr key={row.key} className="border-b border-border hover:bg-bg/50">
                  <td className={`px-5 py-3 font-semibold text-sm ${row.color}`}>{row.label}</td>
                  <td className="px-5 py-3 text-right text-textPrimary font-bold">{summary[row.key]?.calls || 0}</td>
                  <td className="px-5 py-3 text-right text-textSecondary">{summary[row.key]?.duration || '—'}</td>
                </tr>
              ))}
              <tr className="bg-bg font-bold">
                <td className="px-5 py-3 text-textPrimary">Total</td>
                <td className="px-5 py-3 text-right text-textPrimary">{summary.total?.calls || 0}</td>
                <td className="px-5 py-3 text-right text-textSecondary">{summary.total?.duration || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Sidebar stats */}
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-border shadow-card p-4 space-y-3">
            {sidebarStats && Object.entries({
              'Never Attended': sidebarStats.neverAttended,
              'Not Pickup by Client': sidebarStats.notPickupByClient,
              'Connected Calls': sidebarStats.connectedCalls,
              'Unique Connected Calls': sidebarStats.uniqueConnectedCalls,
              'Unique Clients': sidebarStats.uniqueClients,
              'Working Hours': sidebarStats.workingHours
            }).map(([label, val]) => (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                <span className="text-textMuted text-xs">{label}</span>
                <span className="text-textPrimary font-bold text-sm">{val ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pie chart */}
      {pieData?.length > 0 && (
        <div className="bg-white rounded-2xl border border-border shadow-card p-5 max-w-xs">
          <h3 className="text-textPrimary font-semibold text-sm mb-3">Call Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Employee summary */}
      {employeeSummary?.length > 0 && (
        <div>
          <h3 className="text-textPrimary font-semibold text-sm mb-3">Employee Summary</h3>
          <EmployeeSummaryTable rows={employeeSummary} />
        </div>
      )}
    </div>
  );
}

function AnalysisTab({ data }) {
  if (!data?.employeeSummary) return null;
  return (
    <div>
      <h3 className="text-textPrimary font-semibold text-sm mb-3">Employee Analysis</h3>
      <EmployeeSummaryTable rows={data.employeeSummary} />
    </div>
  );
}

function EmployeeSummaryTable({ rows }) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: 900 }}>
        <thead>
          <tr className="bg-bg border-b border-border text-textMuted text-xs font-semibold uppercase">
            <th className="px-4 py-3 text-left">Sr.</th>
            <th className="px-4 py-3 text-left">Employee</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-right">Duration</th>
            <th className="px-4 py-3 text-right">Connected</th>
            <th className="px-4 py-3 text-right text-success">In</th>
            <th className="px-4 py-3 text-right text-success">In Connected</th>
            <th className="px-4 py-3 text-right text-warning">Out</th>
            <th className="px-4 py-3 text-right text-warning">Out Connected</th>
            <th className="px-4 py-3 text-right text-danger">Missed</th>
            <th className="px-4 py-3 text-right">Rejected</th>
            <th className="px-4 py-3 text-right">Never Att.</th>
            <th className="px-4 py-3 text-right">Not Pickup</th>
            <th className="px-4 py-3 text-right">Last Sync</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => (
            <tr key={e.employeeId} className="border-b border-border hover:bg-bg/50">
              <td className="px-4 py-3 text-textMuted text-xs">{i + 1}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primaryLt text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {(e.employeeName || '?')[0].toUpperCase()}
                  </div>
                  <span className="text-textPrimary font-medium text-xs">{e.employeeName}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-bold text-textPrimary">{e.totalCalls}</td>
              <td className="px-4 py-3 text-right text-textSecondary text-xs">{e.totalDuration}</td>
              <td className="px-4 py-3 text-right text-textSecondary">{e.connectedCalls || 0}</td>
              <td className="px-4 py-3 text-right text-success font-medium">{e.incoming}</td>
              <td className="px-4 py-3 text-right text-success">{e.incomingConnected || 0}</td>
              <td className="px-4 py-3 text-right text-warning font-medium">{e.outgoing}</td>
              <td className="px-4 py-3 text-right text-warning">{e.outgoingConnected || 0}</td>
              <td className="px-4 py-3 text-right text-danger font-medium">{e.missed}</td>
              <td className="px-4 py-3 text-right text-purple">{e.rejected}</td>
              <td className="px-4 py-3 text-right text-textMuted">{e.neverAttended}</td>
              <td className="px-4 py-3 text-right text-textMuted">{e.notPickupByClient}</td>
              <td className="px-4 py-3 text-right text-textMuted text-xs">
                {e.lastSyncTime ? new Date(e.lastSyncTime).toLocaleString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DaywiseTab({ data }) {
  if (!data?.daywise) return null;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-border shadow-card p-5">
        <h3 className="text-textPrimary font-semibold text-sm mb-4">Daily Call Volume</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.daywise}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12 }} />
            <Bar dataKey="incoming" fill="#34C759" radius={[3, 3, 0, 0]} name="Incoming" />
            <Bar dataKey="outgoing" fill="#FF9500" radius={[3, 3, 0, 0]} name="Outgoing" />
            <Bar dataKey="missed" fill="#FF3B30" radius={[3, 3, 0, 0]} name="Missed" />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg border-b border-border text-textMuted text-xs font-semibold uppercase">
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3 text-right text-success">Incoming</th>
              <th className="px-5 py-3 text-right text-warning">Outgoing</th>
              <th className="px-5 py-3 text-right text-danger">Missed</th>
              <th className="px-5 py-3 text-right text-purple">Rejected</th>
              <th className="px-5 py-3 text-right">Duration</th>
            </tr>
          </thead>
          <tbody>
            {data.daywise.map((row) => (
              <tr key={row.date} className="border-b border-border hover:bg-bg/50">
                <td className="px-5 py-3 text-textPrimary font-medium">{row.date}</td>
                <td className="px-5 py-3 text-right font-bold text-textPrimary">{row.totalCalls}</td>
                <td className="px-5 py-3 text-right text-success">{row.incoming}</td>
                <td className="px-5 py-3 text-right text-warning">{row.outgoing}</td>
                <td className="px-5 py-3 text-right text-danger">{row.missed}</td>
                <td className="px-5 py-3 text-right text-purple">{row.rejected}</td>
                <td className="px-5 py-3 text-right text-textSecondary">{row.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HourlyTab({ data }) {
  if (!data?.hourly) return null;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-border shadow-card p-5">
        <h3 className="text-textPrimary font-semibold text-sm mb-4">Hourly Call Distribution</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.hourly} barCategoryGap="40%">
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12 }} />
            <Bar dataKey="totalCalls" fill="#1A6BFF" radius={[4, 4, 0, 0]} name="Total Calls" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function NeverAttendedTab({ data, page, onPage }) {
  const records = data?.records || [];
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card overflow-x-auto">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <span className="text-textPrimary font-semibold text-sm">Never Attended ({data?.total || 0})</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg border-b border-border text-textMuted text-xs font-semibold uppercase">
            <th className="px-5 py-3 text-left">Sr.</th>
            <th className="px-5 py-3 text-left">Contact Number</th>
            <th className="px-5 py-3 text-left">Contact Name</th>
            <th className="px-5 py-3 text-right">Missed Count</th>
            <th className="px-5 py-3 text-left">Last Missed</th>
            <th className="px-5 py-3 text-left">Employees</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={r.contactNumber} className="border-b border-border hover:bg-bg/50">
              <td className="px-5 py-3 text-textMuted text-xs">{(page - 1) * 100 + i + 1}</td>
              <td className="px-5 py-3 text-primary font-medium">{r.contactNumber}</td>
              <td className="px-5 py-3 text-textSecondary">{r.contactName}</td>
              <td className="px-5 py-3 text-right">
                <span className="bg-red-50 text-danger border border-red-200 text-xs px-2 py-0.5 rounded-full font-bold">{r.missedCount}</span>
              </td>
              <td className="px-5 py-3 text-textMuted text-xs">{r.lastMissedAt ? new Date(r.lastMissedAt).toLocaleString() : '—'}</td>
              <td className="px-5 py-3 text-textMuted text-xs">{(r.employees || []).join(', ')}</td>
            </tr>
          ))}
          {!records.length && (
            <tr><td colSpan={6} className="px-5 py-10 text-center text-textMuted text-sm">No records</td></tr>
          )}
        </tbody>
      </table>
      <div className="px-5 py-3"><Pagination page={page} pages={data?.pages || 1} onPage={onPage} /></div>
    </div>
  );
}

function NotPickupTab({ data, page, onPage }) {
  const records = data?.records || [];
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card overflow-x-auto">
      <div className="px-5 py-3 border-b border-border">
        <span className="text-textPrimary font-semibold text-sm">Not Pickup by Client ({data?.total || 0})</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg border-b border-border text-textMuted text-xs font-semibold uppercase">
            <th className="px-5 py-3 text-left">Sr.</th>
            <th className="px-5 py-3 text-left">Employee</th>
            <th className="px-5 py-3 text-left">Contact Number</th>
            <th className="px-5 py-3 text-left">Contact Name</th>
            <th className="px-5 py-3 text-left">Date</th>
            <th className="px-5 py-3 text-left">Time</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={r._id} className="border-b border-border hover:bg-bg/50">
              <td className="px-5 py-3 text-textMuted text-xs">{(page - 1) * 100 + i + 1}</td>
              <td className="px-5 py-3 text-textSecondary text-xs">{r.employeeName}</td>
              <td className="px-5 py-3 text-primary font-medium text-xs">{r.contactNumber}</td>
              <td className="px-5 py-3 text-textSecondary text-xs">{r.contactName}</td>
              <td className="px-5 py-3 text-textMuted text-xs">{new Date(r.timestamp).toLocaleDateString('en-GB')}</td>
              <td className="px-5 py-3 text-textMuted text-xs">{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            </tr>
          ))}
          {!records.length && (
            <tr><td colSpan={6} className="px-5 py-10 text-center text-textMuted text-sm">No records</td></tr>
          )}
        </tbody>
      </table>
      <div className="px-5 py-3"><Pagination page={page} pages={data?.pages || 1} onPage={onPage} /></div>
    </div>
  );
}

function UniqueClientsTab({ data, page, onPage }) {
  const records = data?.records || [];
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card overflow-x-auto">
      <div className="px-5 py-3 border-b border-border">
        <span className="text-textPrimary font-semibold text-sm">Unique Clients ({data?.total || 0})</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg border-b border-border text-textMuted text-xs font-semibold uppercase">
            <th className="px-5 py-3 text-left">Sr.</th>
            <th className="px-5 py-3 text-left">Contact</th>
            <th className="px-5 py-3 text-right">Total</th>
            <th className="px-5 py-3 text-right">Connected</th>
            <th className="px-5 py-3 text-right">Incoming</th>
            <th className="px-5 py-3 text-right">Outgoing</th>
            <th className="px-5 py-3 text-right">Missed</th>
            <th className="px-5 py-3 text-right">Duration</th>
            <th className="px-5 py-3 text-left">Last Call</th>
            <th className="px-5 py-3 text-left">Employees</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={r.contactNumber} className="border-b border-border hover:bg-bg/50">
              <td className="px-5 py-3 text-textMuted text-xs">{(page - 1) * 100 + i + 1}</td>
              <td className="px-5 py-3">
                <p className="text-primary font-medium text-xs">{r.contactNumber}</p>
                <p className="text-textMuted text-xs">{r.contactName}</p>
              </td>
              <td className="px-5 py-3 text-right font-bold text-textPrimary">{r.totalCalls}</td>
              <td className="px-5 py-3 text-right text-success">{r.connectedCalls}</td>
              <td className="px-5 py-3 text-right text-success">{r.incoming}</td>
              <td className="px-5 py-3 text-right text-warning">{r.outgoing}</td>
              <td className="px-5 py-3 text-right text-danger">{r.missed}</td>
              <td className="px-5 py-3 text-right text-textSecondary text-xs">{r.totalDuration}</td>
              <td className="px-5 py-3 text-textMuted text-xs">{r.lastCallAt ? new Date(r.lastCallAt).toLocaleDateString('en-GB') : '—'}</td>
              <td className="px-5 py-3 text-textMuted text-xs truncate max-w-32">{(r.employees || []).slice(0, 2).join(', ')}</td>
            </tr>
          ))}
          {!records.length && (
            <tr><td colSpan={10} className="px-5 py-10 text-center text-textMuted text-sm">No records</td></tr>
          )}
        </tbody>
      </table>
      <div className="px-5 py-3"><Pagination page={page} pages={data?.pages || 1} onPage={onPage} /></div>
    </div>
  );
}

function CallHistoryTab({ data, page, onPage }) {
  const calls = data?.calls || [];
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card overflow-x-auto">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <span className="text-textPrimary font-semibold text-sm">Call History ({data?.total || 0})</span>
        <span className="text-textMuted text-xs">Show 100</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg border-b border-border text-textMuted text-xs font-semibold uppercase">
            <th className="px-4 py-3 text-left">Sr.</th>
            <th className="px-4 py-3 text-left">Employee</th>
            <th className="px-4 py-3 text-left">To Number</th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Time</th>
            <th className="px-4 py-3 text-left">Duration</th>
            <th className="px-4 py-3 text-left">Call Type</th>
            <th className="px-4 py-3 text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((log, i) => (
            <tr key={log._id} className="border-b border-border hover:bg-bg/50">
              <td className="px-4 py-3 text-textMuted text-xs">{(page - 1) * 100 + i + 1}</td>
              <td className="px-4 py-3 text-xs">
                <p className="text-textPrimary font-medium">{log.employeeName}</p>
                {log.employeePhone && <p className="text-textMuted">({log.employeePhone})</p>}
              </td>
              <td className="px-4 py-3 text-primary font-medium text-xs">{log.contactNumber}</td>
              <td className="px-4 py-3 text-textMuted text-xs whitespace-nowrap">
                {new Date(log.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </td>
              <td className="px-4 py-3 text-textMuted text-xs whitespace-nowrap">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="px-4 py-3 text-textSecondary text-xs font-medium">
                {log.duration ? `${Math.floor(log.duration/60)}m ${log.duration%60}s` : '—'}
              </td>
              <td className="px-4 py-3"><CallTypeBadge type={log.callType} /></td>
              <td className="px-4 py-3 text-textMuted text-xs max-w-32 truncate">{log.notes || '+ Add Note'}</td>
            </tr>
          ))}
          {!calls.length && (
            <tr><td colSpan={8} className="px-5 py-10 text-center text-textMuted text-sm">No records found</td></tr>
          )}
        </tbody>
      </table>
      <div className="px-5 py-3 flex items-center justify-between">
        <span className="text-textMuted text-xs">1 - {calls.length} of {data?.total || 0}</span>
        <Pagination page={page} pages={data?.pages || 1} onPage={onPage} />
      </div>
    </div>
  );
}
