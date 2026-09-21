'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import api from '../../../lib/api';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const UsersIco   = ({s=22}) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;
const EyeIco     = ({s=22}) => <Ico size={s}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></Ico>;
const ActivityIco= ({s=22}) => <Ico size={s}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></Ico>;
const EditIco    = ({s=22}) => <Ico size={s}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></Ico>;
const TrashIco   = ({s=22}) => <Ico size={s}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></Ico>;
const ReportIco  = ({s=22}) => <Ico size={s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></Ico>;

const NAV_CARDS = [
  { href:'/users/overview',      label:'Overview',             desc:'See all system users at a glance', Icon:UsersIco,    color:'#2563EB', bg:'#EFF6FF' },
  { href:'/users/hierarchy',     label:'Hierarchy Management', desc:'Assign and organize Managers, TLs, and Agents', Icon:UsersIco, color:'#0D9488', bg:'#F0FDFA' },
  { href:'/users/active',        label:'Active Users',         desc:'View currently active and online users', Icon:ActivityIco, color:'#16A34A', bg:'#F0FDF4' },
  { href:'/users/update-users',  label:'Update Users',         desc:'Edit user profiles, roles, and details', Icon:EditIco,     color:'#D97706', bg:'#FFFBEB' },
  { href:'/users/remove-users',  label:'Remove Users',         desc:'Deactivate or permanently remove users', Icon:TrashIco,    color:'#DC2626', bg:'#FFF1F2' },
  { href:'/reports/users',       label:'Users Report',         desc:'Detailed report on user accounts and roles', Icon:ReportIco,   color:'#7C3AED', bg:'#F5F3FF' },
];

export default function UsersPage() {
  const [stats, setStats] = useState({ total:0, active:0, inactive:0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/employees').then(r=>{
      const users  = r.data?.data||[];
      const active = users.filter(u=>u.isActive!==false).length;
      setStats({ total:users.length, active, inactive:users.length-active });
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="rounded-2xl p-6 text-white" style={{ background:'linear-gradient(135deg,#1E40AF 0%,#3B82F6 60%,#93C5FD 100%)' }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:'rgba(255,255,255,0.15)' }}>
            <UsersIco s={20}/>
          </div>
          <h2 className="text-xl font-extrabold" style={{ letterSpacing:'-0.02em' }}>Users</h2>
        </div>
        <p className="text-sm mt-1" style={{ opacity:0.75 }}>Manage system users — roles, permissions, and account settings</p>
        <div className="flex gap-6 mt-4">
          {[
            { l:'Total Users',    v:stats.total },
            { l:'Active',         v:stats.active },
            { l:'Inactive',       v:stats.inactive },
          ].map(s=>(
            <div key={s.l}>
              <p className="text-2xl font-extrabold tabular-nums">{loading?'…':s.v}</p>
              <p className="text-[11px] font-medium" style={{ opacity:0.7 }}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick nav cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
        {NAV_CARDS.map((card,i)=>(
          <Link key={card.href} href={card.href}
            className="page-card p-5 flex items-start gap-4 group cursor-pointer animate-fade-in-up hover:shadow-md transition-all"
            style={{ animationDelay:`${i*0.06}s`, textDecoration:'none' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
              style={{ background:card.bg, color:card.color }}>
              <card.Icon s={22}/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color:'#0F172A' }}>{card.label}</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color:'#94A3B8' }}>{card.desc}</p>
            </div>
            <ChevronRight size={18} className="flex-shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5" style={{ color:'#CBD5E1' }} />
          </Link>
        ))}
      </div>
    </div>
  );
}
