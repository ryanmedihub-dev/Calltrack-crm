'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '../../../../lib/api';
import CallTypeBadge from '../../../../components/CallTypeBadge';
import Pagination from '../../../../components/Pagination';
import StatCard from '../../../../components/StatCard';

function formatDuration(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const TYPE_CHIPS = ['', 'incoming', 'outgoing', 'missed', 'rejected'];
const CHIP_LABELS = { '': 'All', incoming: 'Incoming', outgoing: 'Outgoing', missed: 'Missed', rejected: 'Rejected' };
const CHIP_COLORS = {
  '':       { active: 'bg-textPrimary text-white', idle: 'bg-white text-textSecondary border border-border' },
  incoming: { active: 'bg-primary text-white',     idle: 'bg-primaryLt text-primary border border-blue-200' },
  outgoing: { active: 'bg-success text-white',     idle: 'bg-green-50 text-success border border-green-200' },
  missed:   { active: 'bg-danger text-white',      idle: 'bg-red-50 text-danger border border-red-200' },
  rejected: { active: 'bg-warning text-white',     idle: 'bg-orange-50 text-warning border border-orange-200' },
};

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);
  const [data, setData]         = useState(null);
  const [page, setPage]         = useState(1);
  const [filters, setFilters]   = useState({ callType: '', startDate: '', endDate: '' });

  const fetchData = async (p = page) => {
    try {
      const params = { page: p, limit: 20, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
      const [empRes, callRes] = await Promise.all([
        api.get(`/api/employees/${id}`),
        api.get(`/api/calls/employee/${id}`, { params })
      ]);
      setEmployee(empRes.data.data);
      setData(callRes.data.data);
    } catch {}
  };

  useEffect(() => { fetchData(); }, [page, id]);

  const applyFilter = (patch) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(1);
    setTimeout(() => fetchData(1), 0);
  };

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <a href="/employees" className="text-textMuted hover:text-primary transition-colors">← Employees</a>
        <span className="text-border">/</span>
        <span className="text-textPrimary font-medium">{employee?.name || 'Loading...'}</span>
      </div>

      {/* Employee profile card */}
      {employee && (
        <div className="bg-white rounded-2xl border border-border shadow-card p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primaryLt text-primary text-2xl font-bold flex items-center justify-center flex-shrink-0">
            {employee.name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-textPrimary text-lg font-bold">{employee.name}</p>
            <p className="text-textMuted text-sm">{employee.email}</p>
            {employee.phone && <p className="text-textMuted text-sm">{employee.phone}</p>}
          </div>
          <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${employee.isActive ? 'bg-green-50 text-success border border-green-200' : 'bg-gray-50 text-textMuted border border-border'}`}>
            {employee.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      )}

      {/* Stat cards */}
      {data?.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="Total Calls"  value={data.stats.total}                      icon="📞" color="blue"   />
          <StatCard title="Missed Calls" value={data.stats.missed}                     icon="📵" color="red"    />
          <StatCard title="Avg Duration" value={formatDuration(data.stats.avgDuration)} icon="⏱" color="orange" />
        </div>
      )}

      {/* Type chips */}
      <div className="flex gap-2 flex-wrap">
        {TYPE_CHIPS.map((t) => {
          const active = filters.callType === t;
          const c = CHIP_COLORS[t];
          return (
            <button key={t} onClick={() => applyFilter({ callType: t })}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${active ? c.active : c.idle}`}>
              {CHIP_LABELS[t]}
            </button>
          );
        })}
      </div>

      {/* Date filters */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-textMuted text-xs font-medium mb-1">Start Date</label>
          <input type="date" value={filters.startDate} onChange={(e) => applyFilter({ startDate: e.target.value })}
            className="bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div>
          <label className="block text-textMuted text-xs font-medium mb-1">End Date</label>
          <input type="date" value={filters.endDate} onChange={(e) => applyFilter({ endDate: e.target.value })}
            className="bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <button onClick={() => applyFilter({ callType: '', startDate: '', endDate: '' })}
          className="border border-border text-textMuted text-sm px-4 py-2 rounded-xl hover:border-danger hover:text-danger transition-colors">
          Reset
        </button>
      </div>

      {/* Call logs table */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-textMuted text-xs font-semibold uppercase tracking-wide">
              <th className="px-5 py-3.5 text-left">Contact</th>
              <th className="px-5 py-3.5 text-left">Type</th>
              <th className="px-5 py-3.5 text-left">Duration</th>
              <th className="px-5 py-3.5 text-left">Date & Time</th>
              <th className="px-5 py-3.5 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.calls || []).map((log) => (
              <tr key={log._id} className="border-b border-border hover:bg-bg transition-colors">
                <td className="px-5 py-3.5">
                  <p className="text-textPrimary font-medium">{log.contactName || '—'}</p>
                  <p className="text-textMuted text-xs">{log.contactNumber}</p>
                </td>
                <td className="px-5 py-3.5"><CallTypeBadge type={log.callType} /></td>
                <td className="px-5 py-3.5 text-textSecondary font-medium">{formatDuration(log.duration)}</td>
                <td className="px-5 py-3.5 text-textMuted text-xs">
                  <p>{new Date(log.timestamp).toLocaleDateString()}</p>
                  <p>{new Date(log.timestamp).toLocaleTimeString()}</p>
                </td>
                <td className="px-5 py-3.5">
                  {log.leadStatus ? (
                    <span className="text-xs bg-primaryLt text-primary px-2 py-0.5 rounded-full font-semibold">{log.leadStatus}</span>
                  ) : <span className="text-textMuted text-xs">—</span>}
                </td>
              </tr>
            ))}
            {(data?.calls || []).length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center">
                <span className="text-3xl block mb-2">📭</span>
                <span className="text-textMuted text-sm">No call logs found</span>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={data?.pages || 1} onPage={setPage} />
    </div>
  );
}
