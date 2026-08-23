// Shared by leadPool.js (Meta webhook) and leads.js (bulk upload re-pool) — both need to turn
// a campaign's schema-less form answers into the same bounded {label, value}[] shape.

// Bounds on the schema-less form answers. A campaign we don't control decides these labels, so
// a misconfigured (or hostile) form must not be able to write unbounded data into every lead.
const MAX_EXTRA_DETAILS = 30;
const MAX_EXTRA_VALUE_LEN = 200;

// Accepts either an array of {label, value} (preferred — Meta's field order is meaningful and
// an array is the only shape that preserves it) or a plain object from older senders, which is
// normalized in key-insertion order.
function normalizeExtraDetails(raw) {
  if (!raw) return [];
  const pairs = Array.isArray(raw)
    ? raw.map((e) => [e?.label, e?.value])
    : (typeof raw === 'object' ? Object.entries(raw) : []);

  return pairs
    .map(([label, value]) => ({
      label: String(label ?? '').trim(),
      value: String(value ?? '').trim().slice(0, MAX_EXTRA_VALUE_LEN),
    }))
    // An unanswered optional question comes through empty; showing a blank row to an agent is
    // worse than showing nothing.
    .filter((e) => e.label && e.value)
    .slice(0, MAX_EXTRA_DETAILS);
}

module.exports = { normalizeExtraDetails, MAX_EXTRA_DETAILS, MAX_EXTRA_VALUE_LEN };
