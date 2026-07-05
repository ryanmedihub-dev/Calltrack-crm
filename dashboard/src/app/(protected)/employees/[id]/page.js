'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '../../../../lib/api';
import { fmtDate, fmtTime } from '../../../../lib/timezone';
import { DataTable } from '../../../../components/report-shared';

function formatDuration(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec/60), s = sec%60;
  return m>0?`${m}m ${s}s`:`${s}s`;
}

const TYPE_CHIPS = ['', 'incoming', 'outgoing', 'missed', 'rejected'];
const CHIP_LABELS = { '':'All', incoming:'Incoming', outgoing:'Outgoing', missed:'Missed', rejected:'Rejected' };

const TYPE_COLORS = {
  incoming: { bg:'rgba(22,163,74,0.08)', color:'#16A34A', border:'rgba(22,163,74,0.22)' },
  outgoing: { bg:'rgba(217,119,6,0.08)', color:'#D97706', border:'rgba(217,119,6,0.22)' },
  missed:   { bg:'rgba(220,38,38,0.08)', color:'#DC2626', border:'rgba(220,38,38,0.22)' },
  rejected: { bg:'rgba(124,58,237,0.08)', color:'#7C3AED', border:'rgba(124,58,237,0.22)' },
};

function CallBadge({ type }) {
  const c = TYPE_COLORS[type]||{ bg:'#F1F5F9', color:'#64748B', border:'#E2E8F0' };
  return (
    <span className="badge text-[11px] capitalize"
      style={{ background:c.bg, color:c.color, border:`1px solid ${c.border}` }}>
      {type||'—'}
    </span>
  );
}

const AVATAR_COLORS = ['#2563EB','#16A34A','#D97706','#DC2626','#0D9488','#7C3AED'];

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);
  const [data,     setData]     = useState(null);
  const [page,     setPage]     = useState(1);
  const [filters,  setFilters]  = useState({ callType:'', startDate:'', endDate:'' });
  const [avatarColor] = useState(() => AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)]);

  const fetchData = async (p=page) => {
    try {
      const params = { page:p, limit:20, ...Object.fromEntries(Object.entries(filters).filter(([,v])=>v)) };
      const [empRes, callRes] = await Promise.all([
        api.get(`/api/employees/${id}`),
        api.get(`/api/calls/employee/${id}`, { params }),
      ]);
      setEmployee(empRes.data.data);
      setData(callRes.data.data);
    } catch {}
  };

  useEffect(() => { fetchData(); }, [page, id]);

  const applyFilter = (patch) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(1);
    setTimeout(() => fetchData(1), 0);
  };

  const activeChip = { background:'#2563EB', color:'#fff', border:'1px solid #2563EB' };
  const idleChip   = { background:'#F1F5F9', color:'#64748B', border:'1px solid #E2E8F0' };

  const columns = [
    {
      key: 'contactName',
      label: 'Contact',
      render: (log) => (
        <div>
          <p className="text-sm font-medium" style={{ color:'#0F172A' }}>{log.contactName||'—'}</p>
          <p className="text-xs" style={{ color:'#94A3B8' }}>{log.contactNumber}</p>
        </div>
      ),
    },
    { key: 'callType', label: 'Type', render: (log) => <CallBadge type={log.callType}/> },
    { key: 'duration', label: 'Duration', render: (log) => <span className="font-medium text-sm" style={{ color:'#475569' }}>{formatDuration(log.duration)}</span> },
    {
      key: 'timestamp',
      label: 'Date & Time',
      render: (log) => (
        <div>
          <p className="text-xs" style={{ color:'#475569' }}>{fmtDate(log.timestamp)}</p>
          <p className="text-xs" style={{ color:'#94A3B8' }}>{fmtTime(log.timestamp)}</p>
        </div>
      ),
    },
    {
      key: 'leadStatus',
      label: 'Status',
      render: (log) => log.leadStatus
        ? <span className="badge text-[11px]" style={{ background:'#EFF6FF', color:'#2563EB', border:'1px solid #BFDBFE' }}>{log.leadStatus}</span>
        : <span className="text-xs" style={{ color:'#94A3B8' }}>—</span>,
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <a href="/employees" className="transition-colors" style={{ color:'#94A3B8' }}
          onMouseEnter={e=>e.currentTarget.style.color='#2563EB'}
          onMouseLeave={e=>e.currentTarget.style.color='#94A3B8'}>← Employees</a>
        <span style={{ color:'#E2E8F0' }}>/</span>
        <span className="font-medium" style={{ color:'#0F172A' }}>{employee?.name||'Loading…'}</span>
      </div>

      {/* Profile card */}
      {employee && (
        <div className="page-card p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
            style={{ background:avatarColor }}>
            {employee.name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold" style={{ color:'#0F172A' }}>{employee.name}</p>
            <p className="text-sm" style={{ color:'#94A3B8' }}>{employee.email}</p>
            {employee.phone && <p className="text-sm" style={{ color:'#94A3B8' }}>{employee.phone}</p>}
          </div>
          <span className="badge"
            style={employee.isActive
              ? { background:'rgba(22,163,74,0.08)', color:'#16A34A', border:'1px solid rgba(22,163,74,0.22)' }
              : { background:'#F1F5F9', color:'#64748B', border:'1px solid #E2E8F0' }}>
            {employee.isActive?'Active':'Inactive'}
          </span>
        </div>
      )}

      {/* Stat cards */}
      {data?.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger">
          {[
            { label:'Total Calls',  value:data.stats.total,                      color:'#2563EB', bg:'#EFF6FF' },
            { label:'Missed Calls', value:data.stats.missed,                     color:'#DC2626', bg:'#FFF1F2' },
            { label:'Avg Duration', value:formatDuration(data.stats.avgDuration), color:'#D97706', bg:'#FFFBEB' },
          ].map(({label,value,color,bg})=>(
            <div key={label} className="page-card p-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background:bg, color }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>
              <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color:'#94A3B8' }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Type filter chips */}
      <div className="flex gap-2 flex-wrap">
        {TYPE_CHIPS.map(t=>(
          <button key={t} onClick={()=>applyFilter({ callType:t })}
            className="px-3.5 h-8 flex items-center rounded-full text-xs font-semibold transition-all"
            style={filters.callType===t
              ? (t===''?activeChip:{ background:TYPE_COLORS[t]?.color||'#2563EB', color:'#fff', border:`1px solid ${TYPE_COLORS[t]?.color||'#2563EB'}` })
              : (t===''?idleChip:{ background:TYPE_COLORS[t]?.bg||'#F1F5F9', color:TYPE_COLORS[t]?.color||'#64748B', border:`1px solid ${TYPE_COLORS[t]?.border||'#E2E8F0'}` })}>
            {CHIP_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Date filter bar */}
      <div className="page-card p-4 flex flex-wrap gap-3 items-end">
        {[{key:'startDate',label:'Start Date'},{key:'endDate',label:'End Date'}].map(({key,label})=>(
          <div key={key}>
            <label className="block text-xs font-medium mb-1" style={{ color:'#94A3B8' }}>{label}</label>
            <input type="date" value={filters[key]} onChange={e=>applyFilter({[key]:e.target.value})} className="form-input"/>
          </div>
        ))}
        <button onClick={()=>applyFilter({ callType:'', startDate:'', endDate:'' })} className="btn-secondary">Reset</button>
      </div>

      {/* Call logs table */}
      <div className="page-card overflow-hidden p-4">
        <DataTable
          serverMode
          columns={columns}
          rows={data?.calls||[]}
          loading={!data}
          page={page}
          totalPages={data?.pages||1}
          totalCount={data?.total}
          onPageChange={setPage}
          emptyTitle="No call logs found"
        />
      </div>
    </div>
  );
}
