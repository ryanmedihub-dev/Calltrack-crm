'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '../../../../lib/api';
import { getAllEmployeesSafe } from '../../../../lib/employees';
import useIsAdmin from '../../../../lib/useIsAdmin';
import { DataTable, PageHeader, fmtNum } from '../../../../components/report-shared';

const initials = (n) => (n || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export default function EmployeesOverviewPage() {
  const isAdmin = useIsAdmin();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [callStats, setCallStats] = useState(null);
  const [status, setStatus] = useState('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [empRes, callRes] = await Promise.allSettled([getAllEmployeesSafe(api), api.get('/api/calls/stats')]);
      if (empRes.status === 'fulfilled') {
        const val = empRes.value;
        setEmployees(Array.isArray(val) ? val : (val?.data?.data || []));
      }
      if (callRes.status === 'fulfilled') setCallStats(callRes.value.data?.data);
      setLoading(false);
    })();
  }, []);

  // Full per-employee stats (employeeStats), not the top-5 topDialers list the page used to read —
  // which showed 0 calls for everyone outside the day's top five.
  const rows = useMemo(() => {
    const byId = new Map((callStats?.today?.employeeStats || []).map((s) => [s.employeeId, s]));
    return employees.map((e) => {
      const s = byId.get(String(e._id));
      return {
        ...e,
        statusKey: e.isActive === false ? 'inactive' : 'active',
        todayCalls: s?.count || 0,
        connRate: s?.count ? s.connRate : null,
        target: e.dailyTarget || 0,
      };
    }).sort((a, b) => b.todayCalls - a.todayCalls || (a.name || '').localeCompare(b.name || ''));
  }, [employees, callStats]);

  const counts = { all: rows.length, active: rows.filter((r) => r.statusKey === 'active').length, inactive: rows.filter((r) => r.statusKey === 'inactive').length };
  const visible = status === 'all' ? rows : rows.filter((r) => r.statusKey === status);
  const calledToday = rows.filter((r) => r.todayCalls > 0).length;

  const columns = [
    {
      key: 'name', label: 'Employee', width: '28%',
      filterValue: (e) => `${e.name} ${e.email || ''} ${e.ryanEmployeeCode || ''}`,
      render: (e) => (
        <Link href={`/employees/${e._id}`} className="flex items-center gap-3 min-w-0 group/emp">
          <span className="w-8 h-8 rounded-full bg-gray-100 text-ink-2 flex items-center justify-center text-xs font-semibold shrink-0">{initials(e.name)}</span>
          <span className="min-w-0">
            <span className="block font-medium text-ink truncate group-hover/emp:text-[var(--blue)] transition-colors">{e.name || '—'}</span>
            <span className="block text-xs text-ink-3 truncate">{e.email || ''}</span>
          </span>
        </Link>
      ),
    },
    { key: 'tlName', label: 'Team lead', width: '13%', render: (e) => e.tlName || <span className="text-ink-4">—</span> },
    { key: 'phone', label: 'Phone', width: '13%', render: (e) => <span className="tabular-nums">{e.phone || '—'}</span> },
    {
      key: 'todayCalls', label: 'Today', width: '20%', searchable: false,
      render: (e) => (
        <div className="flex items-center gap-3">
          <span className="tabular-nums w-16 shrink-0"><b className={`font-semibold ${e.todayCalls ? 'text-ink' : 'text-ink-4'}`}>{fmtNum(e.todayCalls)}</b>{e.target > 0 && <span className="text-ink-3"> / {fmtNum(e.target)}</span>}</span>
          {e.target > 0 && (
            <span className="progress-bar flex-1 max-w-[120px]">
              <span className="progress-fill block" style={{ width: `${Math.min(100, (e.todayCalls / e.target) * 100)}%`, background: e.todayCalls >= e.target ? 'var(--met)' : 'var(--blue)' }} />
            </span>
          )}
        </div>
      ),
    },
    { key: 'connRate', label: 'Connected', align: 'right', width: '10%', searchable: false, render: (e) => (e.connRate == null ? <span className="text-ink-4">—</span> : `${e.connRate}%`) },
    {
      key: 'statusKey', label: 'Status', width: '10%', searchable: false,
      render: (e) => (
        <span className="inline-flex items-center gap-1.5 text-[13px]">
          <span className={`w-1.5 h-1.5 rounded-full ${e.statusKey === 'active' ? 'bg-[var(--met)]' : 'bg-gray-300'}`} />
          <span className={e.statusKey === 'active' ? 'text-ink-2' : 'text-ink-3'}>{e.statusKey === 'active' ? 'Active' : 'Inactive'}</span>
        </span>
      ),
    },
    {
      key: 'go', label: '', width: '6%', sortable: false, searchable: false, align: 'right',
      render: (e) => (
        <Link href={`/employees/${e._id}`} aria-label={`Open ${e.name}`} className="inline-flex w-7 h-7 items-center justify-center rounded-md text-ink-4 hover:text-ink hover:bg-gray-100 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        description={loading ? 'Loading team…' : `${fmtNum(counts.all)} employees · ${fmtNum(counts.active)} active · ${fmtNum(calledToday)} calling today`}
        actions={
          <>
            <Link href="/employees/leaderboard" className="btn-secondary">Leaderboard</Link>
            {isAdmin && <Link href="/users/update-users" className="btn-primary">Add employee</Link>}
          </>
        }
      />

      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="seg" role="group" aria-label="Filter by status">
          {[['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']].map(([k, l]) => (
            <button key={k} aria-pressed={status === k} onClick={() => setStatus(k)}>
              {l} <span className="ml-1 text-ink-3 tabular-nums">{loading ? '' : fmtNum(counts[k])}</span>
            </button>
          ))}
        </div>
      </div>

      <DataTable
        loading={loading}
        rows={visible}
        columns={columns}
        pageSize={25}
        getRowId={(e) => e._id}
        emptyTitle={status === 'inactive' ? 'No inactive employees' : 'No employees yet'}
        emptyHint={status === 'all' ? 'Employees you add appear here with their daily call progress.' : 'Switch the filter to see everyone.'}
      />
    </div>
  );
}
