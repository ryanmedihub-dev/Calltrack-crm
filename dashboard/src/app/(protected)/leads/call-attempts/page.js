'use client';
import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../../../lib/api';
import { fmtDateTime } from '../../../../lib/timezone';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco  = () => <Ico size={13}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const AttemptIco = ({s=20}) => <Ico size={s}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></Ico>;

const TYPE_STYLES = {
  incoming: { bg:'#F0FDF4', color:'#16A34A', border:'#BBF7D0' },
  outgoing: { bg:'#FFFBEB', color:'#D97706', border:'#FDE68A' },
  missed:   { bg:'#FFF1F2', color:'#DC2626', border:'#FECACA' },
  rejected: { bg:'#F5F3FF', color:'#7C3AED', border:'#DDD6FE' },
};

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff' }}>
    <p style={{ color:'#94A3B8' }}>{label}</p>
    {payload.map((p,i) => <p key={i} className="font-bold">{p.name}: {p.value}</p>)}
  </div>;
};

const fmt = fmtDateTime;
function dur(s) { return s ? `${Math.floor(s/60)}m ${s%60}s` : '—'; }

export default function CallAttemptsPage() {
  const [leads,     setLeads]     = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [calls,     setCalls]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [callLoad,  setCallLoad]  = useState(false);
  const [search,    setSearch]    = useState('');
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const PER_PAGE = 20;

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/leads', { params:{ search:search||undefined, page, limit:PER_PAGE } });
      setLeads(r.data?.data?.leads||r.data?.data||[]);
      setTotal(r.data?.data?.total||0);
    } catch { setLeads([]); }
    setLoading(false);
  }, [search, page]);

  const loadCalls = useCallback(async (lead) => {
    if (!lead) return;
    setCallLoad(true);
    try {
      const r = await api.get('/api/calls', { params:{ search:lead.phone||lead.name, limit:50 } });
      setCalls(r.data?.data?.calls||r.data?.data||[]);
    } catch { setCalls([]); }
    setCallLoad(false);
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);
  useEffect(() => { if (selected) loadCalls(selected); }, [selected, loadCalls]);

  const totalPages = Math.ceil(total/PER_PAGE);
  const attemptCounts = [1,2,3,4,5].map(n => ({
    name: `${n}${n===5?'+':''} attempt${n>1?'s':''}`,
    leads: leads.filter(l=>(l.callAttempts||l.attempts||0)===n || (n===5&&(l.callAttempts||l.attempts||0)>=5)).length,
  }));

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Call Attempts</h2>
        <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>View call attempt history and patterns per lead</p>
      </div>

      {/* Chart */}
      <div className="page-card p-5">
        <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Attempt Distribution</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={attemptCounts} barCategoryGap="40%">
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
            <XAxis dataKey="name" tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} width={24} allowDecimals={false}/>
            <Tooltip content={<ChartTip/>}/>
            <Bar dataKey="leads" name="Leads" fill="#2563EB" radius={[5,5,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Leads list */}
        <div className="page-card overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom:'1px solid #E2E8F0' }}>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'#94A3B8' }}><SearchIco/></span>
              <input className="form-input pl-8 text-xs" placeholder="Search leads…"
                value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight:480 }}>
            {loading ? (
              Array.from({length:8}).map((_,i)=>(
                <div key={i} className="px-4 py-3 border-b" style={{ borderColor:'#F1F5F9' }}>
                  <div className="skeleton h-4 w-32 rounded mb-1"/><div className="skeleton h-3 w-24 rounded"/>
                </div>
              ))
            ) : leads.map((l,i)=>(
              <button key={l._id||i} onClick={()=>setSelected(l)}
                className="w-full text-left px-4 py-3 transition-colors"
                style={{
                  borderBottom:'1px solid #F1F5F9',
                  background: selected?._id===l._id ? '#EFF6FF' : '',
                }}
                onMouseEnter={e=>{ if(selected?._id!==l._id) e.currentTarget.style.background='#F8FAFC'; }}
                onMouseLeave={e=>{ if(selected?._id!==l._id) e.currentTarget.style.background=''; }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ background: selected?._id===l._id ? '#2563EB' : '#64748B' }}>
                      {(l.name||'?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: selected?._id===l._id ? '#2563EB' : '#0F172A' }}>{l.name||'Unknown'}</p>
                      <p className="text-[11px] font-mono" style={{ color:'#94A3B8' }}>{l.phone||'—'}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background:'#EFF6FF', color:'#2563EB' }}>
                    {l.callAttempts||l.attempts||0} calls
                  </span>
                </div>
              </button>
            ))}
          </div>
          {totalPages>1 && (
            <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop:'1px solid #F1F5F9' }}>
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="text-xs px-2 py-1 rounded font-medium disabled:opacity-40" style={{ color:'#2563EB' }}>← Prev</button>
              <span className="text-xs" style={{ color:'#94A3B8' }}>{page}/{totalPages}</span>
              <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="text-xs px-2 py-1 rounded font-medium disabled:opacity-40" style={{ color:'#2563EB' }}>Next →</button>
            </div>
          )}
        </div>

        {/* Calls for selected lead */}
        <div className="page-card overflow-hidden">
          <div className="px-4 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>
              {selected ? `Calls for ${selected.name||'—'}` : 'Select a lead to view calls'}
            </h3>
          </div>
          {!selected ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background:'#EFF6FF', color:'#2563EB' }}>
                <AttemptIco s={22}/>
              </div>
              <p className="text-sm" style={{ color:'#94A3B8' }}>Click a lead on the left</p>
            </div>
          ) : callLoad ? (
            <div className="p-4 space-y-2">{Array.from({length:5}).map((_,i)=><div key={i} className="skeleton h-12 rounded-lg"/>)}</div>
          ) : calls.length===0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-sm" style={{ color:'#94A3B8' }}>No call records found for this lead.</p>
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight:480 }}>
              {calls.map((c,i)=>{
                const ts = TYPE_STYLES[c.callType?.toLowerCase()]||{ bg:'#F1F5F9', color:'#64748B', border:'#CBD5E1' };
                return (
                  <div key={c._id||i} className="px-4 py-3" style={{ borderBottom:'1px solid #F1F5F9' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="badge capitalize" style={{ background:ts.bg, color:ts.color, border:`1px solid ${ts.border}` }}>
                          {c.callType||'—'}
                        </span>
                        <span className="text-xs font-semibold" style={{ color:'#0F172A' }}>{c.employeeName||'—'}</span>
                      </div>
                      <span className="text-[11px]" style={{ color:'#94A3B8' }}>{fmt(c.timestamp)}</span>
                    </div>
                    <div className="flex gap-4 mt-1">
                      <span className="text-xs" style={{ color:'#64748B' }}>Duration: <strong>{dur(c.duration)}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
