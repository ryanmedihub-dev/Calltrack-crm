'use client';
import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import api from '../../../../lib/api';
import { Skeleton, ChartTip, Ico } from '../../../../components/report-shared';

const LeadIco = ({ s = 16 }) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="23" y1="11" x2="17" y2="11" /><line x1="20" y1="8" x2="20" y2="14" /></Ico>;

const STATUSES = [
  { key: 'new',        label: 'New',        color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { key: 'contacted',  label: 'Contacted',  color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { key: 'qualified',  label: 'Qualified',  color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { key: 'interested', label: 'Interested', color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4' },
  { key: 'converted',  label: 'Converted',  color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { key: 'lost',       label: 'Lost',       color: '#DC2626', bg: '#FFF1F2', border: '#FECACA' },
];

export default function EmployeeLeadsReportPage() {
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState('');
  const [leads, setLeads] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingEmp, setLoadingEmp] = useState(true);

  useEffect(() => {
    api.get('/api/employees').then(r => {
      const emps = r.data?.data || [];
      setEmployees(emps);
      if (emps.length) setSelected(emps[0]._id);
    }).catch(() => {}).finally(() => setLoadingEmp(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    Promise.all(
      STATUSES.map(s =>
        api.get('/api/leads', { params: { assignedTo: selected, status: s.key, limit: 1 } })
          .then(r => ({ key: s.key, count: r.data?.data?.total || 0 }))
          .catch(() => ({ key: s.key, count: 0 }))
      )
    ).then(results => {
      const map = {};
      results.forEach(r => { map[r.key] = r.count; });
      setLeads(map);
    }).finally(() => setLoading(false));
  }, [selected]);

  const emp = employees.find(e => e._id === selected);
  const total = Object.values(leads).reduce((s, n) => s + n, 0);
  const pieData = STATUSES.map(s => ({ name: s.label, value: leads[s.key] || 0, color: s.color })).filter(d => d.value > 0);
  const barData = STATUSES.map(s => ({ name: s.label, count: leads[s.key] || 0, color: s.color }));

  return (
    <div className="min-h-screen">
      <div className="space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              Employees <span className="text-gray-300">/</span> <span className="text-gray-500">Leads Report</span>
            </p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">Employee Leads Report</h1>
          </div>
          {loadingEmp ? (
            <Skeleton className="h-9 w-48 rounded-lg" />
          ) : (
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 bg-white outline-none focus:border-blue-400 w-full sm:w-56"
              value={selected} onChange={e => setSelected(e.target.value)}
            >
              {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          )}
        </div>

        {/* Employee card */}
        {emp && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shrink-0"
              style={{ background: 'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
              {emp.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-base text-gray-900">{emp.name}</p>
              <p className="text-sm text-gray-500">{emp.role || 'Agent'} · {emp.phone || '—'}</p>
              <span className="inline-flex items-center mt-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                {total} Total Leads
              </span>
            </div>
          </div>
        )}

        {/* Status distribution tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {STATUSES.map((s) => {
            const pct = total > 0 ? Math.round(((leads[s.key] || 0) / total) * 100) : 0;
            return (
              <div key={s.key} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: s.color }}>{s.label}</span>
                  {total > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>
                      {pct}%
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-gray-900 tabular-nums">
                  {loading ? <Skeleton className="inline-block w-10 h-6 rounded" /> : (leads[s.key] ?? 0)}
                </div>
                <div className="mt-2 h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: s.color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts */}
        {!loading && total > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Lead Distribution</h3>
              <p className="text-xs text-gray-400 mb-3">{total} total leads</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-gray-500">{d.name}</span>
                    </div>
                    <span className="font-bold text-gray-900">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Leads by Status</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="count" name="Leads" radius={[5, 5, 0, 0]}>
                    {barData.map((e, i) => <Cell key={i} fill={STATUSES[i]?.color || '#2563EB'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {!loading && total === 0 && selected && (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-blue-50 text-blue-600">
              <LeadIco s={24} />
            </div>
            <p className="font-semibold text-sm text-gray-900">No leads assigned</p>
            <p className="text-xs mt-1 text-gray-400">This employee has no leads assigned yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
