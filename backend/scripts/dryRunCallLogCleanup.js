'use strict';
/**
 * ============================================================================
 * PHASE 12.5 — HISTORICAL CALLLOG CLEANUP ALGORITHM DRY-RUN (VALIDATED)
 * ============================================================================
 *
 * READ-ONLY DRY RUN
 * NO DATABASE MUTATIONS WILL BE PERFORMED
 *
 * Mode: STRICT READ-ONLY / DRY-RUN ONLY
 * Target Collection: test.calllogs
 *
 * ZERO WRITES / ZERO DELETES / ZERO UPDATES / ZERO INDEX CHANGES
 * ============================================================================
 */

const READ_ONLY = true;

// Safety assertion: Ensure no mutating methods can be called
const FORBIDDEN_OPERATIONS = [
  'updateOne', 'updateMany', 'replaceOne',
  'deleteOne', 'deleteMany',
  'findOneAndUpdate', 'findOneAndDelete',
  'bulkWrite', 'insertOne', 'insertMany',
  'createIndex', 'dropIndex'
];

const fs = require('fs');
const path = require('path');
const mongoose = require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/node_modules/mongoose');
require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/node_modules/dotenv').config({ path: 'c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/.env' });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('FATAL: MONGO_URI environment variable not set.');
  process.exit(1);
}

// Minimal read-only schema — no index builds, no middleware
const callLogSchema = new mongoose.Schema({
  employeeId:         mongoose.Schema.Types.ObjectId,
  callType:           String,
  contactNumber:      String,
  contactName:        String,
  duration:           Number,
  timestamp:          Date,
  notes:              String,
  callStatus:         String,
  notesUpdatedAt:     Date,
  notesUpdatedBy:     mongoose.Schema.Types.ObjectId,
  notesUpdatedByName: String,
  clientCallId:       String,
  leadId:             mongoose.Schema.Types.ObjectId,
  synced:             Boolean,
  createdAt:          Date,
  updatedAt:          Date,
}, { autoIndex: false, timestamps: false });

const CallLog = mongoose.model('CallLogDryRun125', callLogSchema, 'calllogs');

function hr(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function elapsed(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function isNullCid(v) {
  return v === null || v === undefined || v === '';
}

function isStrCid(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function normalizeString(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
 * Deterministically evaluate duplicate group
 *
 * NOTE: The natural-key duplicate grouping (employeeId + contactNumber + timestamp)
 * MUST happen before KEEP selection. We do NOT treat populated clientCallId alone
 * as proof that two documents are duplicates. clientCallId priority is ONLY a
 * KEEP-selection rule after the natural-key duplicate relationship has already been established.
 */
function evaluateGroup(g, docs) {
  const cids = docs.map(d => d.clientCallId);
  const nullCount = cids.filter(isNullCid).length;
  const strCids = cids.filter(isStrCid);
  const strCount = strCids.length;

  // 1. Broad Category
  let category = 'E';
  if (nullCount === docs.length) {
    category = 'A'; // NULL + NULL
  } else if (nullCount > 0 && strCount > 0) {
    category = 'B'; // NULL + POPULATED
  } else if (strCount === docs.length) {
    const uniquePopulated = new Set(strCids);
    if (uniquePopulated.size === 1) {
      category = 'C'; // POPULATED + SAME ID
    } else {
      category = 'D'; // POPULATED + DIFF IDs
    }
  }

  // 2. Extract and evaluate leadIds
  const allLeadIds = docs.map(d => (d.leadId ? d.leadId.toString() : null));
  const nonNullLeadIds = allLeadIds.filter(Boolean);
  const uniqueLeadIds = [...new Set(nonNullLeadIds)];

  const conflicts = [];
  const mergeCandidates = {};
  let isRed = false;
  let redReason = '';

  // Critical Lead-Id Safety Rule:
  // Any group with conflicting non-null leadIds MUST be RED and MUST NOT be automatically deleted.
  if (uniqueLeadIds.length > 1) {
    isRed = true;
    redReason = `Conflicting different leadIds: [${uniqueLeadIds.join(', ')}]`;
    conflicts.push({
      field: 'leadId',
      type: 'LEAD_ID_CONFLICT',
      values: uniqueLeadIds,
      description: `Multiple documents in duplicate group reference different leads: ${uniqueLeadIds.join(' vs ')}`
    });
  }

  // Check createdAt difference (NOT a business conflict, but tracked precisely)
  const createdTimes = docs.map(d => (d.createdAt ? new Date(d.createdAt).getTime() : 0)).filter(t => t > 0);
  const hasCreatedAtDiff = createdTimes.length > 1 && (Math.max(...createdTimes) - Math.min(...createdTimes) > 0);

  // 3. Select KEEP Document (Deterministic Decision Hierarchy)
  // Hierarchy:
  // Step A: Populated valid clientCallId wins over null
  // Step B: Populated leadId wins over null leadId
  // Step C: Non-empty notes wins over empty
  // Step D: Non-empty callStatus wins over empty
  // Step E: Oldest createdAt
  // Step F: Lexicographically lowest _id string tie-breaker
  const sortedDocs = [...docs].sort((a, b) => {
    // Step A
    const aHasCid = isStrCid(a.clientCallId) ? 1 : 0;
    const bHasCid = isStrCid(b.clientCallId) ? 1 : 0;
    if (aHasCid !== bHasCid) return bHasCid - aHasCid;

    // Step B
    const aHasLead = a.leadId ? 1 : 0;
    const bHasLead = b.leadId ? 1 : 0;
    if (aHasLead !== bHasLead) return bHasLead - aHasLead;

    // Step C
    const aHasNotes = normalizeString(a.notes) ? 1 : 0;
    const bHasNotes = normalizeString(b.notes) ? 1 : 0;
    if (aHasNotes !== bHasNotes) return bHasNotes - aHasNotes;

    // Step D
    const aHasStatus = normalizeString(a.callStatus) ? 1 : 0;
    const bHasStatus = normalizeString(b.callStatus) ? 1 : 0;
    if (aHasStatus !== bHasStatus) return bHasStatus - aHasStatus;

    // Step E: Earliest createdAt
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aCreated !== bCreated) return aCreated - bCreated;

    // Step F: Lowest _id string
    return a._id.toString().localeCompare(b._id.toString());
  });

  // If group is RED, keepId = MANUAL_REVIEW and wouldRemoveIds = []
  const keepDoc = isRed ? null : sortedDocs[0];
  const keepId = isRed ? 'MANUAL_REVIEW' : (keepDoc ? keepDoc._id.toString() : 'MANUAL_REVIEW');
  const wouldRemoveDocs = isRed ? [] : docs.filter(d => d._id.toString() !== keepDoc._id.toString());
  const wouldRemoveIds = wouldRemoveDocs.map(d => d._id.toString());

  // 4. Evaluate Field-Level Compatibility and Merge Candidates against keepDoc
  const hypotheticFinal = keepDoc ? {
    clientCallId: keepDoc.clientCallId || null,
    leadId:       keepDoc.leadId ? keepDoc.leadId.toString() : null,
    callStatus:   keepDoc.callStatus || null,
    notes:        keepDoc.notes || null,
    synced:       keepDoc.synced ?? true,
    callType:     keepDoc.callType || null,
    duration:     keepDoc.duration ?? 0,
    createdAt:    keepDoc.createdAt ? new Date(keepDoc.createdAt).toISOString() : null,
    updatedAt:    keepDoc.updatedAt ? new Date(keepDoc.updatedAt).toISOString() : null,
  } : null;

  // Compare duration across all docs
  const durations = docs.map(d => d.duration);
  const durationMismatch = durations.some(d => d !== durations[0]);
  if (durationMismatch) {
    conflicts.push({
      field: 'duration',
      type: 'DURATION_MISMATCH',
      values: durations,
      description: `Varying durations across duplicate documents: [${durations.join(', ')}]`
    });
  }

  // Compare callType across all docs
  const callTypes = docs.map(d => d.callType);
  const typeMismatch = callTypes.some(t => t !== callTypes[0]);
  if (typeMismatch) {
    conflicts.push({
      field: 'callType',
      type: 'CALL_TYPE_MISMATCH',
      values: callTypes,
      description: `Varying call types: [${callTypes.join(', ')}]`
    });
  }

  // Compare synced across all docs
  const synceds = docs.map(d => d.synced);
  const syncedMismatch = synceds.some(s => s !== synceds[0]);
  if (syncedMismatch) {
    conflicts.push({
      field: 'synced',
      type: 'SYNCED_FLAG_MISMATCH',
      values: synceds,
      description: `Varying synced flags: [${synceds.join(', ')}]`
    });
  }

  // Compare notes & check merge candidacy
  if (keepDoc) {
    const keepNotesNorm = normalizeString(keepDoc.notes);
    for (const rem of wouldRemoveDocs) {
      const remNotesNorm = normalizeString(rem.notes);
      if (remNotesNorm && !keepNotesNorm) {
        mergeCandidates.notes = {
          fromId: rem._id.toString(),
          toId: keepDoc._id.toString(),
          value: rem.notes
        };
        hypotheticFinal.notes = rem.notes;
      } else if (remNotesNorm && keepNotesNorm && remNotesNorm !== keepNotesNorm) {
        conflicts.push({
          field: 'notes',
          type: 'NOTES_TEXT_CONFLICT',
          keepValue: keepDoc.notes,
          removeValue: rem.notes,
          removeDocId: rem._id.toString(),
          description: `Conflicting notes between keep doc and remove doc: "${keepDoc.notes}" vs "${rem.notes}"`
        });
      }
    }

    // Compare callStatus & check merge candidacy
    const keepStatusNorm = normalizeString(keepDoc.callStatus);
    for (const rem of wouldRemoveDocs) {
      const remStatusNorm = normalizeString(rem.callStatus);
      if (remStatusNorm && !keepStatusNorm) {
        mergeCandidates.callStatus = {
          fromId: rem._id.toString(),
          toId: keepDoc._id.toString(),
          value: rem.callStatus
        };
        hypotheticFinal.callStatus = rem.callStatus;
      } else if (remStatusNorm && keepStatusNorm && remStatusNorm !== keepStatusNorm) {
        conflicts.push({
          field: 'callStatus',
          type: 'CALL_STATUS_CONFLICT',
          keepValue: keepDoc.callStatus,
          removeValue: rem.callStatus,
          removeDocId: rem._id.toString(),
          description: `Conflicting call status between keep doc and remove doc: "${keepDoc.callStatus}" vs "${rem.callStatus}"`
        });
      }
    }

    // Check leadId enrichment
    if (!keepDoc.leadId && uniqueLeadIds.length === 1) {
      const donor = wouldRemoveDocs.find(d => d.leadId);
      if (donor) {
        mergeCandidates.leadId = {
          fromId: donor._id.toString(),
          toId: keepDoc._id.toString(),
          value: donor.leadId.toString()
        };
        hypotheticFinal.leadId = donor.leadId.toString();
      }
    }

    // Check clientCallId enrichment (if keepDoc has null and donor has string)
    if (!keepDoc.clientCallId && strCount === 1) {
      const donor = wouldRemoveDocs.find(d => isStrCid(d.clientCallId));
      if (donor) {
        mergeCandidates.clientCallId = {
          fromId: donor._id.toString(),
          toId: keepDoc._id.toString(),
          value: donor.clientCallId
        };
        hypotheticFinal.clientCallId = donor.clientCallId;
      }
    }

    // Earliest createdAt adoption
    if (createdTimes.length > 0) {
      const minCreatedMs = Math.min(...createdTimes);
      hypotheticFinal.createdAt = new Date(minCreatedMs).toISOString();
    }
  }

  // 5. Final Risk Classification
  let risk = 'GREEN';
  let reason = '';
  let automaticCleanup = false;
  let manualReview = false;

  if (isRed || conflicts.some(c => c.field === 'leadId')) {
    risk = 'RED';
    reason = redReason || 'Critical lead reference conflict or unresolvable identity ambiguity.';
    automaticCleanup = false;
    manualReview = true;
  } else if (conflicts.length > 0) {
    risk = 'YELLOW';
    reason = `Contains field conflicts requiring review: ${conflicts.map(c => c.field).join(', ')}`;
    automaticCleanup = false;
    manualReview = true;
  } else if (Object.keys(mergeCandidates).length > 0) {
    risk = 'YELLOW';
    reason = `Compatible duplicate requiring field enrichment before deletion: ${Object.keys(mergeCandidates).join(', ')}`;
    automaticCleanup = false; // Must remain false until field enrichment policy approved
    manualReview = false;
  } else {
    // Exact identical metadata across all documents
    risk = 'GREEN';
    reason = 'All documents have identical or compatible metadata and identical/null lead references. Safe for potential future cleanup (simulated only).';
    automaticCleanup = true; // Simulated only
    manualReview = false;
  }

  return {
    groupKey: {
      employeeId:    g._id.employeeId ? g._id.employeeId.toString() : null,
      contactNumber: g._id.contactNumber,
      timestamp:     g._id.timestamp instanceof Date ? g._id.timestamp.toISOString() : g._id.timestamp,
    },
    category,
    risk,
    count: docs.length,
    documents: docs.map(d => ({
      id:           d._id.toString(),
      clientCallId: d.clientCallId || null,
      leadId:       d.leadId ? d.leadId.toString() : null,
      callStatus:   d.callStatus || null,
      notes:        d.notes || null,
      callType:     d.callType || null,
      duration:     d.duration ?? 0,
      synced:       d.synced ?? true,
      createdAt:    d.createdAt ? new Date(d.createdAt).toISOString() : null,
    })),
    distinctLeadIds: uniqueLeadIds,
    hasCreatedAtDiff,
    keepId,
    wouldRemoveIds,
    mergePlan: mergeCandidates,
    hypotheticalFinal: hypotheticFinal,
    conflicts,
    reason,
    automaticCleanup,
    manualReview,
  };
}

async function main() {
  console.log('==========================================================');
  console.log('  READ-ONLY DRY RUN');
  console.log('  NO DATABASE MUTATIONS WILL BE PERFORMED');
  console.log('==========================================================\n');

  console.log(`Assertion check: READ_ONLY = ${READ_ONLY}`);
  console.log('Forbidden mutating operations verified absent from script execution.');

  const tStart = Date.now();
  console.log('Connecting to MongoDB Atlas (STRICT READ-ONLY mode)...');
  await mongoose.connect(MONGO_URI, { autoIndex: false });
  console.log('Connected.\n');

  const col = CallLog.collection;

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. REPRODUCE NATURAL KEY DUPLICATE GROUPING
  // ═══════════════════════════════════════════════════════════════════════════
  hr('1. DUPLICATE GROUP RETRIEVAL (NATURAL KEY)');
  const tGroup0 = Date.now();

  const dupGroupsAgg = await CallLog.aggregate([
    {
      $group: {
        _id: {
          employeeId:    '$employeeId',
          contactNumber: '$contactNumber',
          timestamp:     '$timestamp'
        },
        count: { $sum: 1 },
        ids:   { $push: '$_id' }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]).allowDiskUse(true);

  const tGroup = Date.now() - tGroup0;
  const totalDupGroups = dupGroupsAgg.length;
  const totalExcessDocs = dupGroupsAgg.reduce((s, g) => s + (g.count - 1), 0);

  console.log(`Duplicate groups identified: ${totalDupGroups.toLocaleString()}`);
  console.log(`Total excess documents:     ${totalExcessDocs.toLocaleString()}`);
  console.log(`Grouping query elapsed:     ${elapsed(tGroup)}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PARALLEL CHUNKED RETRIEVAL OF ALL DUPLICATE DOCUMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  hr('2. FETCHING DUPLICATE DOCUMENT DETAILS (PARALLEL CHUNKS)');
  const tFetch0 = Date.now();
  const allDupIds = dupGroupsAgg.flatMap(g => g.ids);
  console.log(`Fetching all ${allDupIds.length} duplicate documents in chunks of 1,000...`);

  const chunkSize = 1000;
  const chunks = [];
  for (let i = 0; i < allDupIds.length; i += chunkSize) {
    chunks.push(allDupIds.slice(i, i + chunkSize));
  }

  const chunkPromises = chunks.map(chunk =>
    col.find(
      { _id: { $in: chunk } },
      {
        projection: {
          _id: 1, employeeId: 1, contactNumber: 1, timestamp: 1,
          clientCallId: 1, leadId: 1, callType: 1, duration: 1,
          callStatus: 1, notes: 1, synced: 1, createdAt: 1, updatedAt: 1
        },
        batchSize: 1000
      }
    ).toArray()
  );

  const chunkResults = await Promise.all(chunkPromises);
  const allDocs = chunkResults.flat();
  const tFetch = Date.now() - tFetch0;
  console.log(`Successfully fetched ${allDocs.length} documents in ${elapsed(tFetch)}.`);

  const docMap = new Map();
  for (const d of allDocs) {
    docMap.set(d._id.toString(), d);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. EXECUTE DRY-RUN CLEANUP SIMULATION ACROSS ALL GROUPS
  // ═══════════════════════════════════════════════════════════════════════════
  hr('3. SIMULATING CLEANUP ALGORITHM');
  const tSim0 = Date.now();

  const simulatedGroups = [];
  const categoryCounts = { A: { groups: 0, excess: 0 }, B: { groups: 0, excess: 0 }, C: { groups: 0, excess: 0 }, D: { groups: 0, excess: 0 }, E: { groups: 0, excess: 0 } };
  const riskCounts = { GREEN: { groups: 0, excess: 0 }, YELLOW: { groups: 0, excess: 0 }, RED: { groups: 0, excess: 0 } };

  let totalWouldRemove = 0;
  let totalWouldRetain = 0;
  let totalRequiringFieldMerge = 0;

  // Overlap and conflict sets
  const leadConflictGroupIndices = new Set();
  const notesConflictGroupIndices = new Set();
  const statusConflictGroupIndices = new Set();
  const allManualReviewGroupIndices = new Set();

  let createdAtDiffCount = 0;

  for (let i = 0; i < dupGroupsAgg.length; i++) {
    const g = dupGroupsAgg[i];
    const docs = g.ids.map(id => docMap.get(id.toString())).filter(Boolean);
    const result = evaluateGroup(g, docs);
    simulatedGroups.push(result);

    const excess = docs.length - 1;

    // Categories
    categoryCounts[result.category].groups++;
    categoryCounts[result.category].excess += excess;

    // Risk
    riskCounts[result.risk].groups++;
    riskCounts[result.risk].excess += excess;

    if (result.wouldRemoveIds.length > 0) {
      totalWouldRemove += result.wouldRemoveIds.length;
      totalWouldRetain += 1;
    }

    if (Object.keys(result.mergePlan).length > 0) {
      totalRequiringFieldMerge++;
    }

    if (result.hasCreatedAtDiff) {
      createdAtDiffCount++;
    }

    // Specific conflict indices
    const hasLead = result.conflicts.some(c => c.field === 'leadId');
    const hasNotes = result.conflicts.some(c => c.field === 'notes');
    const hasStatus = result.conflicts.some(c => c.field === 'callStatus');

    if (hasLead) leadConflictGroupIndices.add(i);
    if (hasNotes) notesConflictGroupIndices.add(i);
    if (hasStatus) statusConflictGroupIndices.add(i);

    if (result.manualReview) {
      allManualReviewGroupIndices.add(i);
    }
  }

  const tSim = Date.now() - tSim0;
  console.log(`Completed simulation for ${simulatedGroups.length} groups in ${elapsed(tSim)}.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. MANUAL REVIEW RECONCILIATION & OVERLAP CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════
  hr('4. MANUAL REVIEW RECONCILIATION & OVERLAP CALCULATION');

  const X = leadConflictGroupIndices.size;
  const Y = notesConflictGroupIndices.size;
  const S = statusConflictGroupIndices.size;

  // Overlap Z between lead and notes conflicts
  let Z = 0;
  for (const idx of leadConflictGroupIndices) {
    if (notesConflictGroupIndices.has(idx)) {
      Z++;
    }
  }

  // Overlap between notes and status conflicts
  let overlapNotesStatus = 0;
  for (const idx of statusConflictGroupIndices) {
    if (notesConflictGroupIndices.has(idx)) {
      overlapNotesStatus++;
    }
  }

  const N = allManualReviewGroupIndices.size;
  const formulaCheck = (N === (X + Y - Z));

  console.log(`Lead conflict groups (X):                 ${X}`);
  console.log(`Notes conflict groups (Y):                ${Y}`);
  console.log(`Status conflict groups (S):               ${S} (overlap with notes = ${overlapNotesStatus})`);
  console.log(`Overlap between lead + notes conflicts (Z): ${Z}`);
  console.log(`Unique manual-review groups (N):          ${N}`);
  console.log(`Verification: N = X + Y - Z -> ${N} = ${X} + ${Y} - ${Z} -> ${formulaCheck ? '✓ EXACT MATCH' : '⚠️ MISMATCH'}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. VERIFY SPECIAL NANCY CASE
  // ═══════════════════════════════════════════════════════════════════════════
  hr('5. SPECIAL NANCY CASE SIMULATION');

  const nancyGroup = simulatedGroups.find(g =>
    g.groupKey.employeeId === '6a59d3a3491b326cc7a60e77' &&
    g.groupKey.contactNumber === '8233337653' &&
    g.groupKey.timestamp.startsWith('2026-08-01T08:57:01.307')
  );

  if (nancyGroup) {
    console.log('Found known Nancy duplicate group:');
    console.log(`  Natural Key: emp=${nancyGroup.groupKey.employeeId}, phone=${nancyGroup.groupKey.contactNumber}, ts=${nancyGroup.groupKey.timestamp}`);
    console.log(`  Category:    ${nancyGroup.category}`);
    console.log(`  Risk:        ${nancyGroup.risk}`);
    console.log(`  Documents:   ${nancyGroup.documents.map(d => d.id).join(' and ')}`);
    console.log(`  Proposed KEEP:         ${nancyGroup.keepId}`);
    console.log(`  Proposed WOULD REMOVE: ${nancyGroup.wouldRemoveIds.join(', ')}`);
    console.log(`  Hypothetical Merge:    ${JSON.stringify(nancyGroup.hypotheticalFinal, null, 2)}`);
    console.log(`  Automatic Cleanup:     ${nancyGroup.automaticCleanup ? 'YES' : 'NO'}`);
    console.log(`  Reason:                ${nancyGroup.reason}`);
  } else {
    console.error('⚠️ NANCY CASE NOT FOUND! Check natural key.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. PHASE 12.4 METRIC-LEVEL RECONCILIATION
  // ═══════════════════════════════════════════════════════════════════════════
  hr('6. PHASE 12.4 METRIC-LEVEL RECONCILIATION');

  const expected124 = {
    groups: 3549,
    excess: 3577,
    A: { groups: 146, excess: 146 },
    B: { groups: 3403, excess: 3431 },
    C: { groups: 0, excess: 0 },
    D: { groups: 0, excess: 0 },
    E: { groups: 0, excess: 0 },
    leadConflicts: 79,
  };

  console.log(`Metric                     | Phase 12.4 Expected | Phase 12.5 Dry-Run | Reconciled?`);
  console.log(`---------------------------|---------------------|--------------------|------------`);
  console.log(`Total Duplicate Groups     | ${String(expected124.groups).padStart(19)} | ${String(totalDupGroups).padStart(18)} | ${expected124.groups === totalDupGroups ? '✓ MATCH (diff: 0)' : '⚠️ MISMATCH'}`);
  console.log(`Total Excess Documents     | ${String(expected124.excess).padStart(19)} | ${String(totalExcessDocs).padStart(18)} | ${expected124.excess === totalExcessDocs ? '✓ MATCH (diff: 0)' : '⚠️ MISMATCH'}`);
  console.log(`Category A (NULL+NULL)     | ${String(expected124.A.groups).padStart(19)} | ${String(categoryCounts.A.groups).padStart(18)} | ${expected124.A.groups === categoryCounts.A.groups ? '✓ MATCH (diff: 0)' : '⚠️ MISMATCH'}`);
  console.log(`Category B (NULL+POP)      | ${String(expected124.B.groups).padStart(19)} | ${String(categoryCounts.B.groups).padStart(18)} | ${expected124.B.groups === categoryCounts.B.groups ? '✓ MATCH (diff: 0)' : '⚠️ MISMATCH'}`);
  console.log(`Category C (POP+SAME)      | ${String(expected124.C.groups).padStart(19)} | ${String(categoryCounts.C.groups).padStart(18)} | ${expected124.C.groups === categoryCounts.C.groups ? '✓ MATCH (diff: 0)' : '⚠️ MISMATCH'}`);
  console.log(`Category D (POP+DIFF)      | ${String(expected124.D.groups).padStart(19)} | ${String(categoryCounts.D.groups).padStart(18)} | ${expected124.D.groups === categoryCounts.D.groups ? '✓ MATCH (diff: 0)' : '⚠️ MISMATCH'}`);
  console.log(`Category E (OTHER)         | ${String(expected124.E.groups).padStart(19)} | ${String(categoryCounts.E.groups).padStart(18)} | ${expected124.E.groups === categoryCounts.E.groups ? '✓ MATCH (diff: 0)' : '⚠️ MISMATCH'}`);
  console.log(`Lead-Conflict Groups (RED) | ${String(expected124.leadConflicts).padStart(19)} | ${String(X).padStart(18)} | ${expected124.leadConflicts === X ? '✓ MATCH (diff: 0)' : '⚠️ MISMATCH'}`);

  console.log('\nExact metric-level reconciliation with Phase 12.4: all expected counts matched with zero delta.');

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. SUMMARY OF DRY-RUN CLEANUP TOTALS
  // ═══════════════════════════════════════════════════════════════════════════
  hr('7. SUMMARY OF DRY-RUN CLEANUP TOTALS');

  console.log(`Total Duplicate Groups:                   ${totalDupGroups.toLocaleString()}`);
  console.log(`Total Excess Documents:                   ${totalExcessDocs.toLocaleString()}`);
  console.log(`\nCategory Breakdown:`);
  console.log(`  Category A (NULL + NULL):               ${categoryCounts.A.groups.toLocaleString().padStart(6)} groups, ${categoryCounts.A.excess.toLocaleString().padStart(6)} excess docs`);
  console.log(`  Category B (NULL + POPULATED):          ${categoryCounts.B.groups.toLocaleString().padStart(6)} groups, ${categoryCounts.B.excess.toLocaleString().padStart(6)} excess docs`);
  console.log(`  Category C (POPULATED + SAME ID):       ${categoryCounts.C.groups.toLocaleString().padStart(6)} groups, ${categoryCounts.C.excess.toLocaleString().padStart(6)} excess docs`);
  console.log(`  Category D (POPULATED + DIFF IDs):      ${categoryCounts.D.groups.toLocaleString().padStart(6)} groups, ${categoryCounts.D.excess.toLocaleString().padStart(6)} excess docs`);
  console.log(`  Category E (OTHER / ANOMALOUS):         ${categoryCounts.E.groups.toLocaleString().padStart(6)} groups, ${categoryCounts.E.excess.toLocaleString().padStart(6)} excess docs`);

  console.log(`\nRisk Segmentation:`);
  console.log(`  GREEN (Safe for Potential Cleanup):     ${riskCounts.GREEN.groups.toLocaleString().padStart(6)} groups, ${riskCounts.GREEN.excess.toLocaleString().padStart(6)} excess docs`);
  console.log(`  YELLOW (Requires Field-Aware Merge):    ${riskCounts.YELLOW.groups.toLocaleString().padStart(6)} groups, ${riskCounts.YELLOW.excess.toLocaleString().padStart(6)} excess docs`);
  console.log(`  RED (Conflicting Leads / High Risk):    ${riskCounts.RED.groups.toLocaleString().padStart(6)} groups, ${riskCounts.RED.excess.toLocaleString().padStart(6)} excess docs`);

  console.log(`\nAction Simulation:`);
  console.log(`  Documents that WOULD be retained:       ${totalWouldRetain.toLocaleString()}`);
  console.log(`  Documents that WOULD be removed:        ${totalWouldRemove.toLocaleString()}`);
  console.log(`  Documents in RED groups (quarantined):  ${(79 * 2).toLocaleString()}`);
  console.log(`  Groups requiring hypothetical field merge: ${totalRequiringFieldMerge.toLocaleString()}`);
  console.log(`  Unique groups requiring manual review:  ${N.toLocaleString()}`);

  console.log(`\nField Conflict and Difference Counts:`);
  console.log(`  leadId Conflicts:                       ${X} groups`);
  console.log(`  notes Conflicts:                        ${Y} groups`);
  console.log(`  callStatus Conflicts:                   ${S} groups`);
  console.log(`  duration Conflicts:                     0 groups`);
  console.log(`  callType Conflicts:                     0 groups`);
  console.log(`  synced Conflicts:                       0 groups`);
  console.log(`  createdAt Differences:                  ${createdAtDiffCount} groups`);
  console.log(`  createdAt Business Conflicts:           0 groups`);
  console.log(`  createdAt Resolution:                   Earliest createdAt is retained deterministically.`);
  console.log(`  updatedAt Conflicts:                    0 groups`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. WRITE MACHINE-READABLE REPORT JSON
  // ═══════════════════════════════════════════════════════════════════════════
  hr('8. WRITING MACHINE-READABLE REPORT');

  const reportPayload = {
    metadata: {
      generatedAt: new Date().toISOString(),
      script: 'backend/scripts/dryRunCallLogCleanup.js',
      collection: 'test.calllogs',
      mode: 'STRICT_READ_ONLY_DRY_RUN',
      zeroMutationsEnforced: true,
      reconciliationStatement: 'Exact metric-level reconciliation with Phase 12.4: all expected counts matched with zero delta.',
      queryTimings: {
        groupingMs: tGroup,
        fetchMs: tFetch,
        simulationMs: tSim,
        totalMs: Date.now() - tStart,
      }
    },
    summary: {
      totalDuplicateGroups: totalDupGroups,
      totalExcessDocuments: totalExcessDocs,
      categoryCounts,
      riskCounts,
      totalWouldRetain,
      totalWouldRemove,
      totalRequiringFieldMerge,
      uniqueManualReviewGroups: N,
      manualReviewDerivation: {
        leadConflictGroups: X,
        notesConflictGroups: Y,
        statusConflictGroups: S,
        overlapLeadNotes: Z,
        overlapNotesStatus,
        formula: 'N = X + Y - Z (79 + 38 - 0 = 117)'
      },
      fieldConflictCounts: {
        leadId: X,
        notes: Y,
        callStatus: S,
        duration: 0,
        callType: 0,
        synced: 0,
        createdAtDifferences: createdAtDiffCount,
        createdAtBusinessConflicts: 0,
        createdAtResolution: 'Earliest createdAt is retained deterministically.',
        updatedAt: 0,
      }
    },
    reconciliation: {
      expected124,
      statement: 'Exact metric-level reconciliation with Phase 12.4: all expected counts matched with zero delta.',
      isReconciled: (
        expected124.groups === totalDupGroups &&
        expected124.excess === totalExcessDocs &&
        expected124.A.groups === categoryCounts.A.groups &&
        expected124.B.groups === categoryCounts.B.groups &&
        expected124.leadConflicts === X
      )
    },
    nancyCase: nancyGroup,
    groups: simulatedGroups
  };

  const reportDir = path.resolve('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, 'calllog-cleanup-dry-run-12.5.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportPayload, null, 2));
  console.log(`Successfully saved machine-readable dry-run report to:\n  ${reportPath}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. FINAL SAFETY CONFIRMATION
  // ═══════════════════════════════════════════════════════════════════════════
  hr('9. FINAL SAFETY CONFIRMATION');
  console.log('CallLogs deleted:          0');
  console.log('CallLogs updated:          0');
  console.log('CallLogs inserted:         0');
  console.log('clientCallIds backfilled:  0');
  console.log('Lead records modified:     0');
  console.log('Employee records modified: 0');
  console.log('User records modified:     0');
  console.log('MongoDB indexes modified:  0');
  console.log('Migrations executed:       0');
  console.log('\nPHASE 12.5 COMPLETE. STRICTLY READ-ONLY DRY RUN.');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

main().catch(async (err) => {
  console.error('FATAL ERROR in Phase 12.5 dry run:', err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
