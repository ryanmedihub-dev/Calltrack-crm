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
const CheckIco     = () => <Svg><polyline points="20 6 9 17 4 12"/></Svg>;
const UsersIco     = () => <Svg><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg>;
const RefreshIco   = () => <Svg size={15}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></Svg>;
const TrendUpIco   = () => <Svg size={13}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Svg>;
const TrendDownIco = () => <Svg size={13}><polyline points="1 6 10.5 15.5 15.5 10.5 23 18"/><polyline points="7 18 1 18 1 12"/></Svg>;
const ChevronIco   = () => <Svg size={13}><polyline points="9 18 15 12 9 6"/></Svg>;
const StarIco      = () => <Svg size={14}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Svg>;
const CloseIco     = () => <Svg size={16}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Svg>;

function trend(current, prev) {
  if (!prev || prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

const KPI_CONFIG = [
  { key: 'totalCalls',     label: 'Total Calls',     Icon: PhoneIco,    gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', href: '/calls' },
  { key: 'incoming',       label: 'Incoming',         Icon: ArrowInIco,  gradient: 'linear-gradient(135deg, #10B981 0%, #14B8A6 100%)', href: '/calls?callType=incoming' },
  { key: 'outgoing',       label: 'Outgoing',         Icon: ArrowOutIco, gradient: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)', href: '/calls?callType=outgoing' },
  { key: 'missed',         label: 'Missed',           Icon: MissedIco,   gradient: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)', href: '/calls?callType=missed' },
  { key: 'connectedCalls', label: 'Connected',        Icon: CheckIco,    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)', href: '/calls' },
  { key: 'uniqueClients',  label: 'Unique Clients',   Icon: UsersIco,    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)', href: '/calls' },
];

function KpiCard({ label, value, Icon, gradient, href, delta, index }) {
  const inner = (
    <div className="relative rounded-2xl p-4 overflow-hidden group cursor-pointer animate-fade-in-up"
      style={{
        background: '#ffffff',
        border: '1px solid #E2E8F4',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(99,102,241,0.06)',
        animationDelay: `${index * 0.06}s`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(99,102,241,0.14), 0 2px 8px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(99,102,241,0.06)';
      }}>
      {/* Gradient accent corner */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-[4rem] opacity-[0.07]"
        style={{ background: gradient }} />

      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
          style={{ background: gradient, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <Icon />
        </div>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#6366F1' }}>
          <ChevronIco />
        </span>
      </div>

      <p className="text-2xl font-extrabold leading-none tabular-nums" style={{ color: '#0F172A', letterSpacing: '-0.03em' }}>
        {value ?? '—'}
      </p>
      <p className="text-xs font-semibold mt-1.5 uppercase tracking-wider" style={{ color: '#94A3B8' }}>{label}</p>

      {delta !== null && delta !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-semibold`}
          style={{ color: delta >= 0 ? '#10B981' : '#EF4444' }}>
          {delta >= 0 ? <TrendUpIco /> : <TrendDownIco />}
          {Math.abs(delta)}% vs yesterday
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function StatRow({ label, value, subLabel, subValue, valueColor = '#0F172A' }) {
  return (
    <div className="flex items-center justify-between py-2.5 table-row-hover rounded-lg px-2 -mx-2 transition-colors">
      <div>
        <p className="font-bold text-sm leading-none" style={{ color: valueColor }}>{value ?? '—'}</p>
        <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{label}</p>
      </div>
      {subLabel && (
        <div className="text-right">
          <p className="font-semibold text-xs leading-none" style={{ color: '#475569' }}>{subValue ?? '—'}</p>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{subLabel}</p>
        </div>
      )}
    </div>
  );
}

function PeriodPanel({ title, date, data, accentGrad }) {
  return (
    <div className="rounded-2xl p-4"
      style={{ background: '#fff', border: '1px solid #E2E8F4', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(99,102,241,0.06)' }}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: accentGrad }} />
        <div className="min-w-0">
          <h3 className="font-bold text-sm leading-none" style={{ color: '#0F172A' }}>{title}</h3>
          {(date || data?.date) && <p className="text-xs mt-0.5 truncate" style={{ color: '#94A3B8' }}>{date || data.date}</p>}
        </div>
      </div>
      {!data ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="skeleton h-8 rounded-lg"/>)}</div>
      ) : (
        <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
          <StatRow label="Total Calls"   value={data.totalCalls}     valueColor="#6366F1" subLabel="Duration"       subValue={data.callDuration} />
          <StatRow label="Incoming"      value={data.incoming}       valueColor="#10B981" subLabel="Duration"       subValue={data.incomingDuration} />
          <StatRow label="Outgoing"      value={data.outgoing}       valueColor="#F59E0B" subLabel="Duration"       subValue={data.outgoingDuration} />
          <StatRow label="Missed"        value={data.missed}         valueColor="#EF4444" subLabel="Rejected"       subValue={data.rejected} />
          <StatRow label="Connected"     value={data.connectedCalls} valueColor="#0EA5E9" subLabel="Unique Clients" subValue={data.uniqueClients} />
          <StatRow label="Working Hours" value={data.workingHours}   valueColor="#475569" />
        </div>
      )}
    </div>
  );
}

function CreateLeadModal({ call, employees, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: call?.contactName && call.contactName !== 'Unknown' ? call.contactName : '',
    phone: call?.contactNumber || '', email: '', source: 'Call', assignedTo: '', status: 'new',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await api.post('/api/leads/from-call', { ...form, callId: call?._id });
      onCreated(); onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create lead');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay"
      style={{ background: 'rgba(12,10,30,0.55)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-md rounded-2xl modal-content"
        style={{ background: '#fff', border: '1px solid #E2E8F4', boxShadow: '0 25px 80px rgba(0,0,0,0.20), 0 8px 32px rgba(99,102,241,0.12)' }}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>Create Lead from Call</h3>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{call?.contactNumber}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FFF1F2'; e.currentTarget.style.color = '#EF4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#94A3B8'; }}>
            <CloseIco />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {error && (
            <div className="text-xs rounded-xl px-3 py-2.5"
              style={{ background: '#FFF1F2', color: '#EF4444', border: '1px solid #FECACA' }}>
              {error}
            </div>
          )}
          {[{key:'name',label:'Full Name',type:'text',required:true,readOnly:false},{key:'phone',label:'Phone',type:'text',required:true,readOnly:true},{key:'email',label:'Email',type:'email',required:false,readOnly:false}].map(({key,label,type,required,readOnly})=>(
            <div key={key}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>{label}</label>
              <input type={type} value={form[key]} required={required} readOnly={readOnly}
                onChange={e=>!readOnly&&setForm({...form,[key]:e.target.value})}
                className="w-full rounded-xl px-3 py-2.5 text-sm transition-all input-ring"
                style={{ background: readOnly ? '#F8FAFF' : '#F8FAFF', border: '1px solid #E2E8F4', color: readOnly ? '#94A3B8' : '#0F172A', outline: 'none' }} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Assign To</label>
            <select value={form.assignedTo} onChange={e=>setForm({...form,assignedTo:e.target.value})}
              className="w-full rounded-xl px-3 py-2.5 text-sm transition-all input-ring"
              style={{ background: '#F8FAFF', border: '1px solid #E2E8F4', color: '#0F172A', outline: 'none' }}>
              <option value="">Unassigned</option>
              {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ border: '1px solid #E2E8F4', color: '#64748B', background: '#fff' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#FECACA'; e.currentTarget.style.color = '#EF4444'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F4'; e.currentTarget.style.color = '#64748B'; }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating…' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs"
      style={{ background: '#0C0A1E', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
      <p style={{ color: '#8D8BAC' }}>{label}:00 – {label}:59</p>
      <p className="font-bold mt-0.5">{payload[0].value} calls</p>
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs"
      style={{ background: '#0C0A1E', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
      <p className="font-bold">{payload[0].name}: {payload[0].value}</p>
    </div>
  );
};

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
    channel.bind('new_call_log', data => {
      setLiveFeed(prev => [data, ...prev].slice(0, 30));
      fetchStats();
    });
    return () => { clearInterval(interval); channel.unbind_all(); pusher.unsubscribe('managers'); pusher.disconnect(); };
  }, []);

  const today = stats?.today;
  const yest  = stats?.yesterday;

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
      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fade-in-up">
        <div>
          <h2 className="text-xl font-extrabold leading-none" style={{ color: '#0F172A', letterSpacing: '-0.02em' }}>
            {greeting}
          </h2>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={() => fetchStats(true)} disabled={refreshing}
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl transition-all"
          style={{
            background: '#fff',
            border: '1px solid #E2E8F4',
            color: '#475569',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'; e.currentTarget.style.color = '#6366F1'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F4'; e.currentTarget.style.color = '#475569'; }}>
          <span className={refreshing ? 'animate-spin' : ''}><RefreshIco /></span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 stagger">
        {KPI_CONFIG.map((cfg, i) => (
          <KpiCard
            key={cfg.key}
            label={cfg.label}
            value={today?.[cfg.key]}
            Icon={cfg.Icon}
            gradient={cfg.gradient}
            href={cfg.href}
            index={i}
            delta={cfg.key !== 'uniqueClients' ? trend(today?.[cfg.key], yest?.[cfg.key]) : null}
          />
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Hourly bar chart */}
        <div className="xl:col-span-2 rounded-2xl p-5 animate-fade-in-up" style={{ animationDelay: '0.1s', background: '#fff', border: '1px solid #E2E8F4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>Calls Per Hour</h3>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Today's activity breakdown</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full"
              style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />Live
            </span>
          </div>
          <ResponsiveContainer width="100%" height={195}>
            <BarChart data={stats?.callsPerHour || []} barCategoryGap="38%">
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#6366F1" stopOpacity={0.9}/>
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.4}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={h=>`${h}h`} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={26} />
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 6 }} />
              <Bar dataKey="count" fill="url(#barGrad)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div className="rounded-2xl p-5 animate-fade-in-up" style={{ animationDelay: '0.15s', background: '#fff', border: '1px solid #E2E8F4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="mb-1">
            <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>Today's Breakdown</h3>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{today?.totalCalls || 0} total calls</p>
          </div>
          {todayPieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#EEF2FF' }}>
                <PhoneIco />
              </div>
              <p className="text-sm" style={{ color: '#94A3B8' }}>No calls yet today</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={todayPieData} cx="50%" cy="44%" innerRadius={52} outerRadius={78}
                  paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {todayPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend iconType="circle" iconSize={7}
                  wrapperStyle={{ fontSize: 11, color: '#475569', paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Top dialers + Live feed ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Top Dialers */}
        <div className="rounded-2xl p-5 animate-fade-in-up" style={{ animationDelay: '0.18s', background: '#fff', border: '1px solid #E2E8F4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>Top Dialers</h3>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Today's leaders</p>
            </div>
            <Link href="/employees/leaderboard"
              className="text-xs font-semibold transition-colors"
              style={{ color: '#6366F1' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              View all
            </Link>
          </div>
          {(stats?.topDialers?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2.5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#EEF2FF', color: '#818CF8' }}>
                <StarIco />
              </div>
              <p className="text-sm" style={{ color: '#94A3B8' }}>No data yet</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {(stats.topDialers || []).slice(0, 7).map((d, i) => {
                const pct = Math.min(100, (d.count / (stats.topDialers[0]?.count || 1)) * 100);
                const MEDAL_COLORS = ['#F59E0B', '#94A3B8', '#CD7F32'];
                const MEDAL_BG = ['rgba(245,158,11,0.12)', 'rgba(148,163,184,0.12)', 'rgba(205,127,50,0.12)'];
                return (
                  <div key={d.employeeId} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{
                        background: i < 3 ? MEDAL_BG[i] : 'rgba(99,102,241,0.06)',
                        color: i < 3 ? MEDAL_COLORS[i] : '#94A3B8',
                      }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold truncate" style={{ color: '#0F172A' }}>{d.name}</p>
                        <span className="text-xs font-bold ml-2 flex-shrink-0" style={{ color: '#6366F1' }}>{d.count}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Call Feed */}
        <div className="xl:col-span-2 rounded-2xl p-5 animate-fade-in-up" style={{ animationDelay: '0.22s', background: '#fff', border: '1px solid #E2E8F4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>Live Call Feed</h3>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Streaming via Pusher</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }}>
                <span className="live-dot w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />
                Real-time
              </span>
              <Link href="/calls/live"
                className="text-xs font-semibold transition-colors"
                style={{ color: '#6366F1' }}>
                Monitor
              </Link>
            </div>
          </div>
          {liveFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#EEF2FF', color: '#818CF8' }}>
                <PhoneIco />
              </div>
              <p className="text-sm" style={{ color: '#94A3B8' }}>Waiting for live calls…</p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto pr-1 -mr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#C7D2FE transparent' }}>
              <div className="divide-y" style={{ borderColor: '#F8FAFF' }}>
                {liveFeed.map((log, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 table-row-hover rounded-lg px-1 -mx-1 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                        {(log.employeeName || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: '#0F172A' }}>{log.employeeName}</p>
                        <p className="text-xs truncate" style={{ color: '#94A3B8' }}>
                          {log.contactName && log.contactName !== 'Unknown' ? `${log.contactName} · ` : ''}{log.contactNumber}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 flex-shrink-0 ml-2">
                      <CallTypeBadge type={log.callType} />
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-medium" style={{ color: '#475569' }}>
                          {log.duration ? `${Math.floor(log.duration/60)}m ${log.duration%60}s` : '—'}
                        </p>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {!log.hasLead && (
                        <button onClick={() => setCreateLeadCall(log)}
                          className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap"
                          style={{ background: '#EEF2FF', color: '#6366F1', border: '1px solid #C7D2FE' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#6366F1'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#6366F1'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.color = '#6366F1'; e.currentTarget.style.borderColor = '#C7D2FE'; }}>
                          + Lead
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Period Comparison ── */}
      <div className="animate-fade-in-up" style={{ animationDelay: '0.26s' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold" style={{ color: '#0F172A' }}>Period Comparison</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <PeriodPanel title="Today"     data={stats?.today}     accentGrad="linear-gradient(180deg, #6366F1, #8B5CF6)" />
          <PeriodPanel title="Yesterday" data={stats?.yesterday} accentGrad="linear-gradient(180deg, #8B5CF6, #EC4899)" />
          <PeriodPanel title="Last Week" date={stats?.lastWeek?.period} data={stats?.lastWeek} accentGrad="linear-gradient(180deg, #F59E0B, #F97316)" />
        </div>
      </div>

      {createLeadCall && (
        <CreateLeadModal call={createLeadCall} employees={employees}
          onClose={() => setCreateLeadCall(null)} onCreated={() => {}} />
      )}
    </div>
  );
}
