'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
import api from '../../../../lib/api';
import { STATUSES, statusStyle, statusLabel } from '../../../../lib/leadStatus';
import { LeadStatusBadge, ChartTip, Ico } from '../../../../components/report-shared';
import DateRangeFilter, { formatRangeLabel, rangeToDates } from '../../../../components/DateRangeFilter';

const LeadIco = ({ s = 16 }) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="23" y1="11" x2="17" y2="11" /><line x1="20" y1="8" x2="20" y2="14" /></Ico>;
const PipelineIco = ({ s = 16 }) => <Ico size={s}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Ico>;
const FollowUpIco = ({ s = 16 }) => <Ico size={s}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Ico>;
const AssignedIco = ({ s = 16 }) => <Ico size={s}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Ico>;
const LogsIco = ({ s = 16 }) => <Ico size={s}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></Ico>;
const UploadIco = ({ s = 16 }) => <Ico size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></Ico>;
const ReportIco = ({ s = 16 }) => <Ico size={s}><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></Ico>;
const TrendUpIco = () => <Ico size={12}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></Ico>;

// Real chart colors matching lib/leadStatus.js's STATUS_STYLES dot tones — Recharts
// renders raw SVG, so its `fill` prop needs an actual color value, not a Tailwind class.
const CHART_COLORS = {
  new: '#3B82F6', not_connected: '#9CA3AF', low: '#64748B', contacted: '#0EA5E9', engaged: '#3B82F6',
  interested: '#8B5CF6', warm: '#F59E0B', hot: '#EA580C', high_engagement: '#DC2626',
  not_interested: '#EF4444', follow_up: '#14B8A6', booking_done: '#10B981', converted: '#16A34A', lost: '#9CA3AF',
};

const QUICK_LINKS = [
  { href: '/leads/pipeline',       label: 'Pipeline',       desc: 'Kanban lead pipeline view',    color: '#2563EB', bg: '#EFF6FF', icon: <PipelineIco /> },
  { href: '/leads/follow-ups',     label: 'Follow-ups',     desc: 'Leads pending follow-up',      color: '#0D9488', bg: '#F0FDFA', icon: <FollowUpIco /> },
  { href: '/leads/assingned-leads',label: 'Assigned Leads', desc: 'Leads assigned to the team',   color: '#7C3AED', bg: '#F5F3FF', icon: <AssignedIco /> },
  { href: '/leads/leads-logs',     label: 'Leads Logs',     desc: 'Full lead activity log',       color: '#D97706', bg: '#FFFBEB', icon: <LogsIco /> },
  { href: '/leads/leads-uploads',  label: 'Upload Leads',   desc: 'Bulk import via CSV/Excel',    color: '#16A34A', bg: '#F0FDF4', icon: <UploadIco /> },
  { href: '/reports/lead',         label: 'Leads Report',   desc: 'Detailed status-wise report',  color: '#DC2626', bg: '#FFF1F2', icon: <ReportIco /> },
];

export default function LeadsOverviewPage() {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ range: 'all', startDate: null, endDate: null });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const params = { limit: 1 };
      if (dateRange.range && dateRange.range !== 'all') {
        params.range = dateRange.range;
        if (dateRange.range === 'custom') {
          params.startDate = dateRange.startDate;
          params.endDate = dateRange.endDate;
        }
      }
      try {
        const results = await Promise.all(
          STATUSES.map(s =>
            api.get('/api/leads', { params: { ...params, status: s } })
              .then(r => ({ key: s, count: r.data?.data?.total || 0 }))
              .catch(() => ({ key: s, count: 0 }))
          )
        );
        const map = {};
        results.forEach(r => { map[r.key] = r.count; });
        setCounts(map);
      } catch {}
      setLoading(false);
    })();
  }, [dateRange]);

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const pieData = STATUSES.map(s => ({ name: statusLabel(s), value: counts[s] || 0, color: CHART_COLORS[s] })).filter(d => d.value > 0);
  const barData = STATUSES.map(s => ({ name: statusLabel(s), count: counts[s] || 0 }));
  const convRate = total > 0 ? Math.round(((counts.converted || 0) / total) * 100) : 0;
  const rangeLabel = formatRangeLabel(dateRange);
  const { fromDate, toDate } = rangeToDates(dateRange);

  const quickStats = [
    { label: 'Total Leads', value: total, color: '#2563EB', icon: <LeadIco /> },
    { label: 'Conversion Rate', value: `${convRate}%`, color: '#16A34A', icon: <TrendUpIco /> },
    { label: 'Converted', value: counts.converted || 0, color: '#16A34A', icon: <LeadIco /> },
    { label: 'New', value: counts.new || 0, color: '#3B82F6', icon: <LeadIco /> },
  ];

  if (loading && total === 0 && Object.keys(counts).length === 0) {
    return (
      <div className="min-h-screen bg-gray-50/80 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="skeleton h-8 w-56 rounded-xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <LeadIco s={16} />
              </span>
              Leads Overview
            </h2>
            <p className="text-sm text-gray-500 mt-1">Complete lead pipeline summary with status breakdown</p>
          </div>
          <div className="flex items-center gap-2.5">
            <DateRangeFilter value={dateRange} onChange={setDateRange} includeAll />
            <Link href="/leads/leads-uploads" className="btn-primary text-xs py-2 px-4 rounded-xl whitespace-nowrap">+ Import Leads</Link>
          </div>
        </motion.div>

        {/* Date Scope Notice */}
        {dateRange.range === 'today' && total === 0 && (
          <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl px-4 py-3 flex items-center gap-3 text-xs text-blue-800">
            <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              No leads were created on today's calendar date ({rangeLabel}). Select <strong>All Time</strong> in the date dropdown above to view the complete pipeline of leads.
            </span>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${stat.color}15`, color: stat.color }}>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold text-gray-900 tracking-tight tabular-nums">
                {loading ? <span className="skeleton inline-block w-10 h-6 rounded" /> : stat.value}
              </p>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {STATUSES.map((s, i) => {
            const count = counts[s] || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const style = statusStyle(s);
            return (
              <motion.div key={s} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link href={`/reports/lead?status=${s}&fromDate=${fromDate}&toDate=${toDate}`}>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:border-blue-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex items-center justify-between mb-2">
                      <LeadStatusBadge status={s} style={style} label={statusLabel(s)} />
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200">{pct}%</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">
                      {loading ? <span className="skeleton inline-block w-10 h-6 rounded" /> : count}
                    </p>
                    <div className="mt-2 h-1 rounded-full bg-gray-100">
                      <div className={`h-full rounded-full transition-all duration-700 ${style.dot}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Leads by Status</h3>
                <p className="text-xs text-gray-500 mt-0.5">{rangeLabel}</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="count" name="Leads" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} formatter={(v) => v || ''} />
                  {barData.map((_, i) => <Cell key={i} fill={CHART_COLORS[STATUSES[i]] || '#2563EB'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 p-6"
          >
            <h3 className="text-sm font-bold text-gray-900 mb-1">Distribution</h3>
            <p className="text-xs text-gray-500 mb-3">{total} total leads</p>
            {pieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-44 gap-2">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <LeadIco s={24} />
                </div>
                <p className="text-xs text-gray-400">No leads yet</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {pieData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                        <span className="text-gray-500">{d.name}</span>
                      </div>
                      <span className="font-bold text-gray-900">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </div>

        {/* Quick nav */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h3 className="text-sm font-bold text-gray-900 mb-3">Quick Access</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {QUICK_LINKS.map((p, i) => (
              <motion.div
                key={p.href}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 + 0.32 }}
                whileHover={{ y: -4 }}
              >
                <Link href={p.href}>
                  <div className="group bg-white rounded-2xl p-4 border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 duration-300"
                      style={{ background: p.bg, color: p.color }}
                    >
                      {p.icon}
                    </div>
                    <p className="font-semibold text-sm text-gray-900">{p.label}</p>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{p.desc}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
