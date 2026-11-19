// Engagement bands mirror backend/lib/engagement.js. They are the same talk-time bands as the lead
// status ramp, so they reuse its colours (lib/leadStatus.js) instead of keeping a second palette.
// Still a separate component on purpose: engagement is a derived, parallel track, never a
// substitute for the manual pipeline status.
import { statusStyle, statusLabel } from '../lib/leadStatus';

export default function EngagementBadge({ engagement }) {
  if (!engagement) return <span className="text-ink-4">—</span>;
  const key = String(engagement).toLowerCase();
  const st = statusStyle(key);
  return (
    <span className={`badge ${st.bg} ${st.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />
      {statusLabel(key)}
    </span>
  );
}
