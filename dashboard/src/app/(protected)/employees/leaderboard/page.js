'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../../../lib/api';
import { SkeletonTable } from '../../../../components/Skeleton';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

function PodiumCard({ rank, employee, calls }) {
  const styles = {
    1: { height: '9rem',  bg: 'from-yellow-400 to-amber-500', label: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    2: { height: '7rem',  bg: 'from-slate-300 to-gray-400',   label: 'bg-slate-100 text-slate-600 border-slate-300'  },
    3: { height: '5.5rem',bg: 'from-orange-300 to-amber-400', label: 'bg-orange-50 text-orange-600 border-orange-300'},
  };
  const s = styles[rank] || styles[3];

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Avatar + medal */}
      <div className="relative">
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${s.bg} flex items-center justify-center text-white text-lg font-black shadow-md select-none`}>
          {employee.name.slice(0, 2).toUpperCase()}
        </div>
        <span className="absolute -top-2 -right-2 text-xl">{MEDALS[rank - 1]}</span>
      </div>

      {/* Name + calls */}
      <div className="text-center">
        <p className="text-sm font-bold text-textPrimary leading-snug max-w-[90px] truncate">{employee.name}</p>
        <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${s.label}`}>{calls} calls</span>
      </div>

      {/* Podium block */}
      <div className={`w-24 rounded-t-xl bg-gradient-to-br ${s.bg} opacity-30`} style={{ height: s.height }} />
    </div>
  );
}

export default function LeaderboardPage() {
  const [period,  setPeriod]  = useState('week');
  const [dialers, setDialers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/calls/stats');
        const data = res.data.data;
        const key  = period === 'today' ? 'today' : period === 'week' ? 'thisWeek' : 'thisMonth';
        setDialers(data?.[key]?.topDialers || []);
      } catch {}
      setLoading(false);
    })();
  }, [period]);

  const top3    = dialers.slice(0, 3);
  const rest    = dialers.slice(3);
  const maxCalls = dialers[0]?.count || 1;

  const chartData = dialers.slice(0, 10).map(d => ({
    name: d.name?.split(' ')[0] || 'Unknown',
    calls: d.count,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-textPrimary">Leaderboard</h2>
          <p className="text-textMuted text-sm mt-0.5">Top performers ranked by call count</p>
        </div>
        <div className="flex gap-1 bg-white border border-border rounded-xl p-1 shadow-card">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === p.key ? 'bg-primary text-white shadow-sm' : 'text-textMuted hover:text-textSecondary'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={6} />
      ) : dialers.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-16 text-center shadow-card">
          <p className="text-textMuted">No data for this period</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          {top3.length >= 1 && (
            <div className="bg-white border border-border rounded-2xl p-8 shadow-card">
              <h3 className="text-sm font-bold text-textMuted text-center uppercase tracking-widest mb-8">Top Performers</h3>
              <div className="flex items-end justify-center gap-4">
                {/* Reorder: 2nd, 1st, 3rd for visual podium */}
                {[
                  top3[1] ? { ...top3[1], rank: 2 } : null,
                  top3[0] ? { ...top3[0], rank: 1 } : null,
                  top3[2] ? { ...top3[2], rank: 3 } : null,
                ].filter(Boolean).map(d => (
                  <PodiumCard key={d.employeeId} rank={d.rank} employee={{ name: d.name }} calls={d.count} />
                ))}
              </div>
            </div>
          )}

          {/* Bar chart */}
          {chartData.length > 0 && (
            <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
              <h3 className="font-bold text-textPrimary mb-4">Top 10 by Call Count</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barSize={28} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} tickLine={false} axisLine={false} width={80} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} cursor={{ fill: '#F1F5F9' }} />
                  <Bar dataKey="calls" fill="#1A6BFF" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Full rankings table */}
          <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-bold text-textPrimary">Full Rankings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg border-b border-border">
                    {['Rank', 'Agent', 'Calls', 'Share', 'First Call', 'Last Call'].map((h, i) => (
                      <th key={h} className={`px-5 py-3 text-xs font-semibold text-textMuted uppercase tracking-wide ${i <= 1 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dialers.map((d, i) => {
                    const share = Math.round((d.count / (dialers.reduce((s, x) => s + x.count, 0) || 1)) * 100);
                    return (
                      <tr key={d.employeeId} className={`hover:bg-bg transition-colors ${i < 3 ? 'font-medium' : ''}`}>
                        <td className="px-5 py-3 text-textMuted">
                          {i < 3 ? <span className="text-base">{MEDALS[i]}</span> : <span className="text-textMuted font-bold">#{i + 1}</span>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 select-none">
                              {(d.name || 'U').slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-semibold text-textPrimary">{d.name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-textPrimary tabular-nums">{d.count}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${(d.count / maxCalls) * 100}%` }} />
                            </div>
                            <span className="text-xs text-textMuted tabular-nums w-8 text-right">{share}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-textMuted text-xs tabular-nums">
                          {d.first ? new Date(d.first).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-5 py-3 text-right text-textMuted text-xs tabular-nums">
                          {d.last ? new Date(d.last).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
