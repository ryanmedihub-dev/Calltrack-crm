// Canonical lead status taxonomy — single source of truth for every leads/ page.
// Must match the Lead model's `status` enum on the backend (backend/lib/engagement.js
// ALL_LEAD_STATUSES) and backend/routes/reports.js LEAD_STATUS_LABELS. Do not hardcode a
// different status list on any page — several pages used to (with a stray "qualified"
// status that never existed), which silently miscounted and misbucketed leads.
//
// The first nine values are talk-time bands (status IS the band of the lead's best call so
// far — see backend/lib/engagement.js); the last five are set by a person and never
// overwritten by a call.

export const STATUSES = [
  'new', 'not_connected', 'low', 'contacted', 'engaged', 'interested', 'warm', 'hot', 'high_engagement',
  'follow_up', 'not_interested', 'booking_done', 'converted', 'lost',
];

export const STATUS_LABELS = {
  new: 'New',
  not_connected: 'Not Connected',
  low: 'Low',
  contacted: 'Contacted',
  engaged: 'Engaged',
  interested: 'Interested',
  warm: 'Warm / Strong Interest',
  hot: 'Hot',
  high_engagement: 'High Engagement',
  follow_up: 'Follow Up',
  not_interested: 'Not Interested',
  booking_done: 'Booking Done',
  converted: 'Converted',
  lost: 'Lost',
};

// Tailwind-friendly {bg, text, border, dot} tokens — use with className, not inline style.
// The nine talk-time bands are one cold -> hot ramp in the brand blue (light dot = cold, deep = hot),
// so 'hotter' always reads as 'more blue'. Manual statuses carry a fixed meaning colour used
// everywhere: amber = needs a follow-up, green = booked/converted, red = not interested, grey = closed.
export const STATUS_STYLES = {
  new:             { bg: 'bg-gray-100',   text: 'text-gray-700',    border: 'border-gray-200',    dot: 'bg-gray-400',    hex: '#A19DB2' },
  not_connected:   { bg: 'bg-gray-100',   text: 'text-gray-500',    border: 'border-gray-200',    dot: 'bg-gray-300',    hex: '#D5D2DE' },
  low:             { bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-100',    dot: 'bg-blue-200',    hex: '#DDD6FE' },
  contacted:       { bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-100',    dot: 'bg-blue-300',    hex: '#C4B5FD' },
  engaged:         { bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-100',    dot: 'bg-blue-400',    hex: '#A78BFA' },
  interested:      { bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-200',    dot: 'bg-blue-500',    hex: '#8B5CF6' },
  warm:            { bg: 'bg-blue-100',   text: 'text-blue-800',    border: 'border-blue-200',    dot: 'bg-blue-600',    hex: '#7C3AED' },
  hot:             { bg: 'bg-blue-100',   text: 'text-blue-900',    border: 'border-blue-200',    dot: 'bg-blue-700',    hex: '#6D28D9' },
  high_engagement: { bg: 'bg-blue-100',   text: 'text-blue-900',    border: 'border-blue-300',    dot: 'bg-blue-900',    hex: '#4C1D95' },
  follow_up:       { bg: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-200',   dot: 'bg-amber-500',   hex: '#F59E0B' },
  not_interested:  { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500',     hex: '#EF4444' },
  booking_done:    { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-500', hex: '#10B981' },
  converted:       { bg: 'bg-green-50',   text: 'text-green-800',   border: 'border-green-200',   dot: 'bg-green-600',   hex: '#079455' },
  lost:            { bg: 'bg-gray-100',   text: 'text-gray-500',    border: 'border-gray-200',    dot: 'bg-gray-400',    hex: '#A19DB2' },
};

export function statusStyle(status) {
  return STATUS_STYLES[status] || STATUS_STYLES.new;
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || 'Unknown';
}
