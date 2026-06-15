const config = {
  new:           { label: 'New',          bg: '#EEF3FF', color: '#1A6BFF' },
  contacted:     { label: 'Contacted',    bg: '#F3EEFF', color: '#7C3AED' },
  interested:    { label: 'Interested',   bg: '#FFF6E8', color: '#FF9500' },
  not_interested:{ label: 'Not Interest', bg: '#FFF0EE', color: '#FF3B30' },
  converted:     { label: 'Converted',    bg: '#EDFAF2', color: '#34C759' },
  lost:          { label: 'Lost',         bg: '#F1F5F9', color: '#94A3B8' },
};

export default function LeadStatusBadge({ status }) {
  const c = config[status] || { label: status, bg: '#F1F5F9', color: '#94A3B8' };
  return (
    <span
      className="text-xs px-2.5 py-1 rounded-full font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}
