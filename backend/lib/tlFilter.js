const User = require('../models/User');

// CallLog/Lead don't store `tlName` directly (it only lives on User) — this
// resolves a `tlName` query-param into the list of employeeIds under that
// team lead, so report/export routes can filter by it via `employeeId: {$in:...}`.
async function resolveEmployeeIdsForTL(tlName) {
  if (!tlName) return null;
  return User.distinct('_id', { tlName });
}

module.exports = { resolveEmployeeIdsForTL };
