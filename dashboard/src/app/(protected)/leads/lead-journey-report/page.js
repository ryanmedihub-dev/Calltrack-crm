'use client';
import { useState, useCallback } from 'react';
import api from '../../../../lib/api';
import { fmtDateTime } from '../../../../lib/timezone';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco = ({s=16}) => <Ico size={s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const MapIco    = ({s=20}) => <Ico size={s}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></Ico>;
const PhoneIco  = ({s=14}) => <Ico size={s}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Ico>;

const STATUS_META = {
  new:        { color:'#2563EB', bg:'#EFF6FF', border:'#BFDBFE', label:'New'        },
  contacted:  { color:'#D97706', bg:'#FFFBEB', border:'#FDE68A', label:'Contacted'  },
  qualified:  { color:'#7C3AED', bg:'#F5F3FF', border:'#DDD6FE', label:'Qualified'  },
  interested: { color:'#0D9488', bg:'#F0FDFA', border:'#99F6E4', label:'Interested' },
  converted:  { color:'#16A34A', bg:'#F0FDF4', border:'#BBF7D0', label:'Converted'  },
  lost:       { color:'#DC2626', bg:'#FFF1F2', border:'#FECACA', label:'Lost'       },
};

const CALL_TYPE = {
  incoming: { color:'#16A34A', bg:'#F0FDF4' },
  outgoing: { color:'#D97706', bg:'#FFFBEB' },
  missed:   { color:'#DC2626', bg:'#FFF1F2' },
  rejected: { color:'#7C3AED', bg:'#F5F3FF' },
};

const fmt = fmtDateTime;
function dur(s) { return s ? `${Math.floor(s/60)}m ${s%60}s` : '—'; }

export default function LeadJourneyReportPage() {
  const [query,    setQuery]    = useState('');
  const [lead,     setLead]     = useState(null);
  const [calls,    setCalls]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(''); setSearched(true);
    try {
      const [leadsRes, callsRes] = await Promise.allSettled([
        api.get('/api/leads', { params:{ search:query.trim(), limit:1 } }),
        api.get('/api/calls', { params:{ search:query.trim(), limit:100 } }),
      ]);
      const leadData  = leadsRes.status==='fulfilled'  ? (leadsRes.value.data?.data?.leads||leadsRes.value.data?.data||[])[0] : null;
      const callsData = callsRes.status==='fulfilled'  ? (callsRes.value.data?.data?.calls||callsRes.value.data?.data||[])    : [];
      setLead(leadData||null);
      setCalls(callsData);
      if (!leadData && !callsData.length) setError('No records found for this contact.');
    } catch { setError('Failed to fetch data. Please try again.'); }
    setLoading(false);
  }, [query]);

  const totalDur  = calls.reduce((s,c)=>s+(c.duration||0),0);
  const connected = calls.filter(c=>c.isConnected||c.duration>0).length;
  const st        = lead?.status ? (STATUS_META[lead.status]||{ color:'#64748B', bg:'#F1F5F9', border:'#CBD5E1', label:lead.status }) : null;

  const timeline = [...calls].sort((a,b) => new Date(a.timestamp)-new Date(b.timestamp));

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Lead Journey Report</h2>
        <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Full call and status history for any lead from first contact to now</p>
      </div>

      {/* Search */}
      <div className="page-card p-6">
        <p className="text-sm font-semibold mb-3" style={{ color:'#0F172A' }}>Search Lead</p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color:'#94A3B8' }}><SearchIco s={16}/></span>
            <input className="form-input pl-10" placeholder="Enter lead name, phone, or email…"
              value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()}/>
          </div>
          <button onClick={search} disabled={!query.trim()||loading} className="btn-primary px-6"
            style={{ opacity:!query.trim()||loading?0.7:1 }}>
            {loading?'Searching…':'Search'}
          </button>
        </div>
        {error && <p className="text-xs mt-2" style={{ color:'#DC2626' }}>{error}</p>}
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="skeleton h-24 rounded-xl"/>
          <div className="skeleton h-48 rounded-xl"/>
        </div>
      )}

      {!loading && searched && !lead && !calls.length && !error && (
        <div className="page-card p-16 text-center">
          <MapIco s={32}/>
          <p className="font-bold text-sm mt-3" style={{ color:'#0F172A' }}>No records found</p>
          <p className="text-xs mt-1" style={{ color:'#94A3B8' }}>Try searching by a different name, phone, or email.</p>
        </div>
      )}

      {!loading && (lead||calls.length>0) && (
        <>
          {/* Lead info card */}
          {lead && (
            <div className="page-card p-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black flex-shrink-0"
                  style={{ background:'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
                  {(lead.name||'?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-base" style={{ color:'#0F172A' }}>{lead.name||'Unknown'}</p>
                    {st && <span className="badge" style={{ background:st.bg, color:st.color, border:`1px solid ${st.border}` }}>{st.label}</span>}
                  </div>
                  <p className="text-sm font-mono mt-0.5" style={{ color:'#64748B' }}>{lead.phone||'—'}</p>
                  <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{lead.email||''}</p>
                  <div className="flex flex-wrap gap-4 mt-3">
                    <div><p className="text-[10px] uppercase font-bold" style={{ color:'#94A3B8' }}>Source</p><p className="text-xs font-semibold" style={{ color:'#374151' }}>{lead.source||'—'}</p></div>
                    <div><p className="text-[10px] uppercase font-bold" style={{ color:'#94A3B8' }}>Assigned To</p><p className="text-xs font-semibold" style={{ color:'#374151' }}>{lead.assignedToName||lead.assignedTo||'Unassigned'}</p></div>
                    <div><p className="text-[10px] uppercase font-bold" style={{ color:'#94A3B8' }}>Added</p><p className="text-xs font-semibold" style={{ color:'#374151' }}>{fmt(lead.createdAt)}</p></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger">
            {[
              { label:'Total Calls',   val:calls.length,             color:'#2563EB', bg:'#EFF6FF' },
              { label:'Connected',     val:connected,                color:'#16A34A', bg:'#F0FDF4' },
              { label:'Missed',        val:calls.filter(c=>c.callType==='missed').length, color:'#DC2626', bg:'#FFF1F2' },
              { label:'Total Duration',val:dur(totalDur),            color:'#7C3AED', bg:'#F5F3FF' },
            ].map((k,i)=>(
              <div key={k.label} className="page-card p-4 animate-fade-in-up" style={{ animationDelay:`${i*0.05}s` }}>
                <div className="w-2 h-5 rounded-full mb-1.5" style={{ background:k.color }}/>
                <p className="stat-number text-xl">{k.val}</p>
                <p className="stat-label text-[10px] uppercase tracking-wider">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="page-card overflow-hidden">
              <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
                <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Call Journey Timeline</h3>
                <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>From first contact to most recent</p>
              </div>
              <div className="p-5">
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-0.5" style={{ background:'#E2E8F0' }}/>
                  <div className="space-y-4">
                    {timeline.map((c,i) => {
                      const ct  = CALL_TYPE[c.callType?.toLowerCase()]||{ color:'#64748B', bg:'#F1F5F9' };
                      const isLast = i === timeline.length-1;
                      return (
                        <div key={c._id||i} className="relative flex gap-4 pl-12">
                          <div className="absolute left-3 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center z-10"
                            style={{ background:ct.color, top:'2px' }}>
                            <PhoneIco s={8}/>
                          </div>
                          <div className="flex-1 page-card p-3.5">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="badge capitalize" style={{ background:ct.bg, color:ct.color, border:`1px solid ${ct.color}20` }}>
                                  {c.callType||'call'}
                                </span>
                                <span className="text-xs font-semibold" style={{ color:'#0F172A' }}>{c.employeeName||'Unknown'}</span>
                              </div>
                              <span className="text-xs" style={{ color:'#94A3B8' }}>{fmt(c.timestamp)}</span>
                            </div>
                            <div className="flex gap-4 mt-2">
                              <span className="text-xs" style={{ color:'#64748B' }}>Duration: <strong>{dur(c.duration)}</strong></span>
                              <span className="text-xs" style={{ color:'#64748B' }}>
                                {c.isConnected||c.duration>0 ? '✓ Connected' : '✗ Not connected'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
