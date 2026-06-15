'use client';
import { useEffect, useState, useRef } from 'react';
import Pusher from 'pusher-js';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../../../lib/api';
import CallTypeBadge from '../../../components/CallTypeBadge';

const TYPE_COLORS = {
  incoming: '#10B981',
  outgoing: '#F59E0B',
  missed:   '#EF4444',
  rejected: '#8B5CF6',
};

/* ---------- Inline SVG icons ---------- */
function Svg({ children, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const PhoneIco     = () => <Svg><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Svg>;
const ArrowInIco   = () => <Svg><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></Svg>;
const ArrowOutIco  = () => <Svg><polyline points="1 6 10.5 15.5 15.5 10.5 23 18"/><polyline points="7 6 1 6 1 12"/></Svg>;
const MissedIco    = () => <Svg><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/></Svg>;
const CheckPhoneIco= () => <Svg><polyline points="20 6 9 17 4 12"/></Svg>;
const UsersIco     = () => <Svg><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg>;
const RefreshIco   = () => <Svg size={16}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></Svg>;

/* ---------- KPI Card ---------- */
function KpiCard({ label, value, Icon, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex flex-col gap-3 hover:shadow-card-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`} style={{ color: iconColor }}>
          <Icon />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-textPrimary leading-none">{value ?? '—'}</p>
        <p className="text-textMuted text-xs mt-1 font-medium uppercase tracking-wide">{label}</p>
      </div>
    </div>
  );
}

/* ---------- Period stat row ---------- */
function StatRow({ label, value, subLabel, subValue, color = '#0F172A', subColor = '#475569' }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div>
        <p className="font-bold text-base leading-none" style={{ color }}>{value ?? '—'}</p>
        <p className="text-xs text-textMuted mt-0.5">{label}</p>
      </div>
      {subLabel && (
        <div className="text-right">
          <p className="font-semibold text-sm leading-none" style={{ color: subColor }}>{subValue ?? '—'}</p>
          <p className="text-xs text-textMuted mt-0.5">{subLabel}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- Period Panel ---------- */
function PeriodPanel({ title, date, data, accent = '#1A6BFF' }) {
  if (!data) {
    return (
      <div className="bg-white rounded-2xl border border-border shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 rounded-full" style={{ background: accent }} />
          <h3 className="font-bold text-textPrimary">{title}</h3>
          {date && <span className="text-xs text-textMuted">{date}</span>}
        </div>
        <div className="flex items-center justify-center h-40 text-textMuted text-sm">Loading…</div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-1 h-5 rounded-full" style={{ background: accent }} />
        <div>
          <h3 className="font-bold text-textPrimary leading-none">{title}</h3>
          <p className="text-xs text-textMuted mt-0.5">{date || data.date || ''}</p>
        </div>
      </div>
      <StatRow label="Total Calls"     value={data.totalCalls}     color={accent}
        subLabel="Duration"            subValue={data.callDuration}    subColor="#475569" />
      <StatRow label="Incoming"        value={data.incoming}       color="#10B981"
        subLabel="In Duration"         subValue={data.incomingDuration} subColor="#10B981" />
      <StatRow label="Outgoing"        value={data.outgoing}       color="#F59E0B"
        subLabel="Out Duration"        subValue={data.outgoingDuration} subColor="#F59E0B" />
      <StatRow label="Missed"          value={data.missed}         color="#EF4444"
        subLabel="Rejected"            subValue={data.rejected}        subColor="#8B5CF6" />
      <StatRow label="Connected"       value={data.connectedCalls} color="#0EA5E9"
        subLabel="Unique Clients"      subValue={data.uniqueClients}   subColor="#475569" />
      <StatRow label="Working Hours"   value={data.workingHours}  color="#475569" />
    </div>
  );
}

/* ---------- Create Lead Modal ---------- */
function CreateLeadModal({ call, onClose, onCreated, employees }) {
  const [form, setForm] = useState({
    name:       call?.contactName && call.contactName !== 'Unknown' ? call.contactName : '',
    phone:      call?.contactNumber || '',
    email:      '',
    source:     'Call',
    assignedTo: '',
    status:     'new',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/api/leads/from-call', { ...form, callId: call?._id });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create lead');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl border border-border shadow-modal w-full max-w-md">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-bold text-textPrimary">Create Lead from Call</h3>
            <p className="text-textMuted text-xs mt-0.5">{call?.contactNumber}</p>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-danger transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dangerLt text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {error && <p className="text-danger text-xs bg-dangerLt border border-red-200 rounded-xl px-3 py-2">{error}</p>}
          {[
            { key: 'name',  label: 'Full Name', type: 'text',  required: true,  readOnly: false },
            { key: 'phone', label: 'Phone',     type: 'text',  required: true,  readOnly: true  },
            { key: 'email', label: 'Email',     type: 'email', required: false, readOnly: false },
          ].map(({ key, label, type, required, readOnly }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-textSecondary mb-1">{label}</label>
              <input
                type={type} value={form[key]} required={required} readOnly={readOnly}
                onChange={e => !readOnly && setForm({ ...form, [key]: e.target.value })}
                className={`w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${readOnly ? 'bg-bg text-textMuted cursor-default' : 'bg-bg'}`}
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-textSecondary mb-1">Assign To</label>
            <select value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })}
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="">Unassigned</option>
              {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-border text-textSecondary py-2.5 rounded-xl text-sm font-medium hover:border-danger hover:text-danger transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primaryDk disabled:opacity-60 transition-colors">
              {loading ? 'Creating…' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ======================================================= */
export default function DashboardPage() {
  const [stats,           setStats]           = useState(null);
  const [liveFeed,        setLiveFeed]        = useState([]);
  const [employees,       setEmployees]       = useState([]);
  const [createLeadCall,  setCreateLeadCall]  = useState(null);
  const channelRef = useRef(null);

  const fetchStats = async () => {
    try {
      const res = await api.get('/api/calls/stats');
      setStats(res.data.data);
    } catch {}
  };

  useEffect(() => {
    fetchStats();
    api.get('/api/employees').then(r => setEmployees(r.data.data)).catch(() => {});
    // Seed live feed on mount so a page refresh doesn't wipe it
    api.get('/api/calls/realtime').then(r => setLiveFeed((r.data.data || []).slice(0, 20))).catch(() => {});
    const interval = setInterval(fetchStats, 30000);

    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return () => clearInterval(interval);
    const pusher  = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2',
    });
    const channel = pusher.subscribe('managers');
    channelRef.current = channel;
    channel.bind('new_call_log', data => {
      setLiveFeed(prev => [data, ...prev].slice(0, 20));
      fetchStats();
    });
    return () => {
      clearInterval(interval);
      channel.unbind_all();
      pusher.unsubscribe('managers');
      pusher.disconnect();
    };
  }, []);

  const today = stats?.today;

  const kpis = [
    { label: 'Total Calls',    value: today?.totalCalls,    Icon: PhoneIco,      iconBg: 'bg-primaryLt',  iconColor: '#1A6BFF' },
    { label: 'Incoming',       value: today?.incoming,      Icon: ArrowInIco,    iconBg: 'bg-successLt',  iconColor: '#10B981' },
    { label: 'Outgoing',       value: today?.outgoing,      Icon: ArrowOutIco,   iconBg: 'bg-warningLt',  iconColor: '#F59E0B' },
    { label: 'Missed',         value: today?.missed,        Icon: MissedIco,     iconBg: 'bg-dangerLt',   iconColor: '#EF4444' },
    { label: 'Connected',      value: today?.connectedCalls,Icon: CheckPhoneIco, iconBg: 'bg-tealLt',     iconColor: '#0EA5E9' },
    { label: 'Unique Clients', value: today?.uniqueClients, Icon: UsersIco,      iconBg: 'bg-purpleLt',   iconColor: '#8B5CF6' },
  ];

  const todayPieData = today
    ? [
        { name: 'Incoming', value: today.incoming  || 0, color: TYPE_COLORS.incoming  },
        { name: 'Outgoing', value: today.outgoing  || 0, color: TYPE_COLORS.outgoing  },
        { name: 'Missed',   value: today.missed    || 0, color: TYPE_COLORS.missed    },
        { name: 'Rejected', value: today.rejected  || 0, color: TYPE_COLORS.rejected  },
      ].filter(d => d.value > 0)
    : [];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-textPrimary">{greeting} 👋</h2>
          <p className="text-textMuted text-sm mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={fetchStats}
          className="flex items-center gap-2 text-sm text-textSecondary border border-border px-3.5 py-2 rounded-xl hover:border-primary hover:text-primary transition-all bg-white shadow-card">
          <RefreshIco />
          Refresh
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Bar chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-border shadow-card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-textPrimary font-semibold text-sm">Calls Per Hour</h3>
            <span className="text-xs text-textMuted bg-bg border border-border px-2 py-1 rounded-lg">Today</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.callsPerHour || []} barCategoryGap="38%">
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#1A6BFF" stopOpacity={0.9}/>
                  <stop offset="100%" stopColor="#1A6BFF" stopOpacity={0.4}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: '#94A3B8', fontSize: 11 }}
                tickFormatter={h => `${h}:00`} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                labelFormatter={h => `${h}:00`}
                cursor={{ fill: '#F1F5F9', radius: 6 }}
              />
              <Bar dataKey="count" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="text-textPrimary font-semibold text-sm mb-5">Today's Breakdown</h3>
          {todayPieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-textMuted text-sm gap-2">
              <span className="text-4xl">📭</span>
              <p>No calls yet today</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={todayPieData} cx="50%" cy="45%" innerRadius={52} outerRadius={78}
                  paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {todayPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#475569' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Top Dialers */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="text-textPrimary font-semibold text-sm mb-5">Top Dialers Today</h3>
          {(stats?.topDialers?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-textMuted text-sm gap-2">
              <span className="text-3xl">🏆</span>
              <p>No data yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(stats.topDialers || []).map((d, i) => {
                const pct = Math.min(100, (d.count / (stats.topDialers[0]?.count || 1)) * 100);
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={d.employeeId} className="flex items-center gap-3">
                    <span className="text-base w-6 flex-shrink-0 select-none">
                      {medals[i] || <span className="w-6 h-6 rounded-full bg-bg text-textMuted text-xs flex items-center justify-center font-bold">{i + 1}</span>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-textPrimary text-xs font-semibold truncate">{d.name}</p>
                        <span className="text-textSecondary font-bold text-xs ml-2 flex-shrink-0">{d.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all duration-700"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Call Feed */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-border shadow-card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-textPrimary font-semibold text-sm">Live Call Feed</h3>
            <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Real-time
            </span>
          </div>
          {liveFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-textMuted text-sm gap-2">
              <span className="text-3xl">📡</span>
              <p>Waiting for incoming calls…</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {liveFeed.map((log, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0 animate-slide-down">
                  <div className="flex items-center gap-3 min-w-0">
                    <CallTypeBadge type={log.callType} />
                    <div className="min-w-0">
                      <p className="text-textPrimary text-sm font-medium truncate">{log.employeeName}</p>
                      <p className="text-textMuted text-xs truncate">{log.contactNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <div className="text-right">
                      <p className="text-textSecondary text-xs font-medium">
                        {log.duration ? `${Math.floor(log.duration / 60)}m ${log.duration % 60}s` : '—'}
                      </p>
                      <p className="text-textMuted text-xs">{new Date(log.timestamp).toLocaleTimeString()}</p>
                    </div>
                    {!log.hasLead && (
                      <button onClick={() => setCreateLeadCall(log)}
                        className="text-xs bg-primaryLt text-primary border border-blue-200 px-2.5 py-1 rounded-lg font-semibold hover:bg-primary hover:text-white transition-colors whitespace-nowrap">
                        + Lead
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Period Comparison Panels ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <PeriodPanel title="Today"     data={stats?.today}     accent="#1A6BFF" />
        <PeriodPanel title="Yesterday" data={stats?.yesterday} accent="#8B5CF6" />
        <PeriodPanel title="Last Week" date={stats?.lastWeek?.period} data={stats?.lastWeek} accent="#F59E0B" />
      </div>

      {createLeadCall && (
        <CreateLeadModal
          call={createLeadCall}
          employees={employees}
          onClose={() => setCreateLeadCall(null)}
          onCreated={() => {}}
        />
      )}
    </div>
  );
}
