const config = {
  incoming: { label: 'Incoming', bg: '#ECFDF5', color: '#10B981', dot: '#10B981' },
  outgoing: { label: 'Outgoing', bg: '#FFFBEB', color: '#F59E0B', dot: '#F59E0B' },
  missed:   { label: 'Missed',   bg: '#FEF2F2', color: '#EF4444', dot: '#EF4444' },
  rejected: { label: 'Rejected', bg: '#F5F3FF', color: '#8B5CF6', dot: '#8B5CF6' },
};

export default function CallTypeBadge({ type }) {
  const c = config[type] || { label: type, bg: '#F1F5F9', color: '#94A3B8', dot: '#94A3B8' };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}
