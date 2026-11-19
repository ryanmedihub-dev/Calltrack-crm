'use client';
// Thin alias kept for existing imports: one call-type badge, one colour map (report-shared TYPE_META).
import { CallBadge } from './report-shared';

export default function CallTypeBadge({ type }) {
  return <CallBadge type={type} />;
}
