'use client';
import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../../../../lib/api';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const DownloadIco = ({s=13}) => <Ico size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Ico>;

const STATUSES = [
  { key:'new',        label:'New',        color:'#2563EB', bg:'#EFF6FF' },
  { key:'contacted',  label:'Contacted',  color:'#D97706', bg:'#FFFBEB' },
  { key:'qualified',  label:'Qualified',  color:'#7C3AED', bg:'#F5F3FF' },
  { key:'interested', label:'Interested', color:'#0D9488', bg:'#F0FDFA' },
  { key:'converted',  label:'Converted',  color:'#16A34A', bg:'#F0FDF4' },
  { key:'lost',       label:'Lost',       color:'#DC2626', bg:'#FFF1F2' },
];

const PERIODS = [{ k:'today',l:'Today' },{ k:'week',l:'This Week' },{ k:'month',l:'This Month' },{ k:'all',l:'All Time' }];

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff' }}>
    <p style={{ color:'#94A3B8' }}>{label}</p>
    {payload.map((p,i) => <p key={i} className="font-bold">{p.name}: {p.value}</p>)}
  </div>;
};

export default function LeadReportPage() {
  const [period,  setPeriod]  = useState('month');
  const [counts,  setCounts]  = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        STATUSES.map(s =>
          api.get('/api/leads', { params:{ status:s.key, limit:1, period } })
            .then(r=>({ key:s.key, count:r.data?.data?.total||0 }))
            .catch(()=>({ key:s.key, count:0 }))
        )
      );
      const map = {};
      results.forEach(r=>{ map[r.key]=r.count; });
      setCounts(map);
    } catch {}
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const total    = Object.values(counts).reduce((s,n)=>s+n,0);
  const convRate = total>0 ? ((counts.converted||0)/total*100).toFixed(1) : '0.0';
  const lossRate = total>0 ? ((counts.lost||0)/total*100).toFixed(1) : '0.0';
  const barData  = STATUSES.map(s=>({ name:s.label, count:counts[s.key]||0 }));
  const pieData  = STATUSES.map(s=>({ name:s.label, value:counts[s.key]||0, color:s.color })).filter(d=>d.value>0);

  const exportCSV = () => {
    const rows = [['Status','Count','Percentage'],...STATUSES.map(s=>[s.label,counts[s.key]||0,total>0?((counts[s.key]||0)/total*100).toFixed(1)+'%':'0%'])];
    const csv  = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='lead-report.csv'; a.click();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Lead Report</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Comprehensive lead pipeline analytics by period</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 p-1 rounded-xl" style={{ background:'#fff', border:'1px solid #E2E8F0' }}>
            {PERIODS.map(p=>(
              <button key={p.k} onClick={()=>setPeriod(p.k)}
                className="px-3 h-7 flex items-center rounded-lg text-xs font-semibold transition-all"
                style={period===p.k?{background:'#2563EB',color:'#fff',boxShadow:'0 2px 6px rgba(37,99,235,0.25)'}:{color:'#94A3B8'}}>
                {p.l}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} className="btn-secondary text-xs py-1.5 px-3"><DownloadIco/> Export</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger">
        {[
          { label:'Total Leads',     val:total,   color:'#2563EB', bg:'#EFF6FF' },
          { label:'Converted',       val:counts.converted||0, color:'#16A34A', bg:'#F0FDF4' },
          { label:'Conversion Rate', val:`${convRate}%`, color:'#0D9488', bg:'#F0FDFA' },
          { label:'Loss Rate',       val:`${lossRate}%`, color:'#DC2626', bg:'#FFF1F2' },
        ].map((k,i)=>(
          <div key={k.label} className="page-card p-4 animate-fade-in-up" style={{ animationDelay:`${i*0.05}s` }}>
            <div className="w-2 h-6 rounded-full mb-2" style={{ background:k.color }}/>
            <p className="stat-number text-2xl">
              {loading?<span className="skeleton inline-block w-12 h-7 rounded"/>:k.val}
            </p>
            <p className="stat-label text-[10px] uppercase tracking-wider">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 page-card p-5">
          <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Lead Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
              <XAxis dataKey="name" tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} width={28} allowDecimals={false}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="count" name="Leads" radius={[5,5,0,0]}>
                {barData.map((_,i)=><Cell key={i} fill={STATUSES[i]?.color||'#2563EB'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-3" style={{ color:'#0F172A' }}>Distribution</h3>
          {pieData.length===0 ? (
            <div className="flex items-center justify-center h-40"><p className="text-sm" style={{ color:'#94A3B8' }}>No data</p></div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip content={<ChartTip/>}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {pieData.map(d=>(
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background:d.color }}/><span style={{ color:'#64748B' }}>{d.name}</span></div>
                    <span className="font-bold" style={{ color:'#0F172A' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Status Summary Table</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Status</th><th style={{ textAlign:'right' }}>Count</th><th style={{ textAlign:'right' }}>Percentage</th><th>Bar</th></tr></thead>
            <tbody>
              {STATUSES.map(s=>{
                const count = counts[s.key]||0;
                const pct   = total>0?Math.round((count/total)*100):0;
                return (
                  <tr key={s.key}>
                    <td><span className="badge capitalize" style={{ background:s.bg, color:s.color }}>{s.label}</span></td>
                    <td style={{ textAlign:'right', fontWeight:700, color:s.color }}>{loading?'…':count}</td>
                    <td style={{ textAlign:'right', color:'#64748B' }}>{pct}%</td>
                    <td>
                      <div className="w-32 h-2 rounded-full overflow-hidden" style={{ background:'#F1F5F9' }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width:`${pct}%`, background:s.color }}/>
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderTop:'2px solid #E2E8F0' }}>
                <td className="font-bold" style={{ color:'#0F172A' }}>Total</td>
                <td style={{ textAlign:'right', fontWeight:800, color:'#0F172A' }}>{total}</td>
                <td style={{ textAlign:'right', color:'#64748B' }}>100%</td>
                <td/>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
