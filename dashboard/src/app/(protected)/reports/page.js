'use client';
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../../../lib/api';
import Pagination from '../../../components/Pagination';
import CallTypeBadge from '../../../components/CallTypeBadge';

const TABS = [
  { key: 'summary',          label: 'Summary' },
  { key: 'analysis',         label: 'Analysis' },
  { key: 'daywise',          label: 'Day-wise' },
  { key: 'hourly',           label: 'Hourly' },
  { key: 'neverAttended',    label: 'Never Attended' },
  { key: 'notPickupByClient',label: 'Not Picked Up' },
  { key: 'uniqueClients',    label: 'Unique Clients' },
  { key: 'callHistory',      label: 'Call History' },
];

const inputStyle = { background: '#F8FAFF', border: '1px solid #E2E8F4', color: '#0F172A', outline: 'none', fontSize: '13px', borderRadius: '10px', padding: '8px 12px' };

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const tableCardStyle = { background: '#fff', border: '1px solid #E2E8F4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderRadius: '1rem', overflow: 'hidden' };
const theadStyle    = { borderBottom: '1px solid #F1F5F9', background: '#F8FAFF' };
const thStyle       = { padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8', textAlign: 'left', whiteSpace: 'nowrap' };

function TBody({ children }) {
  return <tbody>{children}</tbody>;
}
function Tr({ children }) {
  return (
    <tr className="table-row-hover transition-colors" style={{ borderBottom: '1px solid #F8FAFF' }}>
      {children}
    </tr>
  );
}
function Td({ children, right, bold, color }) {
  return (
    <td style={{
      padding: '10px 16px', fontSize: '12px',
      fontWeight: bold ? '700' : '400',
      color: color || '#475569',
      textAlign: right ? 'right' : 'left',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </td>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs"
      style={{ background: '#0C0A1E', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
      <p style={{ color: '#8D8BAC' }}>{label}</p>
      {payload.map((p,i) => <p key={i} className="font-bold">{p.name}: {p.value}</p>)}
    </div>
  );
};

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [filters,   setFilters]   = useState({ startDate: today, endDate: today, employeeId: '', callType: '' });
  const [activeTab, setActiveTab] = useState('summary');
  const [employees, setEmployees] = useState([]);
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [page,      setPage]      = useState(1);

  useEffect(() => { api.get('/api/employees').then(r=>setEmployees(r.data.data)).catch(()=>{}); }, []);

  const fetchReport = async (tab=activeTab, p=1) => {
    setLoading(true);
    try {
      const params = { ...Object.fromEntries(Object.entries(filters).filter(([,v])=>v)), tab, page: p, limit: 100 };
      const res = await api.get('/api/reports/periodic', { params });
      setData(res.data.data);
    } catch {}
    finally { setLoading(false); }
  };

  const handleApply = () => { setPage(1); fetchReport(activeTab, 1); };
  const handleReset = () => {
    const f = { startDate: today, endDate: today, employeeId: '', callType: '' };
    setFilters(f); setPage(1); setData(null);
  };
  const handleTabChange = (tab) => { setActiveTab(tab); setPage(1); fetchReport(tab, 1); };
  const handlePageChange = (p) => { setPage(p); fetchReport(activeTab, p); };

  const dateLabel = filters.startDate === filters.endDate
    ? fmtDate(filters.startDate)
    : `${fmtDate(filters.startDate)} – ${fmtDate(filters.endDate)}`;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold leading-none" style={{ color: '#0F172A', letterSpacing: '-0.02em' }}>Periodic Reports</h2>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Generate detailed call activity reports by date range</p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-4 flex flex-wrap gap-3 items-end"
        style={{ background: '#fff', border: '1px solid #E2E8F4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {[{f:'startDate',l:'From Date',t:'date'},{f:'endDate',l:'To Date',t:'date'}].map(({f,l,t})=>(
          <div key={f}>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>{l}</label>
            <input type={t} value={filters[f]} onChange={e=>setFilters({...filters,[f]:e.target.value})}
              className="transition-all input-ring" style={inputStyle} />
          </div>
        ))}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Employee</label>
          <select value={filters.employeeId} onChange={e=>setFilters({...filters,employeeId:e.target.value})}
            className="transition-all input-ring" style={inputStyle}>
            <option value="">All Employees</option>
            {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Call Type</label>
          <select value={filters.callType} onChange={e=>setFilters({...filters,callType:e.target.value})}
            className="transition-all input-ring" style={inputStyle}>
            <option value="">All Types</option>
            {['incoming','outgoing','missed','rejected'].map(v=><option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={handleApply}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow: '0 4px 12px rgba(99,102,241,0.30)' }}>
            Generate Report
          </button>
          <button onClick={handleReset}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ border: '1px solid #E2E8F4', color: '#64748B' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#FECACA';e.currentTarget.style.color='#EF4444';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='#E2E8F4';e.currentTarget.style.color='#64748B';}}>
            Reset
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* Date badge */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.10)', color: '#D97706', border: '1px solid rgba(245,158,11,0.22)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {dateLabel}
            </span>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 overflow-x-auto" style={{ borderBottom: '2px solid #F1F5F9' }}>
            {TABS.map(tab => (
              <button key={tab.key} onClick={()=>handleTabChange(tab.key)}
                className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all relative"
                style={{
                  color: activeTab===tab.key ? '#6366F1' : '#64748B',
                  borderBottom: `2px solid ${activeTab===tab.key ? '#6366F1' : 'transparent'}`,
                  marginBottom: '-2px',
                  background: 'transparent',
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center h-40 gap-3" style={{ color: '#94A3B8' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <span className="text-sm">Loading report…</span>
            </div>
          )}

          {!loading && activeTab==='summary'          && <SummaryTab data={data} />}
          {!loading && activeTab==='analysis'         && <AnalysisTab data={data} />}
          {!loading && activeTab==='daywise'          && <DaywiseTab data={data} />}
          {!loading && activeTab==='hourly'           && <HourlyTab data={data} />}
          {!loading && activeTab==='neverAttended'    && <NeverAttendedTab data={data} page={page} onPage={handlePageChange} />}
          {!loading && activeTab==='notPickupByClient'&& <NotPickupTab data={data} page={page} onPage={handlePageChange} />}
          {!loading && activeTab==='uniqueClients'    && <UniqueClientsTab data={data} page={page} onPage={handlePageChange} />}
          {!loading && activeTab==='callHistory'      && <CallHistoryTab data={data} page={page} onPage={handlePageChange} />}
        </>
      )}

      {!data && !loading && (
        <div className="rounded-2xl flex flex-col items-center justify-center h-64"
          style={{ background: '#fff', border: '1px solid #E2E8F4' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#EEF2FF', color: '#818CF8' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
          <p className="font-semibold" style={{ color: '#0F172A' }}>No report yet</p>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Select filters and click Generate Report</p>
        </div>
      )}
    </div>
  );
}

function SummaryTab({ data }) {
  const { summary, sidebarStats, pieData, employeeSummary } = data;
  if (!summary) return null;
  const typeRows = [
    { label:'Incoming', key:'incoming', color:'#059669' },
    { label:'Outgoing', key:'outgoing', color:'#D97706' },
    { label:'Missed',   key:'missed',   color:'#DC2626' },
    { label:'Rejected', key:'rejected', color:'#7C3AED' },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Summary table */}
        <div className="xl:col-span-2" style={tableCardStyle}>
          <table className="w-full">
            <thead>
              <tr style={theadStyle}>
                <th style={thStyle}>Call Type</th>
                <th style={{ ...thStyle, textAlign:'right' }}>Calls</th>
                <th style={{ ...thStyle, textAlign:'right' }}>Duration</th>
              </tr>
            </thead>
            <TBody>
              {typeRows.map(r=>(
                <Tr key={r.key}>
                  <Td><span className="font-semibold" style={{ color: r.color }}>{r.label}</span></Td>
                  <Td right bold color="#0F172A">{summary[r.key]?.calls||0}</Td>
                  <Td right>{summary[r.key]?.duration||'—'}</Td>
                </Tr>
              ))}
              <tr style={{ background: '#F8FAFF', borderTop: '2px solid #E2E8F4' }}>
                <td style={{ ...Object.fromEntries(Object.entries(thStyle).map(([k,v])=>[k,v])), padding:'10px 16px', textAlign:'left' }}>Total</td>
                <td style={{ padding:'10px 16px', textAlign:'right', fontWeight:'800', fontSize:'14px', color:'#0F172A' }}>{summary.total?.calls||0}</td>
                <td style={{ padding:'10px 16px', textAlign:'right', fontSize:'12px', color:'#475569' }}>{summary.total?.duration||'—'}</td>
              </tr>
            </TBody>
          </table>
        </div>

        {/* Sidebar stats */}
        <div className="rounded-2xl p-4 space-y-0.5"
          style={{ background:'#fff', border:'1px solid #E2E8F4' }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color:'#94A3B8' }}>Key Metrics</p>
          {sidebarStats && Object.entries({
            'Never Attended': sidebarStats.neverAttended,
            'Not Pickup by Client': sidebarStats.notPickupByClient,
            'Connected Calls': sidebarStats.connectedCalls,
            'Unique Connected': sidebarStats.uniqueConnectedCalls,
            'Unique Clients': sidebarStats.uniqueClients,
            'Working Hours': sidebarStats.workingHours,
          }).map(([label,val])=>(
            <div key={label} className="flex justify-between items-center py-2.5 table-row-hover rounded-lg px-2 -mx-2 transition-colors" style={{ borderBottom:'1px solid #F8FAFF' }}>
              <span className="text-xs" style={{ color:'#64748B' }}>{label}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color:'#0F172A' }}>{val??'—'}</span>
            </div>
          ))}
        </div>
      </div>

      {pieData?.length > 0 && (
        <div className="rounded-2xl p-5 max-w-xs" style={{ background:'#fff', border:'1px solid #E2E8F4' }}>
          <h3 className="font-bold text-sm mb-1" style={{ color:'#0F172A' }}>Call Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" strokeWidth={0}>
                {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize:11, color:'#475569' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {employeeSummary?.length > 0 && (
        <div>
          <p className="text-sm font-bold mb-3" style={{ color:'#0F172A' }}>Employee Summary</p>
          <EmployeeSummaryTable rows={employeeSummary} />
        </div>
      )}
    </div>
  );
}

function AnalysisTab({ data }) {
  if (!data?.employeeSummary) return null;
  return (
    <div>
      <p className="text-sm font-bold mb-3" style={{ color:'#0F172A' }}>Employee Analysis</p>
      <EmployeeSummaryTable rows={data.employeeSummary} />
    </div>
  );
}

function EmployeeSummaryTable({ rows }) {
  return (
    <div style={{ ...tableCardStyle, overflowX:'auto' }}>
      <table className="w-full" style={{ minWidth:900 }}>
        <thead>
          <tr style={theadStyle}>
            {['#','Employee','Total','Duration','Connected','In','In Conn.','Out','Out Conn.','Missed','Rejected','Never Att.','Not Pickup','Last Sync'].map((h,i)=>(
              <th key={h} style={{ ...thStyle, textAlign: i>1 ? 'right' : 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <TBody>
          {rows.map((e,i)=>(
            <Tr key={e.employeeId}>
              <Td color="#CBD5E1">{i+1}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                    style={{ background:'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                    {(e.employeeName||'?')[0].toUpperCase()}
                  </div>
                  <span className="text-xs font-medium" style={{ color:'#0F172A' }}>{e.employeeName}</span>
                </div>
              </Td>
              <Td right bold color="#0F172A">{e.totalCalls}</Td>
              <Td right>{e.totalDuration}</Td>
              <Td right>{e.connectedCalls||0}</Td>
              <Td right color="#059669">{e.incoming}</Td>
              <Td right color="#059669">{e.incomingConnected||0}</Td>
              <Td right color="#D97706">{e.outgoing}</Td>
              <Td right color="#D97706">{e.outgoingConnected||0}</Td>
              <Td right color="#DC2626">{e.missed}</Td>
              <Td right color="#7C3AED">{e.rejected}</Td>
              <Td right>{e.neverAttended}</Td>
              <Td right>{e.notPickupByClient}</Td>
              <Td color="#94A3B8">{e.lastSyncTime?new Date(e.lastSyncTime).toLocaleString():'—'}</Td>
            </Tr>
          ))}
        </TBody>
      </table>
    </div>
  );
}

function DaywiseTab({ data }) {
  if (!data?.daywise) return null;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5" style={{ background:'#fff', border:'1px solid #E2E8F4' }}>
        <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Daily Call Volume</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.daywise}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
            <XAxis dataKey="date" tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false}/>
            <Tooltip content={<CustomTooltip />}/>
            <Bar dataKey="incoming" fill="#10B981" radius={[3,3,0,0]} name="Incoming"/>
            <Bar dataKey="outgoing" fill="#F59E0B" radius={[3,3,0,0]} name="Outgoing"/>
            <Bar dataKey="missed"   fill="#EF4444" radius={[3,3,0,0]} name="Missed"/>
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize:11, color:'#475569' }}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ ...tableCardStyle, overflowX:'auto' }}>
        <table className="w-full">
          <thead>
            <tr style={theadStyle}>
              {['Date','Total','Incoming','Outgoing','Missed','Rejected','Duration'].map((h,i)=>(
                <th key={h} style={{ ...thStyle, textAlign:i===0?'left':'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <TBody>
            {data.daywise.map(row=>(
              <Tr key={row.date}>
                <Td bold color="#0F172A">{row.date}</Td>
                <Td right bold color="#0F172A">{row.totalCalls}</Td>
                <Td right color="#059669">{row.incoming}</Td>
                <Td right color="#D97706">{row.outgoing}</Td>
                <Td right color="#DC2626">{row.missed}</Td>
                <Td right color="#7C3AED">{row.rejected}</Td>
                <Td right>{row.duration}</Td>
              </Tr>
            ))}
          </TBody>
        </table>
      </div>
    </div>
  );
}

function HourlyTab({ data }) {
  if (!data?.hourly) return null;
  return (
    <div className="rounded-2xl p-5" style={{ background:'#fff', border:'1px solid #E2E8F4' }}>
      <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Hourly Call Distribution</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data.hourly} barCategoryGap="40%">
          <defs>
            <linearGradient id="hbar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#6366F1" stopOpacity={0.9}/>
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.4}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
          <XAxis dataKey="label" tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false}/>
          <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false}/>
          <Tooltip content={<CustomTooltip />}/>
          <Bar dataKey="totalCalls" fill="url(#hbar)" radius={[5,5,0,0]} name="Total Calls"/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function NeverAttendedTab({ data, page, onPage }) {
  const records = data?.records || [];
  return (
    <div style={tableCardStyle}>
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom:'1px solid #F1F5F9' }}>
        <p className="font-bold text-sm" style={{ color:'#0F172A' }}>Never Attended</p>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background:'rgba(239,68,68,0.10)', color:'#DC2626', border:'1px solid rgba(239,68,68,0.22)' }}>{data?.total||0}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr style={theadStyle}>
            {['#','Contact Number','Contact Name','Missed Count','Last Missed','Employees'].map(h=><th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <TBody>
            {records.map((r,i)=>(
              <Tr key={r.contactNumber}>
                <Td color="#CBD5E1">{(page-1)*100+i+1}</Td>
                <Td color="#6366F1">{r.contactNumber}</Td>
                <Td>{r.contactName||'—'}</Td>
                <Td>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:'rgba(239,68,68,0.10)', color:'#DC2626' }}>{r.missedCount}</span>
                </Td>
                <Td color="#94A3B8">{r.lastMissedAt?new Date(r.lastMissedAt).toLocaleString():'—'}</Td>
                <Td color="#94A3B8">{(r.employees||[]).join(', ')||'—'}</Td>
              </Tr>
            ))}
            {!records.length&&<tr><td colSpan={6} className="px-5 py-10 text-center text-sm" style={{ color:'#94A3B8' }}>No records</td></tr>}
          </TBody>
        </table>
      </div>
      <div className="px-5 py-3"><Pagination page={page} pages={data?.pages||1} onPage={onPage}/></div>
    </div>
  );
}

function NotPickupTab({ data, page, onPage }) {
  const records = data?.records || [];
  return (
    <div style={tableCardStyle}>
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom:'1px solid #F1F5F9' }}>
        <p className="font-bold text-sm" style={{ color:'#0F172A' }}>Not Picked Up by Client</p>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background:'rgba(245,158,11,0.10)', color:'#D97706', border:'1px solid rgba(245,158,11,0.22)' }}>{data?.total||0}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr style={theadStyle}>
            {['#','Employee','Contact Number','Contact Name','Date','Time'].map(h=><th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <TBody>
            {records.map((r,i)=>(
              <Tr key={r._id}>
                <Td color="#CBD5E1">{(page-1)*100+i+1}</Td>
                <Td>{r.employeeName}</Td>
                <Td color="#6366F1">{r.contactNumber}</Td>
                <Td>{r.contactName||'—'}</Td>
                <Td color="#94A3B8">{new Date(r.timestamp).toLocaleDateString('en-GB')}</Td>
                <Td color="#94A3B8">{new Date(r.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Td>
              </Tr>
            ))}
            {!records.length&&<tr><td colSpan={6} className="px-5 py-10 text-center text-sm" style={{ color:'#94A3B8' }}>No records</td></tr>}
          </TBody>
        </table>
      </div>
      <div className="px-5 py-3"><Pagination page={page} pages={data?.pages||1} onPage={onPage}/></div>
    </div>
  );
}

function UniqueClientsTab({ data, page, onPage }) {
  const records = data?.records || [];
  return (
    <div style={tableCardStyle}>
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom:'1px solid #F1F5F9' }}>
        <p className="font-bold text-sm" style={{ color:'#0F172A' }}>Unique Clients</p>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background:'#EEF2FF', color:'#6366F1', border:'1px solid #C7D2FE' }}>{data?.total||0}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr style={theadStyle}>
            {['#','Contact','Total','Connected','Incoming','Outgoing','Missed','Duration','Last Call','Employees'].map((h,i)=>(
              <th key={h} style={{ ...thStyle, textAlign:i<2?'left':'right' }}>{h}</th>
            ))}
          </tr></thead>
          <TBody>
            {records.map((r,i)=>(
              <Tr key={r.contactNumber}>
                <Td color="#CBD5E1">{(page-1)*100+i+1}</Td>
                <Td>
                  <p className="font-medium" style={{ color:'#6366F1' }}>{r.contactNumber}</p>
                  <p style={{ color:'#94A3B8' }}>{r.contactName||''}</p>
                </Td>
                <Td right bold color="#0F172A">{r.totalCalls}</Td>
                <Td right color="#059669">{r.connectedCalls}</Td>
                <Td right color="#059669">{r.incoming}</Td>
                <Td right color="#D97706">{r.outgoing}</Td>
                <Td right color="#DC2626">{r.missed}</Td>
                <Td right>{r.totalDuration}</Td>
                <Td color="#94A3B8">{r.lastCallAt?new Date(r.lastCallAt).toLocaleDateString('en-GB'):'—'}</Td>
                <Td color="#94A3B8">{(r.employees||[]).slice(0,2).join(', ')}</Td>
              </Tr>
            ))}
            {!records.length&&<tr><td colSpan={10} className="px-5 py-10 text-center text-sm" style={{ color:'#94A3B8' }}>No records</td></tr>}
          </TBody>
        </table>
      </div>
      <div className="px-5 py-3"><Pagination page={page} pages={data?.pages||1} onPage={onPage}/></div>
    </div>
  );
}

function CallHistoryTab({ data, page, onPage }) {
  const calls = data?.calls || [];
  return (
    <div style={tableCardStyle}>
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom:'1px solid #F1F5F9' }}>
        <p className="font-bold text-sm" style={{ color:'#0F172A' }}>Call History</p>
        <span className="text-xs" style={{ color:'#94A3B8' }}>{calls.length} of {data?.total||0}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr style={theadStyle}>
            {['#','Employee','Contact','Date','Time','Duration','Type','Notes'].map(h=><th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <TBody>
            {calls.map((log,i)=>(
              <Tr key={log._id}>
                <Td color="#CBD5E1">{(page-1)*100+i+1}</Td>
                <Td>
                  <p className="font-medium" style={{ color:'#0F172A' }}>{log.employeeName}</p>
                  {log.employeePhone&&<p style={{ color:'#94A3B8' }}>{log.employeePhone}</p>}
                </Td>
                <Td color="#6366F1">{log.contactNumber}</Td>
                <Td color="#94A3B8">{new Date(log.timestamp).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</Td>
                <Td color="#94A3B8">{new Date(log.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Td>
                <Td bold>{log.duration?`${Math.floor(log.duration/60)}m ${log.duration%60}s`:'—'}</Td>
                <Td><CallTypeBadge type={log.callType}/></Td>
                <Td color="#94A3B8">{log.notes||'—'}</Td>
              </Tr>
            ))}
            {!calls.length&&<tr><td colSpan={8} className="px-5 py-10 text-center text-sm" style={{ color:'#94A3B8' }}>No records</td></tr>}
          </TBody>
        </table>
      </div>
      <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs" style={{ color:'#94A3B8' }}>1–{calls.length} of {data?.total||0}</span>
        <Pagination page={page} pages={data?.pages||1} onPage={onPage}/>
      </div>
    </div>
  );
}
