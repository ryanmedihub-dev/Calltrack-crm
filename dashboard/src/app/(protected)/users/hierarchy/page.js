'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';
import { motion, AnimatePresence } from 'framer-motion';

// ── Icons ──────────────────────────────────────────────────────────────────────
function Ico({ size = 16, children, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      {children}
    </svg>
  );
}
const SearchIco    = () => <Ico size={14}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const UsersIco     = ({ size = 18 }) => <Ico size={size}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;
const ChevronDown  = () => <Ico size={14}><polyline points="6 9 12 15 18 9"/></Ico>;
const PlusIco      = () => <Ico size={14}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Ico>;
const EditIco      = () => <Ico size={13}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></Ico>;
const UnlinkIco    = () => <Ico size={13}><path d="M18.84 12.25l1.72-1.71a4.5 4.5 0 0 0-6.36-6.36l-1.72 1.71"/><path d="M5.16 11.75l-1.72 1.71a4.5 4.5 0 0 0 6.36 6.36l1.72-1.71"/><line x1="8" y1="2" x2="2" y2="8"/><line x1="22" y1="16" x2="16" y2="22"/></Ico>;
const PhoneIco     = () => <Ico size={12}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></Ico>;
const MailIco      = () => <Ico size={12}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></Ico>;
const AlertIco     = () => <Ico size={16}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></Ico>;

// ── Pagination Component ───────────────────────────────────────────────────────
function Pagination({ total, page, pageSize, onPage, onPageSize, borderColor = '#FDE68A' }) {
  const totalPages = Math.ceil(total / pageSize);
  if (total === 0 || totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);

  function getPageNums() {
    const nums = [];
    let last = 0;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
        if (last && i - last > 1) nums.push('...');
        nums.push(i);
        last = i;
      }
    }
    return nums;
  }

  const pages = getPageNums();

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 mt-3"
      style={{ borderTop: `1px solid ${borderColor}` }}
    >
      {/* Left: count + page-size selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: '#78716C' }}>
          Showing{' '}
          <strong style={{ color: '#44403C' }}>{start}–{end}</strong>
          {' '}of{' '}
          <strong style={{ color: '#44403C' }}>{total}</strong>
        </span>
        <div className="flex items-center gap-1.5">
          <label className="text-xs whitespace-nowrap" style={{ color: '#A8A29E' }}>Show</label>
          <select
            value={pageSize}
            onChange={e => onPageSize(Number(e.target.value))}
            className="text-xs rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            style={{ border: '1px solid #D6D3D1', color: '#374151' }}
          >
            {[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Right: page buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
          style={{ borderColor: '#E2E8F0', color: '#475569', background: 'white' }}
        >
          ‹ Prev
        </button>

        {pages.map((p, idx) =>
          p === '...' ? (
            <span key={`e${idx}`} className="px-1.5 text-xs" style={{ color: '#94A3B8' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              className="w-8 h-8 text-xs font-semibold rounded-lg transition-colors"
              style={
                p === page
                  ? { background: '#2563EB', color: 'white', border: '1px solid #2563EB' }
                  : { background: 'white', color: '#475569', border: '1px solid #E2E8F0' }
              }
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
          style={{ borderColor: '#E2E8F0', color: '#475569', background: 'white' }}
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

export default function AdminHierarchyPage() {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [expandedMgr, setExpandedMgr] = useState({});
  const [expandedTL,  setExpandedTL]  = useState({});

  // Assignment Modal States
  // targetTL: { tl, currentManager }
  const [assignTLModal,    setAssignTLModal]    = useState(null);
  const [selectedManagerId, setSelectedManagerId] = useState('');

  // targetAgent: { agent, currentTL }
  const [assignAgentModal, setAssignAgentModal] = useState(null);
  const [selectedTLId,     setSelectedTLId]     = useState('');

  const [mutating, setMutating] = useState(false);

  // ── Pagination State — Unassigned Agents ────────────────────────────────────
  const [agentPage,     setAgentPage]     = useState(1);
  const [agentPageSize, setAgentPageSize] = useState(10);

  // ── Pagination State — Unassigned TLs ───────────────────────────────────────
  const [tlPage,     setTlPage]     = useState(1);
  const [tlPageSize, setTlPageSize] = useState(10);

  // ── Fetch complete hierarchy ───────────────────────────────────────────────
  const fetchHierarchy = useCallback(async () => {
    try {
      const res = await api.get('/api/users/hierarchy');
      const hierarchyData = res.data?.data || { managers: [], unassignedTLs: [], unassignedAgents: [] };
      setData(hierarchyData);

      // Auto-expand all managers and TLs on initial load
      const mgrExp = {};
      const tlExp = {};
      (hierarchyData.managers || []).forEach(m => {
        if (m.manager?._id) mgrExp[m.manager._id] = true;
        (m.teamLeads || []).forEach(t => {
          if (t.tl?._id) tlExp[t.tl._id] = true;
        });
      });
      setExpandedMgr(prev => Object.keys(prev).length ? prev : mgrExp);
      setExpandedTL(prev => Object.keys(prev).length ? prev : tlExp);
    } catch (err) {
      toast.error('Failed to load hierarchy data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  // ── Helper lists for modals ────────────────────────────────────────────────
  const managersList = (data?.managers || []).map(m => m.manager).filter(Boolean);
  const allTLsList = [
    ...(data?.managers || []).flatMap(m => (m.teamLeads || []).map(t => t.tl)),
    ...(data?.unassignedTLs || [])
  ].filter(Boolean);

  // ── Metric Calculations ───────────────────────────────────────────────────
  const totalManagers   = managersList.length;
  const assignedTLCount = (data?.managers || []).reduce((acc, m) => acc + (m.teamLeads?.length || 0), 0);
  const unassignedTLCount = data?.unassignedTLs?.length || 0;
  const totalTLCount    = assignedTLCount + unassignedTLCount;

  const assignedAgentCount = (data?.managers || []).reduce((acc, m) => {
    return acc + (m.teamLeads || []).reduce((tAcc, t) => tAcc + (t.agents?.length || 0), 0);
  }, 0);
  const unassignedAgentCount = data?.unassignedAgents?.length || 0;
  const totalAgentCount = assignedAgentCount + unassignedAgentCount;

  // ── Assign / Reassign TL to Manager ────────────────────────────────────────
  const handleSaveTLAssignment = async () => {
    if (!assignTLModal?.tl?._id) return;
    if (!selectedManagerId) {
      toast.error('Please select a manager');
      return;
    }

    setMutating(true);
    try {
      const res = await api.patch(`/api/users/${assignTLModal.tl._id}/manager`, {
        managerId: selectedManagerId,
      });
      toast.success(res.data?.message || 'Team Lead assigned successfully');
      setAssignTLModal(null);
      setSelectedManagerId('');
      await fetchHierarchy();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign Team Lead');
    } finally {
      setMutating(false);
    }
  };

  // ── Unassign TL from Manager ───────────────────────────────────────────────
  const handleRemoveTLManager = async (tl) => {
    if (!confirm(`Are you sure you want to remove Manager assignment for '${tl.name}'? Agents under this TL will remain assigned to ${tl.name}.`)) return;

    setMutating(true);
    try {
      const res = await api.delete(`/api/users/${tl._id}/manager`);
      toast.success(res.data?.message || 'Manager assignment removed');
      await fetchHierarchy();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove Manager assignment');
    } finally {
      setMutating(false);
    }
  };

  // ── Assign / Reassign Agent to TL ──────────────────────────────────────────
  const handleSaveAgentAssignment = async () => {
    if (!assignAgentModal?.agent?._id) return;
    if (!selectedTLId) {
      toast.error('Please select a Team Lead');
      return;
    }

    setMutating(true);
    try {
      const res = await api.patch(`/api/users/${assignAgentModal.agent._id}/team-lead`, {
        teamLeadId: selectedTLId,
      });
      toast.success(res.data?.message || 'Employee assigned successfully');
      setAssignAgentModal(null);
      setSelectedTLId('');
      await fetchHierarchy();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign Employee');
    } finally {
      setMutating(false);
    }
  };

  // ── Unassign Agent from TL ─────────────────────────────────────────────────
  const handleRemoveAgentTL = async (agent) => {
    if (!confirm(`Are you sure you want to remove Team Lead assignment for '${agent.name}'?`)) return;

    setMutating(true);
    try {
      const res = await api.delete(`/api/users/${agent._id}/team-lead`);
      toast.success(res.data?.message || 'Team Lead assignment removed');
      await fetchHierarchy();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove Team Lead assignment');
    } finally {
      setMutating(false);
    }
  };

  // ── Filter Logic ───────────────────────────────────────────────────────────
  const q = search.toLowerCase().trim();

  const filteredManagers = (data?.managers || []).filter(({ manager, teamLeads }) => {
    if (!q) return true;
    const mgrMatch = manager && (manager.name.toLowerCase().includes(q) || manager.email.toLowerCase().includes(q));
    const tlMatch = teamLeads.some(t =>
      (t.tl?.name || '').toLowerCase().includes(q) ||
      (t.tl?.email || '').toLowerCase().includes(q) ||
      t.agents.some(a => (a.name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q))
    );
    return mgrMatch || tlMatch;
  });

  const filteredUnassignedTLs = (data?.unassignedTLs || []).filter(tl => {
    if (!q) return true;
    return (tl.name || '').toLowerCase().includes(q) || (tl.email || '').toLowerCase().includes(q);
  });

  const filteredUnassignedAgents = (data?.unassignedAgents || []).filter(agent => {
    if (!q) return true;
    return (agent.name || '').toLowerCase().includes(q) || (agent.email || '').toLowerCase().includes(q);
  });

  // ── Reset pagination to page 1 when search changes ───────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setAgentPage(1);
    setTlPage(1);
  }, [search]);

  // ── Paginated slices (filter-first, paginate-second) ─────────────────────────
  const paginatedUnassignedAgents = useMemo(() => {
    const start = (agentPage - 1) * agentPageSize;
    return filteredUnassignedAgents.slice(start, start + agentPageSize);
  }, [filteredUnassignedAgents, agentPage, agentPageSize]);

  const paginatedUnassignedTLs = useMemo(() => {
    const start = (tlPage - 1) * tlPageSize;
    return filteredUnassignedTLs.slice(start, start + tlPageSize);
  }, [filteredUnassignedTLs, tlPage, tlPageSize]);

  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="h-20 bg-white rounded-2xl animate-pulse" style={{ border: '1px solid #E2E8F0' }} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" style={{ border: '1px solid #E2E8F0' }} />
          ))}
        </div>
        <div className="h-96 bg-white rounded-2xl animate-pulse" style={{ border: '1px solid #E2E8F0' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#0F172A' }}>
            Hierarchy Management
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
            Assign and organize Managers, Team Leads, and Agents across your organization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: '#94A3B8' }}>
              <SearchIco />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people…"
              className="w-full pl-9 pr-4 py-2 bg-white rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
            />
          </div>
          <Link href="/users/update-users" className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 flex-shrink-0">
            <PlusIco /> Add User
          </Link>
        </div>
      </div>

      {/* ── Summary Stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border" style={{ borderColor: '#E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Managers</p>
          <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: '#0F172A' }}>{totalManagers}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border" style={{ borderColor: '#E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Team Leads</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold tabular-nums" style={{ color: '#2563EB' }}>{assignedTLCount}</span>
            {unassignedTLCount > 0 && (
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                {unassignedTLCount} unassigned
              </span>
            )}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border" style={{ borderColor: '#E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Agents / Employees</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold tabular-nums" style={{ color: '#16A34A' }}>{assignedAgentCount}</span>
            {unassignedAgentCount > 0 && (
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                {unassignedAgentCount} unassigned
              </span>
            )}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border" style={{ borderColor: '#E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Total Personnel</p>
          <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: '#0F172A' }}>
            {totalManagers + totalTLCount + totalAgentCount}
          </p>
        </div>
      </div>

      {/* ── Unassigned Sections (Notice Banners) ───────────────────────────── */}
      {(filteredUnassignedTLs.length > 0 || filteredUnassignedAgents.length > 0) && (
        <div className="space-y-4">
          {/* Unassigned TLs */}
          {filteredUnassignedTLs.length > 0 && (
            <div className="bg-amber-50/70 rounded-2xl border border-amber-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-amber-600"><AlertIco /></span>
                <h3 className="text-sm font-bold text-amber-900">
                  Unassigned Team Leads ({filteredUnassignedTLs.length})
                </h3>
              </div>
              <p className="text-xs text-amber-700 mb-4">
                These Team Leads currently do not have a Manager assigned. Assign them to bring them into a reporting structure.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {paginatedUnassignedTLs.map((tl) => (
                  <div key={tl._id} className="bg-white p-3.5 rounded-xl border border-amber-200 flex items-center justify-between gap-3 shadow-xs">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: '#0F172A' }}>{tl.name}</p>
                      <p className="text-[11px] truncate" style={{ color: '#94A3B8' }}>{tl.email || tl.phone}</p>
                    </div>
                    <button
                      onClick={() => {
                        setAssignTLModal({ tl, currentManager: null });
                        setSelectedManagerId('');
                      }}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                    >
                      + Assign Manager
                    </button>
                  </div>
                ))}
              </div>
              <Pagination
                total={filteredUnassignedTLs.length}
                page={tlPage}
                pageSize={tlPageSize}
                onPage={setTlPage}
                onPageSize={(s) => { setTlPageSize(s); setTlPage(1); }}
                borderColor="#FDE68A"
              />
            </div>
          )}

          {/* Unassigned Agents */}
          {filteredUnassignedAgents.length > 0 && (
            <div className="bg-amber-50/70 rounded-2xl border border-amber-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-amber-600"><AlertIco /></span>
                <h3 className="text-sm font-bold text-amber-900">
                  Unassigned Employees ({filteredUnassignedAgents.length})
                </h3>
              </div>
              <p className="text-xs text-amber-700 mb-4">
                These Agents currently do not report to any Team Lead. Assign them to enable scoped reporting and call tracking.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {paginatedUnassignedAgents.map((agent) => (
                  <div key={agent._id} className="bg-white p-3.5 rounded-xl border border-amber-200 flex items-center justify-between gap-3 shadow-xs">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: '#0F172A' }}>{agent.name}</p>
                      <p className="text-[11px] truncate" style={{ color: '#94A3B8' }}>{agent.email || agent.phone}</p>
                    </div>
                    <button
                      onClick={() => {
                        setAssignAgentModal({ agent, currentTL: null });
                        setSelectedTLId('');
                      }}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                    >
                      + Assign TL
                    </button>
                  </div>
                ))}
              </div>
              <Pagination
                total={filteredUnassignedAgents.length}
                page={agentPage}
                pageSize={agentPageSize}
                onPage={setAgentPage}
                onPageSize={(s) => { setAgentPageSize(s); setAgentPage(1); }}
                borderColor="#FDE68A"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Active Hierarchy Tree ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Organizational Hierarchy Tree
        </h2>

        {filteredManagers.length === 0 ? (
          <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: '#E2E8F0' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: '#EFF6FF', color: '#2563EB' }}>
              <UsersIco size={24} />
            </div>
            <p className="font-semibold" style={{ color: '#0F172A' }}>
              {search ? 'No hierarchy nodes matched your search' : 'No Managers Found'}
            </p>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
              {search ? 'Try adjusting your search terms.' : 'Create a Manager account from Update Users to start building your hierarchy.'}
            </p>
          </div>
        ) : (
          filteredManagers.map(({ manager, teamLeads }) => {
            const isMgrExpanded = expandedMgr[manager._id] !== false;
            const totalAgentsUnderMgr = teamLeads.reduce((acc, t) => acc + (t.agents?.length || 0), 0);

            return (
              <div
                key={manager._id}
                className="bg-white rounded-2xl border overflow-hidden transition-all duration-200"
                style={{ borderColor: '#E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                {/* ── Manager Node Header ───────────────────────────────────── */}
                <div
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => setExpandedMgr(prev => ({ ...prev, [manager._id]: !prev[manager._id] }))}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-base font-extrabold flex-shrink-0 select-none"
                      style={{ background: 'linear-gradient(135deg,#1E40AF,#3B82F6)', boxShadow: '0 4px 12px rgba(30,64,175,0.25)' }}
                    >
                      {(manager.name || 'M')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800 tracking-wider">
                          Manager
                        </span>
                        <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>
                          {manager.name}
                        </h3>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={
                            manager.isActive !== false
                              ? { background: 'rgba(22,163,74,0.08)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.22)' }
                              : { background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }
                          }
                        >
                          {manager.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs" style={{ color: '#64748B' }}>
                        {manager.email && <span className="flex items-center gap-1"><MailIco /> {manager.email}</span>}
                        {manager.phone && <span className="flex items-center gap-1"><PhoneIco /> {manager.phone}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
                    <div className="text-right hidden sm:block">
                      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Structure</p>
                      <p className="text-xs font-bold" style={{ color: '#0F172A' }}>
                        <span className="text-blue-600">{teamLeads.length} TLs</span> · <span className="text-emerald-600">{totalAgentsUnderMgr} Agents</span>
                      </p>
                    </div>

                    <button
                      onClick={() => setExpandedMgr(prev => ({ ...prev, [manager._id]: !prev[manager._id] }))}
                      className="p-2 rounded-lg transition-transform duration-200"
                      style={{
                        color: '#94A3B8',
                        transform: isMgrExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      <ChevronDown />
                    </button>
                  </div>
                </div>

                {/* ── Team Leads Under Manager ─────────────────────────────── */}
                <AnimatePresence>
                  {isMgrExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}
                      className="p-4 sm:p-6 space-y-4"
                    >
                      {teamLeads.length === 0 ? (
                        <div className="text-center py-6 border border-dashed rounded-xl bg-white" style={{ borderColor: '#E2E8F0' }}>
                          <p className="text-xs font-medium" style={{ color: '#94A3B8' }}>
                            No Team Leads currently assigned to {manager.name}.
                          </p>
                        </div>
                      ) : (
                        teamLeads.map(({ tl, agents }) => {
                          const isTLExpanded = expandedTL[tl._id] !== false;

                          return (
                            <div
                              key={tl._id}
                              className="bg-white rounded-xl border transition-all duration-150 overflow-hidden"
                              style={{ borderColor: '#E2E8F0' }}
                            >
                              {/* TL Row Header */}
                              <div
                                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70"
                                onClick={() => setExpandedTL(prev => ({ ...prev, [tl._id]: !prev[tl._id] }))}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 select-none"
                                    style={{ background: 'linear-gradient(135deg,#D97706,#F59E0B)' }}
                                  >
                                    {(tl.name || 'T')[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 tracking-wider">
                                        TL
                                      </span>
                                      <p className="font-bold text-sm" style={{ color: '#0F172A' }}>{tl.name}</p>
                                      <span
                                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                                        style={
                                          tl.isActive !== false
                                            ? { background: 'rgba(22,163,74,0.08)', color: '#16A34A' }
                                            : { background: '#F1F5F9', color: '#64748B' }
                                        }
                                      >
                                        {tl.isActive !== false ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-[11px]" style={{ color: '#64748B' }}>
                                      {tl.email && <span className="flex items-center gap-1"><MailIco /> {tl.email}</span>}
                                      {tl.phone && <span className="flex items-center gap-1"><PhoneIco /> {tl.phone}</span>}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                    {agents.length} Agents
                                  </span>

                                  {/* TL Actions */}
                                  <button
                                    onClick={() => {
                                      setAssignTLModal({ tl, currentManager: manager });
                                      setSelectedManagerId(manager._id);
                                    }}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1"
                                    title="Reassign to another Manager"
                                  >
                                    <EditIco /> Reassign
                                  </button>
                                  <button
                                    onClick={() => handleRemoveTLManager(tl)}
                                    className="p-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Unassign from Manager"
                                  >
                                    <UnlinkIco />
                                  </button>
                                  <button
                                    onClick={() => setExpandedTL(prev => ({ ...prev, [tl._id]: !prev[tl._id] }))}
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                    style={{ transform: isTLExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                  >
                                    <ChevronDown />
                                  </button>
                                </div>
                              </div>

                              {/* Agents Under TL */}
                              <AnimatePresence>
                                {isTLExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="p-4 bg-slate-50/50 border-t border-slate-100"
                                  >
                                    <div className="flex items-center justify-between mb-3">
                                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                        Assigned Agents ({agents.length})
                                      </p>
                                    </div>

                                    {agents.length === 0 ? (
                                      <p className="text-xs italic text-slate-400 py-1">
                                        No agents assigned to {tl.name} yet.
                                      </p>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                        {agents.map((agent) => (
                                          <div
                                            key={agent._id}
                                            className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                                          >
                                            <div className="flex items-center gap-2 min-w-0">
                                              <div
                                                className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 select-none"
                                                style={{ background: '#64748B' }}
                                              >
                                                {(agent.name || 'A')[0].toUpperCase()}
                                              </div>
                                              <div className="min-w-0">
                                                <p className="text-xs font-semibold truncate text-slate-900">{agent.name}</p>
                                                <p className="text-[10px] truncate text-slate-400">{agent.email || agent.phone || 'No contact'}</p>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-1 flex-shrink-0">
                                              <button
                                                onClick={() => {
                                                  setAssignAgentModal({ agent, currentTL: tl });
                                                  setSelectedTLId(tl._id);
                                                }}
                                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                title="Reassign to another TL"
                                              >
                                                <EditIco />
                                              </button>
                                              <button
                                                onClick={() => handleRemoveAgentTL(agent)}
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                                title="Unassign from TL"
                                              >
                                                <UnlinkIco />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* ── Assign / Reassign TL Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {assignTLModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200"
            >
              <h3 className="text-base font-bold text-slate-900">
                {assignTLModal.currentManager ? 'Reassign Team Lead' : 'Assign Team Lead'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Select the Manager that <strong className="text-slate-800">{assignTLModal.tl.name}</strong> will report to.
              </p>

              {assignTLModal.currentManager && (
                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <span className="text-slate-400 font-medium">Current Manager:</span>{' '}
                  <strong className="text-slate-800">{assignTLModal.currentManager.name}</strong>
                </div>
              )}

              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select New Manager
                </label>
                <select
                  value={selectedManagerId}
                  onChange={(e) => setSelectedManagerId(e.target.value)}
                  className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">-- Choose Manager --</option>
                  {managersList.map((mgr) => (
                    <option key={mgr._id} value={mgr._id}>
                      {mgr.name} ({mgr.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAssignTLModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTLAssignment}
                  disabled={mutating || !selectedManagerId}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors shadow-sm"
                >
                  {mutating ? 'Saving…' : 'Confirm Assignment'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Assign / Reassign Agent Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {assignAgentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200"
            >
              <h3 className="text-base font-bold text-slate-900">
                {assignAgentModal.currentTL ? 'Reassign Employee' : 'Assign Employee'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Select the Team Lead that <strong className="text-slate-800">{assignAgentModal.agent.name}</strong> will report to.
              </p>

              {assignAgentModal.currentTL && (
                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <span className="text-slate-400 font-medium">Current Team Lead:</span>{' '}
                  <strong className="text-slate-800">{assignAgentModal.currentTL.name}</strong>
                </div>
              )}

              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select New Team Lead
                </label>
                <select
                  value={selectedTLId}
                  onChange={(e) => setSelectedTLId(e.target.value)}
                  className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">-- Choose Team Lead --</option>
                  {allTLsList.map((tl) => (
                    <option key={tl._id} value={tl._id}>
                      {tl.name} ({tl.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAssignAgentModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAgentAssignment}
                  disabled={mutating || !selectedTLId}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors shadow-sm"
                >
                  {mutating ? 'Saving…' : 'Confirm Assignment'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
