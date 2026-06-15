'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { SkeletonTable } from '../../../components/Skeleton';

const ACTION_CONFIG = {
  'lead.create': { label: 'Lead Created',  color: '#10B981', bg: '#ECFDF5', icon: '➕' },
  'lead.update': { label: 'Lead Updated',  color: '#F59E0B', bg: '#FFFBEB', icon: '✎'  },
  'lead.delete': { label: 'Lead Deleted',  color: '#EF4444', bg: '#FEF2F2', icon: '🗑' },
  'call.sync':   { label: 'Calls Synced',  color: '#1A6BFF', bg: '#EFF6FF', icon: '🔄' },
  'auth.login':  { label: 'Login',         color: '#8B5CF6', bg: '#F5F3FF', icon: '🔑' },
};

function getActionCfg(action) {
  return ACTION_CONFIG[action] || { label: action, color: '#64748B', bg: '#F8FAFC', icon: '•' };
}

function groupByDate(logs) {
  const map = {};
  logs.forEach(log => {
    const date = new Date(log.createdAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    if (!map[date]) map[date] = [];
    map[date].push(log);
  });
  return Object.entries(map);
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function buildDescription(log) {
  if (log.details?.name) return log.details.name;
  if (log.details?.phone) return log.details.phone;
  return log.entity || '';
}

export default function ActivityLogPage() {
  const [logs,       setLogs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const [actionFilter, setActionFilter] = useState('all');
  const [employees,  setEmployees]  = useState([]);
  const [empFilter,  setEmpFilter]  = useState('all');
  const LIMIT = 50;

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: LIMIT };
      if (actionFilter !== 'all') params.action = actionFilter;
      if (empFilter    !== 'all') params.userId  = empFilter;
      const res = await api.get('/api/audit-logs', { params });
      const data = res.data.data;
      setLogs(data?.logs || []);
      setTotal(data?.total || 0);
      setPage(p);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    api.get('/api/employees').then(r => setEmployees(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => { load(1); }, [actionFilter, empFilter]);

  const grouped = groupByDate(logs);
  const pages   = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-textPrimary">Activity Log</h2>
        <p className="text-textMuted text-sm mt-0.5">Audit trail of all manager and system actions</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
          <option value="all">All Actions</option>
          {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>

        <select value={empFilter} onChange={e => setEmpFilter(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
          <option value="all">All Users</option>
          {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>

        <p className="text-xs text-textMuted ml-auto">{total.toLocaleString()} total records</p>
      </div>

      {/* Timeline */}
      {loading ? (
        <SkeletonTable rows={8} />
      ) : logs.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-16 text-center shadow-card">
          <p className="text-textMuted text-sm">No activity found for selected filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, dayLogs]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-bold text-textMuted bg-bg border border-border rounded-full px-3 py-1 flex-shrink-0">
                  {date}
                </span>
                <span className="text-xs text-textMuted flex-shrink-0">{dayLogs.length} events</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
                <div className="divide-y divide-border">
                  {dayLogs.map((log, i) => {
                    const cfg  = getActionCfg(log.action);
                    const desc = buildDescription(log);
                    return (
                      <div key={log._id || i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg transition-colors">
                        <span className="text-xs text-textMuted font-mono w-14 flex-shrink-0 tabular-nums">
                          {formatTime(log.createdAt)}
                        </span>

                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ background: cfg.bg, color: cfg.color }}>
                          {cfg.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-textPrimary truncate">
                            {cfg.label}{desc ? `: ${desc}` : ''}
                          </p>
                          {log.userName && (
                            <p className="text-xs text-textMuted">{log.userName}</p>
                          )}
                        </div>

                        <span className="hidden md:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ color: cfg.color, background: cfg.bg }}>
                          {log.entity || 'System'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page === 1} onClick={() => load(page - 1)}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-textSecondary hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            ← Prev
          </button>
          <span className="text-sm text-textMuted px-2">Page {page} of {pages}</span>
          <button disabled={page === pages} onClick={() => load(page + 1)}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-textSecondary hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
