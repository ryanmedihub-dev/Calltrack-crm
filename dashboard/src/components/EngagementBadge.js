// Bands mirror backend/lib/engagement.js — cold grey to hot red, one colour per band.
// A separate component from LeadStatusBadge on purpose: engagement is a derived, parallel
// track (see lib/engagement.js), never a substitute for the manual pipeline status.
const config = {
  NOT_CONNECTED:   { label: 'Not Connected',   bg: '#F1F5F9', color: '#94A3B8' },
  LOW:             { label: 'Low',             bg: '#F1F5F9', color: '#64748B' },
  CONTACTED:       { label: 'Contacted',       bg: '#EEF3FF', color: '#1A6BFF' },
  ENGAGED:         { label: 'Engaged',         bg: '#E0F2FE', color: '#0EA5E9' },
  INTERESTED:      { label: 'Interested',      bg: '#EDFAF2', color: '#16A34A' },
  WARM:            { label: 'Warm',            bg: '#FFF6E8', color: '#D97706' },
  HOT:             { label: 'Hot',             bg: '#FFF0E6', color: '#EA580C' },
  HIGH_ENGAGEMENT: { label: 'High Engagement', bg: '#FFF0EE', color: '#DC2626' },
};

export default function EngagementBadge({ engagement }) {
  if (!engagement) {
    return (
      <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: '#F1F5F9', color: '#CBD5E1' }}>
        —
      </span>
    );
  }
  const c = config[engagement] || { label: engagement, bg: '#F1F5F9', color: '#94A3B8' };
  return (
    <span
      className="text-xs px-2.5 py-1 rounded-full font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}
