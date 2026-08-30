// GET /api/leads/retry-queue
//
// Prioritized list of currently-assigned leads worth calling back, ranked P0 (most urgent) to
// P4. Built entirely from Lead fields already maintained elsewhere in this system — no new
// tracking. Consumed by ryan-crm's Owner panel (Retry & Recovery screen) via CALLBY_API_URL +
// CALLBY_SERVICE_TOKEN, the same manager-role-JWT pattern GET /api/leads/funnel-data already uses.
//
// Query params (all optional):
//   dateFrom, dateTo — ISO date bounds on Lead.createdAt. NOT defaulted: a lead left open since
//                       months ago is exactly what this queue exists to surface, so bounding it
//                       by date would hide real problems rather than just save time.
//   teams            — comma-separated User.tlName values; only leads assigned to employees
//                       under one of these team leads are included (same resolution
//                       leadFunnel.js uses for `teams`).
//   limit            — cap on returned leads (default DEFAULT_LIMIT, max MAX_LIMIT).
//
// RESULTS ARE CAPPED. ~57k leads currently satisfy the priority rules — a response no caller can
// use, and the reason this endpoint was timing out at the gateway. `totalMatching`, `byPriority`
// and `truncated` come back alongside, so the panel can show "500 of 57,438" and the full tier
// breakdown rather than silently dropping the rest.
//
// HOW IT STAYS FAST: the tiers are walked in priority order and each one is fetched already
// sorted and limited to whatever is still needed, so a default request is satisfied out of P0
// and P1 (~3.2k leads, both index-backed) and never looks at P2–P4 at all. Nothing computes a
// priority for, or sorts, the full match set.
const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const User = require('../models/User');
const { protect, isManager } = require('../middleware/auth');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const PRIORITY_ORDER = ['P0', 'P1', 'P2', 'P3', 'P4'];
// A page, not a dump. Measured against the live cluster, response time is dominated by moving
// documents over the wire (~300ms fixed + ~1.5ms per row) rather than by the queries, which the
// indexes now keep in the tens of milliseconds — so the row count IS the latency dial. 200 rows
// covers every P0 and P1 lead a floor manager can act on in a sitting; `limit` raises it.
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 5000;

// Priority rules, checked in order — a lead is scored by the first rule its status matches,
// never by more than one. A lead whose status doesn't satisfy its own tier's extra condition
// (e.g. an 'interested' lead with no past follow-up) falls all the way through and is excluded
// from the queue entirely — it isn't "less urgent", it just isn't a retry-queue case (a future
// follow-up is already being tracked via its own reminder, not this queue).
//
// Kept as the readable statement of what each tier MEANS, and still used to label every lead
// that goes out. buildTiers() below is the same rules expressed for Mongo; the two are asserted
// against each other by backend/scripts (see the retry-queue equivalence check).
function computePriority(lead, now) {
  const { status, followUpDate, attempts, connectedCallCount, lastCallAt } = lead;

  if (status === 'interested' && followUpDate && new Date(followUpDate).getTime() < now) {
    return 'P0';
  }
  if (
    status === 'contacted' && (connectedCallCount || 0) > 0 && lastCallAt &&
    (now - new Date(lastCallAt).getTime()) <= SEVEN_DAYS_MS
  ) {
    return 'P1';
  }
  if (status === 'new' && (attempts || 0) === 0) {
    return 'P2';
  }
  if (
    status === 'not_connected' &&
    (!lastCallAt || (now - new Date(lastCallAt).getTime()) > FOUR_HOURS_MS)
  ) {
    return 'P3';
  }
  if (['follow_up', 'contacted', 'not_connected'].includes(status)) {
    return 'P4';
  }
  return null;
}

function ageHours(lead, now) {
  const ref = lead.lastCallAt || lead.createdAt;
  return (now - new Date(ref).getTime()) / (1000 * 60 * 60);
}

// Each tier as its own Mongo filter, in the same order computePriority checks them.
//
// P0–P3 are mutually exclusive by construction: each pins a different `status`, so no lead can
// satisfy two of them. P4 is the catch-all and is the only one that needs explicit exclusions —
// it shares 'contacted' with P1 and 'not_connected' with P3, so it subtracts both. (P4's $nor
// does not index well; that is fine, because filling a page from P0–P3 takes 29,867 leads and
// no reachable `limit` gets that far.)
function buildTiers(now) {
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);
  const fourHoursAgo = new Date(now.getTime() - FOUR_HOURS_MS);
  // JS `(now - lastCallAt) > FOUR_HOURS`  <=>  `lastCallAt < fourHoursAgo`.
  const p1Cond = { connectedCallCount: { $gt: 0 }, lastCallAt: { $gte: sevenDaysAgo } };
  const p3Cond = { $or: [{ lastCallAt: null }, { lastCallAt: { $lt: fourHoursAgo } }] };

  // `sortBy` marks a tier whose age ordering an index can serve directly. ageHours descends as
  // (lastCallAt || createdAt) ascends, so wherever lastCallAt is guaranteed non-null the tier
  // can be read straight off { status, lastCallAt } already in order — Mongo then stops at the
  // limit instead of loading the tier's whole set to sort it. Tiers without it fall back to
  // computing and sorting ageHours in the pipeline, which is fine for the small ones.
  return [
    // $lt against a Date is type-bracketed in a query filter, so a null/missing followUpDate
    // cannot slip in the way it would in an aggregation expression.
    // No sortBy: age here comes off lastCallAt OR createdAt, and this tier admits both.
    { label: 'P0', match: { status: 'interested', followUpDate: { $lt: now } } },
    // lastCallAt is pinned non-null by p1Cond's $gte, so lastCallAt ascending IS age descending.
    { label: 'P1', match: { status: 'contacted', ...p1Cond }, sortBy: { lastCallAt: 1 } },
    // $in [0, null] also matches a missing field — what JS's `(attempts || 0) === 0` does.
    { label: 'P2', match: { status: 'new', attempts: { $in: [0, null] } } },
    { label: 'P3', match: { status: 'not_connected', ...p3Cond } },
    { label: 'P4', match: { $or: [
      { status: 'follow_up' },
      { status: 'contacted',     $nor: [p1Cond] },
      { status: 'not_connected', $nor: [p3Cond] },
    ] } },
  ];
}

// The union of all five tiers — i.e. exactly the leads computePriority() scores non-null.
// Three branches, not five: P1's status ('contacted') and P3's ('not_connected') both already
// sit inside P4's status list, so those two branches would return documents the third already
// returns while making the planner run and de-duplicate two extra index scans.
function buildPriorityMatch(now) {
  return {
    $or: [
      { status: 'interested', followUpDate: { $lt: now } },
      { status: 'new', attempts: { $in: [0, null] } },
      { status: { $in: ['follow_up', 'contacted', 'not_connected'] } },
    ],
  };
}

const PROJECTION = {
  name: 1, phone: 1, status: 1, attempts: 1, lastCallAt: 1, lastCallType: 1,
  followUpDate: 1, connectedCallCount: 1, createdAt: 1, assignedTo: 1,
};

router.get('/retry-queue', protect, isManager, async (req, res) => {
  try {
    const { dateFrom, dateTo, teams } = req.query;
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit) || DEFAULT_LIMIT));

    // One fixed instant for the whole request: tier bounds, ordering and labelling all evaluate
    // against it, so none of them can disagree about a lead sitting on a boundary mid-request.
    const now = new Date();
    const nowMs = now.getTime();

    const base = { assignedTo: { $ne: null } }; // only leads someone owns belong in a retry queue
    if (dateFrom || dateTo) {
      base.createdAt = {};
      if (dateFrom) base.createdAt.$gte = new Date(dateFrom);
      if (dateTo) base.createdAt.$lte = new Date(dateTo);
    }
    if (teams) {
      const teamList = teams.split(',').filter(Boolean);
      const teamEmployeeIds = await User.distinct('_id', { tlName: { $in: teamList } });
      base.assignedTo = { $in: teamEmployeeIds };
    }

    const tiers = buildTiers(now);

    // Counts for the whole match set, all index-backed. P4 is derived by subtraction rather than
    // counted: the tiers partition the match set exactly, so P4 = total - (P0+P1+P2+P3), which
    // avoids running P4's un-indexable $nor over every lead. Kicked off here but NOT awaited
    // until the end — the counts and the page are independent, so they overlap on the wire
    // instead of costing their round-trips back to back.
    const countsPromise = Promise.all([
      Lead.countDocuments({ ...base, ...buildPriorityMatch(now) }),
      ...tiers.slice(0, 4).map((t) => Lead.countDocuments({ ...base, ...t.match })),
    ]);

    // Walk the tiers in priority order, taking only what's still needed from each. Ordering is
    // identical to the old "fetch everything, sort by (priority, ageHours desc)" because the
    // tiers ARE the priority order and each is fetched already sorted by age.
    const collected = [];
    const seen = new Set();
    for (const tier of tiers) {
      const remaining = limit - collected.length;
      if (remaining <= 0) break;

      const rows = tier.sortBy
        // Index-ordered read: the sort key comes off the index, so Mongo stops at `remaining`
        // rather than materialising the tier to sort it.
        ? await Lead.find({ ...base, ...tier.match })
            .sort(tier.sortBy).limit(remaining).select(PROJECTION).lean()
        : await Lead.aggregate([
            { $match: { ...base, ...tier.match } },
            {
              $project: {
                ...PROJECTION,
                // Rounded here, not only on output, because the old in-JS sort compared the
                // ROUNDED value — rounding after ordering would arrange equal-looking rows
                // differently.
                ageHours: {
                  $round: [{
                    $divide: [{ $subtract: [now, { $ifNull: ['$lastCallAt', '$createdAt'] }] }, 1000 * 60 * 60],
                  }, 2],
                },
              },
            },
            { $sort: { ageHours: -1 } },
            { $limit: remaining },
          ]);

      for (const r of rows) {
        const id = String(r._id);
        if (seen.has(id)) continue; // belt-and-braces; the tiers are already disjoint
        seen.add(id);
        collected.push(r);
      }
    }

    const [totalMatching, ...headCounts] = await countsPromise;
    const byPriority = {
      P0: headCounts[0], P1: headCounts[1], P2: headCounts[2], P3: headCounts[3],
      P4: Math.max(0, totalMatching - headCounts.reduce((a, b) => a + b, 0)),
    };

    // Resolve agents in ONE batched query rather than a $lookup stage, which Mongo runs per
    // input document — at limit=5000 that was thousands of individual index hits and by far the
    // slowest thing in the request.
    const agentIds = [...new Set(collected.map((l) => l.assignedTo).filter(Boolean).map(String))];
    const agents = agentIds.length
      ? await User.find({ _id: { $in: agentIds } }).select('name tlName').lean()
      : [];
    const agentById = new Map(agents.map((a) => [String(a._id), a]));

    const leads = collected.map((lead) => {
      const agent = lead.assignedTo ? agentById.get(String(lead.assignedTo)) : null;
      return {
        id: lead._id,
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        attempts: lead.attempts || 0,
        lastCallAt: lead.lastCallAt || null,
        lastCallType: lead.lastCallType || null,
        followUpDate: lead.followUpDate || null,
        assignedTo: agent ? { id: agent._id, name: agent.name, tlName: agent.tlName || null } : null,
        ageHours: Math.round(ageHours(lead, nowMs) * 100) / 100,
        // Labelled by the same function as before the rewrite, against the same instant the
        // tiers were built from.
        priority: computePriority(lead, nowMs),
      };
    });

    return res.json({
      success: true,
      data: {
        generatedAt: now,
        totalMatching,
        byPriority,
        returned: leads.length,
        truncated: totalMatching > leads.length,
        limit,
        leads,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports.PRIORITY_ORDER = PRIORITY_ORDER;
module.exports.computePriority = computePriority;
module.exports.ageHours = ageHours;
module.exports.buildPriorityMatch = buildPriorityMatch;
module.exports.buildTiers = buildTiers;
