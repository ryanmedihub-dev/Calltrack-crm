'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';

const ACTION_CONFIG = {
  'lead.create': { label:'Lead Created',  color:'#16A34A', bg:'rgba(22,163,74,0.08)',  icon:'➕' },
  'lead.update': { label:'Lead Updated',  color:'#D97706', bg:'rgba(217,119,6,0.08)', icon:'✎'  },
  'lead.delete': { label:'Lead Deleted',  color:'#EF4444', bg:'rgba(220,38,38,0.08)',  icon:'🗑' },
  'call.sync':   { label:'Calls Synced',  color:'#2563EB', bg:'rgba(37,99,235,0.08)', icon:'🔄' },
  'auth.login':  { label:'Login',         color:'#7C3AED', bg:'rgba(124,58,237,0.08)', icon:'🔑' },
};

function getActionCfg(action) {
  return ACTION_CONFIG[action]||{ label:action, color:'#64748B', bg:'rgba(100,116,139,0.08)', icon:'•' };
}

function groupByDate(logs) {
  const map = {};
  logs.forEach(log => {
    const date = new Date(log.createdAt).toLocaleDateString('en-IN',{ weekday:'short', day:'numeric', month:'short', year:'numeric' });
    if (!map[date]) map[date]=[];
    map[date].push(log);
  });
  return Object.entries(map);
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IN',{ hour:'2-digit', minute:'2-digit' });
}

function buildDescription(log) {
  if (log.details?.name)  return log.details.name;
  if (log.details?.phone) return log.details.phone;
  return log.entity||'';
}

export default function ActivityLogPage() {
  const [logs,         setLogs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [page,         setPage]         = useState(1);
  const [total,        setTotal]        = useState(0);
  const [actionFilter, setActionFilter] = useState('all');
  const [employees,    setEmployees]    = useState([]);
  const [empFilter,    setEmpFilter]    = useState('all');
  const LIMIT = 50;

  const load = async (p=1) => {
    setLoading(true);
    try {
      const params = { page:p, limit:LIMIT };
      if (actionFilter!=='all') params.action = actionFilter;
      if (empFilter!=='all')    params.userId  = empFilter;
      const res  = await api.get('/api/audit-logs', { params });
      const data = res.data.data;
      setLogs(data?.logs||[]);
      setTotal(data?.total||0);
      setPage(p);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    api.get('/api/employees').then(r=>setEmployees(r.data.data||[])).catch(()=>{});
  }, []);

  useEffect(() => { load(1); }, [actionFilter, empFilter]);

  const grouped = groupByDate(logs);
  const pages   = Math.ceil(total/LIMIT);

  const selectStyle = {
    background:'#fff', border:'1px solid #E2E8F0', borderRadius:'0.625rem',
    padding:'8px 12px', fontSize:'13px', color:'#0F172A', outline:'none',
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Activity Log</h2>
        <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Audit trail of all manager and system actions</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={actionFilter} onChange={e=>setActionFilter(e.target.value)} style={selectStyle}
          onFocus={e=>e.currentTarget.style.borderColor='#2563EB'} onBlur={e=>e.currentTarget.style.borderColor='#E2E8F0'}>
          <option value="all">All Actions</option>
          {Object.entries(ACTION_CONFIG).map(([key,cfg])=>(
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>

        <select value={empFilter} onChange={e=>setEmpFilter(e.target.value)} style={selectStyle}
          onFocus={e=>e.currentTarget.style.borderColor='#2563EB'} onBlur={e=>e.currentTarget.style.borderColor='#E2E8F0'}>
          <option value="all">All Users</option>
          {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
        </select>

        <p className="text-xs ml-auto" style={{ color:'#94A3B8' }}>{total.toLocaleString()} total records</p>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-5">
          {[1,2,3].map(i=>(
            <div key={i}>
              <div className="skeleton h-5 w-32 rounded-full mx-auto mb-3"/>
              <div className="page-card overflow-hidden">
                {[1,2,3].map(j=>(
                  <div key={j} className="flex items-center gap-4 px-5 py-3.5" style={{ borderBottom:'1px solid #F1F5F9' }}>
                    <div className="skeleton w-14 h-4 rounded"/>
                    <div className="skeleton w-8 h-8 rounded-xl flex-shrink-0"/>
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3 w-3/4 rounded"/>
                      <div className="skeleton h-3 w-1/3 rounded"/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="page-card p-16 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background:'#EFF6FF', color:'#2563EB' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p className="text-sm" style={{ color:'#94A3B8' }}>No activity found for selected filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, dayLogs])=>(
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1" style={{ background:'#E2E8F0' }}/>
                <span className="text-xs font-bold px-3 py-1 rounded-full flex-shrink-0"
                  style={{ color:'#64748B', background:'#F8FAFC', border:'1px solid #E2E8F0' }}>
                  {date}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color:'#94A3B8' }}>{dayLogs.length} events</span>
                <div className="h-px flex-1" style={{ background:'#E2E8F0' }}/>
              </div>

              <div className="page-card overflow-hidden">
                {dayLogs.map((log,i)=>{
                  const cfg  = getActionCfg(log.action);
                  const desc = buildDescription(log);
                  return (
                    <div key={log._id||i} className="flex items-center gap-4 px-5 py-3.5 transition-colors"
                      style={{ borderBottom:'1px solid #F1F5F9' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#F8FAFC'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <span className="text-xs font-mono w-14 flex-shrink-0 tabular-nums" style={{ color:'#94A3B8' }}>
                        {formatTime(log.createdAt)}
                      </span>

                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background:cfg.bg, color:cfg.color }}>
                        {cfg.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color:'#0F172A' }}>
                          {cfg.label}{desc?`: ${desc}`:''}
                        </p>
                        {log.userName && <p className="text-xs" style={{ color:'#94A3B8' }}>{log.userName}</p>}
                      </div>

                      <span className="hidden md:inline-block badge text-[10px] font-bold flex-shrink-0"
                        style={{ color:cfg.color, background:cfg.bg }}>
                        {log.entity||'System'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page===1} onClick={()=>load(page-1)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ border:'1px solid #E2E8F0', color:'#64748B', opacity:page===1?0.4:1 }}
            onMouseEnter={e=>{ if(page!==1){ e.currentTarget.style.borderColor='#BFDBFE'; e.currentTarget.style.color='#2563EB'; } }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor='#E2E8F0'; e.currentTarget.style.color='#64748B'; }}>
            ← Prev
          </button>
          <span className="text-sm px-2" style={{ color:'#94A3B8' }}>Page {page} of {pages}</span>
          <button disabled={page===pages} onClick={()=>load(page+1)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ border:'1px solid #E2E8F0', color:'#64748B', opacity:page===pages?0.4:1 }}
            onMouseEnter={e=>{ if(page!==pages){ e.currentTarget.style.borderColor='#BFDBFE'; e.currentTarget.style.color='#2563EB'; } }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor='#E2E8F0'; e.currentTarget.style.color='#64748B'; }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
