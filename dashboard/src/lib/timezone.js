/**
 * IST timezone utilities (UTC+5:30)
 *
 * Problem: Vercel runs UTC. MongoDB stores UTC timestamps. Some API responses
 * return datetime strings without a 'Z' suffix, so browsers parse them as
 * local time — but the value is UTC — causing a 5h 30m display offset.
 *
 * Fix strategy:
 *  1. Always force-parse timestamps as UTC before displaying.
 *  2. Always render with timeZone:'Asia/Kolkata' so the output is IST.
 *  3. Shift callsPerHour UTC-hour buckets (+5.5h) for chart x-axis labels.
 */

const TZ = 'Asia/Kolkata';

/**
 * Parse any timestamp string as UTC.
 * Handles strings with or without a trailing 'Z'.
 */
export function parseUTC(ts) {
  if (!ts) return null;
  const s = String(ts).trim();
  // Already has timezone info
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s)) {
    return new Date(s);
  }
  // No timezone info → treat as UTC by appending Z
  return new Date(s + 'Z');
}

/** Format as "15 Jan 2025" in IST */
export function fmtDate(ts) {
  const d = parseUTC(ts);
  if (!d || isNaN(d)) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ,
  });
}

/** Format as "02:30 PM" in IST */
export function fmtTime(ts) {
  const d = parseUTC(ts);
  if (!d || isNaN(d)) return '—';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', timeZone: TZ,
  });
}

/** Format as "15 Jan, 02:30 PM" in IST */
export function fmtDateTime(ts) {
  const d = parseUTC(ts);
  if (!d || isNaN(d)) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
    timeZone: TZ,
  });
}

/** Format as "15 Jan 2025, 02:30 PM" in IST */
export function fmtFull(ts) {
  const d = parseUTC(ts);
  if (!d || isNaN(d)) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: TZ,
  });
}

/**
 * Convert a UTC hour (0–23, as returned by the server's callsPerHour
 * aggregation) to an IST hour label like "9 AM" or "11 PM".
 *
 * IST = UTC + 5h 30m, so we add 5.5 and wrap at 24.
 */
export function utcHourToISTLabel(utcHour) {
  const h   = parseFloat(utcHour);
  const ist = Math.floor((h + 5.5) % 24);
  const ampm = ist >= 12 ? 'PM' : 'AM';
  const h12  = ist % 12 || 12;
  return `${h12} ${ampm}`;
}

/** Today's date string in IST (YYYY-MM-DD) — for default date inputs */
export function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/** IST-aware today datetime-local string for <input type="datetime-local"> */
export function todayStartIST() {
  return todayIST() + 'T00:00';
}
export function todayEndIST() {
  return todayIST() + 'T23:59';
}
