const config = {
  incoming: { label: 'Incoming', bg: 'rgba(16,185,129,0.10)', color: '#059669', border: 'rgba(16,185,129,0.22)', dot: '#10B981' },
  outgoing: { label: 'Outgoing', bg: 'rgba(245,158,11,0.10)', color: '#D97706', border: 'rgba(245,158,11,0.22)', dot: '#F59E0B' },
  missed:   { label: 'Missed',   bg: 'rgba(239,68,68,0.10)',  color: '#DC2626', border: 'rgba(239,68,68,0.22)',  dot: '#EF4444' },
  rejected: { label: 'Rejected', bg: 'rgba(139,92,246,0.10)', color: '#7C3AED', border: 'rgba(139,92,246,0.22)', dot: '#8B5CF6' },
};

export default function CallTypeBadge({ type }) {
  const c = config[type] || { label: type || 'Unknown', bg: 'rgba(148,163,184,0.10)', color: '#64748B', border: 'rgba(148,163,184,0.22)', dot: '#94A3B8' };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap select-none"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}
