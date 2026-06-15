const palette = {
  blue:   { bg: '#EEF4FF', color: '#1A6BFF', border: '#C7D9FF' },
  green:  { bg: '#ECFDF5', color: '#10B981', border: '#A7F3D0' },
  red:    { bg: '#FEF2F2', color: '#EF4444', border: '#FECACA' },
  orange: { bg: '#FFFBEB', color: '#F59E0B', border: '#FDE68A' },
  purple: { bg: '#F5F3FF', color: '#8B5CF6', border: '#DDD6FE' },
  teal:   { bg: '#F0F9FF', color: '#0EA5E9', border: '#BAE6FD' },
};

export default function StatCard({ title, value, sub, icon, color = 'blue' }) {
  const p = palette[color] || palette.blue;
  return (
    <div className="bg-white rounded-2xl p-5 flex items-center gap-4 border border-border shadow-card hover:shadow-card-md transition-shadow">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 border"
        style={{ background: p.bg, borderColor: p.border, color: p.color }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-textMuted text-[11px] font-semibold uppercase tracking-wide truncate">{title}</p>
        <p className="text-2xl font-bold mt-0.5 leading-none" style={{ color: p.color }}>{value ?? '—'}</p>
        {sub && <p className="text-textMuted text-xs mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );
}
