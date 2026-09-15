'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '../../../../lib/api';
import { todayIST } from '../../../../lib/timezone';
import {
  DataTable, StatCard, EmptyState,
  UsersIco, CheckIco, PhoneIco, GaugeIco,
} from '../../../../components/report-shared';

function RefreshIco({ spinning }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={spinning ? 'animate-spin' : ''}>
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
function ChevronRightIco() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>;
}

function AchievementBar({ pct }) {
  if (pct == null) return <span className="text-xs text-gray-400">No target</span>;
  const color = pct >= 100 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626';
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-1.5 rounded-full overflow-hidden bg-gray-200">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-9 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

function avatarColor(id) {
  const colors = ['#2563EB', '#16A34A', '#D97706', '#7C3AED', '#0D9488', '#DC2626'];
  const s = String(id || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

export default function ActiveUsersPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(new Date());
  const [search, setSearch] = useState('');

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      // Same endpoint the Employee Reports page uses. Scoped to today only —
      // the endpoint's own default (no startDate/endDate) is a rolling 29-day
      // window, which made this page scan a month of calls/leads on every
      // 30s poll for a screen that only needs today's snapshot.
      const today = todayIST();
      const res = await api.get('/api/reports/employees-periodic', {
        params: { tab: 'summary', startDate: today, endDate: today },
      });
      setReport(res.data?.data || null);
    } catch {
      setReport(null);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { setNow(new Date()); load(true); }, 30000);
    return () => clearInterval(t);
  }, [load]);

  const all = report?.employeePerformance || [];
  const active = all.filter((u) => u.isActive);
  const filtered = active.filter((u) =>
    !search || u.employeeName?.toLowerCase().includes(search.toLowerCase()) || (u.phone || '').includes(search)
  );

  const avgTarget = active.length
    ? Math.round(active.reduce((s, u) => s + (u.dailyTarget || 0), 0) / active.length)
    : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Active Users
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            </span>
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? 'Loading…' : `${active.length} of ${all.length} employees active`} · updated {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
            <RefreshIco spinning={refreshing} /> Refresh
          </button>
          <Link href="/users" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors">
            Manage Users <ChevronRightIco />
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard loading={loading} label="Active Now" value={active.length.toLocaleString()} color="#16A34A" icon={<CheckIco />} />
        <StatCard loading={loading} label="Inactive" value={(all.length - active.length).toLocaleString()} color="#DC2626" icon={<UsersIco />} />
        <StatCard loading={loading} label="Calls Today" value={(report?.kpis?.totalCalls ?? 0).toLocaleString()} color="#2563EB" icon={<PhoneIco />} />
        <StatCard loading={loading} label="Avg Daily Target" value={avgTarget.toLocaleString()} color="#D97706" icon={<GaugeIco />} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-900">Currently Active</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">{filtered.length}</span>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="form-input max-w-xs"
          />
        </div>

        {!loading && active.length === 0 ? (
          <EmptyState title="No one is active right now" hint="Employees marked inactive won't show here — check the Manage Users page." />
        ) : (
          <DataTable
            loading={loading}
            pageSize={15}
            emptyTitle="No matches"
            emptyHint="Try a different search."
            columns={[
              {
                key: 'employeeName', label: 'Employee',
                render: (u) => (
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm"
                        style={{ background: avatarColor(u.employeeId) }}>
                        {(u.employeeName || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{u.employeeName}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                  </div>
                ),
              },
              { key: 'phone', label: 'Phone', searchable: false, render: (u) => u.phone || '—' },
              { key: 'dailyTarget', label: 'Daily Target', align: 'right', searchable: false },
              { key: 'totalCalls', label: 'Calls Today', align: 'right', searchable: false, render: (u) => <span className="font-semibold text-blue-600">{u.totalCalls}</span> },
              { key: 'leadsAssigned', label: 'Leads', align: 'right', searchable: false },
              { key: 'targetAchievement', label: 'Target', align: 'right', sortable: false, searchable: false, render: (u) => <AchievementBar pct={u.targetAchievement} /> },
              {
                key: 'actions', label: '', sortable: false, searchable: false, align: 'right',
                render: (u) => (
                  <Link href="/users" className="text-xs font-medium text-blue-600 hover:underline">
                    Manage
                  </Link>
                ),
              },
            ]}
            rows={filtered}
          />
        )}
      </div>
    </div>
  );
}