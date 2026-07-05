'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../../../lib/api';
import { DataTable, ChartTip } from '../../../../components/report-shared';

const STATUSES = ['new', 'contacted', 'qualified', 'interested', 'converted', 'lost'];
const STATUS_COLORS = { new: '#2563EB', contacted: '#D97706', qualified: '#7C3AED', interested: '#0D9488', converted: '#16A34A', lost: '#DC2626' };

export default function LeadsEmployeesReportsPage() {
  const [employees, setEmployees] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('total');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const empRes = await api.get('/api/employees');
        const emps = empRes.data?.data || [];
        setEmployees(emps);

        const rows = await Promise.all(emps.map(async e => {
          const counts = {};
          await Promise.all(STATUSES.map(s =>
            api.get('/api/leads', { params: { assignedTo: e._id, status: s, limit: 1 } })
              .then(r => { counts[s] = r.data?.data?.total || 0; })
              .catch(() => { counts[s] = 0; })
          ));
          const total = Object.values(counts).reduce((s, n) => s + n, 0);
          return { id: e._id, name: e.name, role: e.role || 'Agent', ...counts, total };
        }));
        setData(rows);
      } catch { setData([]); }
      setLoading(false);
    })();
  }, []);

  const sorted = [...data].sort((a, b) => b[sort] - a[sort]);
  const chartData = sorted.slice(0, 10).map(r => ({ name: r.name.split(' ')[0], ...r }));

  const tableRows = sorted.map(r => ({ ...r, convRate: r.total > 0 ? Math.round((r.converted / r.total) * 100) : 0 }));

  return (
    <div className="min-h-screen">
      <div className="space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              Leads <span className="text-gray-300">/</span> <span className="text-gray-500">Employees Report</span>
            </p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">Employees Leads Report</h1>
          </div>
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 bg-white outline-none focus:border-blue-400 w-44"
            value={sort} onChange={e => setSort(e.target.value)}
          >
            <option value="total">Sort: Total</option>
            <option value="converted">Sort: Converted</option>
            <option value="interested">Sort: Interested</option>
            <option value="new">Sort: New</option>
          </select>
        </div>

        {/* Stacked bar chart */}
        {!loading && chartData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Lead Distribution</h3>
            <p className="text-xs text-gray-400 mb-4">Top 10 employees by {sort}</p>
            <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 32)}>
              <BarChart data={chartData} barSize={22} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} tickLine={false} axisLine={false} width={72} />
                <Tooltip content={<ChartTip />} />
                {STATUSES.map(s => (
                  <Bar key={s} dataKey={s} name={s.charAt(0).toUpperCase() + s.slice(1)}
                    stackId="a" fill={STATUS_COLORS[s]} radius={s === 'lost' ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-4 justify-center">
              {STATUSES.map(s => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLORS[s] }} />
                  <span className="text-[11px] capitalize text-gray-600">{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Employee Lead Breakdown</h3>
          <p className="text-xs text-gray-400 mb-3">Lead status counts assigned to each employee</p>
          <DataTable
            loading={loading}
            emptyTitle="No data available"
            columns={[
              {
                key: 'name', label: 'Employee',
                render: (r) => (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0 bg-blue-600">
                      {(r.name || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-gray-900">{r.name}</p>
                      <p className="text-[10px] capitalize text-gray-400">{r.role}</p>
                    </div>
                  </div>
                ),
              },
              ...STATUSES.map(s => ({
                key: s,
                label: s.charAt(0).toUpperCase() + s.slice(1),
                align: 'right',
                searchable: false,
                render: (r) => <span className="font-semibold" style={{ color: STATUS_COLORS[s] }}>{r[s] || 0}</span>,
              })),
              { key: 'total', label: 'Total', align: 'right', searchable: false, render: (r) => <span className="font-bold text-gray-900">{r.total}</span> },
              {
                key: 'convRate', label: 'Conv. Rate', align: 'right', searchable: false,
                render: (r) => (
                  <span className="font-bold text-xs" style={{ color: r.convRate > 20 ? '#16A34A' : r.convRate > 10 ? '#D97706' : '#DC2626' }}>
                    {r.convRate}%
                  </span>
                ),
              },
            ]}
            rows={tableRows}
          />
        </div>
      </div>
    </div>
  );
}
