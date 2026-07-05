'use client';
import { useState, useCallback } from 'react';
import api from '../../../../lib/api';
import { fmtDateTime } from '../../../../lib/timezone';
import { StatCard, Skeleton, CallBadge, SearchIco, PhoneIco, UsersIco, CheckIco, Ico } from '../../../../components/report-shared';

const MapIco = ({ s = 20 }) => <Ico size={s}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></Ico>;

const STATUS_META = {
  new:        { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', label: 'New' },
  contacted:  { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label: 'Contacted' },
  qualified:  { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', label: 'Qualified' },
  interested: { color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4', label: 'Interested' },
  converted:  { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', label: 'Converted' },
  lost:       { color: '#DC2626', bg: '#FFF1F2', border: '#FECACA', label: 'Lost' },
};

const fmt = fmtDateTime;
function dur(s) { return s ? `${Math.floor(s / 60)}m ${s % 60}s` : '—'; }

export default function LeadJourneyReportPage() {
  const [query, setQuery] = useState('');
  const [lead, setLead] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(''); setSearched(true);
    try {
      const [leadsRes, callsRes] = await Promise.allSettled([
        api.get('/api/leads', { params: { search: query.trim(), limit: 1 } }),
        api.get('/api/calls', { params: { search: query.trim(), limit: 100 } }),
      ]);
      const leadData = leadsRes.status === 'fulfilled' ? (leadsRes.value.data?.data?.leads || leadsRes.value.data?.data || [])[0] : null;
      const callsData = callsRes.status === 'fulfilled' ? (callsRes.value.data?.data?.calls || callsRes.value.data?.data || []) : [];
      setLead(leadData || null);
      setCalls(callsData);
      if (!leadData && !callsData.length) setError('No records found for this contact.');
    } catch { setError('Failed to fetch data. Please try again.'); }
    setLoading(false);
  }, [query]);

  const totalDur = calls.reduce((s, c) => s + (c.duration || 0), 0);
  const connected = calls.filter(c => c.isConnected || c.duration > 0).length;
  const st = lead?.status ? (STATUS_META[lead.status] || { color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1', label: lead.status }) : null;

  const timeline = [...calls].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return (
    <div className="min-h-screen">
      <div className="space-y-5">

        {/* Header */}
        <div>
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            Leads <span className="text-gray-300">/</span> <span className="text-gray-500">Lead Journey Report</span>
          </p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">Lead Journey Report</h1>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">Search Lead</p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIco s={16} /></span>
              <input
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                placeholder="Enter lead name, phone, or email…"
                value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
              />
            </div>
            <button
              onClick={search} disabled={!query.trim() || loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm disabled:opacity-60 transition-colors"
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
          {error && <p className="text-xs mt-2 text-red-600">{error}</p>}
        </div>

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        )}

        {!loading && searched && !lead && !calls.length && !error && (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-blue-50 text-blue-600">
              <MapIco s={24} />
            </div>
            <p className="font-bold text-sm text-gray-900">No records found</p>
            <p className="text-xs mt-1 text-gray-400">Try searching by a different name, phone, or email.</p>
          </div>
        )}

        {!loading && (lead || calls.length > 0) && (
          <>
            {/* Lead info card */}
            {lead && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shrink-0"
                    style={{ background: 'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
                    {(lead.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-base text-gray-900">{lead.name || 'Unknown'}</p>
                      {st && (
                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                          {st.label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-mono mt-0.5 text-gray-500">{lead.phone || '—'}</p>
                    <p className="text-xs mt-0.5 text-gray-400">{lead.email || ''}</p>
                    <div className="flex flex-wrap gap-4 mt-3">
                      <div><p className="text-[10px] uppercase font-bold text-gray-400">Source</p><p className="text-xs font-semibold text-gray-700">{lead.source || '—'}</p></div>
                      <div><p className="text-[10px] uppercase font-bold text-gray-400">Assigned To</p><p className="text-xs font-semibold text-gray-700">{lead.assignedToName || lead.assignedTo || 'Unassigned'}</p></div>
                      <div><p className="text-[10px] uppercase font-bold text-gray-400">Added</p><p className="text-xs font-semibold text-gray-700">{fmt(lead.createdAt)}</p></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Calls" value={calls.length} color="#2563EB" icon={<PhoneIco s={16} />} />
              <StatCard label="Connected" value={connected} color="#16A34A" icon={<CheckIco s={16} />} />
              <StatCard label="Missed" value={calls.filter(c => c.callType === 'missed').length} color="#DC2626" icon={<PhoneIco s={16} />} />
              <StatCard label="Total Duration" value={dur(totalDur)} color="#7C3AED" icon={<UsersIco s={16} />} />
            </div>

            {/* Timeline */}
            {timeline.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-5 py-3.5 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900">Call Journey Timeline</h3>
                  <p className="text-xs mt-0.5 text-gray-400">From first contact to most recent</p>
                </div>
                <div className="p-5">
                  <div className="relative">
                    <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
                    <div className="space-y-4">
                      {timeline.map((c, i) => (
                        <div key={c._id || i} className="relative flex gap-4 pl-12">
                          <div className="absolute left-3 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center z-10 bg-blue-600" style={{ top: '2px' }}>
                            <PhoneIco s={8} />
                          </div>
                          <div className="flex-1 bg-gray-50 rounded-lg border border-gray-100 p-3.5">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <CallBadge type={c.callType?.toLowerCase()} />
                                <span className="text-xs font-semibold text-gray-900">{c.employeeName || 'Unknown'}</span>
                              </div>
                              <span className="text-xs text-gray-400">{fmt(c.timestamp)}</span>
                            </div>
                            <div className="flex gap-4 mt-2">
                              <span className="text-xs text-gray-500">Duration: <strong>{dur(c.duration)}</strong></span>
                              <span className="text-xs text-gray-500">
                                {c.isConnected || c.duration > 0 ? '✓ Connected' : '✗ Not connected'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
