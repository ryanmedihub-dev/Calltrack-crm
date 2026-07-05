'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import api from '../../../../lib/api';
import { STATUSES, statusStyle, statusLabel } from '../../../../lib/leadStatus';
import { LeadStatusBadge, ChartTip, Ico } from '../../../../components/report-shared';

const LeadIco = ({ s = 16 }) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="23" y1="11" x2="17" y2="11" /><line x1="20" y1="8" x2="20" y2="14" /></Ico>;

// Real chart colors matching lib/leadStatus.js's STATUS_STYLES dot tones — Recharts
// renders raw SVG, so its `fill` prop needs an actual color value, not a Tailwind class.
const CHART_COLORS = {
  new: '#3B82F6', contacted: '#8B5CF6', not_connected: '#9CA3AF', interested: '#F59E0B',
  not_interested: '#EF4444', follow_up: '#14B8A6', booking_done: '#10B981', converted: '#16A34A', lost: '#9CA3AF',
};

const QUICK_LINKS = [
  { href: '/leads/pipeline',      label: 'Pipeline',      desc: 'Kanban lead pipeline view',   bg: 'bg-blue-50',    text: 'text-blue-600' },
  { href: '/leads/unattempted',   label: 'Unattempted',   desc: 'Leads with no call attempts', bg: 'bg-red-50',     text: 'text-red-600' },
  { href: '/leads/interested',    label: 'Interested',    desc: 'Leads marked as interested',   bg: 'bg-teal-50',    text: 'text-teal-600' },
  { href: '/leads/follow-ups',    label: 'Follow-ups',    desc: 'Leads pending follow-up',      bg: 'bg-amber-50',   text: 'text-amber-600' },
  { href: '/leads/call-attempts', label: 'Call Attempts', desc: 'Attempt history per lead',     bg: 'bg-violet-50',  text: 'text-violet-600' },
  { href: '/leads/leads-uploads', label: 'Upload Leads',  desc: 'Bulk import via CSV/Excel',    bg: 'bg-emerald-50', text: 'text-emerald-600' },
];

export default function LeadsOverviewPage() {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          STATUSES.map(s =>
            api.get('/api/leads', { params: { status: s, limit: 1 } })
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
  }, []);

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const pieData = STATUSES.map(s => ({ name: statusLabel(s), value: counts[s] || 0, color: CHART_COLORS[s] })).filter(d => d.value > 0);
  const barData = STATUSES.map(s => ({ name: statusLabel(s), count: counts[s] || 0 }));
  const convRate = total > 0 ? Math.round(((counts.converted || 0) / total) * 100) : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Leads Overview</h2>
          <p className="text-sm mt-0.5 text-gray-400">Complete lead pipeline summary with status breakdown</p>
        </div>
        <Link href="/leads/leads-uploads" className="btn-primary text-xs py-1.5 px-3">+ Import Leads</Link>
      </motion.div>

      {/* Top metric */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
        className="rounded-xl p-5 flex flex-wrap items-center gap-6 bg-gradient-to-br from-blue-600 to-blue-700 shadow-sm">
        <div>
          <p className="text-4xl font-extrabold tabular-nums text-white tracking-tight">
            {loading ? '…' : total}
          </p>
          <p className="text-sm mt-1 font-medium text-white/75">Total Leads in System</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-center">
            <p className="text-2xl font-extrabold text-white">{convRate}%</p>
            <p className="text-xs text-white/65">Conversion Rate</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold text-white">{counts.converted || 0}</p>
            <p className="text-xs text-white/65">Converted</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold text-white">{counts.new || 0}</p>
            <p className="text-xs text-white/65">New This Cycle</p>
          </div>
        </div>
      </motion.div>

      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STATUSES.map((s, i) => {
          const count = counts[s] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const style = statusStyle(s);
          return (
            <motion.div key={s} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Link href={`/leads?status=${s}`}>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 cursor-pointer hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5 transition-all">
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
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-sm mb-4 text-gray-900">Leads by Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="count" name="Leads" radius={[5, 5, 0, 0]}>
                {barData.map((_, i) => <Cell key={i} fill={CHART_COLORS[STATUSES[i]] || '#2563EB'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-sm mb-1 text-gray-900">Distribution</h3>
          <p className="text-xs mb-3 text-gray-400">{total} total leads</p>
          {pieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 gap-2">
              <LeadIco s={28} />
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
              <div className="space-y-1.5">
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
        </div>
      </motion.div>

      {/* Quick nav */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
        <h3 className="text-sm font-bold mb-3 text-gray-900">Quick Access</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {QUICK_LINKS.map((p, i) => (
            <motion.div key={p.href} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 + i * 0.03 }}>
              <Link href={p.href}>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 cursor-pointer hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${p.bg} ${p.text}`}>
                    <LeadIco s={14} />
                  </div>
                  <p className="font-bold text-xs text-gray-900">{p.label}</p>
                  <p className="text-[11px] mt-0.5 text-gray-400">{p.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
