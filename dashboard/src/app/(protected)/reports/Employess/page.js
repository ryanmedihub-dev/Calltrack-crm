'use client';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import api from '../../../../lib/api';
import useIsAdmin from '../../../../lib/useIsAdmin';
import { getAllEmployeesSafe } from '../../../../lib/employees';
import { triggerServerExport } from '../../../../lib/downloads';
import {
  DataTable, StatCard, ChartTip, EmptyState, InsightCard, Field, Skeleton, TLFilter, Truncate,
  PhoneIco, UsersIco, CheckIco, GaugeIco, TrophyIco, ClockIco, DownloadIco,
  GridIco, BarChartTabIco, CalendarTabIco, ClockTabIco, NoEntryIco, ClipboardIco,
} from '../../../../components/report-shared';

const TABS = [
  { key: 'summary',  label: 'Summary',           icon: <GridIco /> },
  { key: 'analysis', label: 'Analysis',          icon: <BarChartTabIco /> },
  { key: 'dayWise',  label: 'Day-wise Analysis', icon: <CalendarTabIco /> },
  { key: 'hourly',   label: 'Hourly Analysis',   icon: <ClockTabIco /> },
  { key: 'target',   label: 'Target Achievement',icon: <GaugeIco /> },
  { key: 'attention',label: 'Needs Attention',   icon: <NoEntryIco /> },
  { key: 'directory',label: 'Directory',         icon: <ClipboardIco /> },
];

function AchievementBar({ pct }) {
  if (pct == null) return <span className="text-xs text-gray-400">No target set</span>;
  const color = pct >= 100 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626';
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-20 h-1.5 rounded-full overflow-hidden bg-gray-200">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-10 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

function StatusPill({ active }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${active ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

/* Inline-editable Daily Target cell, backed by the real PATCH /api/employees/:id/target endpoint */
function TargetCell({ employeeId, initial, onSaved }) {
  const [value, setValue] = useState(initial ?? 0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const isAdmin = useIsAdmin();

  const commit = async () => {
    setEditing(false);
    const num = Number(value);
    if (Number.isNaN(num) || num < 0 || num === initial) { setValue(initial ?? 0); return; }
    setSaving(true);
    try {
      await api.patch(`/api/employees/${employeeId}/target`, { dailyTarget: num });
      toast.success('Target updated');
      onSaved?.(num);
    } catch {
      toast.error('Failed to update target');
      setValue(initial ?? 0);
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return <span className="text-xs font-semibold text-gray-700">{value || 0}</span>;
  if (editing) {
    return (
      <input
        autoFocus type="number" min={0} value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="w-20 text-xs border border-blue-300 rounded-md px-2 py-1 outline-none text-right"
      />
    );
  }
  return (
    <button onClick={() => setEditing(true)} disabled={saving}
      className="text-xs font-semibold text-gray-700 hover:text-blue-600 hover:underline disabled:opacity-50">
      {saving ? '…' : value || 0}
    </button>
  );
}

/* Active/Inactive toggle, backed by PATCH /api/employees/:id/status */
function StatusToggle({ employeeId, active, onSaved }) {
  const [busy, setBusy] = useState(false);
  const isAdmin = useIsAdmin();
  const toggle = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/employees/${employeeId}/status`, { isActive: !active });
      toast.success(!active ? 'Marked active' : 'Marked inactive');
      onSaved?.(!active);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setBusy(false);
    }
  };
  if (!isAdmin) return <StatusPill active={active} />;
  return (
    <button onClick={toggle} disabled={busy} className="disabled:opacity-50">
      <StatusPill active={active} />
    </button>
  );
}

export default function EmployeeReportsPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [chartMode, setChartMode] = useState('composed');
  const [employees, setEmployees] = useState([]);
  const [report, setReport] = useState(null);
  const [rowOverrides, setRowOverrides] = useState({}); // optimistic edits for directory tab

  const [filters, setFilters] = useState({ fromDate: '', toDate: '', employee: '', status: '', tl: '' });

  const buildParams = useCallback(() => ({
    ...(filters.fromDate && { startDate: filters.fromDate }),
    ...(filters.toDate && { endDate: filters.toDate }),
    ...(filters.employee && { employeeId: filters.employee }),
    ...(filters.status && { status: filters.status }),
    ...(filters.tl && { tlName: filters.tl }),
  }), [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/reports/employees-periodic', { params: { ...buildParams(), tab: activeTab, limit: 500 } });
      setReport(res.data?.data || null);
      setRowOverrides({});
    } catch {
      setReport(null);
      toast.error('Failed to load report');
    }
    setLoading(false);
  }, [buildParams, activeTab]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getAllEmployeesSafe(api).then((list) => setEmployees(list)).catch(() => {}); }, []);

  // Full-schema server-side export (every User field + performance aggregates,
  // including total talktime) — replaces the old client-side CSV that only
  // covered whatever columns happened to be on screen.
  const exportCSV = () => triggerServerExport({
    endpoint: '/api/reports/employees/export',
    params: buildParams(),
    filename: `employees-${filters.fromDate || 'all'}_${filters.toDate || 'today'}.csv`,
  });

  const applyOverride = (id, patch) => setRowOverrides((o) => ({ ...o, [id]: { ...o[id], ...patch } }));

  const performanceRows = (report?.employeePerformance || []).map((r) => ({ ...r, ...rowOverrides[r.employeeId] }));
  const directoryRows = (report?.employees || []).map((r) => ({ ...r, ...rowOverrides[r.employeeId] }));
  const targetRows = (report?.records || []);
  const attentionRows = (report?.records || []);
  const hourlyRows = (report?.hourly || []).map((h) => ({ ...h, id: h.hour }));
  const dayWiseRows = (report?.daywise || []).map((d) => ({ ...d, id: d.date }));
  const hourlyChartData = (report?.hourly || []).map((h) => ({ hour: h.label, calls: h.calls, leads: h.leads }));

  const employeeName = employees.find((e) => e._id === filters.employee)?.name;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            Reports <span className="text-gray-300">/</span> <span className="text-gray-500">Employee Reports</span>
          </p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">{report?.dateLabel || 'Employee Reports'}</h1>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-2 px-3.5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium shadow-sm">
          <DownloadIco /> Export
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <Field label="From Date">
            <input type="date" className="form-input" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
          </Field>
          <Field label="To Date">
            <input type="date" className="form-input" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
          </Field>
          <Field label="Employee">
            <select className="form-input" value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })}>
              <option value="">All employees</option>
              {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="form-input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </Field>
          <Field label="Team Lead">
            <TLFilter value={filters.tl} onChange={(v) => setFilters({ ...filters, tl: v })} className="w-full" />
          </Field>
          <button onClick={load} className="btn-primary justify-center h-[38px]">Apply</button>
        </div>
        {(filters.employee || filters.status || filters.tl) && (
          <p className="text-xs text-gray-400 mt-3">
            Filtering by {filters.employee ? employeeName : 'all employees'}{filters.status ? `, ${filters.status}` : ''}{filters.tl ? `, TL: ${filters.tl}` : ''}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-nav">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`tab-item${activeTab === t.key ? ' active' : ''}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Summary ── */}
      {activeTab === 'summary' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard loading={loading} label="Total Employees" value={(report?.kpis?.totalEmployees ?? 0).toLocaleString()} color="#2563EB" icon={<UsersIco />} />
            <StatCard loading={loading} label="Active Employees" value={(report?.kpis?.activeEmployees ?? 0).toLocaleString()} color="#16A34A" icon={<CheckIco />} />
            <StatCard loading={loading} label="Total Calls" value={(report?.kpis?.totalCalls ?? 0).toLocaleString()} color="#D97706" icon={<PhoneIco />} />
            <StatCard loading={loading} label="Leads Assigned" value={(report?.kpis?.totalLeadsAssigned ?? 0).toLocaleString()} color="#7C3AED" icon={<UsersIco />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Workforce Status</h3>
              <p className="text-xs text-gray-400 mb-3">Active vs inactive</p>
              {loading ? <Skeleton className="h-44 w-full" /> : !report?.statusPie?.length ? <EmptyState title="No employees" hint="" /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={report.statusPie} cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={3} dataKey="value">
                      {report.statusPie.map((d, i) => <Cell key={i} fill={d.color} stroke="#fff" strokeWidth={2} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="flex justify-center gap-4 mt-2 flex-wrap">
                {(report?.statusPie || []).map((d, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} /> {d.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Employee Performance</h3>
              <p className="text-xs text-gray-400 mb-3">Calls, leads and target achievement for the selected period</p>
              <DataTable
                loading={loading}
                pageSize={10}
                emptyTitle="No employees found"
                columns={[
                  {
                    key: 'employeeName', label: 'Employee',
                    render: (r) => (
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{r.employeeName}</p>
                        <StatusPill active={r.isActive} />
                      </div>
                    ),
                  },
                  { key: 'totalCalls', label: 'Calls', align: 'right', searchable: false },
                  { key: 'connectedCalls', label: 'Connected', align: 'right', searchable: false, render: (r) => <span className="text-emerald-600 font-semibold">{r.connectedCalls}</span> },
                  { key: 'leadsAssigned', label: 'Leads', align: 'right', searchable: false },
                  { key: 'leadsConverted', label: 'Converted', align: 'right', searchable: false, render: (r) => <span className="text-emerald-600 font-semibold">{r.leadsConverted}</span> },
                  { key: 'conversionRate', label: 'Conv. Rate', align: 'right', searchable: false, render: (r) => `${r.conversionRate}%` },
                  { key: 'targetAchievement', label: 'Target', align: 'right', sortable: false, searchable: false, render: (r) => <AchievementBar pct={r.targetAchievement} /> },
                ]}
                rows={performanceRows}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Analysis ── */}
      {activeTab === 'analysis' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Calls vs. Leads — Hourly</h3>
                <p className="text-xs text-gray-400">Org-wide activity across all employees</p>
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {['composed', 'bar'].map((m) => (
                  <button key={m} onClick={() => setChartMode(m)}
                    className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${chartMode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {loading ? <Skeleton className="h-72 w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: '#94A3B8', fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="calls" name="Calls" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={18} />
                  {chartMode === 'composed' && <Line type="monotone" dataKey="leads" name="Leads Created" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3, fill: '#7C3AED' }} />}
                  {chartMode === 'bar' && <Bar dataKey="leads" name="Leads Created" fill="#7C3AED" radius={[4, 4, 0, 0]} barSize={18} />}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InsightCard icon={<TrophyIco />} title="Top Performers" rows={[
              { label: 'Top Dialer', value: report?.topDialer?.employeeName || '—', sub: report?.topDialer ? `${report.topDialer.count} calls` : '' },
              { label: 'Top Converter', value: report?.topConverter?.employeeName || '—', sub: report?.topConverter ? `${report.topConverter.count} leads converted` : '' },
            ]} />
            <InsightCard icon={<GaugeIco />} title="Target Achievement" rows={[
              { label: 'Best Achiever', value: report?.bestTarget?.employeeName || '—', sub: report?.bestTarget ? `${report.bestTarget.pct}% of target` : 'No targets set' },
              { label: 'Needs Coaching', value: report?.needsAttention?.employeeName || '—', sub: report?.needsAttention ? `${report.needsAttention.pct}% of target` : '' },
            ]} />
            <InsightCard icon={<ClockIco />} title="Averages" rows={[
              { label: 'Avg Calls / Employee', value: report?.avgCallsPerEmployee ?? 0 },
              { label: 'Avg Leads / Employee', value: report?.avgLeadsPerEmployee ?? 0 },
              { label: 'Business Days', value: report?.dayCount ?? 0 },
            ]} />
          </div>
        </div>
      )}

      {/* ── Day-wise ── */}
      {activeTab === 'dayWise' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Daily Activity</h3>
          <p className="text-xs text-gray-400 mb-4">Calls and leads created per day, across all employees</p>
          <DataTable
            loading={loading}
            searchable={false}
            pageSize={15}
            columns={[
              { key: 'label', label: 'Day' },
              { key: 'calls', label: 'Calls', align: 'right' },
              { key: 'leadsCreated', label: 'Leads Created', align: 'right' },
              { key: 'leadsConverted', label: 'Converted', align: 'right', render: (r) => <span className="text-emerald-600 font-semibold">{r.leadsConverted}</span> },
            ]}
            rows={dayWiseRows}
          />
          {!loading && dayWiseRows.length > 0 && (
            <div className="mt-6">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[...dayWiseRows].reverse().map((r) => ({ day: r.label.split(',')[0], calls: r.calls, leads: r.leadsCreated }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="calls" name="Calls" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="leads" name="Leads Created" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Hourly ── */}
      {activeTab === 'hourly' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Hourly Time Slots</h3>
          <p className="text-xs text-gray-400 mb-4">Share of combined activity (calls + leads) by hour, IST</p>
          <DataTable
            loading={loading}
            searchable={false}
            pageSize={24}
            columns={[
              { key: 'label', label: 'Time Slot' },
              { key: 'calls', label: 'Calls', align: 'right' },
              { key: 'leads', label: 'Leads', align: 'right' },
              {
                key: 'pct', label: '% of Total', align: 'right', sortable: false,
                render: (r) => (
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(r.pct, 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">{r.pct}%</span>
                  </div>
                ),
              },
            ]}
            rows={hourlyRows}
          />
        </div>
      )}

      {/* ── Target Achievement ── */}
      {activeTab === 'target' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Target Achievement</h3>
          <p className="text-xs text-gray-400 mb-4">Employees with a daily call target set, weakest first</p>
          <DataTable
            loading={loading}
            emptyTitle="No targets configured"
            emptyHint="Set a daily target for an employee from the Directory tab."
            columns={[
              { key: 'employeeName', label: 'Employee' },
              { key: 'dailyTarget', label: 'Daily Target', align: 'right', searchable: false },
              { key: 'totalCalls', label: 'Calls Made', align: 'right', searchable: false },
              { key: 'targetTotal', label: 'Period Target', align: 'right', searchable: false },
              { key: 'targetAchievement', label: 'Achievement', align: 'right', sortable: false, searchable: false, render: (r) => <AchievementBar pct={r.targetAchievement} /> },
            ]}
            rows={targetRows}
          />
        </div>
      )}

      {/* ── Needs Attention ── */}
      {activeTab === 'attention' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Needs Attention</h3>
          <p className="text-xs text-gray-400 mb-4">Inactive accounts, employees below 50% of target, or no activity this period</p>
          <DataTable
            loading={loading}
            emptyTitle="Nobody needs attention 🎉"
            columns={[
              { key: 'employeeName', label: 'Employee' },
              {
                key: 'reason', label: 'Reason', sortable: false,
                render: (r) => (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium text-red-600 bg-red-50">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {r.reason}
                  </span>
                ),
              },
              { key: 'totalCalls', label: 'Calls', align: 'right', searchable: false },
              { key: 'targetAchievement', label: 'Target', align: 'right', sortable: false, searchable: false, render: (r) => <AchievementBar pct={r.targetAchievement} /> },
            ]}
            rows={attentionRows}
          />
        </div>
      )}

      {/* ── Directory ── */}
      {activeTab === 'directory' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Employee Directory</h3>
          <p className="text-xs text-gray-400 mb-4">Full roster — click a status pill or target value to edit it directly</p>
          <DataTable
            loading={loading}
            pageSize={25}
            showRowNumber
            columns={[
              {
                key: 'employeeName', label: 'Employee',
                render: (r) => (
                  <div>
                    <p className="font-semibold text-sm text-gray-900"><Truncate text={r.employeeName} /></p>
                    <p className="text-xs text-gray-400 truncate">{r.email}</p>
                  </div>
                ),
              },
              { key: 'employeeCode', label: 'Employee ID', render: (r) => r.employeeCode || <span className="text-gray-300">—</span> },
              { key: 'tlName', label: 'Team Lead', render: (r) => r.tlName ? <Truncate text={r.tlName} max={14} /> : <span className="text-gray-300">—</span> },
              { key: 'phone', label: 'Phone', searchable: false },
              {
                key: 'isActive', label: 'Status', sortable: false, searchable: false,
                render: (r) => <StatusToggle employeeId={r.employeeId} active={r.isActive} onSaved={(v) => applyOverride(r.employeeId, { isActive: v })} />,
              },
              {
                key: 'dailyTarget', label: 'Daily Target', align: 'right', sortable: false, searchable: false,
                render: (r) => <TargetCell employeeId={r.employeeId} initial={r.dailyTarget} onSaved={(v) => applyOverride(r.employeeId, { dailyTarget: v })} />,
              },
              { key: 'targetAchievement', label: 'Achievement', align: 'right', sortable: false, searchable: false, render: (r) => <AchievementBar pct={r.targetAchievement} /> },
              { key: 'totalCalls', label: 'Calls (period)', align: 'right', searchable: false },
              { key: 'totalTalktime', label: 'Total Talktime', align: 'right', searchable: false, render: (r) => r.totalTalktime || '0s' },
              { key: 'leadsAssigned', label: 'Leads (period)', align: 'right', searchable: false },
              { key: 'conversionRate', label: 'Conv. Rate', align: 'right', searchable: false, render: (r) => `${r.conversionRate ?? 0}%` },
            ]}
            rows={directoryRows}
          />
        </div>
      )}
    </div>
  );
}