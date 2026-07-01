'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../../../lib/api';
import Pagination from '../../../components/Pagination';
import CallTypeBadge from '../../../components/CallTypeBadge';
import { parseUTC } from '../../../lib/timezone';

const TABS = [
  { key: 'summary',           label: 'Summary'         },
  { key: 'analysis',          label: 'Analysis'        },
  { key: 'daywise',           label: 'Day-wise'        },
  { key: 'hourly',            label: 'Hourly'          },
  { key: 'neverAttended',     label: 'Never Attended'  },
  { key: 'notPickupByClient', label: 'Not Picked Up'   },
  { key: 'uniqueClients',     label: 'Unique Clients'  },
  { key: 'callHistory',       label: 'Call History'    },
];

function fmtDate(d) {
  if (!d) return '—';
  return parseUTC(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function fmtTime(d) {
  return parseUTC(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff', boxShadow:'0 8px 24px rgba(0,0,0,0.25)' }}>
      <p style={{ color:'#94A3B8' }}>{label}</p>
      {payload.map((p,i)=><p key={i} className="font-bold">{p.name}: {p.value}</p>)}
    </div>
  );
};

function TH({ children, right }) {
  return <th className="text-left px-4 py-2.5 text-[10px] font-700 uppercase tracking-[0.08em] whitespace-nowrap"
    style={{ color:'#64748B', background:'#F8FAFC', borderBottom:'1px solid #E2E8F0', fontWeight:700, textAlign:right?'right':'left' }}>
    {children}
  </th>;
}
function TD({ children, right, bold, color = '#374151' }) {
  return <td style={{ padding:'10px 16px', fontSize:12, fontWeight:bold?700:400, color, textAlign:right?'right':'left', whiteSpace:'nowrap', borderBottom:'1px solid #F1F5F9' }}>
    {children}
  </td>;
}
function TR({ children }) {
  return <tr style={{ transition:'background 0.1s' }}
    onMouseEnter={e=>e.currentTarget.style.background='#F8FAFC'}
    onMouseLeave={e=>e.currentTarget.style.background=''}>{children}</tr>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-40 gap-2" style={{ color:'#94A3B8' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <span className="text-sm">Loading…</span>
    </div>
  );
}

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [filters,   setFilters]   = useState({ startDate: today, endDate: today, employeeId: '', callType: '' });
  const [activeTab, setActiveTab] = useState('summary');
  const [employees, setEmployees] = useState([]);
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [page,      setPage]      = useState(1);
  const [applied,   setApplied]   = useState(false);

  useEffect(() => { api.get('/api/employees').then(r=>setEmployees(r.data.data)).catch(()=>{}); }, []);

  const fetchReport = async (tab = activeTab, p = 1) => {
    setLoading(true);
    try {
      const params = { ...Object.fromEntries(Object.entries(filters).filter(([,v])=>v)), tab, page: p, limit: 100 };
      const res = await api.get('/api/reports/periodic', { params });
      setData(res.data.data);
    } catch {}
    finally { setLoading(false); }
  };

  const handleApply = () => { setPage(1); setApplied(true); fetchReport(activeTab, 1); };
  const handleReset = () => { setFilters({ startDate: today, endDate: today, employeeId: '', callType: '' }); setPage(1); setData(null); setApplied(false); };
  const handleTab   = (tab) => { setActiveTab(tab); setPage(1); if (applied) fetchReport(tab, 1); };
  const handlePage  = (p)   => { setPage(p); fetchReport(activeTab, p); };

  const dateLabel = filters.startDate === filters.endDate
    ? fmtDate(filters.startDate)
    : `${fmtDate(filters.startDate)} – ${fmtDate(filters.endDate)}`;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div>
        <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Periodic Reports</h2>
        <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Generate detailed call activity reports by date range and filters</p>
      </div>

      {/* Filter bar — Callyzer-style clean row */}
      <div className="page-card p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>From Date</label>
            <input type="date" value={filters.startDate} onChange={e=>setFilters({...filters,startDate:e.target.value})}
              className="form-input" style={{ width:150 }} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>To Date</label>
            <input type="date" value={filters.endDate} onChange={e=>setFilters({...filters,endDate:e.target.value})}
              className="form-input" style={{ width:150 }} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>Employee</label>
            <select value={filters.employeeId} onChange={e=>setFilters({...filters,employeeId:e.target.value})}
              className="form-input" style={{ width:180 }}>
              <option value="">All Employees</option>
              {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>Call Type</label>
            <select value={filters.callType} onChange={e=>setFilters({...filters,callType:e.target.value})}
              className="form-input" style={{ width:150 }}>
              <option value="">All Types</option>
              {['incoming','outgoing','missed','rejected'].map(v=>(
                <option key={v} value={v}>{v[0].toUpperCase()+v.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <button onClick={handleApply} className="btn-primary">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Generate
            </button>
            <button onClick={handleReset} className="btn-secondary">Reset</button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!applied && !loading && (
        <div className="page-card flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background:'#EFF6FF' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm" style={{ color:'#0F172A' }}>No report generated yet</p>
            <p className="text-xs mt-1" style={{ color:'#94A3B8' }}>Select your filters above and click Generate to view data</p>
          </div>
        </div>
      )}

      {applied && (
        <>
          {/* Date badge + tabs */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background:'rgba(37,99,235,0.08)', color:'#2563EB', border:'1px solid rgba(37,99,235,0.20)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {dateLabel}
              </span>
              {filters.employeeId && (
                <span className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background:'rgba(124,58,237,0.08)', color:'#7C3AED', border:'1px solid rgba(124,58,237,0.20)' }}>
                  {employees.find(e=>e._id===filters.employeeId)?.name}
                </span>
              )}
              {filters.callType && (
                <span className="text-[11px] font-semibold px-3 py-1 rounded-full capitalize" style={{ background:'rgba(22,163,74,0.08)', color:'#16A34A', border:'1px solid rgba(22,163,74,0.20)' }}>
                  {filters.callType}
                </span>
              )}
            </div>

            {/* Tabs */}
            <div className="tab-nav overflow-x-auto">
              {TABS.map(t => (
                <button key={t.key} onClick={()=>handleTab(t.key)}
                  className={`tab-item${activeTab===t.key?' active':''}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {loading && <Spinner />}

          {!loading && data && activeTab==='summary'           && <SummaryTab data={data} />}
          {!loading && data && activeTab==='analysis'          && <AnalysisTab data={data} />}
          {!loading && data && activeTab==='daywise'           && <DaywiseTab data={data} />}
          {!loading && data && activeTab==='hourly'            && <HourlyTab data={data} />}
          {!loading && data && activeTab==='neverAttended'     && <NeverAttendedTab data={data} page={page} onPage={handlePage} />}
          {!loading && data && activeTab==='notPickupByClient' && <NotPickupTab data={data} page={page} onPage={handlePage} />}
          {!loading && data && activeTab==='uniqueClients'     && <UniqueClientsTab data={data} page={page} onPage={handlePage} />}
          {!loading && data && activeTab==='callHistory'       && <CallHistoryTab data={data} page={page} onPage={handlePage} />}
        </>
      )}
    </div>
  );
}

/* ── Summary ─────────────────────────────────── */
function SummaryTab({ data }) {
  const { summary, sidebarStats, pieData, employeeSummary } = data;
  if (!summary) return null;
  const typeRows = [
    { label:'Incoming', key:'incoming', color:'#16A34A' },
    { label:'Outgoing', key:'outgoing', color:'#D97706' },
    { label:'Missed',   key:'missed',   color:'#DC2626' },
    { label:'Rejected', key:'rejected', color:'#7C3AED' },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Summary table */}
        <div className="xl:col-span-2 page-card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0', background:'#F8FAFC' }}>
            <p className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color:'#64748B' }}>Call Type Breakdown</p>
          </div>
          <table className="w-full">
            <thead>
              <tr><TH>Call Type</TH><TH right>Calls</TH><TH right>Duration</TH></tr>
            </thead>
            <tbody>
              {typeRows.map(r=>(
                <TR key={r.key}>
                  <TD><span className="font-semibold" style={{ color:r.color }}>{r.label}</span></TD>
                  <TD right bold color="#0F172A">{summary[r.key]?.calls||0}</TD>
                  <TD right>{summary[r.key]?.duration||'—'}</TD>
                </TR>
              ))}
              <tr style={{ background:'#F8FAFC' }}>
                <td style={{ padding:'11px 16px', fontSize:13, fontWeight:700, color:'#0F172A', borderTop:'2px solid #E2E8F0' }}>Total</td>
                <td style={{ padding:'11px 16px', fontSize:14, fontWeight:800, color:'#2563EB', textAlign:'right', borderTop:'2px solid #E2E8F0' }}>{summary.total?.calls||0}</td>
                <td style={{ padding:'11px 16px', fontSize:12, color:'#64748B', textAlign:'right', borderTop:'2px solid #E2E8F0' }}>{summary.total?.duration||'—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Key metrics */}
        <div className="page-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-4" style={{ color:'#94A3B8' }}>Key Metrics</p>
          {sidebarStats && Object.entries({
            'Never Attended':       sidebarStats.neverAttended,
            'Not Pickup by Client': sidebarStats.notPickupByClient,
            'Connected Calls':      sidebarStats.connectedCalls,
            'Unique Connected':     sidebarStats.uniqueConnectedCalls,
            'Unique Clients':       sidebarStats.uniqueClients,
            'Working Hours':        sidebarStats.workingHours,
          }).map(([label,val])=>(
            <div key={label} className="flex justify-between items-center py-2.5" style={{ borderBottom:'1px solid #F1F5F9' }}>
              <span className="text-xs" style={{ color:'#64748B' }}>{label}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color:'#0F172A' }}>{val??'—'}</span>
            </div>
          ))}
        </div>
      </div>

      {pieData?.length > 0 && (
        <div className="page-card p-5 max-w-xs">
          <p className="text-sm font-bold mb-1" style={{ color:'#0F172A' }}>Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value" strokeWidth={0}>
                {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
              </Pie>
              <Tooltip content={<ChartTip />} />
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

/* ── Analysis ────────────────────────────────── */
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
  const cols = ['#','Employee','Total','Duration','Connected','In','In Conn.','Out','Out Conn.','Missed','Rejected','Never Att.','Not Pickup','Last Sync'];
  return (
    <div className="page-card overflow-auto">
      <table className="w-full" style={{ minWidth:900 }}>
        <thead><tr>{cols.map((h,i)=><TH key={h} right={i>1}>{h}</TH>)}</tr></thead>
        <tbody>
          {rows.map((e,i)=>(
            <TR key={e.employeeId}>
              <TD color="#CBD5E1">{i+1}</TD>
              <TD>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                    style={{ background:'#2563EB' }}>
                    {(e.employeeName||'?')[0].toUpperCase()}
                  </div>
                  <span className="text-xs font-medium" style={{ color:'#0F172A' }}>{e.employeeName}</span>
                </div>
              </TD>
              <TD right bold color="#0F172A">{e.totalCalls}</TD>
              <TD right>{e.totalDuration}</TD>
              <TD right>{e.connectedCalls||0}</TD>
              <TD right color="#16A34A">{e.incoming}</TD>
              <TD right color="#16A34A">{e.incomingConnected||0}</TD>
              <TD right color="#D97706">{e.outgoing}</TD>
              <TD right color="#D97706">{e.outgoingConnected||0}</TD>
              <TD right color="#DC2626">{e.missed}</TD>
              <TD right color="#7C3AED">{e.rejected}</TD>
              <TD right>{e.neverAttended}</TD>
              <TD right>{e.notPickupByClient}</TD>
              <TD color="#94A3B8">{e.lastSyncTime?parseUTC(e.lastSyncTime).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'—'}</TD>
            </TR>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Day-wise ────────────────────────────────── */
function DaywiseTab({ data }) {
  if (!data?.daywise) return null;
  return (
    <div className="space-y-4">
      <div className="page-card p-5">
        <p className="text-sm font-bold mb-4" style={{ color:'#0F172A' }}>Daily Call Volume</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.daywise}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
            <XAxis dataKey="date" tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} width={24}/>
            <Tooltip content={<ChartTip />}/>
            <Bar dataKey="incoming" fill="#22C55E" radius={[3,3,0,0]} name="Incoming"/>
            <Bar dataKey="outgoing" fill="#F59E0B" radius={[3,3,0,0]} name="Outgoing"/>
            <Bar dataKey="missed"   fill="#EF4444" radius={[3,3,0,0]} name="Missed"/>
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize:11, color:'#475569' }}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="page-card overflow-auto">
        <table className="w-full">
          <thead><tr>
            {['Date','Total','Incoming','Outgoing','Missed','Rejected','Duration'].map((h,i)=><TH key={h} right={i>0}>{h}</TH>)}
          </tr></thead>
          <tbody>
            {data.daywise.map(row=>(
              <TR key={row.date}>
                <TD bold color="#0F172A">{row.date}</TD>
                <TD right bold color="#2563EB">{row.totalCalls}</TD>
                <TD right color="#16A34A">{row.incoming}</TD>
                <TD right color="#D97706">{row.outgoing}</TD>
                <TD right color="#DC2626">{row.missed}</TD>
                <TD right color="#7C3AED">{row.rejected}</TD>
                <TD right>{row.duration}</TD>
              </TR>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Hourly ──────────────────────────────────── */
function HourlyTab({ data }) {
  if (!data?.hourly) return null;
  return (
    <div className="page-card p-5">
      <p className="text-sm font-bold mb-4" style={{ color:'#0F172A' }}>Hourly Call Distribution</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data.hourly} barCategoryGap="40%">
          <defs>
            <linearGradient id="hbar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#2563EB" stopOpacity={0.9}/>
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.35}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
          <XAxis dataKey="label" tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false}/>
          <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} width={24}/>
          <Tooltip content={<ChartTip />}/>
          <Bar dataKey="totalCalls" fill="url(#hbar)" radius={[4,4,0,0]} name="Total Calls"/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Never Attended ──────────────────────────── */
function NeverAttendedTab({ data, page, onPage }) {
  const records = data?.records || [];
  return (
    <div className="page-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
        <p className="font-bold text-sm" style={{ color:'#0F172A' }}>Never Attended</p>
        <span className="badge" style={{ background:'rgba(220,38,38,0.08)', color:'#DC2626', border:'1px solid rgba(220,38,38,0.20)' }}>{data?.total||0} records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            {['#','Contact Number','Contact Name','Missed Count','Last Missed','Employees'].map(h=><TH key={h}>{h}</TH>)}
          </tr></thead>
          <tbody>
            {records.map((r,i)=>(
              <TR key={r.contactNumber}>
                <TD color="#CBD5E1">{(page-1)*100+i+1}</TD>
                <TD><span className="font-medium" style={{ color:'#2563EB' }}>{r.contactNumber}</span></TD>
                <TD>{r.contactName||'—'}</TD>
                <TD>
                  <span className="badge" style={{ background:'rgba(220,38,38,0.08)', color:'#DC2626' }}>{r.missedCount}</span>
                </TD>
                <TD color="#94A3B8">{r.lastMissedAt?`${fmtDate(r.lastMissedAt)} ${fmtTime(r.lastMissedAt)}`:'—'}</TD>
                <TD color="#64748B">{(r.employees||[]).join(', ')||'—'}</TD>
              </TR>
            ))}
            {!records.length&&<tr><td colSpan={6} className="px-5 py-10 text-center text-sm" style={{ color:'#94A3B8' }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3"><Pagination page={page} pages={data?.pages||1} onPage={onPage}/></div>
    </div>
  );
}

/* ── Not Picked Up ───────────────────────────── */
function NotPickupTab({ data, page, onPage }) {
  const records = data?.records || [];
  return (
    <div className="page-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
        <p className="font-bold text-sm" style={{ color:'#0F172A' }}>Not Picked Up by Client</p>
        <span className="badge" style={{ background:'rgba(217,119,6,0.08)', color:'#D97706', border:'1px solid rgba(217,119,6,0.20)' }}>{data?.total||0} records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            {['#','Employee','Contact Number','Contact Name','Date','Time'].map(h=><TH key={h}>{h}</TH>)}
          </tr></thead>
          <tbody>
            {records.map((r,i)=>(
              <TR key={r._id}>
                <TD color="#CBD5E1">{(page-1)*100+i+1}</TD>
                <TD>{r.employeeName}</TD>
                <TD><span className="font-medium" style={{ color:'#2563EB' }}>{r.contactNumber}</span></TD>
                <TD>{r.contactName||'—'}</TD>
                <TD color="#94A3B8">{fmtDate(r.timestamp)}</TD>
                <TD color="#94A3B8">{fmtTime(r.timestamp)}</TD>
              </TR>
            ))}
            {!records.length&&<tr><td colSpan={6} className="px-5 py-10 text-center text-sm" style={{ color:'#94A3B8' }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3"><Pagination page={page} pages={data?.pages||1} onPage={onPage}/></div>
    </div>
  );
}

/* ── Unique Clients ──────────────────────────── */
function UniqueClientsTab({ data, page, onPage }) {
  const records = data?.records || [];
  return (
    <div className="page-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
        <p className="font-bold text-sm" style={{ color:'#0F172A' }}>Unique Clients</p>
        <span className="badge" style={{ background:'#EFF6FF', color:'#2563EB', border:'1px solid #BFDBFE' }}>{data?.total||0}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            {['#','Contact','Total','Connected','Incoming','Outgoing','Missed','Duration','Last Call','Employees'].map((h,i)=>(
              <TH key={h} right={i>1}>{h}</TH>
            ))}
          </tr></thead>
          <tbody>
            {records.map((r,i)=>(
              <TR key={r.contactNumber}>
                <TD color="#CBD5E1">{(page-1)*100+i+1}</TD>
                <TD>
                  <p className="font-medium" style={{ color:'#2563EB' }}>{r.contactNumber}</p>
                  <p className="text-[11px]" style={{ color:'#94A3B8' }}>{r.contactName||''}</p>
                </TD>
                <TD right bold color="#0F172A">{r.totalCalls}</TD>
                <TD right color="#16A34A">{r.connectedCalls}</TD>
                <TD right color="#16A34A">{r.incoming}</TD>
                <TD right color="#D97706">{r.outgoing}</TD>
                <TD right color="#DC2626">{r.missed}</TD>
                <TD right>{r.totalDuration}</TD>
                <TD color="#94A3B8">{r.lastCallAt?fmtDate(r.lastCallAt):'—'}</TD>
                <TD color="#64748B">{(r.employees||[]).slice(0,2).join(', ')}</TD>
              </TR>
            ))}
            {!records.length&&<tr><td colSpan={10} className="px-5 py-10 text-center text-sm" style={{ color:'#94A3B8' }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3"><Pagination page={page} pages={data?.pages||1} onPage={onPage}/></div>
    </div>
  );
}

/* ── Call History ────────────────────────────── */
function CallHistoryTab({ data, page, onPage }) {
  const calls = data?.calls || [];
  return (
    <div className="page-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
        <p className="font-bold text-sm" style={{ color:'#0F172A' }}>Call History</p>
        <span className="text-xs" style={{ color:'#94A3B8' }}>{calls.length} of {data?.total||0}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            {['#','Employee','Contact','Date','Time','Duration','Type','Notes'].map(h=><TH key={h}>{h}</TH>)}
          </tr></thead>
          <tbody>
            {calls.map((log,i)=>(
              <TR key={log._id}>
                <TD color="#CBD5E1">{(page-1)*100+i+1}</TD>
                <TD>
                  <p className="font-medium" style={{ color:'#0F172A' }}>{log.employeeName}</p>
                  {log.employeePhone&&<p className="text-[11px]" style={{ color:'#94A3B8' }}>{log.employeePhone}</p>}
                </TD>
                <TD><span style={{ color:'#2563EB' }}>{log.contactNumber}</span></TD>
                <TD color="#94A3B8">{fmtDate(log.timestamp)}</TD>
                <TD color="#94A3B8">{fmtTime(log.timestamp)}</TD>
                <TD bold>{log.duration?`${Math.floor(log.duration/60)}m ${log.duration%60}s`:'—'}</TD>
                <TD><CallTypeBadge type={log.callType}/></TD>
                <TD color="#94A3B8">{log.notes||'—'}</TD>
              </TR>
            ))}
            {!calls.length&&<tr><td colSpan={8} className="px-5 py-10 text-center text-sm" style={{ color:'#94A3B8' }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs" style={{ color:'#94A3B8' }}>Showing {calls.length} of {data?.total||0}</span>
        <Pagination page={page} pages={data?.pages||1} onPage={onPage}/>
      </div>
    </div>
  );
}
