// Formats a duration in seconds as "1h 2m 3s" / "2m 3s" / "3s" — shared by
// stats endpoints and CSV exports so call durations never render as raw
// seconds in a downloaded file.
function fmtDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

module.exports = fmtDuration;
