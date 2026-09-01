// The single definition of "in the open pool" — what the Live Leads (mobile) and Live Data
// (dashboard) screens show. Shared by routes/leadPool.js and by the maintenance scripts that
// act on those leads, so a change to what counts as poolable can't leave a script quietly
// operating on a different set than the screen it claims to mirror.
//
// Membership is not a stored flag. It is `assignedTo: null` AND a status that still means
// nobody has settled this lead yet:
//   - `assignedTo: null` makes pooled-and-owned mutually exclusive by construction, needs no
//     migration, and leaves no second collection to reconcile. It also means ASSIGNING a lead
//     is what removes it from the pool — there is nothing else to delete.
//   - the status whitelist keeps a lead somebody has already worked (interested / follow_up /
//     not_interested / booked / converted / lost) from being offered to the whole floor. The
//     call sync links calls to leads BY PHONE regardless of assignment, so an unclaimed lead
//     can be driven to a decided status without ever being claimed.
//
// Whitelist rather than a $nin of the decided ones: Mongo can use an index for $in but not
// $nin, and a status added to the enum later stays OUT of the pool until somebody deliberately
// opts it in — the safe direction for a screen every agent works from.
const POOL_ELIGIBLE_STATUSES = ['new', 'contacted', 'not_connected'];

// A lead dialled more than this many times is not an open opportunity for the floor — it belongs
// to whoever has been working it. Enforced in TWO places on purpose:
//   - here, as part of POOL_FILTER, so an over-attempted lead stops appearing the moment its
//     third call syncs. This is the guarantee: it holds even if the assign sweep below is not
//     running, has not run yet, or cannot resolve a caller to hand the lead to.
//   - by lib/assignToLastCaller.js, which gives those leads an owner rather than leaving them
//     unassigned and invisible.
// Filtering alone would strand them; assigning alone would leave a window where an over-attempted
// lead is still on the board. Both together is what makes the rule hold continuously.
const MAX_POOL_ATTEMPTS = 2;

// Callers spread this (`{ ...POOL_FILTER, ...more }`) rather than mutating it.
// `attempts` is never missing in this data (schema default 0), so a plain $lte is safe and keeps
// the range on the same field the pool sorts by — see the pool_attempts_order index.
const POOL_FILTER = {
  assignedTo: null,
  status: { $in: POOL_ELIGIBLE_STATUSES },
  attempts: { $lte: MAX_POOL_ATTEMPTS },
};

module.exports = { POOL_ELIGIBLE_STATUSES, MAX_POOL_ATTEMPTS, POOL_FILTER };
