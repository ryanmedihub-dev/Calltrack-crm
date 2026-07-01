'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../../../lib/api';
import { fmtTime } from '../../../../lib/timezone';

const PERIODS = [
  { key:'today', label:'Today' },
  { key:'week',  label:'This Week' },
  { key:'month', label:'This Month' },
];
const MEDALS = ['🥇', '🥈', '🥉'];

function PodiumCard({ rank, employee, calls }) {
  const styles = {
    1: { height:'9rem',  bg:'linear-gradient(135deg,#F59E0B,#D97706)', label:{ background:'rgba(245,158,11,0.12)', color:'#92400E', border:'1px solid rgba(245,158,11,0.30)' } },
    2: { height:'7rem',  bg:'linear-gradient(135deg,#94A3B8,#64748B)', label:{ background:'#F1F5F9', color:'#475569', border:'1px solid #CBD5E1' } },
    3: { height:'5.5rem',bg:'linear-gradient(135deg,#FB923C,#F97316)', label:{ background:'rgba(251,146,60,0.12)', color:'#9A3412', border:'1px solid rgba(251,146,60,0.30)' } },
  };
  const s = styles[rank]||styles[3];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-md select-none"
          style={{ background:s.bg }}>
          {employee.name.slice(0,2).toUpperCase()}
        </div>
        <span className="absolute -top-2 -right-2 text-xl">{MEDALS[rank-1]}</span>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold leading-snug max-w-[90px] truncate" style={{ color:'#0F172A' }}>{employee.name}</p>
        <span className="text-xs font-bold rounded-full px-2 py-0.5" style={s.label}>{calls} calls</span>
      </div>
      <div className="w-24 rounded-t-xl opacity-20" style={{ height:s.height, background:s.bg }} />
    </div>
  );
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff', boxShadow:'0 8px 24px rgba(0,0,0,0.25)' }}>
      <p style={{ color:'#94A3B8' }}>{label}</p>
      {payload.map((p,i)=><p key={i} className="font-bold">{p.value} calls</p>)}
    </div>
  );
};

export default function LeaderboardPage() {
  const [period,  setPeriod]  = useState('week');
  const [dialers, setDialers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res  = await api.get('/api/calls/stats');
        const data = res.data.data;
        const key  = period==='today' ? 'today' : period==='week' ? 'thisWeek' : 'thisMonth';
        setDialers(data?.[key]?.topDialers||[]);
      } catch {}
      setLoading(false);
    })();
  }, [period]);

  const top3     = dialers.slice(0,3);
  const rest     = dialers.slice(3);
  const maxCalls = dialers[0]?.count||1;
  const chartData = dialers.slice(0,10).map(d=>({ name:d.name?.split(' ')[0]||'Unknown', calls:d.count }));
  const totalCalls = dialers.reduce((s,d)=>s+d.count,0)||1;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Leaderboard</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Top performers ranked by call count</p>
        </div>
        <div className="flex gap-0.5 p-1 rounded-xl" style={{ background:'#fff', border:'1px solid #E2E8F0' }}>
          {PERIODS.map(p=>(
            <button key={p.key} onClick={()=>setPeriod(p.key)}
              className="px-3.5 h-8 flex items-center rounded-lg text-xs font-semibold transition-all"
              style={period===p.key ? { background:'#2563EB', color:'#fff', boxShadow:'0 2px 6px rgba(37,99,235,0.25)' } : { color:'#94A3B8' }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i=><div key={i} className="skeleton h-16 rounded-xl"/>)}
        </div>
      ) : dialers.length === 0 ? (
        <div className="page-card p-16 text-center">
          <p className="text-sm" style={{ color:'#94A3B8' }}>No data for this period</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          {top3.length >= 1 && (
            <div className="page-card p-8">
              <h3 className="text-xs font-bold text-center uppercase tracking-widest mb-8" style={{ color:'#94A3B8' }}>Top Performers</h3>
              <div className="flex items-end justify-center gap-6">
                {[
                  top3[1] ? { ...top3[1], rank:2 } : null,
                  top3[0] ? { ...top3[0], rank:1 } : null,
                  top3[2] ? { ...top3[2], rank:3 } : null,
                ].filter(Boolean).map(d=>(
                  <PodiumCard key={d.employeeId} rank={d.rank} employee={{ name:d.name }} calls={d.count}/>
                ))}
              </div>
            </div>
          )}

          {/* Bar chart */}
          {chartData.length > 0 && (
            <div className="page-card p-5">
              <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Top 10 by Call Count</h3>
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.length*36)}>
                <BarChart data={chartData} barSize={22} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false}/>
                  <XAxis type="number" tick={{ fontSize:11, fill:'#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false}/>
                  <YAxis type="category" dataKey="name" tick={{ fontSize:12, fill:'#475569', fontWeight:600 }} tickLine={false} axisLine={false} width={80}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Bar dataKey="calls" fill="#2563EB" radius={[0,5,5,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Full rankings table */}
          <div className="page-card overflow-hidden">
            <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
              <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Full Rankings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table" style={{ minWidth:520 }}>
                <thead><tr>
                  <th>Rank</th><th>Agent</th>
                  <th style={{ textAlign:'right' }}>Calls</th>
                  <th style={{ textAlign:'right' }}>Share</th>
                  <th style={{ textAlign:'right' }}>First Call</th>
                  <th style={{ textAlign:'right' }}>Last Call</th>
                </tr></thead>
                <tbody>
                  {dialers.map((d,i)=>{
                    const share = Math.round((d.count/totalCalls)*100);
                    return (
                      <tr key={d.employeeId}>
                        <td className="w-10">
                          {i < 3
                            ? <span className="text-base">{MEDALS[i]}</span>
                            : <span className="font-bold text-xs" style={{ color:'#94A3B8' }}>#{i+1}</span>}
                        </td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                              style={{ background:'#2563EB' }}>
                              {(d.name||'U').slice(0,2).toUpperCase()}
                            </div>
                            <span className="font-semibold text-sm" style={{ color:'#0F172A' }}>{d.name||'Unknown'}</span>
                          </div>
                        </td>
                        <td style={{ textAlign:'right', fontWeight:700, color:'#2563EB' }}>{d.count}</td>
                        <td style={{ textAlign:'right' }}>
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background:'#E2E8F0' }}>
                              <div className="h-full rounded-full" style={{ width:`${(d.count/maxCalls)*100}%`, background:'#2563EB' }}/>
                            </div>
                            <span className="text-xs tabular-nums w-8 text-right" style={{ color:'#94A3B8' }}>{share}%</span>
                          </div>
                        </td>
                        <td style={{ textAlign:'right' }} className="text-xs tabular-nums" style2={{ color:'#94A3B8' }}>
                          <span style={{ color:'#94A3B8' }}>{d.first ? fmtTime(d.first) : '—'}</span>
                        </td>
                        <td style={{ textAlign:'right' }}>
                          <span className="text-xs tabular-nums" style={{ color:'#94A3B8' }}>{d.last ? fmtTime(d.last) : '—'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
