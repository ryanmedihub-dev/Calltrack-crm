'use client';
import { useState } from 'react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../../../lib/api';
import CallTypeBadge from '../../../../components/CallTypeBadge';
import Pagination from '../../../../components/Pagination';

const DURATION_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' }
];

export default function ClientReportsPage() {
  const [phone, setPhone] = useState('');
  const [duration, setDuration] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [page, setPage] = useState(1);
  const [historyData, setHistoryData] = useState(null);

  const fetchReport = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const res = await api.get('/api/reports/client', { params: { phone: phone.trim(), duration, tab: 'summary' } });
      setData(res.data.data);
      setActiveTab('summary');
      setPage(1);
      setHistoryData(null);
    } catch {}
    finally { setLoading(false); }
  };

  const fetchHistory = async (p = 1) => {
    try {
      const res = await api.get('/api/reports/client', { params: { phone: phone.trim(), duration, tab: 'history', page: p, limit: 50 } });
      setHistoryData(res.data.data);
    } catch {}
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'history') fetchHistory(1);
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-textPrimary">Client Reports</h2>

      {/* Search bar */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-textMuted text-xs font-medium mb-1">Select Duration</label>
          <select value={duration} onChange={(e) => setDuration(e.target.value)}
            className="bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-w-36">
            {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-textMuted text-xs font-medium mb-1">Search By (Phone Number)</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchReport()}
            placeholder="Enter phone number…"
            className="w-full bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted" />
        </div>
        <button onClick={fetchReport} disabled={loading || !phone.trim()}
          className="bg-warning text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-orange-600 disabled:opacity-60 transition-colors">
          {loading ? 'Loading…' : 'Get Report'}
        </button>
      </div>

      {data && (
        <>
          {/* Client header */}
          <div className="flex items-center gap-2">
            <span className="text-xs bg-orange-50 border border-orange-200 text-warning px-3 py-1 rounded-full font-semibold">
              📅 {DURATION_OPTIONS.find(o => o.value === duration)?.label} &nbsp;·&nbsp; Client: {data.phone}
            </span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            {[{ key: 'summary', label: 'Summary' }, { key: 'history', label: 'Call History' }].map((tab) => (
              <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                className={`px-4 py-2.5 text-xs font-semibold transition-all border-b-2 -mb-px ${
                  activeTab === tab.key ? 'border-warning text-warning' : 'border-transparent text-textSecondary hover:text-textPrimary'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'summary' && <ClientSummaryTab data={data} />}
          {activeTab === 'history' && (
            <ClientHistoryTab
              data={historyData}
              page={page}
              onPage={(p) => { setPage(p); fetchHistory(p); }}
            />
          )}
        </>
      )}

      {!data && !loading && (
        <div className="bg-white rounded-2xl border border-border shadow-card flex flex-col items-center justify-center h-64 text-textMuted">
          <span className="text-4xl mb-3">👤</span>
          <p className="text-sm">Enter a phone number and click Get Report</p>
        </div>
      )}
    </div>
  );
}

function ClientSummaryTab({ data }) {
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
                  <td className={`px-5 py-3 font-semibold ${row.color}`}>{row.label}</td>
                  <td className="px-5 py-3 text-right font-bold text-textPrimary">{summary[row.key]?.calls || 0}</td>
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

        {/* Right column: sidebar stats + pie */}
        <div className="space-y-4">
          {sidebarStats && (
            <div className="bg-white rounded-2xl border border-border shadow-card p-4 space-y-2">
              {[
                { label: 'Never Attended', val: sidebarStats.neverAttended },
                { label: 'Not Pickup by Client', val: sidebarStats.notPickupByClient },
                { label: 'Connected Calls', val: sidebarStats.connectedCalls }
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                  <span className="text-textMuted text-xs">{label}</span>
                  <span className="text-textPrimary font-bold">{val ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
          {pieData?.length > 0 && (
            <div className="bg-white rounded-2xl border border-border shadow-card p-4">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Employee Summary */}
      {employeeSummary?.length > 0 && (
        <div>
          <h3 className="text-textPrimary font-semibold text-sm mb-3">Employee Summary</h3>
          <div className="bg-white rounded-2xl border border-border shadow-card overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 800 }}>
              <thead>
                <tr className="bg-bg border-b border-border text-textMuted text-xs font-semibold uppercase">
                  <th className="px-4 py-3 text-left">Sr.</th>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Duration</th>
                  <th className="px-4 py-3 text-right">Connected</th>
                  <th className="px-4 py-3 text-right text-success">In</th>
                  <th className="px-4 py-3 text-right text-success">In Conn.</th>
                  <th className="px-4 py-3 text-right text-warning">Out</th>
                  <th className="px-4 py-3 text-right text-warning">Out Conn.</th>
                  <th className="px-4 py-3 text-right text-danger">Missed</th>
                  <th className="px-4 py-3 text-right">Rejected</th>
                  <th className="px-4 py-3 text-right">Never Att.</th>
                  <th className="px-4 py-3 text-right">Not Pickup</th>
                  <th className="px-4 py-3 text-left">Last Sync</th>
                </tr>
              </thead>
              <tbody>
                {employeeSummary.map((e, i) => (
                  <tr key={e.employeeId} className="border-b border-border hover:bg-bg/50">
                    <td className="px-4 py-3 text-textMuted text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="text-textPrimary font-medium text-xs">{e.employeeName}</p>
                      {e.employeePhone && <p className="text-textMuted text-xs">({e.employeePhone})</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-textPrimary">{e.totalCalls}</td>
                    <td className="px-4 py-3 text-right text-textSecondary text-xs">{e.totalDuration}</td>
                    <td className="px-4 py-3 text-right">{e.connectedCalls || 0}</td>
                    <td className="px-4 py-3 text-right text-success">{e.incomingTotal}</td>
                    <td className="px-4 py-3 text-right text-success">{e.incomingConnected}</td>
                    <td className="px-4 py-3 text-right text-warning">{e.outgoingTotal}</td>
                    <td className="px-4 py-3 text-right text-warning">{e.outgoingConnected}</td>
                    <td className="px-4 py-3 text-right text-danger">{e.missed}</td>
                    <td className="px-4 py-3 text-right text-purple">{e.rejected}</td>
                    <td className="px-4 py-3 text-right text-textMuted">{e.neverAttended}</td>
                    <td className="px-4 py-3 text-right text-textMuted">{e.notPickupByClient}</td>
                    <td className="px-4 py-3 text-textMuted text-xs whitespace-nowrap">
                      {e.lastSyncTime ? new Date(e.lastSyncTime).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientHistoryTab({ data, page, onPage }) {
  const calls = data?.calls || [];
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card overflow-x-auto">
      <div className="px-5 py-3 border-b border-border">
        <span className="text-textPrimary font-semibold text-sm">Call History ({data?.total || 0})</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg border-b border-border text-textMuted text-xs font-semibold uppercase">
            <th className="px-4 py-3 text-left">Sr.</th>
            <th className="px-4 py-3 text-left">Employee</th>
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
              <td className="px-4 py-3 text-textMuted text-xs">{(page - 1) * 50 + i + 1}</td>
              <td className="px-4 py-3 text-textSecondary text-xs font-medium">{log.employeeName}</td>
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
              <td className="px-4 py-3 text-textMuted text-xs">{log.notes || '—'}</td>
            </tr>
          ))}
          {!calls.length && (
            <tr><td colSpan={7} className="px-5 py-10 text-center text-textMuted text-sm">No records</td></tr>
          )}
        </tbody>
      </table>
      <div className="px-5 py-3">
        <Pagination page={page} pages={data?.pages || 1} onPage={onPage} />
      </div>
    </div>
  );
}
