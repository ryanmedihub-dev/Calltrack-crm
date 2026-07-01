'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import api from '../../../../lib/api';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const LeadIco    = ({s=16}) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></Ico>;
const ChevronIco = ({s=13}) => <Ico size={s}><polyline points="9 18 15 12 9 6"/></Ico>;

const STATUSES = [
  { key:'new',        label:'New',        color:'#2563EB', bg:'#EFF6FF', border:'#BFDBFE', href:'/leads?status=new' },
  { key:'contacted',  label:'Contacted',  color:'#D97706', bg:'#FFFBEB', border:'#FDE68A', href:'/leads?status=contacted' },
  { key:'qualified',  label:'Qualified',  color:'#7C3AED', bg:'#F5F3FF', border:'#DDD6FE', href:'/leads?status=qualified' },
  { key:'interested', label:'Interested', color:'#0D9488', bg:'#F0FDFA', border:'#99F6E4', href:'/leads/interested' },
  { key:'converted',  label:'Converted',  color:'#16A34A', bg:'#F0FDF4', border:'#BBF7D0', href:'/leads?status=converted' },
  { key:'lost',       label:'Lost',       color:'#DC2626', bg:'#FFF1F2', border:'#FECACA', href:'/leads?status=lost' },
];

const QUICK_LINKS = [
  { href:'/leads/pipeline',      label:'Pipeline',        desc:'Kanban lead pipeline view',       color:'#2563EB', bg:'#EFF6FF' },
  { href:'/leads/unattempted',   label:'Unattempted',     desc:'Leads with no call attempts',     color:'#DC2626', bg:'#FFF1F2' },
  { href:'/leads/interested',    label:'Interested',      desc:'Leads marked as interested',      color:'#0D9488', bg:'#F0FDFA' },
  { href:'/leads/follow-ups',    label:'Follow-ups',      desc:'Leads pending follow-up',         color:'#D97706', bg:'#FFFBEB' },
  { href:'/leads/call-attempts', label:'Call Attempts',   desc:'Attempt history per lead',        color:'#7C3AED', bg:'#F5F3FF' },
  { href:'/leads/leads-uploads', label:'Upload Leads',    desc:'Bulk import via CSV/Excel',       color:'#16A34A', bg:'#F0FDF4' },
];

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff' }}>
    <p style={{ color:'#94A3B8' }}>{label}</p>
    {payload.map((p,i) => <p key={i} className="font-bold">{p.name}: {p.value}</p>)}
  </div>;
};

export default function LeadsOverviewPage() {
  const [counts,  setCounts]  = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          STATUSES.map(s =>
            api.get('/api/leads', { params:{ status:s.key, limit:1 } })
              .then(r => ({ key:s.key, count:r.data?.data?.total||0 }))
              .catch(() => ({ key:s.key, count:0 }))
          )
        );
        const map = {};
        results.forEach(r => { map[r.key]=r.count; });
        setCounts(map);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const total   = Object.values(counts).reduce((s,n)=>s+n,0);
  const pieData = STATUSES.map(s=>({ name:s.label, value:counts[s.key]||0, color:s.color })).filter(d=>d.value>0);
  const barData = STATUSES.map(s=>({ name:s.label, count:counts[s.key]||0 }));
  const convRate = total>0 ? Math.round(((counts.converted||0)/total)*100) : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Leads Overview</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Complete lead pipeline summary with status breakdown</p>
        </div>
        <Link href="/leads/leads-uploads" className="btn-primary text-xs py-1.5 px-3">+ Import Leads</Link>
      </div>

      {/* Top metric */}
      <div className="page-card p-5 flex flex-wrap items-center gap-6" style={{ background:'linear-gradient(135deg,#2563EB,#1D4ED8)', border:'none' }}>
        <div>
          <p className="text-4xl font-extrabold tabular-nums text-white" style={{ letterSpacing:'-0.03em' }}>
            {loading?'…':total}
          </p>
          <p className="text-sm mt-1 font-medium" style={{ color:'rgba(255,255,255,0.75)' }}>Total Leads in System</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-center">
            <p className="text-2xl font-extrabold text-white">{convRate}%</p>
            <p className="text-xs" style={{ color:'rgba(255,255,255,0.65)' }}>Conversion Rate</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold text-white">{counts.converted||0}</p>
            <p className="text-xs" style={{ color:'rgba(255,255,255,0.65)' }}>Converted</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold text-white">{counts.new||0}</p>
            <p className="text-xs" style={{ color:'rgba(255,255,255,0.65)' }}>New This Cycle</p>
          </div>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 stagger">
        {STATUSES.map((s,i) => {
          const count = counts[s.key]||0;
          const pct   = total>0 ? Math.round((count/total)*100) : 0;
          return (
            <Link key={s.key} href={s.href}>
              <div className="page-card p-4 cursor-pointer transition-all animate-fade-in-up"
                style={{ animationDelay:`${i*0.05}s` }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,0.08)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color:s.color }}>{s.label}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{pct}%</span>
                </div>
                <p className="stat-number text-2xl">
                  {loading?<span className="skeleton inline-block w-10 h-6 rounded"/>:count}
                </p>
                <div className="mt-2 h-1 rounded-full" style={{ background:'#F1F5F9' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width:`${pct}%`, background:s.color }}/>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 page-card p-5">
          <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Leads by Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
              <XAxis dataKey="name" tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} width={28} allowDecimals={false}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="count" name="Leads" radius={[5,5,0,0]}>
                {barData.map((_,i) => <Cell key={i} fill={STATUSES[i]?.color||'#2563EB'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-1" style={{ color:'#0F172A' }}>Distribution</h3>
          <p className="text-xs mb-3" style={{ color:'#94A3B8' }}>{total} total leads</p>
          {pieData.length===0 ? (
            <div className="flex flex-col items-center justify-center h-44 gap-2">
              <LeadIco s={28}/>
              <p className="text-xs" style={{ color:'#94A3B8' }}>No leads yet</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip content={<ChartTip/>}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {pieData.map(d=>(
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background:d.color }}/>
                      <span style={{ color:'#64748B' }}>{d.name}</span>
                    </div>
                    <span className="font-bold" style={{ color:'#0F172A' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick nav */}
      <div>
        <h3 className="text-sm font-bold mb-3" style={{ color:'#0F172A' }}>Quick Access</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {QUICK_LINKS.map(p=>(
            <Link key={p.href} href={p.href}>
              <div className="page-card p-4 cursor-pointer transition-all"
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,0.08)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background:p.bg, color:p.color }}>
                  <LeadIco s={14}/>
                </div>
                <p className="font-bold text-xs" style={{ color:'#0F172A' }}>{p.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color:'#94A3B8' }}>{p.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
