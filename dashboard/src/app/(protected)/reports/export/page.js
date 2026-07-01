'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';
import { parseUTC } from '../../../../lib/timezone';

const HISTORY_KEY = 'calltrack_export_history';

function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY))||[]; } catch { return []; } }
function pushHistory(e){ const h=[e,...loadHistory()].slice(0,20); localStorage.setItem(HISTORY_KEY,JSON.stringify(h)); }

function downloadBlob(content, filename) {
  const blob = new Blob([content],{ type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
}

function Ico({ d }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

const EXPORT_CARDS = [
  {
    id:'calls', title:'Call Logs',
    desc:'All call records with duration, type, employee name, and notes.',
    icon:<Ico d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>,
    extra:<><polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="1.75" fill="none"/><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="1.75"/></>,
    color:'#2563EB', bg:'#EFF6FF',
    endpoint:'/api/calls/export', filename:'call_logs',
  },
  {
    id:'leads', title:'Leads',
    desc:'Full lead database including status, contact info, and follow-up dates.',
    icon:<Ico d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>,
    color:'#16A34A', bg:'#F0FDF4',
    endpoint:'/api/leads/export', filename:'leads',
  },
  {
    id:'report_today', title:"Today's Report",
    desc:'Stats summary for today: totals, breakdowns, and top dialers.',
    icon:<Ico d="M22 12h-4l-3 9L9 3l-3 9H2"/>,
    color:'#D97706', bg:'#FFFBEB',
    endpoint:null, filename:'report_today',
    buildLocal: async () => {
      const res = await api.get('/api/calls/stats');
      const d   = res.data.data?.today;
      if (!d) throw new Error('No data');
      return [
        ['Metric','Value'],
        ['Total Calls',d.totalCalls],['Incoming',d.incoming],['Outgoing',d.outgoing],
        ['Missed',d.missed],['Unique Contacts',d.uniqueClients],
        ['Connected Calls',d.connectedCalls],['Total Duration (s)',d.totalDuration],
      ].map(r=>r.join(',')).join('\n');
    },
  },
  {
    id:'report_week', title:'Weekly Report',
    desc:"This week's performance stats across all agents.",
    icon:<Ico d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>,
    color:'#7C3AED', bg:'#F5F3FF',
    endpoint:null, filename:'report_week',
    buildLocal: async () => {
      const res = await api.get('/api/calls/stats');
      const d   = res.data.data?.thisWeek;
      if (!d) throw new Error('No data');
      return [
        ['Metric','Value'],
        ['Total Calls',d.totalCalls],['Incoming',d.incoming],['Outgoing',d.outgoing],
        ['Missed',d.missed],['Unique Contacts',d.uniqueClients],
      ].map(r=>r.join(',')).join('\n');
    },
  },
];

export default function ExportCenterPage() {
  const [loadingMap, setLoadingMap] = useState({});
  const [history,    setHistory]    = useState([]);
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');

  useEffect(() => { setHistory(loadHistory()); }, []);

  const doExport = async (card) => {
    setLoadingMap(p=>({...p,[card.id]:true}));
    try {
      let csv;
      if (card.buildLocal) {
        csv = await card.buildLocal();
      } else {
        const params = {};
        if (dateFrom) params.from = dateFrom;
        if (dateTo)   params.to   = dateTo;
        const res = await api.get(card.endpoint, { params, responseType:'text' });
        csv = res.data;
      }
      const fname = `${card.filename}_${new Date().toISOString().slice(0,10)}.csv`;
      downloadBlob(csv, fname);
      const entry = { id:card.id, title:card.title, filename:fname, exportedAt:new Date().toISOString(), dateFrom:dateFrom||'—', dateTo:dateTo||'—' };
      pushHistory(entry); setHistory(loadHistory());
      toast.success(`${card.title} exported`);
    } catch (err) {
      toast.error(err.response?.data?.error||'Export failed');
    } finally {
      setLoadingMap(p=>({...p,[card.id]:false}));
    }
  };

  const clearHistory = () => { localStorage.removeItem(HISTORY_KEY); setHistory([]); toast.success('History cleared'); };

  return (
    <div className="space-y-5 max-w-4xl animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Export Center</h2>
        <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Download call logs, leads, and reports as CSV</p>
      </div>

      {/* Date filter */}
      <div className="page-card p-5">
        <h3 className="text-sm font-semibold mb-3" style={{ color:'#0F172A' }}>Date Range Filter</h3>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium" style={{ color:'#64748B' }}>From</label>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="form-input"/>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium" style={{ color:'#64748B' }}>To</label>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="form-input"/>
          </div>
          <button onClick={()=>{ setDateFrom(''); setDateTo(''); }} className="btn-secondary">Clear</button>
          <p className="text-xs ml-auto" style={{ color:'#94A3B8' }}>Leave blank to export all records</p>
        </div>
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger">
        {EXPORT_CARDS.map(card=>(
          <div key={card.id} className="page-card p-5 flex flex-col gap-4"
            onMouseEnter={e=>e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.10)'}
            onMouseLeave={e=>e.currentTarget.style.boxShadow=''}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background:card.bg, color:card.color }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  {card.icon}{card.extra}
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold" style={{ color:'#0F172A' }}>{card.title}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color:'#94A3B8' }}>{card.desc}</p>
              </div>
            </div>
            <button onClick={()=>doExport(card)} disabled={loadingMap[card.id]}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background:card.bg, color:card.color, border:`1.5px solid ${card.color}40`, opacity:loadingMap[card.id]?0.7:1 }}>
              {loadingMap[card.id] ? (
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              )}
              {loadingMap[card.id]?'Exporting…':'Export CSV'}
            </button>
          </div>
        ))}
      </div>

      {/* History */}
      <div className="page-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Export History</h3>
          {history.length > 0 && (
            <button onClick={clearHistory}
              className="text-xs transition-colors"
              style={{ color:'#94A3B8' }}
              onMouseEnter={e=>e.currentTarget.style.color='#EF4444'}
              onMouseLeave={e=>e.currentTarget.style.color='#94A3B8'}>
              Clear
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <div className="flex items-center justify-center h-28 text-sm" style={{ color:'#94A3B8' }}>
            No exports yet — your history will appear here
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr>
                <th>Type</th><th>Filename</th><th>Date Range</th><th>Exported At</th>
              </tr></thead>
              <tbody>
                {history.map((h,i)=>(
                  <tr key={i}>
                    <td className="font-medium" style={{ color:'#0F172A' }}>{h.title}</td>
                    <td className="font-mono text-xs" style={{ color:'#475569' }}>{h.filename}</td>
                    <td className="text-xs" style={{ color:'#94A3B8' }}>{h.dateFrom} → {h.dateTo}</td>
                    <td className="text-xs" style={{ color:'#94A3B8' }}>
                      {parseUTC(h.exportedAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
