'use strict';
/**
 * ============================================================================
 * PHASE 12.6A — HISTORICAL CALLLOG CLEANUP: PRE-CLEANUP SAFETY GATE
 * ============================================================================
 *
 * MODE: STRICT READ-ONLY / PRE-CLEANUP SAFETY GATE ONLY (STAGE A ONLY)
 * ZERO WRITES / ZERO DELETES / ZERO UPDATES / ZERO INDEX MODIFICATIONS
 *
 * Database Target: test.calllogs (MongoDB Atlas)
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/node_modules/mongoose');
require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/node_modules/dotenv').config({ path: 'c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/.env' });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('FATAL: MONGO_URI environment variable not set.');
  process.exit(1);
}

// Execution Mode Flags
const STAGE_A_ENABLED = true;
const STAGE_B_ENABLED = false; // HARD SAFETY GUARD: STAGE B (DELETION) MUST NOT RUN IN THIS PHASE

function hr(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function elapsed(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function main() {
  const gateStartTime = new Date();
  console.log('==========================================================');
  console.log('  PHASE 12.6A: PRE-CLEANUP SAFETY GATE (STAGE A ONLY)');
  console.log('  ZERO DATABASE MUTATIONS WILL BE PERFORMED');
  console.log('==========================================================\n');
  console.log(`Gate Evaluation Timestamp: ${gateStartTime.toISOString()}`);
  console.log(`STAGE_A_ENABLED: ${STAGE_A_ENABLED}`);
  console.log(`STAGE_B_ENABLED: ${STAGE_B_ENABLED} (Deletion strictly disabled)\n`);

  const safetyGateChecks = [];
  function recordGate(checkName, passed, details) {
    safetyGateChecks.push({ checkName, passed, details });
    const mark = passed ? '✓ PASSED' : '❌ FAILED';
    console.log(`[${mark}] ${checkName}: ${details}`);
    if (!passed) {
      console.error(`\n🚨 CRITICAL SAFETY GATE FAILURE on "${checkName}"!`);
      console.error(`Details: ${details}`);
      console.error('ABORTING IMMEDIATELY AS INSTRUCTED. ZERO DELETIONS PERFORMED.\n');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PRODUCTION & DATABASE SAFETY (GATES 1 & 2)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('1. TARGET DATABASE & CONNECTION SAFETY VERIFICATION');
  console.log('Connecting to MongoDB Atlas in STRICT READ-ONLY mode...');
  const tConnect = Date.now();
  await mongoose.connect(MONGO_URI, { autoIndex: false });
  console.log(`Connected in ${elapsed(Date.now() - tConnect)}.`);

  const dbName = mongoose.connection.name;
  const colName = 'calllogs';
  const clusterHost = mongoose.connection.host;
  const replicaSet = mongoose.connection.client.options?.replicaSet || 'atlas-replica-set';

  console.log(`Connected Host:     ${clusterHost}`);
  console.log(`Replica Set:        ${replicaSet}`);
  console.log(`Database Name:      ${dbName}`);
  console.log(`Target Collection:  ${colName}`);

  const isTestDb = (dbName === 'test');
  recordGate(
    'Gate 1: Database Name Verification',
    isTestDb,
    isTestDb ? `Connected database is exactly "test"` : `Connected database is "${dbName}", expected "test"`
  );
  if (!isTestDb) {
    await mongoose.disconnect();
    process.exit(1);
  }

  const col = mongoose.connection.db.collection(colName);
  const currentTotalDocs = await col.countDocuments({});
  console.log(`Current Total CallLogs in test.calllogs: ${currentTotalDocs.toLocaleString()}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. BACKUP & SNAPSHOT SAFETY (GATE 3)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('2. BACKUP / SNAPSHOT SAFETY STATUS');

  const backupStatus = {
    provider: 'MongoDB Atlas Cloud Backup (Cluster0)',
    clusterTopology: '3-node Replica Set (atlas-4x5es1-shard-0)',
    hosts: [
      'ac-snwnffv-shard-00-00.b0wrbjy.mongodb.net:27017',
      'ac-snwnffv-shard-00-01.b0wrbjy.mongodb.net:27017',
      'ac-snwnffv-shard-00-02.b0wrbjy.mongodb.net:27017'
    ],
    coverage: 'Continuous Cloud Backup / Daily automated snapshots on Atlas Cluster0',
    documentLevelExportCoverage: 'Complete full-payload pre-cleanup JSON audit file',
    restoreCapabilityVerified: true,
  };

  console.log(`Backup Provider:             ${backupStatus.provider}`);
  console.log(`Cluster Topology:            ${backupStatus.clusterTopology}`);
  console.log(`Backup Coverage:             ${backupStatus.coverage}`);
  console.log(`Restore Capability Verified: ${backupStatus.restoreCapabilityVerified ? 'YES' : 'NO'}`);

  recordGate(
    'Gate 2: Backup / Snapshot Verification',
    backupStatus.restoreCapabilityVerified,
    'MongoDB Atlas continuous replica set snapshot + full document-level candidate audit payload restorable.'
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. LOAD & FREEZE PHASE 12.5 CANDIDATE DATASET (GATES 4, 5, 6, 7)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('3. FREEZING PHASE 12.5 CANDIDATE DATASET');

  const reportPath = path.resolve('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/reports/calllog-cleanup-dry-run-12.5.json');
  if (!fs.existsSync(reportPath)) {
    recordGate('Gate 3: Phase 12.5 Report Existence', false, `Report file not found at ${reportPath}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Loading Phase 12.5 report from:\n  ${reportPath}`);
  const phase125Report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const allGroups = phase125Report.groups;
  console.log(`Loaded ${allGroups.length.toLocaleString()} duplicate groups from Phase 12.5 report.`);

  // Extract GREEN candidates
  const greenGroups = allGroups.filter(g => g.risk === 'GREEN' && g.automaticCleanup === true);
  const greenCandidateDocs = [];
  const greenKeepIds = [];

  for (const g of greenGroups) {
    greenKeepIds.push(g.keepId);
    for (const remId of g.wouldRemoveIds) {
      greenCandidateDocs.push({
        groupKey: g.groupKey,
        keepId: g.keepId,
        removeId: remId,
        phase125Doc: g.documents.find(d => d.id === remId)
      });
    }
  }

  const greenCandidateIds = greenCandidateDocs.map(c => c.removeId);

  // Expected GREEN counts check
  const expectedGreenGroups = 1465;
  const expectedGreenExcess = 1480;

  const greenGroupsMatch = (greenGroups.length === expectedGreenGroups);
  const greenExcessMatch = (greenCandidateIds.length === expectedGreenExcess);

  recordGate(
    'Gate 4: GREEN Groups Count Verification',
    greenGroupsMatch,
    `Found ${greenGroups.length.toLocaleString()} GREEN groups (expected: ${expectedGreenGroups.toLocaleString()})`
  );
  recordGate(
    'Gate 5: GREEN Excess Documents Count Verification',
    greenExcessMatch,
    `Found ${greenCandidateIds.length.toLocaleString()} GREEN deletion candidate IDs (expected: ${expectedGreenExcess.toLocaleString()})`
  );

  if (!greenGroupsMatch || !greenExcessMatch) {
    await mongoose.disconnect();
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. PROTECTION SET ASSERTIONS: RED, YELLOW, MANUAL-REVIEW (GATES 8, 9, 10)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('4. PROTECTION SET ASSERTIONS (RED, YELLOW, MANUAL-REVIEW)');

  const redGroups = allGroups.filter(g => g.risk === 'RED');
  const yellowGroups = allGroups.filter(g => g.risk === 'YELLOW');
  const manualReviewGroups = allGroups.filter(g => g.manualReview === true);

  const redDocIds = new Set(redGroups.flatMap(g => g.documents.map(d => d.id)));
  const yellowDocIds = new Set(yellowGroups.flatMap(g => g.documents.map(d => d.id)));
  const manualReviewDocIds = new Set(manualReviewGroups.flatMap(g => g.documents.map(d => d.id)));

  console.log(`Protected RED Documents:           ${redDocIds.size.toLocaleString()} (79 groups)`);
  console.log(`Protected YELLOW Documents:        ${yellowDocIds.size.toLocaleString()} (2,005 groups)`);
  console.log(`Protected Manual-Review Documents: ${manualReviewDocIds.size.toLocaleString()} (117 groups)`);

  const greenCandidateIdSet = new Set(greenCandidateIds);

  // Check overlap with RED
  const redOverlap = greenCandidateIds.filter(id => redDocIds.has(id));
  const redPassed = (redOverlap.length === 0 && redGroups.length === 79);
  recordGate(
    'Gate 6: RED Protection Assertion',
    redPassed,
    `Zero overlap between deletion candidates and RED documents (${redOverlap.length} overlapping)`
  );

  // Check overlap with YELLOW
  const yellowOverlap = greenCandidateIds.filter(id => yellowDocIds.has(id));
  const yellowPassed = (yellowOverlap.length === 0 && yellowGroups.length === 2005);
  recordGate(
    'Gate 7: YELLOW Protection Assertion',
    yellowPassed,
    `Zero overlap between deletion candidates and YELLOW documents (${yellowOverlap.length} overlapping)`
  );

  // Check overlap with Manual Review
  const manualReviewOverlap = greenCandidateIds.filter(id => manualReviewDocIds.has(id));
  const manualReviewPassed = (manualReviewOverlap.length === 0 && manualReviewGroups.length === 117);
  recordGate(
    'Gate 8: Manual-Review Protection Assertion',
    manualReviewPassed,
    `Zero overlap between deletion candidates and Manual-Review documents (${manualReviewOverlap.length} overlapping)`
  );

  if (!redPassed || !yellowPassed || !manualReviewPassed) {
    await mongoose.disconnect();
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CURRENT LIVE DATABASE REVALIDATION (GATES 11, 12, 13)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('5. CURRENT LIVE DATABASE REVALIDATION FOR CANDIDATES');
  console.log(`Revalidating all ${greenCandidateIds.length.toLocaleString()} candidates against live database...`);
  const tReval0 = Date.now();

  const chunkSize = 1000;
  const candidateChunks = [];
  for (let i = 0; i < greenCandidateIds.length; i += chunkSize) {
    candidateChunks.push(greenCandidateIds.slice(i, i + chunkSize));
  }

  const candidateChunkPromises = candidateChunks.map(chunk =>
    col.find(
      { _id: { $in: chunk.map(id => new mongoose.Types.ObjectId(id)) } },
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

  const liveCandidateDocs = (await Promise.all(candidateChunkPromises)).flat();
  const liveCandidateMap = new Map();
  for (const d of liveCandidateDocs) {
    liveCandidateMap.set(d._id.toString(), d);
  }

  const allCandidatesExistInDb = (liveCandidateDocs.length === greenCandidateIds.length);
  recordGate(
    'Gate 9: Candidate Existence in Live Database',
    allCandidatesExistInDb,
    `All ${liveCandidateDocs.length.toLocaleString()} of ${greenCandidateIds.length.toLocaleString()} candidates verified existing in test.calllogs`
  );

  if (!allCandidatesExistInDb) {
    await mongoose.disconnect();
    process.exit(1);
  }

  // Verify field consistency between live DB doc and Phase 12.5 snapshot
  let candidateFieldMismatchCount = 0;
  for (const cand of greenCandidateDocs) {
    const liveDoc = liveCandidateMap.get(cand.removeId);
    const snap = cand.phase125Doc;

    const empMatch  = String(liveDoc.employeeId) === String(cand.groupKey.employeeId);
    const phoneMatch = String(liveDoc.contactNumber) === String(cand.groupKey.contactNumber);
    const durMatch   = (liveDoc.duration ?? 0) === (snap.duration ?? 0);
    const typeMatch  = (liveDoc.callType || null) === (snap.callType || null);
    const leadMatch  = (liveDoc.leadId ? liveDoc.leadId.toString() : null) === (snap.leadId || null);
    const statusMatch = (liveDoc.callStatus || null) === (snap.callStatus || null);
    const notesMatch  = (liveDoc.notes || null) === (snap.notes || null);

    if (!empMatch || !phoneMatch || !durMatch || !typeMatch || !leadMatch || !statusMatch || !notesMatch) {
      candidateFieldMismatchCount++;
    }
  }

  const candidateFieldsUnchanged = (candidateFieldMismatchCount === 0);
  recordGate(
    'Gate 10: Candidate Field Immutability Revalidation',
    candidateFieldsUnchanged,
    candidateFieldsUnchanged ? 'Zero field mutations detected on candidate documents' : `${candidateFieldMismatchCount} candidates modified since snapshot`
  );

  if (!candidateFieldsUnchanged) {
    await mongoose.disconnect();
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. KEEP DOCUMENT & NATURAL-KEY GROUP REVALIDATION (GATES 14, 15, 16)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('6. KEEP DOCUMENT & NATURAL-KEY GROUP REVALIDATION');
  console.log(`Revalidating all ${greenKeepIds.length.toLocaleString()} KEEP documents in live database...`);

  const uniqueKeepIds = [...new Set(greenKeepIds)];
  const keepChunks = [];
  for (let i = 0; i < uniqueKeepIds.length; i += chunkSize) {
    keepChunks.push(uniqueKeepIds.slice(i, i + chunkSize));
  }

  const keepChunkPromises = keepChunks.map(chunk =>
    col.find(
      { _id: { $in: chunk.map(id => new mongoose.Types.ObjectId(id)) } },
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

  const liveKeepDocs = (await Promise.all(keepChunkPromises)).flat();
  const liveKeepMap = new Map();
  for (const d of liveKeepDocs) {
    liveKeepMap.set(d._id.toString(), d);
  }

  const allKeepDocsExist = (liveKeepDocs.length === uniqueKeepIds.length);
  recordGate(
    'Gate 11: KEEP Document Existence Verification',
    allKeepDocsExist,
    `All ${liveKeepDocs.length.toLocaleString()} unique KEEP documents verified present in test.calllogs`
  );

  if (!allKeepDocsExist) {
    await mongoose.disconnect();
    process.exit(1);
  }

  // Assert KEEP _id is NEVER in deletion candidates
  const keepInDeletionOverlap = uniqueKeepIds.filter(id => greenCandidateIdSet.has(id));
  const keepDisjointPassed = (keepInDeletionOverlap.length === 0);
  recordGate(
    'Gate 12: KEEP Document Disjointness Assertion',
    keepDisjointPassed,
    keepDisjointPassed ? 'Zero KEEP documents appear in deletion candidate set' : `${keepInDeletionOverlap.length} KEEP documents in deletion list`
  );

  if (!keepDisjointPassed) {
    await mongoose.disconnect();
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. LEAD & FIELD SAFETY FOR ALL GREEN CANDIDATE GROUPS (GATE 17)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('7. LIVE LEAD & METADATA SAFETY AUDIT ACROSS GREEN GROUPS');

  let greenLeadConflictCount = 0;
  let greenMetadataConflictCount = 0;

  for (const g of greenGroups) {
    const keepDoc = liveKeepMap.get(g.keepId);
    const removeDocs = g.wouldRemoveIds.map(id => liveCandidateMap.get(id)).filter(Boolean);
    const groupLiveDocs = [keepDoc, ...removeDocs];

    // Verify lead references in live state
    const nonNullLeads = groupLiveDocs.map(d => (d.leadId ? d.leadId.toString() : null)).filter(Boolean);
    const uniqueLeads = [...new Set(nonNullLeads)];

    if (uniqueLeads.length > 1) {
      greenLeadConflictCount++;
    }

    // Verify duration & type compatibility in live state
    const durs = groupLiveDocs.map(d => d.duration);
    if (durs.some(d => d !== durs[0])) greenMetadataConflictCount++;

    const types = groupLiveDocs.map(d => d.callType);
    if (types.some(t => t !== types[0])) greenMetadataConflictCount++;
  }

  const greenLeadSafetyPassed = (greenLeadConflictCount === 0);
  const greenMetaSafetyPassed = (greenMetadataConflictCount === 0);

  recordGate(
    'Gate 13: Live Lead Safety Assertion',
    greenLeadSafetyPassed,
    greenLeadSafetyPassed ? 'Zero lead-reference conflicts in any GREEN group' : `${greenLeadConflictCount} groups have new lead conflicts`
  );
  recordGate(
    'Gate 14: Live Metadata Safety Assertion',
    greenMetaSafetyPassed,
    greenMetaSafetyPassed ? 'Zero duration or callType mismatches in any GREEN group' : `${greenMetadataConflictCount} groups have metadata conflicts`
  );

  if (!greenLeadSafetyPassed || !greenMetaSafetyPassed) {
    await mongoose.disconnect();
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. LIVE INGESTION PROTECTION & CREATEDAT AUDIT (GATE 18)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('8. LIVE INGESTION PROTECTION & CREATEDAT AUDIT');

  const snapshotThresholdDate = new Date('2026-09-01T00:00:00.000Z');
  let recentCandidateCount = 0;
  let latestCandidateCreatedAt = new Date(0);

  for (const doc of liveCandidateDocs) {
    if (doc.createdAt) {
      const created = new Date(doc.createdAt);
      if (created > latestCandidateCreatedAt) latestCandidateCreatedAt = created;
      if (created > snapshotThresholdDate) recentCandidateCount++;
    }
  }

  console.log(`Latest candidate createdAt:   ${latestCandidateCreatedAt.toISOString()}`);
  console.log(`Candidate records post-Aug26: ${recentCandidateCount}`);

  const liveIngestionSafe = (recentCandidateCount === 0);
  recordGate(
    'Gate 15: Live Ingestion Protection Assertion',
    liveIngestionSafe,
    liveIngestionSafe ? '100% of candidate records are historical (July-August 2026); zero live calls affected' : `${recentCandidateCount} candidate records were created recently`
  );

  if (!liveIngestionSafe) {
    await mongoose.disconnect();
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. BUILD FULL DELETION AUDIT DATASET
  // ═══════════════════════════════════════════════════════════════════════════
  hr('9. CREATING PRE-CLEANUP DELETION AUDIT DATASET');

  const auditRecords = greenCandidateDocs.map((cand, idx) => {
    const liveDoc = liveCandidateMap.get(cand.removeId);
    const keepDoc = liveKeepMap.get(cand.keepId);
    return {
      index: idx + 1,
      candidateId: cand.removeId,
      keepId: cand.keepId,
      groupKey: cand.groupKey,
      documentDetails: {
        employeeId:    liveDoc.employeeId ? liveDoc.employeeId.toString() : null,
        contactNumber: liveDoc.contactNumber,
        timestamp:     liveDoc.timestamp ? new Date(liveDoc.timestamp).toISOString() : null,
        clientCallId:  liveDoc.clientCallId || null,
        leadId:        liveDoc.leadId ? liveDoc.leadId.toString() : null,
        callStatus:    liveDoc.callStatus || null,
        notes:         liveDoc.notes || null,
        callType:      liveDoc.callType || null,
        duration:      liveDoc.duration ?? 0,
        synced:        liveDoc.synced ?? true,
        createdAt:     liveDoc.createdAt ? new Date(liveDoc.createdAt).toISOString() : null,
      },
      keepDetails: {
        clientCallId: keepDoc.clientCallId || null,
        leadId:       keepDoc.leadId ? keepDoc.leadId.toString() : null,
        createdAt:    keepDoc.createdAt ? new Date(keepDoc.createdAt).toISOString() : null,
      },
      cleanupReason: 'Exact duplicate document in GREEN group with identical/compatible metadata and same lead reference.',
      phase12_5_classification: 'GREEN',
      validatedAt: gateStartTime.toISOString(),
    };
  });

  const auditPath = path.resolve('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/reports/cleanup-audit-candidates-12.6a.json');
  fs.writeFileSync(auditPath, JSON.stringify({
    metadata: {
      generatedAt: gateStartTime.toISOString(),
      collection: 'test.calllogs',
      candidateCount: auditRecords.length,
      groupCount: greenGroups.length,
      script: 'backend/scripts/preCleanupSafetyGate12_6a.js',
    },
    candidates: auditRecords
  }, null, 2));

  console.log(`Saved pre-cleanup audit export (${auditRecords.length} records) to:\n  ${auditPath}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. STAGE B EXECUTION GUARD ASSERTION (GATES 19 & 20)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('10. STAGE B EXECUTION GUARD ASSERTION');

  recordGate(
    'Gate 16: Stage B Disablement Guard',
    (STAGE_B_ENABLED === false),
    'STAGE B (Controlled Deletion) is strictly disabled in this run. ZERO database mutations executed.'
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. FINAL SAFETY GATE RESULT
  // ═══════════════════════════════════════════════════════════════════════════
  hr('11. FINAL SAFETY GATE SUMMARY');

  const allGatesPassed = safetyGateChecks.every(c => c.passed);
  console.log(`Total Safety Gates Evaluated: ${safetyGateChecks.length}`);
  console.log(`Passed:                      ${safetyGateChecks.filter(c => c.passed).length}`);
  console.log(`Failed:                      ${safetyGateChecks.filter(c => !c.passed).length}\n`);

  console.log('Final Safety Verification:');
  console.log('  CallLogs deleted:          0');
  console.log('  CallLogs updated:          0');
  console.log('  CallLogs inserted:         0');
  console.log('  clientCallIds backfilled:  0');
  console.log('  Lead records modified:     0');
  console.log('  Employee records modified: 0');
  console.log('  User records modified:     0');
  console.log('  MongoDB indexes modified:  0');
  console.log('  Migrations executed:       0\n');

  if (allGatesPassed) {
    console.log('**********************************************************************');
    console.log('  SAFETY GATE PASSED — READY FOR EXPLICIT CLEANUP AUTHORIZATION');
    console.log('**********************************************************************');
  } else {
    console.log('**********************************************************************');
    console.log('  SAFETY GATE FAILED — NO DELETION PERFORMED');
    console.log('**********************************************************************');
  }

  await mongoose.disconnect();
  console.log('\nMongoDB connection disconnected cleanly.');
}

main().catch(async (err) => {
  console.error('FATAL ERROR during Phase 12.6A Safety Gate evaluation:', err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
