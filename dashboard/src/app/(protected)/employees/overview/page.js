'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../../../lib/api';
import { getAllEmployeesSafe } from '../../../../lib/employees';
import { DataTable } from '../../../../components/report-shared';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const UsersIco   = ({s=16}) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;
const ChevronIco = () => <Ico size={13}><polyline points="9 18 15 12 9 6"/></Ico>;
const ChartTip   = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff', boxShadow:'0 8px 24px rgba(0,0,0,0.25)' }}>
    <p style={{ color:'#94A3B8' }}>{label}</p>
    {payload.map((p,i) => <p key={i} className="font-bold">{p.name}: {p.value}</p>)}
  </div>;
};

const STATUS_STYLES = {
  active:   { bg:'#F0FDF4', color:'#16A34A', border:'#BBF7D0' },
  inactive: { bg:'#FFF1F2', color:'#DC2626', border:'#FECACA' },
};

export default function EmployeesOverviewPage() {
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [callStats, setCallStats] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [empRes, callRes] = await Promise.allSettled([
          getAllEmployeesSafe(api),
          api.get('/api/calls/stats'),
        ]);
        if (empRes.status === 'fulfilled') {
          const val = empRes.value;
          setEmployees(Array.isArray(val) ? val : (val?.data?.data || []));
        }
        if (callRes.status==='fulfilled') setCallStats(callRes.value.data?.data);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const activeCount   = employees.filter(e => e.isActive!==false).length;
  const inactiveCount = employees.filter(e => e.isActive===false).length;

  const chartData = employees
    .map(e => ({ name: (e.name||'').split(' ')[0], calls: callStats?.today?.topDialers?.find(d=>d.employeeId===e._id)?.count || 0 }))
    .sort((a,b) => b.calls-a.calls).slice(0,10);

  const tableRows = employees
    .map(e => ({ ...e, todayCalls: callStats?.today?.topDialers?.find(d=>d.employeeId===e._id)?.count||0 }))
    .sort((a,b) => b.todayCalls-a.todayCalls);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Employees Overview</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>All employees with call stats, lead counts, and status</p>
        </div>
        <Link href="/employees/leaderboard" className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
          <ChevronIco/> Leaderboard
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger">
        {[
          { label:'Total Employees', val:employees.length, color:'#2563EB', bg:'#EFF6FF' },
          { label:'Active',          val:activeCount,      color:'#16A34A', bg:'#F0FDF4' },
          { label:'Inactive',        val:inactiveCount,    color:'#DC2626', bg:'#FFF1F2' },
          { label:'Today Calls',     val:callStats?.today?.totalCalls??'—', color:'#7C3AED', bg:'#F5F3FF' },
        ].map((k,i) => (
          <div key={k.label} className="page-card p-4 animate-fade-in-up" style={{ animationDelay:`${i*0.05}s` }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background:k.bg, color:k.color }}>
              <UsersIco s={14}/>
            </div>
            <p className="stat-number text-2xl">{loading ? <span className="skeleton inline-block w-12 h-7 rounded"/> : k.val}</p>
            <p className="stat-label text-[10px] uppercase tracking-wider">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.some(d=>d.calls>0) && (
        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Top 10 Employees by Today's Calls</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, chartData.length*32)}>
            <BarChart data={chartData} barSize={20} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false}/>
              <XAxis type="number" tick={{ fontSize:10, fill:'#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false}/>
              <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#475569', fontWeight:600 }} tickLine={false} axisLine={false} width={72}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="calls" name="Calls" fill="#2563EB" radius={[0,5,5,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-4">
          <DataTable
            loading={loading}
            rows={tableRows}
            emptyTitle="No employees found"
            columns={[
              {
                key: 'name', label: 'Employee',
                render: (e) => (
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                      style={{ background:'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
                      {(e.name||'?').slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-xs" style={{ color:'#0F172A' }}>{e.name||'—'}</p>
                      <p className="text-[11px]" style={{ color:'#94A3B8' }}>{e.email||''}</p>
                    </div>
                  </div>
                ),
              },
              { key: 'phone', label: 'Phone', render: (e) => <span className="font-mono text-xs" style={{ color:'#475569' }}>{e.phone||'—'}</span> },
              { key: 'role', label: 'Role', render: (e) => <span className="text-xs capitalize" style={{ color:'#64748B' }}>{e.role||'Agent'}</span> },
              {
                key: 'todayCalls', label: 'Today Calls', align: 'right',
                render: (e) => <span className="font-bold tabular-nums text-sm" style={{ color: e.todayCalls>0?'#2563EB':'#94A3B8' }}>{e.todayCalls}</span>,
              },
              {
                key: 'status', label: 'Status', filterType: 'select',
                filterOptions: [{ value:'active', label:'Active' }, { value:'inactive', label:'Inactive' }],
                filterValue: (e) => e.isActive===false?'inactive':'active',
                render: (e) => {
                  const ws = e.isActive===false?'inactive':'active';
                  const ss = STATUS_STYLES[ws]||STATUS_STYLES.active;
                  return (
                    <span className="badge capitalize" style={{ background:ss.bg, color:ss.color, border:`1px solid ${ss.border}` }}>
                      {ws.replace('_',' ')}
                    </span>
                  );
                },
              },
              {
                key: 'actions', label: 'Actions', sortable: false, searchable: false,
                render: (e) => (
                  <Link href={`/employees/${e._id}`}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all"
                    style={{ background:'#EFF6FF', color:'#2563EB', border:'1px solid #BFDBFE' }}
                    onMouseEnter={ev=>{ev.currentTarget.style.background='#2563EB';ev.currentTarget.style.color='#fff';}}
                    onMouseLeave={ev=>{ev.currentTarget.style.background='#EFF6FF';ev.currentTarget.style.color='#2563EB';}}>
                    View
                  </Link>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
