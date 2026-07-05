// Canonical lead status taxonomy — single source of truth for every leads/ page.
// Must match the Lead model's `status` enum on the backend (backend/models/Lead.js)
// and backend/routes/reports.js LEAD_STATUS_LABELS. Do not hardcode a different
// status list on any page — several pages used to (with a stray "qualified"
// status that never existed), which silently miscounted and misbucketed leads.

export const STATUSES = [
  'new', 'contacted', 'not_connected', 'interested', 'not_interested',
  'follow_up', 'booking_done', 'converted', 'lost',
];

export const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  not_connected: 'Not Connected',
  interested: 'Interested',
  not_interested: 'Not Interested',
  follow_up: 'Follow Up',
  booking_done: 'Booking Done',
  converted: 'Converted',
  lost: 'Lost',
};

// Tailwind-friendly {bg, text, border, dot} tokens — use with className, not inline style.
export const STATUS_STYLES = {
  new:            { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200',    dot: 'bg-blue-500' },
  contacted:      { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-200',  dot: 'bg-violet-500' },
  not_connected:  { bg: 'bg-gray-100',   text: 'text-gray-500',    border: 'border-gray-200',    dot: 'bg-gray-400' },
  interested:     { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  not_interested: { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200',     dot: 'bg-red-500' },
  follow_up:      { bg: 'bg-teal-50',    text: 'text-teal-600',    border: 'border-teal-200',    dot: 'bg-teal-500' },
  booking_done:   { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  converted:      { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-300',   dot: 'bg-green-600' },
  lost:           { bg: 'bg-gray-100',   text: 'text-gray-500',    border: 'border-gray-200',    dot: 'bg-gray-400' },
};

export function statusStyle(status) {
  return STATUS_STYLES[status] || STATUS_STYLES.new;
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || 'Unknown';
}
