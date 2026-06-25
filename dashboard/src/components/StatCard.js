const palette = {
  blue:   { grad: 'linear-gradient(135deg, #6366F1, #8B5CF6)', glow: 'rgba(99,102,241,0.18)',  lt: '#EEF2FF' },
  green:  { grad: 'linear-gradient(135deg, #10B981, #14B8A6)', glow: 'rgba(16,185,129,0.18)', lt: '#ECFDF5' },
  red:    { grad: 'linear-gradient(135deg, #EF4444, #F97316)', glow: 'rgba(239,68,68,0.18)',  lt: '#FEF2F2' },
  orange: { grad: 'linear-gradient(135deg, #F59E0B, #F97316)', glow: 'rgba(245,158,11,0.18)', lt: '#FFFBEB' },
  purple: { grad: 'linear-gradient(135deg, #8B5CF6, #EC4899)', glow: 'rgba(139,92,246,0.18)', lt: '#F5F3FF' },
  teal:   { grad: 'linear-gradient(135deg, #14B8A6, #0EA5E9)', glow: 'rgba(20,184,166,0.18)', lt: '#F0FDFA' },
};

export default function StatCard({ title, value, sub, icon, color = 'blue' }) {
  const p = palette[color] || palette.blue;
  return (
    <div
      className="bg-white rounded-2xl p-5 flex items-center gap-4 card-hover"
      style={{ border: '1px solid #E2E8F4', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(99,102,241,0.06)' }}>
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl flex-shrink-0"
        style={{ background: p.grad, boxShadow: `0 4px 12px ${p.glow}` }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider truncate" style={{ color: '#94A3B8' }}>
          {title}
        </p>
        <p className="text-2xl font-extrabold mt-0.5 leading-none tabular-nums"
          style={{ color: '#0F172A', letterSpacing: '-0.03em' }}>
          {value ?? '—'}
        </p>
        {sub && <p className="text-xs mt-1 truncate" style={{ color: '#94A3B8' }}>{sub}</p>}
      </div>
    </div>
  );
}
