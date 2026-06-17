'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Pusher from 'pusher-js';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import api from '../../../lib/api';
import CallTypeBadge from '../../../components/CallTypeBadge';

const TYPE_COLORS = {
  incoming: '#10B981', outgoing: '#F59E0B', missed: '#EF4444', rejected: '#8B5CF6',
};

function Svg({ children, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const PhoneIco      = () => <Svg><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Svg>;
const ArrowInIco    = () => <Svg><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></Svg>;
const ArrowOutIco   = () => <Svg><polyline points="1 6 10.5 15.5 15.5 10.5 23 18"/><polyline points="7 6 1 6 1 12"/></Svg>;
const MissedIco     = () => <Svg><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/></Svg>;
const CheckIco      = () => <Svg><polyline points="20 6 9 17 4 12"/></Svg>;
const UsersIco      = () => <Svg><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg>;
const ClockIco      = () => <Svg><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Svg>;
const RefreshIco    = () => <Svg size={16}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></Svg>;
const TrendUpIco    = () => <Svg size={14}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Svg>;
const TrendDownIco  = () => <Svg size={14}><polyline points="1 6 10.5 15.5 15.5 10.5 23 18"/><polyline points="7 18 1 18 1 12"/></Svg>;
const ChevronIco    = () => <Svg size={14}><polyline points="9 18 15 12 9 6"/></Svg>;

function fmtDur(sec) {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function trend(current, prev) {
  if (!prev || prev === 0) return null;
  const pct = Math.round(((current - prev) / prev) * 100);
  return pct;
}

/* ── Clickable KPI Card ── */
function KpiCard({ label, value, Icon, iconBg, iconColor, href, sub, delta }) {
  const content = (
    <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex flex-col gap-3 hover:shadow-card-md hover:-translate-y-0.5 transition-all cursor-pointer group">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`} style={{ color: iconColor }}>
          <Icon />
        </div>
        <span className="text-textMuted group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
          <ChevronIco />
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold text-textPrimary leading-none tabular-nums">{value ?? '—'}</p>
        <p className="text-textMuted text-xs mt-1 font-medium uppercase tracking-wide">{label}</p>
      </div>
      {(delta !== null && delta !== undefined) && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${delta >= 0 ? 'text-success' : 'text-danger'}`}>
          {delta >= 0 ? <TrendUpIco /> : <TrendDownIco />}
          {Math.abs(delta)}% vs yesterday
        </div>
      )}
      {sub && !delta && <p className="text-xs text-textMuted">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

/* ── Period stat row ── */
function StatRow({ label, value, subLabel, subValue, color = '#0F172A', subColor = '#475569' }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div>
        <p className="font-bold text-sm leading-none" style={{ color }}>{value ?? '—'}</p>
        <p className="text-xs text-textMuted mt-0.5">{label}</p>
      </div>
      {subLabel && (
        <div className="text-right">
          <p className="font-semibold text-xs leading-none" style={{ color: subColor }}>{subValue ?? '—'}</p>
          <p className="text-xs text-textMuted mt-0.5">{subLabel}</p>
        </div>
      )}
    </div>
  );
}

/* ── Period panel ── */
function PeriodPanel({ title, date, data, accent = '#1A6BFF' }) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: accent }} />
        <div className="min-w-0">
          <h3 className="font-bold text-textPrimary text-sm leading-none">{title}</h3>
          {(date || data?.date) && <p className="text-xs text-textMuted mt-0.5 truncate">{date || data.date}</p>}
        </div>
      </div>
      {!data ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="h-8 bg-bg rounded-lg animate-pulse"/>)}</div>
      ) : (
        <>
          <StatRow label="Total Calls"   value={data.totalCalls}     color={accent}
            subLabel="Duration"          subValue={data.callDuration}    subColor="#475569" />
          <StatRow label="Incoming"      value={data.incoming}       color="#10B981"
            subLabel="Duration"          subValue={data.incomingDuration} subColor="#10B981" />
          <StatRow label="Outgoing"      value={data.outgoing}       color="#F59E0B"
            subLabel="Duration"          subValue={data.outgoingDuration} subColor="#F59E0B" />
          <StatRow label="Missed"        value={data.missed}         color="#EF4444"
            subLabel="Rejected"          subValue={data.rejected}        subColor="#8B5CF6" />
          <StatRow label="Connected"     value={data.connectedCalls} color="#0EA5E9"
            subLabel="Unique Clients"    subValue={data.uniqueClients}   subColor="#475569" />
          <StatRow label="Working Hours" value={data.workingHours}   color="#475569" />
        </>
      )}
    </div>
  );
}

/* ── Create Lead Modal ── */
function CreateLeadModal({ call, employees, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: call?.contactName && call.contactName !== 'Unknown' ? call.contactName : '',
    phone: call?.contactNumber || '', email: '', source: 'Call', assignedTo: '', status: 'new',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try { await api.post('/api/leads/from-call', { ...form, callId: call?._id }); onCreated(); onClose(); }
    catch (err) { setError(err.response?.data?.error || 'Failed to create lead'); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border shadow-modal w-full max-w-md">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div><h3 className="font-bold text-textPrimary">Create Lead from Call</h3><p className="text-textMuted text-xs mt-0.5">{call?.contactNumber}</p></div>
          <button onClick={onClose} className="text-textMuted hover:text-danger text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {error && <p className="text-danger text-xs bg-dangerLt border border-red-200 rounded-xl px-3 py-2">{error}</p>}
          {[{key:'name',label:'Full Name',type:'text',required:true,readOnly:false},{key:'phone',label:'Phone',type:'text',required:true,readOnly:true},{key:'email',label:'Email',type:'email',required:false,readOnly:false}].map(({key,label,type,required,readOnly})=>(
            <div key={key}>
              <label className="block text-xs font-medium text-textSecondary mb-1">{label}</label>
              <input type={type} value={form[key]} required={required} readOnly={readOnly}
                onChange={e=>!readOnly&&setForm({...form,[key]:e.target.value})}
                className={`w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${readOnly?'bg-bg text-textMuted':'bg-bg'}`}/>
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-textSecondary mb-1">Assign To</label>
            <select value={form.assignedTo} onChange={e=>setForm({...form,assignedTo:e.target.value})}
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">Unassigned</option>
              {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-textSecondary py-2.5 rounded-xl text-sm font-medium hover:text-danger transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primaryDk disabled:opacity-60 transition-colors">{loading?'Creating…':'Create Lead'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════ */
export default function DashboardPage() {
  const [stats,          setStats]          = useState(null);
  const [liveFeed,       setLiveFeed]       = useState([]);
  const [employees,      setEmployees]      = useState([]);
  const [createLeadCall, setCreateLeadCall] = useState(null);
  const [refreshing,     setRefreshing]     = useState(false);
  const channelRef = useRef(null);

  const fetchStats = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try { const r = await api.get('/api/calls/stats'); setStats(r.data.data); }
    catch {}
    finally { setRefreshing(false); }
  };

  useEffect(() => {
    fetchStats();
    api.get('/api/employees').then(r => setEmployees(r.data.data)).catch(() => {});
    api.get('/api/calls/realtime').then(r => setLiveFeed((r.data.data || []).slice(0, 30))).catch(() => {});
    const interval = setInterval(fetchStats, 30000);
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return () => clearInterval(interval);
    const pusher  = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2' });
    const channel = pusher.subscribe('managers');
    channelRef.current = channel;
    channel.bind('new_call_log', data => { setLiveFeed(prev => [data, ...prev].slice(0, 30)); fetchStats(); });
    return () => { clearInterval(interval); channel.unbind_all(); pusher.unsubscribe('managers'); pusher.disconnect(); };
  }, []);

  const today = stats?.today;
  const yest  = stats?.yesterday;

  const kpis = [
    { label: 'Total Calls',    value: today?.totalCalls,     Icon: PhoneIco,    iconBg: 'bg-primaryLt',  iconColor: '#1A6BFF', href: '/calls',                        delta: trend(today?.totalCalls, yest?.totalCalls) },
    { label: 'Incoming',       value: today?.incoming,        Icon: ArrowInIco,  iconBg: 'bg-successLt',  iconColor: '#10B981', href: '/calls?callType=incoming',       delta: trend(today?.incoming, yest?.incoming) },
    { label: 'Outgoing',       value: today?.outgoing,        Icon: ArrowOutIco, iconBg: 'bg-warningLt',  iconColor: '#F59E0B', href: '/calls?callType=outgoing',       delta: trend(today?.outgoing, yest?.outgoing) },
    { label: 'Missed',         value: today?.missed,          Icon: MissedIco,   iconBg: 'bg-dangerLt',   iconColor: '#EF4444', href: '/calls?callType=missed',         delta: trend(today?.missed, yest?.missed) },
    { label: 'Connected',      value: today?.connectedCalls,  Icon: CheckIco,    iconBg: 'bg-tealLt',     iconColor: '#0EA5E9', href: '/calls',                        delta: trend(today?.connectedCalls, yest?.connectedCalls) },
    { label: 'Unique Clients', value: today?.uniqueClients,   Icon: UsersIco,    iconBg: 'bg-purpleLt',   iconColor: '#8B5CF6', href: '/calls',                        delta: null, sub: 'Distinct numbers' },
  ];

  const todayPieData = today
    ? [
        { name: 'Incoming', value: today.incoming || 0, color: '#10B981' },
        { name: 'Outgoing', value: today.outgoing || 0, color: '#F59E0B' },
        { name: 'Missed',   value: today.missed   || 0, color: '#EF4444' },
        { name: 'Rejected', value: today.rejected || 0, color: '#8B5CF6' },
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-textPrimary">{greeting} 👋</h2>
          <p className="text-textMuted text-sm mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={() => fetchStats(true)} disabled={refreshing}
          className="flex items-center gap-2 text-sm text-textSecondary border border-border px-3.5 py-2 rounded-xl hover:border-primary hover:text-primary transition-all bg-white shadow-card disabled:opacity-60">
          <span className={refreshing ? 'animate-spin' : ''}><RefreshIco /></span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── KPI Strip — all clickable ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {/* ── Main content: charts + live feed ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Hourly bar chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-border shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-textPrimary font-semibold text-sm">Calls Per Hour — Today</h3>
            <span className="text-xs text-textMuted bg-bg border border-border px-2 py-1 rounded-lg">Live</span>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={stats?.callsPerHour || []} barCategoryGap="40%">
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#1A6BFF" stopOpacity={0.9}/>
                  <stop offset="100%" stopColor="#1A6BFF" stopOpacity={0.35}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={h=>`${h}h`} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={28}/>
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12 }}
                labelFormatter={h=>`${h}:00 – ${h}:59`} cursor={{ fill: '#F1F5F9', radius: 4 }} />
              <Bar dataKey="count" fill="url(#barGrad)" radius={[5,5,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut + legend */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="text-textPrimary font-semibold text-sm mb-1">Today's Breakdown</h3>
          <p className="text-textMuted text-xs mb-3">{today?.totalCalls || 0} total calls</p>
          {todayPieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-textMuted text-sm gap-2">
              <span className="text-4xl">📭</span>
              <p>No calls yet today</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={todayPieData} cx="50%" cy="45%" innerRadius={50} outerRadius={76}
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

      {/* ── Middle row: top dialers + live feed ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Top Dialers */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-textPrimary font-semibold text-sm">Top Dialers — Today</h3>
            <Link href="/employees/leaderboard" className="text-xs text-primary hover:underline font-medium">View all</Link>
          </div>
          {(stats?.topDialers?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-textMuted text-sm gap-2">
              <span className="text-3xl">🏆</span><p>No data yet</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {(stats.topDialers || []).slice(0, 7).map((d, i) => {
                const pct = Math.min(100, (d.count / (stats.topDialers[0]?.count || 1)) * 100);
                const medals = ['🥇','🥈','🥉'];
                return (
                  <div key={d.employeeId} className="flex items-center gap-3">
                    <span className="text-base w-6 text-center flex-shrink-0 select-none">{medals[i] || `${i+1}`}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-textPrimary text-xs font-semibold truncate">{d.name}</p>
                        <span className="text-textSecondary font-bold text-xs ml-2 flex-shrink-0">{d.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-textPrimary font-semibold text-sm">Live Call Feed</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />Real-time
              </span>
              <Link href="/calls/live" className="text-xs text-primary hover:underline font-medium">Monitor</Link>
            </div>
          </div>
          {liveFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-textMuted text-sm gap-2">
              <span className="text-3xl">📡</span><p>Waiting for calls…</p>
            </div>
          ) : (
            <div className="space-y-0 max-h-72 overflow-y-auto pr-1 divide-y divide-border/60">
              {liveFeed.map((log, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 hover:bg-bg/50 rounded-lg px-1 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primaryLt flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                      {(log.employeeName || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-textPrimary text-xs font-semibold truncate">{log.employeeName}</p>
                      <p className="text-textMuted text-xs truncate">{log.contactName && log.contactName !== 'Unknown' ? `${log.contactName} · ` : ''}{log.contactNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <CallTypeBadge type={log.callType} />
                    <div className="text-right hidden sm:block">
                      <p className="text-textSecondary text-xs font-medium">{log.duration ? `${Math.floor(log.duration/60)}m ${log.duration%60}s` : '—'}</p>
                      <p className="text-textMuted text-xs">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    {!log.hasLead && (
                      <button onClick={() => setCreateLeadCall(log)}
                        className="text-xs bg-primaryLt text-primary border border-blue-200 px-2 py-1 rounded-lg font-semibold hover:bg-primary hover:text-white transition-colors whitespace-nowrap">
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

      {/* ── Period Comparison ── */}
      <div>
        <h3 className="text-textPrimary font-semibold text-sm mb-3">Period Comparison</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <PeriodPanel title="Today"     data={stats?.today}     accent="#1A6BFF" />
          <PeriodPanel title="Yesterday" data={stats?.yesterday} accent="#8B5CF6" />
          <PeriodPanel title="Last Week" date={stats?.lastWeek?.period} data={stats?.lastWeek} accent="#F59E0B" />
        </div>
      </div>

      {createLeadCall && (
        <CreateLeadModal call={createLeadCall} employees={employees}
          onClose={() => setCreateLeadCall(null)} onCreated={() => {}} />
      )}
    </div>
  );
}