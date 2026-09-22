// Central on/off switches for features that are paused but not removed.
// Read from env so a flag can be flipped on the VPS without a code deploy.
// Default values here are the CURRENT intended state, not the historical one.

function envBool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

const FEATURES = {
  // The open lead pool: GET/POST /api/lead-pool/*, the dashboard "Live Data" page and the
  // mobile "Live Leads" tab. Paused — the code stays, the surface is closed.
  LEAD_POOL: envBool('FEATURE_LEAD_POOL', false),

  // Recycle sweep UNASSIGNS claimed leads back into the pool every 5 minutes. With the pool
  // closed this would strip ownership off leads with nowhere for them to go, so it is tied
  // to LEAD_POOL and must never be enabled independently.
  get LEAD_POOL_RECYCLE_SWEEP() { return this.LEAD_POOL; },

  // Whether a call to an unknown number should create a Lead. Default OFF: every dialled
  // number becoming a Lead pollutes the collection that feeds the pool filter, the retry
  // queue, the report tabs and the ryan-crm owner panel. Flip on only deliberately.
  AUTO_LEAD_CREATE_ON_CALL: envBool('FEATURE_AUTO_LEAD_CREATE_ON_CALL', false),

  // Every 5 minutes, gives over-attempted UNASSIGNED leads to their last caller. Replaced by
  // the first-call assignment rule in lib/applyCallToLead.js — the first agent to call a lead
  // owns it immediately, so there is nothing left for a sweep to do. Off; code kept.
  AUTO_ASSIGN_SWEEP: envBool('FEATURE_AUTO_ASSIGN_SWEEP', false),

  // GET /api/leads/retry-queue. Read-only list (it never changes a lead), but the owner wants
  // no retry workflow at all right now. Off; code kept. NOTE: ryan-crm's /owner/leads/retry
  // page reads this route and will show its callby-error state while this is off.
  RETRY_QUEUE: envBool('FEATURE_RETRY_QUEUE', false),
};

module.exports = { FEATURES };
