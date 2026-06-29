'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Pusher from 'pusher-js';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../../../lib/api';
import CallTypeBadge from '../../../components/CallTypeBadge';

/* ── Timezone helpers ─────────────────────────────── */
const TIMEZONES = [
  { label: 'IST (India)', value: 'Asia/Kolkata' },
  { label: 'UTC',         value: 'UTC' },
  { label: 'EST (US)',    value: 'America/New_York' },
  { label: 'PST (US)',    value: 'America/Los_Angeles' },
  { label: 'GST (Gulf)',  value: 'Asia/Dubai' },
];

function fmtDate(ts, tz) {
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: tz });
}
function fmtTime(ts, tz) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: tz });
}
function todayInTZ(tz) {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

/* ── Icons ───────────────────────────────────────── */
function Ico({ size = 18, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const PhoneIco   = ({size}) => <Ico size={size}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Ico>;
const InIco      = () => <Ico><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></Ico>;
const OutIco     = () => <Ico><polyline points="1 6 10.5 15.5 15.5 10.5 23 18"/><polyline points="7 6 1 6 1 12"/></Ico>;
const MissedIco  = () => <Ico><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/></Ico>;
const CheckIco   = () => <Ico><polyline points="20 6 9 17 4 12"/></Ico>;
const UsersIco   = () => <Ico><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;
const RefreshIco = () => <Ico size={14}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></Ico>;
const StarIco    = () => <Ico size={14}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Ico>;
const ChevronIco = () => <Ico size={13}><polyline points="9 18 15 12 9 6"/></Ico>;
const CloseIco   = () => <Ico size={15}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Ico>;
const TrendUpIco = () => <Ico size={12}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Ico>;
const TrendDnIco = () => <Ico size={12}><polyline points="1 6 10.5 15.5 15.5 10.5 23 18"/><polyline points="7 18 1 18 1 12"/></Ico>;
const GlobeIco   = () => <Ico size={14}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></Ico>;
const LeadIco    = () => <Ico size={16}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></Ico>;

function trend(cur, prev) {
  if (!prev || prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

const KPI = [
  { key: 'totalCalls',    label: 'Total Calls',   Icon: PhoneIco,  grad: 'linear-gradient(135deg,#2563EB,#3B82F6)', href: '/calls' },
  { key: 'incoming',      label: 'Incoming',       Icon: InIco,     grad: 'linear-gradient(135deg,#16A34A,#22C55E)', href: '/calls?callType=incoming' },
  { key: 'outgoing',      label: 'Outgoing',       Icon: OutIco,    grad: 'linear-gradient(135deg,#D97706,#F59E0B)', href: '/calls?callType=outgoing' },
  { key: 'missed',        label: 'Missed',         Icon: MissedIco, grad: 'linear-gradient(135deg,#DC2626,#EF4444)', href: '/calls?callType=missed' },
  { key: 'connectedCalls',label: 'Connected',      Icon: CheckIco,  grad: 'linear-gradient(135deg,#0D9488,#14B8A6)', href: '/calls' },
  { key: 'uniqueClients', label: 'Unique Clients', Icon: UsersIco,  grad: 'linear-gradient(135deg,#7C3AED,#8B5CF6)', href: '/calls' },
];

function KpiCard({ label, value, Icon, grad, href, delta, idx }) {
  const card = (
    <div className="page-card p-4 cursor-pointer group animate-fade-in-up"
      style={{ animationDelay: `${idx * 0.05}s`, transition: 'transform 0.18s, box-shadow 0.18s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0"
          style={{ background: grad }}>
          <Icon size={16} />
        </div>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#2563EB' }}>
          <ChevronIco />
        </span>
      </div>
      <p className="stat-number">{value ?? '—'}</p>
      <p className="stat-label uppercase tracking-wider text-[10px]">{label}</p>
      {delta !== null && delta !== undefined && (
        <div className="flex items-center gap-1 mt-2 text-[11px] font-semibold"
          style={{ color: delta >= 0 ? '#16A34A' : '#DC2626' }}>
          {delta >= 0 ? <TrendUpIco /> : <TrendDnIco />}
          {Math.abs(delta)}% vs yesterday
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function PeriodPanel({ title, data }) {
  const rows = [
    { label: 'Total Calls',   val: data?.totalCalls,     color: '#2563EB' },
    { label: 'Incoming',      val: data?.incoming,       color: '#16A34A' },
    { label: 'Outgoing',      val: data?.outgoing,       color: '#D97706' },
    { label: 'Missed',        val: data?.missed,         color: '#DC2626' },
    { label: 'Connected',     val: data?.connectedCalls, color: '#0D9488' },
    { label: 'Working Hours', val: data?.workingHours,   color: '#475569' },
  ];
  return (
    <div className="page-card p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-3" style={{ color: '#94A3B8' }}>{title}</p>
      {!data ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="skeleton h-7 rounded-lg"/>)}</div>
      ) : (
        <div className="space-y-0">
          {rows.map(r => (
            <div key={r.label} className="flex items-center justify-between py-2"
              style={{ borderBottom: '1px solid #F1F5F9' }}>
              <span className="text-xs" style={{ color: '#64748B' }}>{r.label}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: r.color }}>{r.val ?? '—'}</span>
            </div>
          ))}
          {data?.callDuration && (
            <div className="flex items-center justify-between py-2">
              <span className="text-xs" style={{ color: '#64748B' }}>Total Duration</span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: '#475569' }}>{data.callDuration}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreateLeadModal({ call, employees, onClose }) {
  const [form, setForm] = useState({
    name: call?.contactName && call.contactName !== 'Unknown' ? call.contactName : '',
    phone: call?.contactNumber || '', email: '', assignedTo: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await api.post('/api/leads/from-call', { ...form, callId: call?._id, source: 'Call' });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create lead');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay"
      style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(5px)' }}>
      <div className="w-full max-w-md rounded-xl modal-content"
        style={{ background: '#fff', border: '1px solid #E2E8F0', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>Create Lead from Call</h3>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{call?.contactNumber}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FFF1F2'; e.currentTarget.style.color = '#EF4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#94A3B8'; }}>
            <CloseIco />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {error && <div className="text-xs rounded-lg px-3 py-2" style={{ background: '#FFF1F2', color: '#DC2626', border: '1px solid #FECACA' }}>{error}</div>}
          {[{k:'name',l:'Full Name',ro:false},{k:'phone',l:'Phone',ro:true},{k:'email',l:'Email',ro:false}].map(({k,l,ro})=>(
            <div key={k}>
              <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>{l}</label>
              <input type={k==='email'?'email':'text'} value={form[k]} readOnly={ro}
                onChange={e=>!ro&&setForm({...form,[k]:e.target.value})}
                className="form-input" style={ro?{background:'#F8FAFC',color:'#94A3B8'}:{}} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Assign To</label>
            <select value={form.assignedTo} onChange={e=>setForm({...form,assignedTo:e.target.value})} className="form-input">
              <option value="">Unassigned</option>
              {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center"
              style={{ opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating…' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs"
      style={{ background: '#0F172A', color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
      <p style={{ color: '#94A3B8' }}>{label}</p>
      {payload.map((p,i) => <p key={i} className="font-bold">{p.name}: {p.value}</p>)}
    </div>
  );
};

const LEAD_STATUSES = [
  { key: 'new',        label: 'New',        color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { key: 'contacted',  label: 'Contacted',  color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { key: 'qualified',  label: 'Qualified',  color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { key: 'converted',  label: 'Converted',  color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { key: 'lost',       label: 'Lost',       color: '#DC2626', bg: '#FFF1F2', border: '#FECACA' },
];

export default function DashboardPage() {
  const [stats,      setStats]      = useState(null);
  const [liveFeed,   setLiveFeed]   = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [leadModal,  setLeadModal]  = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timezone,   setTimezone]   = useState('Asia/Kolkata');
  const [tzOpen,     setTzOpen]     = useState(false);
  const [leadStats,  setLeadStats]  = useState({});
  const channelRef = useRef(null);

  const fetchStats = async (spin = false) => {
    if (spin) setRefreshing(true);
    try { const r = await api.get('/api/calls/stats'); setStats(r.data.data); }
    catch {}
    finally { setRefreshing(false); }
  };

  const fetchLeadStats = async () => {
    try {
      const results = await Promise.all(
        LEAD_STATUSES.map(s =>
          api.get('/api/leads', { params: { status: s.key, limit: 1 } })
            .then(r => ({ key: s.key, count: r.data.data?.total ?? 0 }))
            .catch(() => ({ key: s.key, count: 0 }))
        )
      );
      const map = {};
      results.forEach(r => { map[r.key] = r.count; });
      setLeadStats(map);
    } catch {}
  };

  useEffect(() => {
    fetchStats();
    fetchLeadStats();
    api.get('/api/employees').then(r=>setEmployees(r.data.data)).catch(()=>{});
    api.get('/api/calls/realtime').then(r=>setLiveFeed((r.data.data||[]).slice(0,30))).catch(()=>{});
    const interval = setInterval(fetchStats, 30000);
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return () => clearInterval(interval);
    const pusher  = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2' });
    const channel = pusher.subscribe('managers');
    channelRef.current = channel;
    channel.bind('new_call_log', data => {
      setLiveFeed(prev => [data, ...prev].slice(0, 30));
      fetchStats();
    });
    return () => { clearInterval(interval); channel.unbind_all(); pusher.unsubscribe('managers'); pusher.disconnect(); };
  }, []);

  const today = stats?.today;
  const yest  = stats?.yesterday;

  const pieData = today ? [
    { name: 'Incoming', value: today.incoming || 0, color: '#22C55E' },
    { name: 'Outgoing', value: today.outgoing || 0, color: '#F59E0B' },
    { name: 'Missed',   value: today.missed   || 0, color: '#EF4444' },
    { name: 'Rejected', value: today.rejected || 0, color: '#8B5CF6' },
  ].filter(d => d.value > 0) : [];

  const greeting = (() => {
    const h = new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
    const hr = parseInt(h);
    return hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  })();

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: timezone
  });

  const tzLabel = TIMEZONES.find(t => t.value === timezone)?.label || timezone;
  const totalLeads = Object.values(leadStats).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fade-in">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A', letterSpacing: '-0.02em' }}>{greeting}</h2>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>{todayLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Timezone selector */}
          <div className="relative">
            <button onClick={() => setTzOpen(o => !o)}
              className="btn-secondary text-xs py-1.5 px-3 gap-1.5">
              <GlobeIco />
              {tzLabel}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {tzOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 rounded-xl overflow-hidden"
                style={{ background: '#fff', border: '1px solid #E2E8F0', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', minWidth: 180 }}>
                {TIMEZONES.map(tz => (
                  <button key={tz.value} onClick={() => { setTimezone(tz.value); setTzOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-xs transition-colors"
                    style={{
                      color: timezone === tz.value ? '#2563EB' : '#374151',
                      background: timezone === tz.value ? '#EFF6FF' : '',
                      fontWeight: timezone === tz.value ? 600 : 400,
                    }}
                    onMouseEnter={e => { if (timezone !== tz.value) e.currentTarget.style.background = '#F8FAFC'; }}
                    onMouseLeave={e => { if (timezone !== tz.value) e.currentTarget.style.background = ''; }}>
                    {tz.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => fetchStats(true)} disabled={refreshing}
            className="btn-secondary text-xs py-1.5 px-3">
            <span className={refreshing ? 'animate-spin' : ''}><RefreshIco /></span>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 stagger">
        {KPI.map((cfg, i) => (
          <KpiCard key={cfg.key} idx={i} label={cfg.label} value={today?.[cfg.key]}
            Icon={cfg.Icon} grad={cfg.grad} href={cfg.href}
            delta={cfg.key !== 'uniqueClients' ? trend(today?.[cfg.key], yest?.[cfg.key]) : null} />
        ))}
      </div>

      {/* Lead Status Counts */}
      <div className="animate-fade-in-up" style={{ animationDelay: '0.08s' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#EFF6FF', color: '#2563EB' }}>
              <LeadIco />
            </div>
            <h3 className="text-sm font-bold" style={{ color: '#0F172A' }}>Lead Pipeline</h3>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#F1F5F9', color: '#64748B' }}>
              {totalLeads} total
            </span>
          </div>
          <Link href="/leads" className="text-xs font-semibold transition-opacity"
            style={{ color: '#2563EB' }}
            onMouseEnter={e=>e.currentTarget.style.opacity='0.7'}
            onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          {LEAD_STATUSES.map((s, i) => {
            const count = leadStats[s.key] ?? 0;
            const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
            return (
              <Link href={`/leads?status=${s.key}`} key={s.key}>
                <div className="page-card p-4 cursor-pointer transition-all"
                  style={{ animationDelay: `${i * 0.04}s` }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: s.color }}>{s.label}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                      {pct}%
                    </span>
                  </div>
                  <p className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: '#0F172A', letterSpacing: '-0.03em' }}>
                    {leadStats[s.key] === undefined ? '—' : count}
                  </p>
                  <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: s.color }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Hourly bar */}
        <div className="xl:col-span-2 page-card p-5 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>Calls Per Hour</h3>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Today's activity · {tzLabel}</p>
            </div>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.20)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22C55E' }} />Live
            </span>
          </div>
          <ResponsiveContainer width="100%" height={195}>
            <BarChart data={stats?.callsPerHour || []} barCategoryGap="38%">
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9}/>
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.35}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill:'#94A3B8', fontSize:10 }} tickFormatter={h=>`${h}h`} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip content={<ChartTip />} cursor={{ fill:'rgba(37,99,235,0.05)', radius:4 }} />
              <Bar dataKey="count" fill="url(#barGrad)" radius={[5,5,0,0]} name="Calls" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut */}
        <div className="page-card p-5 animate-fade-in-up" style={{ animationDelay: '0.14s' }}>
          <h3 className="font-bold text-sm mb-0.5" style={{ color: '#0F172A' }}>Today's Breakdown</h3>
          <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>{today?.totalCalls || 0} total calls</p>
          {pieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                <PhoneIco size={20} />
              </div>
              <p className="text-sm" style={{ color: '#94A3B8' }}>No calls yet today</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="44%" innerRadius={50} outerRadius={76}
                  paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip content={<ChartTip />} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize:11, color:'#475569', paddingTop:8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top dialers + Live feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Top dialers */}
        <div className="page-card p-5 animate-fade-in-up" style={{ animationDelay: '0.18s' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>Top Dialers</h3>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Today's leaders</p>
            </div>
            <Link href="/employees/leaderboard" className="text-xs font-semibold transition-colors"
              style={{ color: '#2563EB' }}
              onMouseEnter={e=>e.currentTarget.style.opacity='0.7'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              View all
            </Link>
          </div>
          {(stats?.topDialers?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                <StarIco />
              </div>
              <p className="text-sm" style={{ color: '#94A3B8' }}>No data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(stats.topDialers||[]).slice(0,7).map((d,i)=>{
                const pct = Math.min(100,(d.count/(stats.topDialers[0]?.count||1))*100);
                const MEDAL = ['#F59E0B','#94A3B8','#B45309'];
                const MEDAL_BG = ['rgba(245,158,11,0.12)','rgba(148,163,184,0.12)','rgba(180,83,9,0.12)'];
                return (
                  <div key={d.employeeId} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{ background:i<3?MEDAL_BG[i]:'#F1F5F9', color:i<3?MEDAL[i]:'#94A3B8' }}>
                      {i+1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold truncate" style={{ color:'#0F172A' }}>{d.name}</p>
                        <span className="text-xs font-bold ml-1 flex-shrink-0" style={{ color:'#2563EB' }}>{d.count}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width:`${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live feed */}
        <div className="xl:col-span-2 page-card p-5 animate-fade-in-up" style={{ animationDelay: '0.22s' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Live Call Feed</h3>
              <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>Streaming in real time · {tzLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background:'rgba(22,163,74,0.08)', color:'#16A34A', border:'1px solid rgba(22,163,74,0.20)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#22C55E' }} />
                Real-time
              </span>
              <Link href="/calls/live" className="text-xs font-semibold" style={{ color:'#2563EB' }}>Monitor →</Link>
            </div>
          </div>
          {liveFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background:'#EFF6FF', color:'#2563EB' }}>
                <PhoneIco size={20} />
              </div>
              <p className="text-sm" style={{ color:'#94A3B8' }}>Waiting for live calls…</p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto pr-1 -mr-1">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Contact</th>
                    <th>Type</th>
                    <th>Duration</th>
                    <th>Time ({tzLabel})</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {liveFeed.map((log,i)=>(
                    <tr key={i}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                            style={{ background:'#2563EB' }}>
                            {(log.employeeName||'?')[0].toUpperCase()}
                          </div>
                          <span className="text-xs font-medium" style={{ color:'#0F172A' }}>{log.employeeName}</span>
                        </div>
                      </td>
                      <td>
                        <p className="text-xs" style={{ color:'#374151' }}>{log.contactNumber}</p>
                        {log.contactName&&log.contactName!=='Unknown'&&<p className="text-[11px]" style={{ color:'#94A3B8' }}>{log.contactName}</p>}
                      </td>
                      <td><CallTypeBadge type={log.callType}/></td>
                      <td className="text-xs" style={{ color:'#475569' }}>
                        {log.duration?`${Math.floor(log.duration/60)}m ${log.duration%60}s`:'—'}
                      </td>
                      <td className="text-xs" style={{ color:'#94A3B8' }}>
                        {fmtTime(log.timestamp, timezone)}
                      </td>
                      <td>
                        {!log.hasLead&&(
                          <button onClick={()=>setLeadModal(log)}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded transition-colors whitespace-nowrap"
                            style={{ background:'#EFF6FF', color:'#2563EB', border:'1px solid #BFDBFE' }}
                            onMouseEnter={e=>{e.currentTarget.style.background='#2563EB';e.currentTarget.style.color='#fff';}}
                            onMouseLeave={e=>{e.currentTarget.style.background='#EFF6FF';e.currentTarget.style.color='#2563EB';}}>
                            + Lead
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Period comparison */}
      <div className="animate-fade-in-up" style={{ animationDelay: '0.26s' }}>
        <h3 className="text-sm font-bold mb-3" style={{ color:'#0F172A' }}>Period Comparison</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <PeriodPanel title="Today"     data={stats?.today} />
          <PeriodPanel title="Yesterday" data={stats?.yesterday} />
          <PeriodPanel title="Last Week" data={stats?.lastWeek} />
        </div>
      </div>

      {leadModal && (
        <CreateLeadModal call={leadModal} employees={employees}
          onClose={() => setLeadModal(null)} />
      )}
    </div>
  );
}
