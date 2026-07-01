'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../../../lib/api';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const UsersIco = ({s=16}) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;

const STATUSES = ['new','contacted','qualified','interested','converted','lost'];
const STATUS_COLORS = { new:'#2563EB', contacted:'#D97706', qualified:'#7C3AED', interested:'#0D9488', converted:'#16A34A', lost:'#DC2626' };

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff' }}>
    <p style={{ color:'#94A3B8' }}>{label}</p>
    {payload.map((p,i) => <p key={i} className="font-bold" style={{ color:STATUS_COLORS[p.dataKey]||'#fff' }}>{p.name}: {p.value}</p>)}
  </div>;
};

export default function LeadsEmployeesReportsPage() {
  const [employees, setEmployees] = useState([]);
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [sort,      setSort]      = useState('total');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const empRes = await api.get('/api/employees');
        const emps   = empRes.data?.data||[];
        setEmployees(emps);

        const rows = await Promise.all(emps.map(async e => {
          const counts = {};
          await Promise.all(STATUSES.map(s =>
            api.get('/api/leads', { params:{ assignedTo:e._id, status:s, limit:1 } })
              .then(r=>{ counts[s]=r.data?.data?.total||0; })
              .catch(()=>{ counts[s]=0; })
          ));
          const total = Object.values(counts).reduce((s,n)=>s+n,0);
          return { id:e._id, name:e.name, role:e.role||'Agent', ...counts, total };
        }));
        setData(rows);
      } catch { setData([]); }
      setLoading(false);
    })();
  }, []);

  const sorted = [...data].sort((a,b) => b[sort]-a[sort]);
  const chartData = sorted.slice(0,10).map(r=>({ name:r.name.split(' ')[0], ...r }));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Employees Leads Report</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Lead status breakdown assigned to each employee</p>
        </div>
        <select className="form-input text-xs w-40" value={sort} onChange={e=>setSort(e.target.value)}>
          <option value="total">Sort: Total</option>
          <option value="converted">Sort: Converted</option>
          <option value="interested">Sort: Interested</option>
          <option value="new">Sort: New</option>
        </select>
      </div>

      {/* Stacked bar chart */}
      {!loading && chartData.length > 0 && (
        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Lead Distribution — Top 10 Employees</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, chartData.length*32)}>
            <BarChart data={chartData} barSize={22} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false}/>
              <XAxis type="number" tick={{ fontSize:10, fill:'#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false}/>
              <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#475569', fontWeight:600 }} tickLine={false} axisLine={false} width={72}/>
              <Tooltip content={<ChartTip/>}/>
              {STATUSES.map(s=>(
                <Bar key={s} dataKey={s} name={s.charAt(0).toUpperCase()+s.slice(1)}
                  stackId="a" fill={STATUS_COLORS[s]} radius={s==='lost'?[0,4,4,0]:[0,0,0,0]}/>
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-4 justify-center">
            {STATUSES.map(s=>(
              <div key={s} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ background:STATUS_COLORS[s] }}/>
                <span className="text-[11px] capitalize" style={{ color:'#475569' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="page-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth:760 }}>
            <thead>
              <tr>
                <th>Employee</th>
                {STATUSES.map(s=><th key={s} style={{ textAlign:'right' }} className="capitalize">{s}</th>)}
                <th style={{ textAlign:'right' }}>Total</th>
                <th style={{ textAlign:'right' }}>Conv. Rate</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:6}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:9}).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
                ))
              ) : sorted.length===0 ? (
                <tr><td colSpan={9}>
                  <div className="flex flex-col items-center py-14 gap-2">
                    <UsersIco s={24}/>
                    <p className="text-sm" style={{ color:'#94A3B8' }}>No data available</p>
                  </div>
                </td></tr>
              ) : sorted.map((r,i)=>{
                const convRate = r.total>0 ? Math.round((r.converted/r.total)*100) : 0;
                return (
                  <tr key={r.id||i}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ background:'#2563EB' }}>{(r.name||'?').slice(0,2).toUpperCase()}</div>
                        <div>
                          <p className="font-semibold text-xs" style={{ color:'#0F172A' }}>{r.name}</p>
                          <p className="text-[10px] capitalize" style={{ color:'#94A3B8' }}>{r.role}</p>
                        </div>
                      </div>
                    </td>
                    {STATUSES.map(s=>(
                      <td key={s} style={{ textAlign:'right', fontWeight:600, color:STATUS_COLORS[s] }}>{r[s]||0}</td>
                    ))}
                    <td style={{ textAlign:'right', fontWeight:700, color:'#0F172A' }}>{r.total}</td>
                    <td style={{ textAlign:'right' }}>
                      <span className="font-bold text-xs" style={{ color:convRate>20?'#16A34A':convRate>10?'#D97706':'#DC2626' }}>
                        {convRate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
