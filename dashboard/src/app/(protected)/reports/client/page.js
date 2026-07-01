'use client';
import { useState } from 'react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../../../lib/api';
import Pagination from '../../../../components/Pagination';
import { parseUTC } from '../../../../lib/timezone';

const DURATION_OPTIONS = [
  { value:'all',       label:'All Time' },
  { value:'today',     label:'Today' },
  { value:'yesterday', label:'Yesterday' },
  { value:'week',      label:'Last 7 Days' },
  { value:'month',     label:'Last 30 Days' },
];

const TYPE_COLORS = {
  incoming: '#22C55E', outgoing: '#F59E0B', missed: '#EF4444', rejected: '#7C3AED',
};

function CallBadge({ type }) {
  const color = TYPE_COLORS[type] || '#64748B';
  return (
    <span className="badge text-[11px] capitalize"
      style={{ background:`${color}14`, color, border:`1px solid ${color}38` }}>
      {type||'—'}
    </span>
  );
}

export default function ClientReportsPage() {
  const [phone,       setPhone]       = useState('');
  const [duration,    setDuration]    = useState('all');
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [activeTab,   setActiveTab]   = useState('summary');
  const [page,        setPage]        = useState(1);
  const [historyData, setHistoryData] = useState(null);

  const fetchReport = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const res = await api.get('/api/reports/client', { params:{ phone:phone.trim(), duration, tab:'summary' } });
      setData(res.data.data);
      setActiveTab('summary'); setPage(1); setHistoryData(null);
    } catch {}
    finally { setLoading(false); }
  };

  const fetchHistory = async (p=1) => {
    try {
      const res = await api.get('/api/reports/client', { params:{ phone:phone.trim(), duration, tab:'history', page:p, limit:50 } });
      setHistoryData(res.data.data);
    } catch {}
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab==='history') fetchHistory(1);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Client Reports</h2>
        <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Search call history by client phone number</p>
      </div>

      {/* Search bar */}
      <div className="page-card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color:'#64748B' }}>Duration</label>
          <select value={duration} onChange={e=>setDuration(e.target.value)} className="form-input min-w-36">
            {DURATION_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium mb-1" style={{ color:'#64748B' }}>Phone Number</label>
          <input value={phone} onChange={e=>setPhone(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&fetchReport()}
            placeholder="Enter phone number…"
            className="form-input w-full"/>
        </div>
        <button onClick={fetchReport} disabled={loading||!phone.trim()} className="btn-primary" style={{ opacity:loading||!phone.trim()?0.6:1 }}>
          {loading?'Loading…':'Get Report'}
        </button>
      </div>

      {data && (
        <>
          {/* Active filter tag */}
          <div className="flex items-center gap-2">
            <span className="badge text-xs"
              style={{ background:'#EFF6FF', color:'#2563EB', border:'1px solid #BFDBFE' }}>
              {DURATION_OPTIONS.find(o=>o.value===duration)?.label} · Client: {data.phone}
            </span>
          </div>

          {/* Tabs */}
          <div className="tab-nav">
            {[{ key:'summary',label:'Summary' },{ key:'history',label:'Call History' }].map(tab=>(
              <button key={tab.key} onClick={()=>handleTabChange(tab.key)}
                className={`tab-item${activeTab===tab.key?' active':''}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab==='summary' && <ClientSummaryTab data={data} CallBadge={CallBadge}/>}
          {activeTab==='history' && (
            <ClientHistoryTab data={historyData} page={page} onPage={p=>{ setPage(p); fetchHistory(p); }} CallBadge={CallBadge}/>
          )}
        </>
      )}

      {!data && !loading && (
        <div className="page-card flex flex-col items-center justify-center h-64 gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background:'#EFF6FF', color:'#2563EB' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            </svg>
          </div>
          <p className="text-sm" style={{ color:'#94A3B8' }}>Enter a phone number and click Get Report</p>
        </div>
      )}
    </div>
  );
}

function ClientSummaryTab({ data, CallBadge }) {
  const { summary, sidebarStats, pieData, employeeSummary } = data;
  if (!summary) return null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Summary table */}
        <div className="xl:col-span-2 page-card overflow-hidden">
          <table className="data-table">
            <thead><tr>
              <th>Call Type</th>
              <th style={{ textAlign:'right' }}>Calls</th>
              <th style={{ textAlign:'right' }}>Duration</th>
            </tr></thead>
            <tbody>
              {[
                { label:'Incoming', key:'incoming', color:'#22C55E' },
                { label:'Outgoing', key:'outgoing', color:'#F59E0B' },
                { label:'Missed',   key:'missed',   color:'#EF4444' },
                { label:'Rejected', key:'rejected', color:'#7C3AED' },
              ].map(row=>(
                <tr key={row.key}>
                  <td className="font-semibold" style={{ color:row.color }}>{row.label}</td>
                  <td style={{ textAlign:'right', fontWeight:700, color:'#0F172A' }}>{summary[row.key]?.calls||0}</td>
                  <td style={{ textAlign:'right', color:'#475569' }}>{summary[row.key]?.duration||'—'}</td>
                </tr>
              ))}
              <tr style={{ background:'#F8FAFC' }}>
                <td className="font-bold" style={{ color:'#0F172A' }}>Total</td>
                <td style={{ textAlign:'right', fontWeight:700, color:'#0F172A' }}>{summary.total?.calls||0}</td>
                <td style={{ textAlign:'right', color:'#475569' }}>{summary.total?.duration||'—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Sidebar stats + pie */}
        <div className="space-y-4">
          {sidebarStats && (
            <div className="page-card p-4 space-y-2">
              {[
                { label:'Never Attended',        val:sidebarStats.neverAttended },
                { label:'Not Pickup by Client',  val:sidebarStats.notPickupByClient },
                { label:'Connected Calls',       val:sidebarStats.connectedCalls },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between items-center py-1.5" style={{ borderBottom:'1px solid #F1F5F9' }}>
                  <span className="text-xs" style={{ color:'#94A3B8' }}>{label}</span>
                  <span className="font-bold text-sm" style={{ color:'#0F172A' }}>{val??'—'}</span>
                </div>
              ))}
            </div>
          )}
          {pieData?.length > 0 && (
            <div className="page-card p-4">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {pieData.map((entry,i)=><Cell key={i} fill={entry.color}/>)}
                  </Pie>
                  <Tooltip contentStyle={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, fontSize:12 }}/>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11 }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {employeeSummary?.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3" style={{ color:'#0F172A' }}>Employee Summary</h3>
          <div className="page-card overflow-x-auto">
            <table className="data-table" style={{ minWidth:800 }}>
              <thead><tr>
                <th>Sr.</th><th>Employee</th>
                <th style={{ textAlign:'right' }}>Total</th>
                <th style={{ textAlign:'right' }}>Duration</th>
                <th style={{ textAlign:'right' }}>Connected</th>
                <th style={{ textAlign:'right', color:'#22C55E' }}>In</th>
                <th style={{ textAlign:'right', color:'#22C55E' }}>In Conn.</th>
                <th style={{ textAlign:'right', color:'#F59E0B' }}>Out</th>
                <th style={{ textAlign:'right', color:'#F59E0B' }}>Out Conn.</th>
                <th style={{ textAlign:'right', color:'#EF4444' }}>Missed</th>
                <th style={{ textAlign:'right', color:'#7C3AED' }}>Rejected</th>
                <th style={{ textAlign:'right' }}>Never Att.</th>
                <th style={{ textAlign:'right' }}>Not Pickup</th>
                <th>Last Sync</th>
              </tr></thead>
              <tbody>
                {employeeSummary.map((e,i)=>(
                  <tr key={e.employeeId}>
                    <td className="text-xs" style={{ color:'#94A3B8' }}>{i+1}</td>
                    <td>
                      <p className="text-xs font-medium" style={{ color:'#0F172A' }}>{e.employeeName}</p>
                      {e.employeePhone&&<p className="text-xs" style={{ color:'#94A3B8' }}>({e.employeePhone})</p>}
                    </td>
                    <td style={{ textAlign:'right', fontWeight:700, color:'#0F172A' }}>{e.totalCalls}</td>
                    <td style={{ textAlign:'right', color:'#475569' }} className="text-xs">{e.totalDuration}</td>
                    <td style={{ textAlign:'right', color:'#475569' }}>{e.connectedCalls||0}</td>
                    <td style={{ textAlign:'right', color:'#22C55E' }}>{e.incomingTotal}</td>
                    <td style={{ textAlign:'right', color:'#22C55E' }}>{e.incomingConnected}</td>
                    <td style={{ textAlign:'right', color:'#F59E0B' }}>{e.outgoingTotal}</td>
                    <td style={{ textAlign:'right', color:'#F59E0B' }}>{e.outgoingConnected}</td>
                    <td style={{ textAlign:'right', color:'#EF4444' }}>{e.missed}</td>
                    <td style={{ textAlign:'right', color:'#7C3AED' }}>{e.rejected}</td>
                    <td style={{ textAlign:'right', color:'#94A3B8' }}>{e.neverAttended}</td>
                    <td style={{ textAlign:'right', color:'#94A3B8' }}>{e.notPickupByClient}</td>
                    <td className="text-xs whitespace-nowrap" style={{ color:'#94A3B8' }}>
                      {e.lastSyncTime?parseUTC(e.lastSyncTime).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientHistoryTab({ data, page, onPage, CallBadge }) {
  const calls = data?.calls||[];
  return (
    <div className="page-card overflow-hidden">
      <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
        <span className="font-semibold text-sm" style={{ color:'#0F172A' }}>Call History ({data?.total||0})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead><tr>
            <th>Sr.</th><th>Employee</th><th>Date</th><th>Time</th><th>Duration</th><th>Call Type</th><th>Notes</th>
          </tr></thead>
          <tbody>
            {calls.map((log,i)=>(
              <tr key={log._id}>
                <td className="text-xs" style={{ color:'#94A3B8' }}>{(page-1)*50+i+1}</td>
                <td className="text-xs font-medium" style={{ color:'#475569' }}>{log.employeeName}</td>
                <td className="text-xs whitespace-nowrap" style={{ color:'#94A3B8' }}>
                  {parseUTC(log.timestamp).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'})}
                </td>
                <td className="text-xs whitespace-nowrap" style={{ color:'#94A3B8' }}>
                  {parseUTC(log.timestamp).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})}
                </td>
                <td className="text-xs font-medium" style={{ color:'#475569' }}>
                  {log.duration?`${Math.floor(log.duration/60)}m ${log.duration%60}s`:'—'}
                </td>
                <td><CallBadge type={log.callType}/></td>
                <td className="text-xs" style={{ color:'#94A3B8' }}>{log.notes||'—'}</td>
              </tr>
            ))}
            {!calls.length&&<tr><td colSpan={7} className="py-10 text-center text-sm" style={{ color:'#94A3B8' }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3">
        <Pagination page={page} pages={data?.pages||1} onPage={onPage}/>
      </div>
    </div>
  );
}
