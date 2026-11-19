'use client';
import { Plus, Pencil, Trash2, RefreshCw, KeyRound } from 'lucide-react';
const ACT_ICONS = { '➕': Plus, '✎': Pencil, '🗑': Trash2, '🔄': RefreshCw, '🔑': KeyRound };
const ActIcon = ({ glyph }) => { const I = ACT_ICONS[glyph]; return I ? <I size={15} strokeWidth={1.75} aria-hidden /> : null; };
import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { getAllEmployeesSafe } from '../../../lib/employees';
import { parseUTC } from '../../../lib/timezone';
import MultiSelect from '../../../components/MultiSelect';

const ACTION_CONFIG = {
  'lead.create': { label:'Lead Created',  color:'#079455', bg:'rgba(7,148,85,0.08)',  icon:'➕' },
  'lead.update': { label:'Lead Updated',  color:'#B54708', bg:'rgba(181,71,8,0.08)', icon:'✎'  },
  'lead.delete': { label:'Lead Deleted',  color:'#D92D20', bg:'rgba(217,45,32,0.08)',  icon:'🗑' },
  'call.sync':   { label:'Calls Synced',  color:'#7C3AED', bg:'rgba(124,58,237,0.08)', icon:'🔄' },
  'lead.claim':  { label:'Lead Claimed',  color:'#7C3AED', bg:'rgba(124,58,237,0.08)', icon:'➕' },
  'auth.login':  { label:'Login',         color:'#524F63', bg:'#F4F3F8', icon:'🔑' },
};

function getActionCfg(action) {
  return ACTION_CONFIG[action]||{ label:action, color:'#6B6880', bg:'rgba(100,116,139,0.08)', icon:'•' };
}

function groupByDate(logs) {
  const map = {};
  logs.forEach(log => {
    const date = parseUTC(log.createdAt).toLocaleDateString('en-IN',{
      weekday:'short', day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Kolkata',
    });
    if (!map[date]) map[date]=[];
    map[date].push(log);
  });
  return Object.entries(map);
}

function formatTime(ts) {
  return parseUTC(ts).toLocaleTimeString('en-IN',{ hour:'2-digit', minute:'2-digit', timeZone:'Asia/Kolkata' });
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
  const [actionFilter, setActionFilter] = useState('');
  const [employees,    setEmployees]    = useState([]);
  const [empFilter,    setEmpFilter]    = useState('');
  const LIMIT = 50;

  const load = async (p=1) => {
    setLoading(true);
    try {
      const params = { page:p, limit:LIMIT };
      if (actionFilter) params.action = actionFilter;
      if (empFilter)    params.userId  = empFilter;
      const res  = await api.get('/api/audit-logs', { params });
      const data = res.data.data;
      setLogs(data?.logs||[]);
      setTotal(data?.total||0);
      setPage(p);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    getAllEmployeesSafe(api).then(setEmployees).catch(()=>{});
  }, []);

  useEffect(() => { load(1); }, [actionFilter, empFilter]);

  const grouped = groupByDate(logs);
  const pages   = Math.ceil(total/LIMIT);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="page-title">Activity Log</h2>
        <p className="page-subtitle">Audit trail of all manager and system actions</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <MultiSelect className="w-48" ariaLabel="Action" placeholder="All actions" noun="actions"
          value={actionFilter} onChange={setActionFilter}
          options={Object.entries(ACTION_CONFIG).map(([key, cfg]) => [key, cfg.label])} />
        <MultiSelect className="w-52" ariaLabel="User" placeholder="All users" noun="users"
          value={empFilter} onChange={setEmpFilter} options={employees.map((e) => [e._id, e.name])} />

        <p className="text-xs ml-auto" style={{ color: '#6B6880' }}>{total.toLocaleString()} total records</p>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-5">
          {[1,2,3].map(i=>(
            <div key={i}>
              <div className="skeleton h-5 w-32 rounded-full mx-auto mb-3"/>
              <div className="page-card overflow-hidden">
                {[1,2,3].map(j=>(
                  <div key={j} className="flex items-center gap-4 px-5 py-3.5" style={{ borderBottom:'1px solid #F4F3F8' }}>
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
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background:'#F5F3FF', color:'#7C3AED' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p className="text-sm" style={{ color: '#6B6880' }}>No activity found for selected filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, dayLogs])=>(
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1" style={{ background:'#E9E7EF' }}/>
                <span className="text-xs font-bold px-3 py-1 rounded-full flex-shrink-0"
                  style={{ color:'#6B6880', background:'#FAF9FC', border:'1px solid #E9E7EF' }}>
                  {date}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: '#6B6880' }}>{dayLogs.length} events</span>
                <div className="h-px flex-1" style={{ background:'#E9E7EF' }}/>
              </div>

              <div className="page-card overflow-hidden">
                {dayLogs.map((log,i)=>{
                  const cfg  = getActionCfg(log.action);
                  const desc = buildDescription(log);
                  return (
                    <div key={log._id||i} className="flex items-center gap-4 px-5 py-3.5 transition-colors"
                      style={{ borderBottom:'1px solid #F4F3F8' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#FAF9FC'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <span className="text-xs font-mono w-14 flex-shrink-0 tabular-nums" style={{ color: '#6B6880' }}>
                        {formatTime(log.createdAt)}
                      </span>

                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background:cfg.bg, color:cfg.color }}>
                        <ActIcon glyph={cfg.icon} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color:'#1A1726' }}>
                          {cfg.label}{desc?`: ${desc}`:''}
                        </p>
                        {log.userName && <p className="text-xs" style={{ color: '#6B6880' }}>{log.userName}</p>}
                      </div>

                      <span className="hidden md:inline-block badge text-xs font-bold flex-shrink-0"
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
            style={{ border:'1px solid #E9E7EF', color:'#6B6880', opacity:page===1?0.4:1 }}
            onMouseEnter={e=>{ if(page!==1){ e.currentTarget.style.borderColor='#EDE9FE'; e.currentTarget.style.color='#7C3AED'; } }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor='#E9E7EF'; e.currentTarget.style.color='#6B6880'; }}>
            ← Prev
          </button>
          <span className="text-sm px-2" style={{ color: '#6B6880' }}>Page {page} of {pages}</span>
          <button disabled={page===pages} onClick={()=>load(page+1)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ border:'1px solid #E9E7EF', color:'#6B6880', opacity:page===pages?0.4:1 }}
            onMouseEnter={e=>{ if(page!==pages){ e.currentTarget.style.borderColor='#EDE9FE'; e.currentTarget.style.color='#7C3AED'; } }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor='#E9E7EF'; e.currentTarget.style.color='#6B6880'; }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
