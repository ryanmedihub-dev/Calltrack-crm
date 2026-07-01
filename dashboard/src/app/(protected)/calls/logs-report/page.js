'use client';
import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { parseUTC } from '../../../../lib/timezone';
import CallTypeBadge from '../../../../components/CallTypeBadge';
import Pagination from '../../../../components/Pagination';
import toast from 'react-hot-toast';

function formatDur(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function fmtDate(ts) {
  return parseUTC(ts).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', timeZone:'Asia/Kolkata' });
}
function fmtTime(ts) {
  return parseUTC(ts).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Kolkata' });
}

function Ico({ size = 14, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const ExportIco  = () => <Ico><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Ico>;
const PrintIco   = () => <Ico><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></Ico>;
const CalIco     = () => <Ico><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Ico>;

const TYPE_COLORS = {
  incoming: { bg:'rgba(22,163,74,0.08)',  color:'#16A34A' },
  outgoing: { bg:'rgba(217,119,6,0.08)',  color:'#D97706' },
  missed:   { bg:'rgba(220,38,38,0.08)',  color:'#DC2626' },
  rejected: { bg:'rgba(124,58,237,0.08)', color:'#7C3AED' },
};

export default function LogsReportPage() {
  const [calls,    setCalls]    = useState([]);
  const [total,    setTotal]    = useState(0);
  const [pages,    setPages]    = useState(1);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [stats,    setStats]    = useState(null);

  const today = todayIST();
  const [startDate, setStartDate] = useState(today);
  const [endDate,   setEndDate]   = useState(today);
  const [callType,  setCallType]  = useState('');

  const fetchData = async (p = page, sd = startDate, ed = endDate, ct = callType) => {
    setLoading(true);
    try {
      const params = { page:p, limit:25, startDate:sd, endDate:ed };
      if (ct) params.callType = ct;
      const [callsRes, statsRes] = await Promise.all([
        api.get('/api/calls', { params }),
        api.get('/api/calls/stats'),
      ]);
      setCalls(callsRes.data.data.calls);
      setTotal(callsRes.data.data.total);
      setPages(callsRes.data.data.pages);
      setStats(statsRes.data.data);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page]);

  const applyFilter = () => { setPage(1); fetchData(1, startDate, endDate, callType); };

  const handleExport = async () => {
    try {
      const params = { startDate, endDate };
      if (callType) params.callType = callType;
      const res = await api.get('/api/calls/export', { params, responseType:'blob' });
      const url = URL.createObjectURL(new Blob([res.data],{type:'text/csv'}));
      const a = document.createElement('a'); a.href = url;
      a.download = `logs_report_${startDate}_${endDate}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Report exported');
    } catch { toast.error('Export failed'); }
  };

  const today_d = stats?.today;
  const summaryStats = [
    { label:'Total in Range',  value:total,                          color:'#2563EB' },
    { label:'Today Total',     value:today_d?.totalCalls??'—',        color:'#0F172A' },
    { label:'Today Connected', value:today_d?.connectedCalls??'—',    color:'#16A34A' },
    { label:'Today Missed',    value:today_d?.missed??'—',            color:'#DC2626' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Logs Report</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Detailed call log report with full metrics · IST timezone</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>window.print()} className="btn-secondary text-xs py-1.5 px-3">
            <PrintIco /> Print
          </button>
          <button onClick={handleExport} className="btn-primary text-xs py-1.5 px-3">
            <ExportIco /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryStats.map((s,i)=>(
          <div key={s.label} className="page-card p-4 animate-fade-in-up" style={{ animationDelay:`${i*0.04}s` }}>
            <p className="text-2xl font-extrabold leading-none tabular-nums" style={{ color:s.color, letterSpacing:'-0.03em' }}>{s.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider mt-1.5" style={{ color:'#94A3B8' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="page-card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5 flex items-center gap-1" style={{ color:'#64748B' }}>
              <CalIco /> From Date
            </label>
            <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
              className="form-input" style={{ width:150 }} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>To Date</label>
            <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
              className="form-input" style={{ width:150 }} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>Call Type</label>
            <select value={callType} onChange={e=>setCallType(e.target.value)} className="form-input" style={{ width:140 }}>
              <option value="">All Types</option>
              <option value="incoming">Incoming</option>
              <option value="outgoing">Outgoing</option>
              <option value="missed">Missed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="flex gap-2 pb-0.5">
            <button onClick={()=>{ setStartDate(today); setEndDate(today); setCallType(''); fetchData(1,today,today,''); }}
              className="btn-secondary text-xs py-1.5 px-3">Reset</button>
            <button onClick={applyFilter} className="btn-primary text-xs py-1.5 px-4">Apply</button>
          </div>
        </div>
      </div>

      {/* Report table */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <div>
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Call Records</h3>
            <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{total.toLocaleString()} records · {startDate} to {endDate}</p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map(i=><div key={i} className="skeleton h-12 rounded-lg"/>)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table" style={{ minWidth:900 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date (IST)</th>
                  <th>Time (IST)</th>
                  <th>Agent</th>
                  <th>Contact</th>
                  <th>Number</th>
                  <th>Type</th>
                  <th>Duration</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((log, idx) => (
                  <tr key={log._id}>
                    <td style={{ color:'#CBD5E1' }}>{(page-1)*25+idx+1}</td>
                    <td>
                      <span className="text-xs font-medium" style={{ color:'#475569' }}>{fmtDate(log.timestamp)}</span>
                    </td>
                    <td>
                      <span className="text-xs" style={{ color:'#94A3B8' }}>{fmtTime(log.timestamp)}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ background:'#2563EB' }}>
                          {(log.employeeName||'?')[0].toUpperCase()}
                        </div>
                        <span className="text-xs font-medium" style={{ color:'#0F172A' }}>{log.employeeName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-xs font-medium" style={{ color:'#0F172A' }}>
                        {log.contactName && log.contactName !== 'Unknown' ? log.contactName : '—'}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-mono" style={{ color:'#475569' }}>{log.contactNumber}</span>
                    </td>
                    <td>
                      <span className="badge text-[10px] capitalize"
                        style={{
                          background: TYPE_COLORS[log.callType]?.bg || '#F1F5F9',
                          color:      TYPE_COLORS[log.callType]?.color || '#64748B',
                        }}>
                        {log.callType}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-medium" style={{ color: log.duration ? '#0F172A' : '#CBD5E1' }}>
                        {formatDur(log.duration)}
                      </span>
                    </td>
                    <td className="max-w-[160px]">
                      <p className="text-xs truncate" style={{ color:log.notes?'#374151':'#CBD5E1' }}>{log.notes||'—'}</p>
                    </td>
                  </tr>
                ))}
                {calls.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-14 text-center text-sm" style={{ color:'#94A3B8' }}>
                      No records found for this date range
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} pages={pages} onPage={setPage} />
    </div>
  );
}
