'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../../../lib/api';
import Pagination from '../../../../components/Pagination';
import { parseUTC } from '../../../../lib/timezone';
import {
  DataTable, EmptyState, Field, ChartTip, CallBadge, Truncate, EditableRemarks,
  PhoneIco, GridIco, ClipboardIco,
} from '../../../../components/report-shared';

const DURATION_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
];

const TABS = [
  { key: 'summary', label: 'Summary', icon: <GridIco /> },
  { key: 'history', label: 'Call History', icon: <ClipboardIco /> },
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
      setActiveTab('summary'); setPage(1); setHistoryData(null);
    } catch (err) {
      setData(null);
      toast.error(err.response?.data?.error || 'Failed to load client report');
    }
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

  // Admin edit of a past call's remark. Rethrows on failure so EditableRemarks can roll its
  // optimistic text back rather than leaving a value on screen that never reached the server.
  const saveRemark = async (callId, notes) => {
    try {
      await api.patch(`/api/calls/${callId}/notes`, { notes });
      toast.success('Remark updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update remark');
      throw err;
    }
  };

  return (
    <div className="min-h-screen">
      <div className="space-y-5">

        {/* ── Header ── */}
        <div>
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            Reports <span className="text-gray-300">/</span> <span className="text-gray-500">Client Reports</span>
          </p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">Client Reports</h1>
        </div>

        {/* ── Search ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-3 items-end">
            <Field label="Duration">
              <select className="input" value={duration} onChange={(e) => setDuration(e.target.value)}>
                {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Phone Number">
              <div className="relative">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchReport()}
                  placeholder="Enter phone number…"
                  className="input pl-9"
                />
              </div>
            </Field>
            <button
              onClick={fetchReport}
              disabled={loading || !phone.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed h-[38px]"
            >
              {loading ? 'Loading…' : 'Get Report'}
            </button>
          </div>
        </div>

        {data && data.noResults && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <EmptyState title="No results found" hint={`No calls on record for ${data.phone}. Check the number and try again.`} />
          </div>
        )}

        {data && !data.noResults && (
          <>
            {/* Active search tag */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full border border-blue-100">
                {DURATION_OPTIONS.find((o) => o.value === duration)?.label} · Client: {data.phone}
              </span>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
              <div className="flex gap-1 px-4 py-3 overflow-hidden">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => handleTabChange(tab.key)}
                    className={`relative px-2 py-3.5 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                      activeTab === tab.key ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span className={`flex items-center justify-center transition-transform ${activeTab === tab.key ? 'scale-110' : ''}`}>
                      {tab.icon}
                    </span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'summary' && <ClientSummaryTab data={data} />}
            {activeTab === 'history' && (
              <ClientHistoryTab
                data={historyData}
                page={page}
                onPage={(p) => { setPage(p); fetchHistory(p); }}
                onSaveRemark={saveRemark}
              />
            )}
          </>
        )}

        {!data && !loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <EmptyState title="No client selected" hint="Enter a phone number above and click Get Report." />
          </div>
        )}
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

function ClientSummaryTab({ data }) {
  const { summary, sidebarStats, pieData, employeeSummary } = data;
  if (!summary) return null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Call Type Breakdown</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase">
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
                <td className="py-2.5 text-right font-bold text-gray-900">{summary.total?.calls || 0}</td>
                <td className="py-2.5 text-right font-bold text-gray-900">{summary.total?.duration || '—'}</td>
              </tr>
            </tbody>
          </table>

          {sidebarStats && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
              {[
                { label: 'Never Attended', value: sidebarStats.neverAttended, color: '#DC2626' },
                { label: 'Not Pickup by Client', value: sidebarStats.notPickupByClient, color: '#EA580C' },
                { label: 'Connected Calls', value: sidebarStats.connectedCalls, color: '#16A34A' },
              ].map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: s.color }}>{s.value ?? '—'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {pieData?.length > 0 && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Distribution</h3>
            <p className="text-xs text-gray-400 mb-3">Overall split by call type</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                </Pie>
                <Tooltip content={<ChartTip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2 flex-wrap">
              {pieData.map((d, i) => (
                <span key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-2 h-2 rounded-full" style={{ background: d.color }} /> {d.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {employeeSummary?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Employee Summary</h3>
          <p className="text-xs text-gray-400 mb-3">Per-employee performance for this client</p>
          <DataTable
            rows={employeeSummary}
            pageSize={employeeSummary.length || 10}
            columns={[
              {
                key: 'employeeName', label: 'Employee', render: (r) => (
                  <div>
                    <p className="font-medium text-gray-900"><Truncate text={r.employeeName} /></p>
                    {r.employeePhone && <p className="text-xs text-gray-400">({r.employeePhone})</p>}
                  </div>
                ),
              },
              { key: 'tlName', label: 'TL', render: (r) => r.tlName ? <Truncate text={r.tlName} /> : <span className="text-gray-300">—</span> },
              { key: 'totalCalls', label: 'Total', align: 'right', searchable: false },
              { key: 'totalDuration', label: 'Duration', align: 'right', searchable: false },
              { key: 'connectedCalls', label: 'Connected', align: 'right', searchable: false, render: (r) => <span className="text-emerald-600 font-semibold">{r.connectedCalls || 0}</span> },
              { key: 'incomingTotal', label: 'In', align: 'right', searchable: false, render: (r) => <span className="text-emerald-600">{r.incomingTotal}</span> },
              { key: 'incomingConnected', label: 'In Conn.', align: 'right', searchable: false, render: (r) => <span className="text-emerald-600">{r.incomingConnected}</span> },
              { key: 'outgoingTotal', label: 'Out', align: 'right', searchable: false, render: (r) => <span className="text-amber-600">{r.outgoingTotal}</span> },
              { key: 'outgoingConnected', label: 'Out Conn.', align: 'right', searchable: false, render: (r) => <span className="text-amber-600">{r.outgoingConnected}</span> },
              { key: 'missed', label: 'Missed', align: 'right', searchable: false, render: (r) => <span className="text-red-600">{r.missed}</span> },
              { key: 'rejected', label: 'Rejected', align: 'right', searchable: false, render: (r) => <span className="text-violet-600">{r.rejected}</span> },
              { key: 'neverAttended', label: 'Never Att.', align: 'right', searchable: false },
              { key: 'notPickupByClient', label: 'Not Pickup', align: 'right', searchable: false },
              { key: 'lastSyncTime', label: 'Last Sync', searchable: false, render: (r) => (r.lastSyncTime ? parseUTC(r.lastSyncTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—') },
            ]}
          />
        </div>
      )}
    </div>
  );
}

function ClientHistoryTab({ data, page, onPage, onSaveRemark }) {
  const calls = data?.calls || [];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-900">Call History</h3>
        <span className="text-xs text-gray-400">{data?.total || 0} total</span>
      </div>
      <p className="text-xs text-gray-400 mb-3">Every call to/from this client</p>
      <DataTable
        rows={calls}
        pageSize={50}
        emptyTitle="No records"
        showRowNumber
        maxBodyHeight={560}
        columns={[
          {
            key: 'employeeName', label: 'Employee', width: 160, render: (r) => (
              <div>
                <p className="font-medium text-gray-900"><Truncate text={r.employeeName} /></p>
                {r.employeeTL && <p className="text-[11px] text-gray-400">TL: <Truncate text={r.employeeTL} max={14} /></p>}
              </div>
            ),
          },
          { key: 'contactName', label: 'Contact', width: 140, searchable: false, render: (r) => <Truncate text={r.contactName} /> },
          {
            key: 'contactNumber', label: 'Patient Number', width: 130, render: (r) => (
              r.contactNumber
                ? <span className="text-gray-700 tabular-nums">{r.contactNumber}</span>
                : <span className="text-gray-300">—</span>
            ),
          },
          { key: 'date', label: 'Date', width: 110, searchable: false, render: (r) => parseUTC(r.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) },
          { key: 'time', label: 'Time', width: 80, searchable: false, render: (r) => parseUTC(r.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) },
          { key: 'duration', label: 'Duration', width: 90, align: 'right', searchable: false, render: (r) => (r.duration ? `${Math.floor(r.duration / 60)}m ${r.duration % 60}s` : '—') },
          { key: 'callType', label: 'Call Type', width: 120, searchable: false, render: (r) => <CallBadge type={r.callType} /> },
          {
            key: 'callStatus', label: 'Status', width: 130, searchable: false, render: (r) => r.callStatus
              ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100"><Truncate text={r.callStatus} /></span>
              : <span className="text-gray-300">—</span>,
          },
          {
            key: 'notes', label: 'Remarks', width: 260, searchable: false, wrap: true,
            render: (r) => (
              <EditableRemarks
                value={r.notes}
                updatedAt={r.notesUpdatedAt}
                updatedByName={r.notesUpdatedByName}
                onSave={(val) => onSaveRemark(r._id, val)}
              />
            ),
          },
        ]}
      />
      <div className="mt-2"><Pagination page={page} pages={data?.pages || 1} onPage={onPage} /></div>
    </div>
  );
}
