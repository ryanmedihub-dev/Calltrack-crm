'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../../../lib/api';
import { fmtDate, fmtTime } from '../../../../lib/timezone';
import { statusLabel, statusStyle } from '../../../../lib/leadStatus';
import { DataTable, CallBadge, ChartTip, LeadStatusBadge, Skeleton, fmtNum } from '../../../../components/report-shared';

function formatDuration(sec) {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}
const hourLabel = (h) => `${h % 12 || 12}${h >= 12 ? 'p' : 'a'}`;
const initials = (n) => (n || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const TYPES = [['', 'All'], ['outgoing', 'Outgoing'], ['incoming', 'Incoming'], ['missed', 'Missed'], ['rejected', 'Rejected']];

function Fact({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-line-2 last:border-0">
      <dt className="text-[13px] text-ink-3 shrink-0">{label}</dt>
      <dd className="text-[13px] text-ink text-right min-w-0 break-words">{children || <span className="text-ink-4">—</span>}</dd>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);
  const [today, setToday] = useState(null);
  const [data, setData] = useState(null);
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ callType: '', startDate: '', endDate: '' });
  const reqId = useRef(0);

  useEffect(() => {
    api.get(`/api/employees/${id}`).then((r) => setEmployee(r.data.data)).catch(() => setEmployee(false));
    api.get('/api/calls/stats', { params: { range: 'today', employee: id } }).then((r) => setToday(r.data.data?.today || null)).catch(() => {});
  }, [id]);

  // Filters are passed in explicitly — the old setTimeout(fetchData) read the previous filter state.
  useEffect(() => {
    const mine = ++reqId.current;
    setLoadingCalls(true);
    const params = { page, limit: 20, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
    api.get(`/api/calls/employee/${id}`, { params })
      .then((r) => { if (mine === reqId.current) setData(r.data.data); })
      .catch(() => {})
      .finally(() => { if (mine === reqId.current) setLoadingCalls(false); });
  }, [id, page, filters]);

  const applyFilter = (patch) => { setFilters((f) => ({ ...f, ...patch })); setPage(1); };
  const filtered = filters.callType || filters.startDate || filters.endDate;

  const target = employee?.dailyTarget || 0;
  const done = today?.totalCalls || 0;
  const pct = target ? Math.min(100, Math.round((done / target) * 100)) : 0;
  const hours = (today?.callsPerHour || []).filter((h) => h.hour >= 8 && h.hour <= 21).map((h) => ({ ...h, label: hourLabel(h.hour) }));

  const columns = [
    {
      key: 'contactName', label: 'Contact', width: '28%',
      render: (log) => (
        <span className="block min-w-0">
          <span className="block font-medium text-ink truncate">{log.contactName && log.contactName !== 'Unknown' ? log.contactName : log.contactNumber}</span>
          {log.contactName && log.contactName !== 'Unknown' && <span className="block text-xs text-ink-3 tabular-nums">{log.contactNumber}</span>}
        </span>
      ),
    },
    { key: 'callType', label: 'Type', width: '14%', render: (log) => <CallBadge type={log.callType} /> },
    { key: 'duration', label: 'Duration', align: 'right', width: '12%', render: (log) => <span className="tabular-nums">{formatDuration(log.duration)}</span> },
    {
      key: 'timestamp', label: 'When', width: '20%',
      render: (log) => <span className="tabular-nums">{fmtDate(log.timestamp)} <span className="text-ink-3">· {fmtTime(log.timestamp)}</span></span>,
    },
    {
      key: 'leadStatus', label: 'Lead status', width: '26%',
      render: (log) => log.leadStatus
        ? <LeadStatusBadge status={log.leadStatus} style={statusStyle(log.leadStatus)} label={statusLabel(log.leadStatus)} />
        : <span className="text-ink-4">No lead</span>,
    },
  ];

  if (employee === false) {
    return (
      <div className="panel p-10 text-center">
        <p className="text-sm font-medium text-ink">Employee not found</p>
        <p className="text-[13px] text-ink-3 mt-1">They may have been removed, or they’re not on your team.</p>
        <Link href="/employees/overview" className="btn-secondary btn-sm mt-4">Back to employees</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Identity */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="w-12 h-12 rounded-full bg-white ring-1 ring-line text-ink-2 flex items-center justify-center text-base font-semibold shrink-0">
          {employee ? initials(employee.name) : ''}
        </span>
        <div className="min-w-0 flex-1">
          {employee ? (
            <>
              <h1 className="page-title flex items-center gap-2.5">
                {employee.name}
                <span className={`badge ${employee.isActive !== false ? 'bg-[var(--met-50)] text-met' : 'bg-gray-100 text-ink-3'}`}>
                  {employee.isActive !== false ? 'Active' : 'Inactive'}
                </span>
              </h1>
              <p className="page-subtitle">
                {[employee.tlName && `Team lead ${employee.tlName}`, employee.ryanEmployeeCode, employee.phone].filter(Boolean).join(' · ') || employee.email}
              </p>
            </>
          ) : (
            <><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64 mt-2" /></>
          )}
        </div>
        <Link href={`/reports/calllogs?employee=${id}`} className="btn-secondary">Open in calls report</Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Today */}
        <section className="panel xl:col-span-2" aria-label="Today">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Today</h2>
              <p className="panel-sub">Progress against their daily target</p>
            </div>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
              <div>
                <p className="stat-label">Calls</p>
                <p className={`stat-number mt-1 ${target && done >= target ? 'text-met' : ''}`}>
                  {fmtNum(done)}<span className="text-[15px] font-medium text-ink-3 ml-1">/ {target ? fmtNum(target) : '—'}</span>
                </p>
              </div>
              <div><p className="stat-label">Connected</p><p className="stat-number mt-1">{done ? `${Math.round(((today?.connectedCalls || 0) / done) * 100)}%` : '—'}</p></div>
              <div><p className="stat-label">Missed</p><p className={`stat-number mt-1 ${(today?.missed || 0) > 0 ? 'text-behind' : ''}`}>{fmtNum(today?.missed || 0)}</p></div>
              <div><p className="stat-label">Talk time</p><p className="stat-number mt-1">{formatDuration(today?.callDurationSec)}</p></div>
            </div>
            {target > 0 && (
              <div className="mt-5">
                <div className="flex justify-between text-xs text-ink-3 mb-1.5">
                  <span>{pct}% of target</span>
                  <span className="tabular-nums">{done >= target ? 'Target met' : `${fmtNum(target - done)} to go`}</span>
                </div>
                <div className="progress-bar h-2"><div className="progress-fill" style={{ width: `${pct}%`, background: done >= target ? 'var(--met)' : 'var(--blue)' }} /></div>
              </div>
            )}
            <div className="h-[160px] mt-6 -ml-2">
              {!today ? <Skeleton className="h-full ml-2" /> : done === 0 ? (
                <div className="h-full ml-2 rounded-lg bg-gray-50 flex items-center justify-center text-[13px] text-ink-3">No calls today yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hours} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid stroke="#F1F0F5" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} width={28} allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(124,58,237,0.05)' }} />
                    <Bar dataKey="count" name="Calls" fill="#7C3AED" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        {/* Details */}
        <section className="panel" aria-label="Details">
          <div className="panel-head"><h2 className="panel-title">Details</h2></div>
          <dl className="px-5 py-1.5">
            <Fact label="Email">{employee?.email}</Fact>
            <Fact label="Phone"><span className="tabular-nums">{employee?.phone}</span></Fact>
            <Fact label="Team lead">{employee?.tlName}</Fact>
            <Fact label="Employee ID">{employee?.ryanEmployeeCode}</Fact>
            <Fact label="Daily target">{target ? `${fmtNum(target)} calls` : null}</Fact>
            <Fact label="All-time calls"><span className="tabular-nums">{data?.stats ? fmtNum(data.stats.total) : null}</span></Fact>
            <Fact label="Avg call">{data?.stats ? formatDuration(data.stats.avgDuration) : null}</Fact>
            <Fact label="Joined">{employee?.createdAt ? fmtDate(employee.createdAt) : null}</Fact>
          </dl>
        </section>
      </div>

      {/* Call history */}
      <section className="panel" aria-label="Call history">
        <div className="panel-head flex-wrap">
          <div>
            <h2 className="panel-title">Call history</h2>
            <p className="panel-sub">{data ? `${fmtNum(data.total)} calls${filtered ? ' match these filters' : ''}` : 'Loading…'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="seg" role="group" aria-label="Call type">
              {TYPES.map(([k, l]) => (
                <button key={k || 'all'} aria-pressed={filters.callType === k} onClick={() => applyFilter({ callType: k })}>{l}</button>
              ))}
            </div>
            <input type="date" aria-label="From date" value={filters.startDate} onChange={(e) => applyFilter({ startDate: e.target.value })} className="form-input h-8 w-[140px] text-xs" />
            <span className="text-ink-4 text-xs">to</span>
            <input type="date" aria-label="To date" value={filters.endDate} onChange={(e) => applyFilter({ endDate: e.target.value })} className="form-input h-8 w-[140px] text-xs" />
            {filtered && <button onClick={() => applyFilter({ callType: '', startDate: '', endDate: '' })} className="btn-ghost btn-sm">Clear</button>}
          </div>
        </div>
        <div className="p-4 pt-3">
          <DataTable
            serverMode
            searchable={false}
            columns={columns}
            rows={data?.calls || []}
            loading={loadingCalls && !data}
            page={page}
            pageSize={20}
            totalPages={data?.pages || 1}
            totalCount={data?.total}
            onPageChange={setPage}
            emptyTitle={filtered ? 'No calls match these filters' : 'No calls yet'}
            emptyHint={filtered ? 'Clear a filter or widen the dates.' : 'Calls appear here once this employee’s phone syncs.'}
          />
        </div>
      </section>
    </div>
  );
}
