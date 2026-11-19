const mongoose = require('mongoose');

// Filters from the dashboard's multi-select dropdowns arrive as "a,b,c". These turn one value
// into an exact match and several into $in, so every route reads single and multi the same way.
const list = (v) => (Array.isArray(v) ? v : String(v ?? '').split(','))
  .map((s) => String(s).trim()).filter(Boolean);

const anyOf = (v, cast = (x) => x) => {
  const l = list(v).map(cast);
  return l.length === 1 ? l[0] : { $in: l };
};

// For aggregate() $match, which does no schema casting. Returns null if any id is invalid.
const oidsOf = (v) => {
  const l = list(v);
  if (!l.length || !l.every((id) => mongoose.Types.ObjectId.isValid(id))) return null;
  return anyOf(l, (id) => new mongoose.Types.ObjectId(id));
};

module.exports = { list, anyOf, oidsOf };
