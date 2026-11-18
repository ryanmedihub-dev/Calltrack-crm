const User = require('../models/User');

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Mongo condition matching tlName case-insensitively and ignoring surrounding spaces,
// so "Rahul", " rahul" and "RAHUL" are the same team everywhere. Accepts one name or a list.
function tlNameMatch(names) {
  const list = (Array.isArray(names) ? names : [names]).map((n) => String(n ?? '').trim()).filter(Boolean);
  return { $in: list.map((n) => new RegExp(`^\\s*${escapeRe(n)}\\s*$`, 'i')) };
}

// CallLog/Lead don't store `tlName` directly (it only lives on User) — this
// resolves a `tlName` query-param into the list of employeeIds under that
// team lead, so report/export routes can filter by it via `employeeId: {$in:...}`.
async function resolveEmployeeIdsForTL(tlName) {
  if (!tlName) return null;
  return User.distinct('_id', { tlName: tlNameMatch(tlName) });
}

module.exports = { resolveEmployeeIdsForTL, tlNameMatch };
