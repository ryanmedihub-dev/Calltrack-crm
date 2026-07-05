'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../../../../lib/api';
import { fmtTime } from '../../../../lib/timezone';
import { triggerLocalExport } from '../../../../lib/downloads';
import {
  DataTable, ChartTip, EmptyState, TYPE_META,
  PhoneIco, UsersIco, CheckIco, XIco, ClockIco, DownloadIco,
} from '../../../../components/report-shared';

/* Backend only computes today / yesterday / last-7-days aggregates
   (see computePeriodStats in routes/callLogs.js) — there is no
   thisWeek/thisMonth bucket, so the period switch must match that. */
const PERIODS = [
  { key: 'today',     label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'lastWeek',  label: 'Last 7 Days' },
];

const TABS = [
  { key: 'summary',  label: 'Summary' },
  { key: 'rankings', label: 'Rankings' },
  { key: 'hourly',   label: 'Hourly Analysis' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

function initials(name) {
  return (name || 'U').slice(0, 2).toUpperCase();
}

function utcHourToIST(h) {
  const ist = Math.floor((h + 5.5) % 24);
  const ampm = ist >= 12 ? 'PM' : 'AM';
  const h12 = ist % 12 || 12;
  return `${h12} ${ampm}`;
}

/* ── Small pieces ─────────────────────────────────────────── */
function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-300 shrink-0">{icon}</span>
      <span className="text-xs text-gray-500 flex-1">{label}</span>
      <span className="text-base font-bold text-gray-900 tabular-nums">{value}</span>
    </div>
  );
}

function AccentCard({ title, name, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-blue-600 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <p className="text-sm font-bold text-gray-900 mt-1.5 truncate">{name || '—'}</p>
      <p className="text-xl font-extrabold text-blue-600 mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function LeaderboardPage() {
  const [period,  setPeriod]  = useState('today');
  const [tab,      setTab]     = useState('summary');
  const [chartMode, setChartMode] = useState('bar');
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/calls/stats');
        if (!ignore) setStats(res.data.data);
      } catch {
        if (!ignore) {
          setStats(null);
          toast.error('Failed to load report');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  const data      = stats?.[period];
  const dialers   = data?.topDialers || [];
  const total     = data?.totalCalls || 0;
  const maxCalls  = dialers[0]?.count || 1;

  const rows = dialers.map((d, i) => ({
    ...d,
    rank: i + 1,
    share: total ? Math.round((d.count / total) * 100) : 0,
  }));

  const callTypeRows = data ? [
    { key: 'incoming', label: TYPE_META.incoming.label, color: TYPE_META.incoming.color, calls: data.incoming, duration: data.incomingDuration },
    { key: 'outgoing', label: TYPE_META.outgoing.label, color: TYPE_META.outgoing.color, calls: data.outgoing, duration: data.outgoingDuration },
    { key: 'missed',   label: TYPE_META.missed.label,   color: TYPE_META.missed.color,   calls: data.missed,   duration: '—' },
    { key: 'rejected', label: TYPE_META.rejected.label,  color: TYPE_META.rejected.color, calls: data.rejected, duration: '—' },
  ] : [];

  const donutData = callTypeRows.filter((r) => r.calls > 0).map((r) => ({ name: r.label, value: r.calls, color: r.color }));

  const hourlyRows = (data?.callsPerHour || [])
    .map((h) => ({ hour: h.hour, label: utcHourToIST(h.hour), calls: h.count }))
    .sort((a, b) => ((a.hour + 5.5) % 24) - ((b.hour + 5.5) % 24))
    .map((h) => ({ ...h, pct: total ? Math.round((h.calls / total) * 1000) / 10 : 0 }));

  const exportCSV = () => {
    const csvRows = [['Rank', 'Agent', 'Calls', 'Share %'], ...rows.map((r) => [r.rank, r.name, r.count, r.share])];
    triggerLocalExport({
      label: 'Leaderboard',
      filename: `leaderboard-${period}.csv`,
      csv: csvRows.map((r) => r.join(',')).join('\n'),
    });
  };

  const columns = [
    {
      key: 'rank', label: 'Rank', sortable: false, searchable: false,
      render: (row) => row.rank <= 3 ? <span className="text-lg">{MEDALS[row.rank - 1]}</span> : <span className="font-bold text-xs text-gray-400">#{row.rank}</span>,
    },
    {
      key: 'name', label: 'Agent',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 bg-blue-600">{initials(row.name)}</div>
          <span className="font-semibold text-sm text-gray-900">{row.name || 'Unknown'}</span>
        </div>
      ),
    },
    { key: 'count', label: 'Calls', align: 'right', render: (row) => <span className="font-bold text-blue-600">{row.count}</span> },
    {
      key: 'share', label: 'Share', align: 'right', searchable: false,
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <div className="w-20 h-1.5 rounded-full overflow-hidden bg-gray-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${(row.count / maxCalls) * 100}%` }} /></div>
          <span className="text-xs tabular-nums w-9 text-right text-gray-400">{row.share}%</span>
        </div>
      ),
    },
    { key: 'first', label: 'First Call', align: 'right', searchable: false, render: (row) => <span className="text-xs tabular-nums text-gray-400">{row.first ? fmtTime(row.first) : '—'}</span> },
    { key: 'last',  label: 'Last Call',  align: 'right', searchable: false, render: (row) => <span className="text-xs tabular-nums text-gray-400">{row.last ? fmtTime(row.last) : '—'}</span> },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            Employees <span className="text-gray-300">/</span> <span className="text-gray-500">Leaderboard</span>
          </p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">Leaderboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {PERIODS.map((p) => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${period === p.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} disabled={!rows.length}
            className="flex items-center gap-2 px-3.5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium shadow-sm disabled:opacity-40">
            <DownloadIco /> Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-nav">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`tab-item${tab === t.key ? ' active' : ''}`}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="h-64 bg-white rounded-xl border border-gray-200 animate-pulse" />
          <div className="h-64 bg-white rounded-xl border border-gray-200 animate-pulse" />
          <div className="h-64 bg-white rounded-xl border border-gray-200 animate-pulse" />
        </div>
      ) : !data || data.totalCalls === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState title="No data for this period" hint="Try a different time range." />
        </div>
      ) : (
        <>
          {/* ── Summary tab ── */}
          {tab === 'summary' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Call Type Breakdown</h3>
                <table className="data-table">
                  <thead><tr><th>Call Type</th><th>Calls</th><th>Duration</th></tr></thead>
                  <tbody>
                    {callTypeRows.map((r) => (
                      <tr key={r.key}>
                        <td><span className="font-medium" style={{ color: r.color }}>{r.label}</span></td>
                        <td>{r.calls}</td>
                        <td>{r.duration}</td>
                      </tr>
                    ))}
                    <tr><td className="font-bold text-gray-900">Total</td><td className="font-bold text-gray-900">{data.totalCalls}</td><td className="font-bold text-gray-900">{data.callDuration}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1">Key Metrics</h3>
                <div className="mt-3">
                  <InfoRow icon={<XIco s={16} />} label="Never Attended" value={data.neverAttended} />
                  <InfoRow icon={<PhoneIco s={16} />} label="Not Pickup by Client" value={data.notPickupByClient} />
                  <InfoRow icon={<CheckIco s={16} />} label="Connected Calls" value={data.connectedCalls} />
                  <InfoRow icon={<UsersIco s={16} />} label="Unique Clients" value={data.uniqueClients} />
                  <InfoRow icon={<UsersIco s={16} />} label="Active Agents" value={data.activeEmployees} />
                  <InfoRow icon={<ClockIco s={16} />} label="Working Hours" value={data.workingHours} />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Call Distribution</h3>
                {donutData.length === 0 ? <EmptyState title="No data" hint="" /> : (
                  <>
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={donutData} cx="50%" cy="50%" innerRadius={56} outerRadius={82} paddingAngle={2} dataKey="value">
                            {donutData.map((d, i) => <Cell key={i} fill={d.color} stroke="#fff" strokeWidth={2} />)}
                          </Pie>
                          <Tooltip content={<ChartTip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-xl font-extrabold text-gray-900">{data.totalCalls}</p>
                        <p className="text-[11px] text-gray-400">Calls</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                      {donutData.map((d) => (
                        <span key={d.name} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: d.color }} />{d.name}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Rankings tab ── */}
          {tab === 'rankings' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <AccentCard title="Top Dialer" name={dialers[0]?.name} value={dialers[0] ? `${dialers[0].count} calls` : '—'} />
                <AccentCard title="Runner-up" name={dialers[1]?.name} value={dialers[1] ? `${dialers[1].count} calls` : '—'} />
                <AccentCard title="Third Place" name={dialers[2]?.name} value={dialers[2] ? `${dialers[2].count} calls` : '—'} />
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1">Full Rankings</h3>
                <p className="text-xs text-gray-400 mb-3">Ranked by call volume for the selected period</p>
                <DataTable
                  columns={columns}
                  rows={rows}
                  loading={loading}
                  pageSize={10}
                  emptyTitle="No agents found"
                  emptyHint="Try a different time range."
                  footer={{ name: 'Total', count: total.toLocaleString() }}
                />
              </div>
            </div>
          )}

          {/* ── Hourly Analysis tab ── */}
          {tab === 'hourly' && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900">Calls by Hour</h3>
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    {[['line', 'Line Chart'], ['bar', 'Bar Chart']].map(([v, l]) => (
                      <button key={v} onClick={() => setChartMode(v)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${chartMode === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  {chartMode === 'line' ? (
                    <LineChart data={hourlyRows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={1} />
                      <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                      <Tooltip content={<ChartTip />} />
                      <Line type="monotone" dataKey="calls" name="Calls" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3, fill: '#2563EB' }} />
                    </LineChart>
                  ) : (
                    <BarChart data={hourlyRows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={1} />
                      <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="calls" name="Calls" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 overflow-x-auto">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Hourly Breakdown</h3>
                <table className="data-table" style={{ minWidth: 480 }}>
                  <thead><tr><th>Hour (IST)</th><th style={{ textAlign: 'right' }}>Calls</th><th style={{ textAlign: 'right' }}>% of Total</th></tr></thead>
                  <tbody>
                    {hourlyRows.map((h) => (
                      <tr key={h.hour}>
                        <td>{h.label}</td>
                        <td style={{ textAlign: 'right' }} className="tabular-nums">{h.calls}</td>
                        <td style={{ textAlign: 'right' }} className="tabular-nums">{h.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}