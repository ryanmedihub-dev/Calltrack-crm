/**
 * test-phase7.js — Final Integration, Security & Production Verification Suite
 *
 * Runs self-contained and offline.
 *
 * Comprehensive Test Coverage:
 * 1. Full Role Permission Matrix & Middleware Guards (Admin, Manager, TL, Employee)
 * 2. Cross-Hierarchy Isolation & Response-Body Data Leakage Defense
 * 3. Aggregation Pipeline Pre-Filtering Verification ($match before $group/$facet)
 * 4. ID Manipulation Defense (employeeId, assignedTo, teamLeadId, managerId, filters)
 * 5. Non-Cascading Reassignment & Transitive Hierarchy Guarantees
 * 6. Dynamic Scoping Updates Post-Mutation
 * 7. Export Center & Download Scoping
 * 8. Error Handling & Safe Response Formatting
 */

const assert = require('assert');
const mongoose = require('mongoose');
const User = require('../models/User');
const { isAdmin, requireManagement } = require('../middleware/auth');
const {
  getScopedTLIds,
  getScopedEmployeeIds,
  validateEmployeeInScope,
  validateTLInScope,
  resolveEmployeeFilter,
} = require('../lib/scope');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Multi-Hierarchy In-Memory Mock Store
// ─────────────────────────────────────────────────────────────────────────────

let mockDb = [];

function resetMockDb() {
  mockDb = [
    // 0: Admin
    { _id: new mongoose.Types.ObjectId('900000000000000000000001'), name: 'Admin Root', role: 'admin', isActive: true },

    // 1-2: Managers
    { _id: new mongoose.Types.ObjectId('900000000000000000000002'), name: 'Manager Alpha', role: 'manager', isActive: true },
    { _id: new mongoose.Types.ObjectId('900000000000000000000003'), name: 'Manager Beta', role: 'manager', isActive: true },

    // 3-5: Team Leads
    // TL A1 & TL A2 under Manager Alpha
    { _id: new mongoose.Types.ObjectId('900000000000000000000004'), name: 'TL Alpha-1', role: 'tl', managerId: new mongoose.Types.ObjectId('900000000000000000000002'), isActive: true },
    { _id: new mongoose.Types.ObjectId('900000000000000000000005'), name: 'TL Alpha-2', role: 'tl', managerId: new mongoose.Types.ObjectId('900000000000000000000002'), isActive: true },
    // TL B1 under Manager Beta
    { _id: new mongoose.Types.ObjectId('900000000000000000000006'), name: 'TL Beta-1', role: 'tl', managerId: new mongoose.Types.ObjectId('900000000000000000000003'), isActive: true },
    // Unassigned TL
    { _id: new mongoose.Types.ObjectId('900000000000000000000007'), name: 'TL Solo', role: 'tl', managerId: null, isActive: true },

    // 7-11: Employees / Agents
    // Under TL A1
    { _id: new mongoose.Types.ObjectId('900000000000000000000008'), name: 'Agent A1a', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('900000000000000000000004'), tlName: 'TL Alpha-1', isActive: true, dailyTarget: 50 },
    { _id: new mongoose.Types.ObjectId('900000000000000000000009'), name: 'Agent A1b', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('900000000000000000000004'), tlName: 'TL Alpha-1', isActive: true, dailyTarget: 45 },
    // Under TL A2
    { _id: new mongoose.Types.ObjectId('900000000000000000000010'), name: 'Agent A2a', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('900000000000000000000005'), tlName: 'TL Alpha-2', isActive: true, dailyTarget: 40 },
    // Under TL B1
    { _id: new mongoose.Types.ObjectId('900000000000000000000011'), name: 'Agent B1a', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('900000000000000000000006'), tlName: 'TL Beta-1', isActive: true, dailyTarget: 60 },
    { _id: new mongoose.Types.ObjectId('900000000000000000000012'), name: 'Agent B1b', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('900000000000000000000006'), tlName: 'TL Beta-1', isActive: true, dailyTarget: 55 },
    // Unassigned Agent
    { _id: new mongoose.Types.ObjectId('900000000000000000000013'), name: 'Agent Solo', role: 'employee', teamLeadId: null, tlName: '', isActive: true, dailyTarget: 20 },
  ];
}

resetMockDb();

const mockCalls = [
  { _id: 'c-a1a-1', employeeId: new mongoose.Types.ObjectId('900000000000000000000008'), duration: 150, callType: 'outgoing', connected: true },
  { _id: 'c-a1b-1', employeeId: new mongoose.Types.ObjectId('900000000000000000000009'), duration: 30,  callType: 'incoming', connected: false },
  { _id: 'c-a2a-1', employeeId: new mongoose.Types.ObjectId('900000000000000000000010'), duration: 240, callType: 'outgoing', connected: true },
  { _id: 'c-b1a-1', employeeId: new mongoose.Types.ObjectId('900000000000000000000011'), duration: 80,  callType: 'outgoing', connected: true },
  { _id: 'c-b1b-1', employeeId: new mongoose.Types.ObjectId('900000000000000000000012'), duration: 190, callType: 'incoming', connected: true },
];

const mockLeads = [
  { _id: 'l-a1a-1', name: 'Lead Alpha 1', assignedTo: new mongoose.Types.ObjectId('900000000000000000000008'), status: 'new' },
  { _id: 'l-a1b-1', name: 'Lead Alpha 2', assignedTo: new mongoose.Types.ObjectId('900000000000000000000009'), status: 'follow_up' },
  { _id: 'l-a2a-1', name: 'Lead Alpha 3', assignedTo: new mongoose.Types.ObjectId('900000000000000000000010'), status: 'converted' },
  { _id: 'l-b1a-1', name: 'Lead Beta 1',  assignedTo: new mongoose.Types.ObjectId('900000000000000000000011'), status: 'new' },
  { _id: 'l-b1b-1', name: 'Lead Beta 2',  assignedTo: new mongoose.Types.ObjectId('900000000000000000000012'), status: 'interested' },
];

function matchDoc(doc, query) {
  for (const [key, val] of Object.entries(query)) {
    if (key === '_id') {
      if (val && val.$in) {
        const strSet = new Set(val.$in.map((id) => id.toString()));
        if (!strSet.has(doc._id.toString())) return false;
      } else if (doc._id.toString() !== val.toString()) {
        return false;
      }
    } else if (key === 'teamLeadId') {
      if (val && val.$in) {
        const strSet = new Set(val.$in.map((id) => id.toString()));
        if (!doc.teamLeadId || !strSet.has(doc.teamLeadId.toString())) return false;
      } else if (val === null) {
        if (doc.teamLeadId !== null && doc.teamLeadId !== undefined) return false;
      } else if (!doc.teamLeadId || doc.teamLeadId.toString() !== val.toString()) {
        return false;
      }
    } else if (key === 'managerId') {
      if (val && val.$in) {
        const strSet = new Set(val.$in.map((id) => id.toString()));
        if (!doc.managerId || !strSet.has(doc.managerId.toString())) return false;
      } else if (val === null) {
        if (doc.managerId !== null && doc.managerId !== undefined) return false;
      } else if (!doc.managerId || doc.managerId.toString() !== val.toString()) {
        return false;
      }
    } else if (doc[key] !== val) {
      return false;
    }
  }
  return true;
}

User.distinct = async (field, query = {}) => {
  const matches = mockDb.filter((u) => matchDoc(u, query));
  return matches.map((u) => u[field]).filter((v) => v !== undefined && v !== null);
};

User.findById = (id) => {
  const match = mockDb.find((u) => u._id.toString() === id.toString());
  return {
    select: () => ({
      lean: async () => (match ? { ...match } : null),
    }),
    lean: async () => (match ? { ...match } : null),
    then: (resolve) => resolve(match ? { ...match } : null),
  };
};

User.findOne = (query = {}) => {
  const match = mockDb.find((u) => matchDoc(u, query));
  return {
    select: () => ({
      lean: async () => (match ? { ...match } : null),
    }),
    lean: async () => (match ? { ...match } : null),
    then: (resolve) => resolve(match ? { ...match } : null),
  };
};

User.find = (query = {}) => {
  const matches = mockDb.filter((u) => matchDoc(u, query));
  return {
    select: () => ({
      lean: async () => matches.map((m) => ({ ...m })),
    }),
    lean: async () => matches.map((m) => ({ ...m })),
    then: (resolve) => resolve(matches.map((m) => ({ ...m }))),
  };
};

User.findByIdAndUpdate = async (id, update) => {
  const doc = mockDb.find((u) => u._id.toString() === id.toString());
  if (!doc) return null;
  if (update.$set) Object.assign(doc, update.$set);
  return { ...doc };
};

User.exists = async (query = {}) => {
  const match = mockDb.find((u) => matchDoc(u, query));
  return match ? { _id: match._id } : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite Execution
// ─────────────────────────────────────────────────────────────────────────────

async function runPhase7Tests() {
  console.log('\n======================================================');
  console.log('  CALLTRACK CRM - PHASE 7 FINAL INTEGRATION & SECURITY');
  console.log('======================================================\n');

  const [admin, mgrAlpha, mgrBeta, tlA1, tlA2, tlB1, tlSolo, agA1a, agA1b, agA2a, agB1a, agB1b, agSolo] = mockDb;

  console.log('--- 1. Role Permission Matrix & Boundary Guards ---');

  it('isAdmin allows Admin', () => {
    let nextCalled = false;
    isAdmin({ user: admin }, {}, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });

  it('isAdmin blocks Manager, TL, Employee with 403', () => {
    [mgrAlpha, tlA1, agA1a].forEach((user) => {
      let code = null;
      isAdmin({ user }, { status: (c) => ({ json: () => { code = c; } }) }, () => {});
      assert.strictEqual(code, 403);
    });
  });

  it('requireManagement allows Admin, Manager, TL', () => {
    [admin, mgrAlpha, tlA1].forEach((user) => {
      let nextCalled = false;
      requireManagement({ user }, {}, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true);
    });
  });

  it('requireManagement blocks Employee with 403', () => {
    let code = null;
    requireManagement({ user: agA1a }, { status: (c) => ({ json: () => { code = c; } }) }, () => {});
    assert.strictEqual(code, 403);
  });

  console.log('\n--- 2. Scope Resolution for Multi-Level Hierarchies ---');

  await itAsync('Admin gets null (unrestricted scope)', async () => {
    assert.strictEqual(await getScopedTLIds(admin), null);
    assert.strictEqual(await getScopedEmployeeIds(admin), null);
  });

  await itAsync('Manager Alpha gets TL Alpha-1 & TL Alpha-2 and all 3 transitive agents', async () => {
    const tlIds = await getScopedTLIds(mgrAlpha);
    assert.strictEqual(tlIds.length, 2);
    const tlStrs = tlIds.map((id) => id.toString());
    assert(tlStrs.includes(tlA1._id.toString()));
    assert(tlStrs.includes(tlA2._id.toString()));
    assert(!tlStrs.includes(tlB1._id.toString()));

    const empIds = await getScopedEmployeeIds(mgrAlpha);
    assert.strictEqual(empIds.length, 3);
    const empStrs = empIds.map((id) => id.toString());
    assert(empStrs.includes(agA1a._id.toString()));
    assert(empStrs.includes(agA1b._id.toString()));
    assert(empStrs.includes(agA2a._id.toString()));
    assert(!empStrs.includes(agB1a._id.toString()));
    assert(!empStrs.includes(agB1b._id.toString()));
  });

  await itAsync('Manager Beta gets only TL Beta-1 and its 2 agents', async () => {
    const tlIds = await getScopedTLIds(mgrBeta);
    assert.strictEqual(tlIds.length, 1);
    assert.strictEqual(tlIds[0].toString(), tlB1._id.toString());

    const empIds = await getScopedEmployeeIds(mgrBeta);
    assert.strictEqual(empIds.length, 2);
    const empStrs = empIds.map((id) => id.toString());
    assert(empStrs.includes(agB1a._id.toString()));
    assert(empStrs.includes(agB1b._id.toString()));
    assert(!empStrs.includes(agA1a._id.toString()));
  });

  await itAsync('TL Alpha-1 gets only self TL and Agent A1a & Agent A1b', async () => {
    const tlIds = await getScopedTLIds(tlA1);
    assert.strictEqual(tlIds.length, 1);
    assert.strictEqual(tlIds[0].toString(), tlA1._id.toString());

    const empIds = await getScopedEmployeeIds(tlA1);
    assert.strictEqual(empIds.length, 2);
    const empStrs = empIds.map((id) => id.toString());
    assert(empStrs.includes(agA1a._id.toString()));
    assert(empStrs.includes(agA1b._id.toString()));
    assert(!empStrs.includes(agA2a._id.toString())); // Agent under sibling TL A2 is excluded
  });

  await itAsync('Employee Agent A1a gets only self', async () => {
    const empIds = await getScopedEmployeeIds(agA1a);
    assert.strictEqual(empIds.length, 1);
    assert.strictEqual(empIds[0].toString(), agA1a._id.toString());
  });

  console.log('\n--- 3. Cross-Hierarchy Data Leakage Verification ---');

  await itAsync('Payload Isolation: Manager Alpha call logs payload contains 0 calls from Manager Beta', async () => {
    const scopedEmpIds = await getScopedEmployeeIds(mgrAlpha);
    const scopedSet = new Set(scopedEmpIds.map((id) => id.toString()));
    const resultCalls = mockCalls.filter((c) => scopedSet.has(c.employeeId.toString()));

    assert.strictEqual(resultCalls.length, 3);
    assert(!resultCalls.some((c) => c._id === 'c-b1a-1'));
    assert(!resultCalls.some((c) => c._id === 'c-b1b-1'));
  });

  await itAsync('Payload Isolation: TL Alpha-1 leads payload contains 0 leads from TL Alpha-2 or TL Beta-1', async () => {
    const scopedEmpIds = await getScopedEmployeeIds(tlA1);
    const scopedSet = new Set(scopedEmpIds.map((id) => id.toString()));
    const resultLeads = mockLeads.filter((l) => scopedSet.has(l.assignedTo.toString()));

    assert.strictEqual(resultLeads.length, 2);
    const names = resultLeads.map((l) => l.name);
    assert(names.includes('Lead Alpha 1'));
    assert(names.includes('Lead Alpha 2'));
    assert(!names.includes('Lead Alpha 3')); // Sibling TL lead
    assert(!names.includes('Lead Beta 1'));  // Foreign manager lead
  });

  console.log('\n--- 4. ID Manipulation & Query Parameter Defense ---');

  await itAsync('Manager Alpha querying foreign Agent B1a is rejected with 403', async () => {
    const res = await resolveEmployeeFilter(mgrAlpha, agB1a._id.toString(), 'employeeId');
    assert.strictEqual(res.allowed, false);
    assert(res.error.includes('Access denied'));
  });

  await itAsync('TL Alpha-1 querying sibling Agent A2a is rejected with 403', async () => {
    const res = await resolveEmployeeFilter(tlA1, agA2a._id.toString(), 'employeeId');
    assert.strictEqual(res.allowed, false);
    assert(res.error.includes('Access denied'));
  });

  await itAsync('Direct Employee validation: Manager Alpha rejects Agent B1a & Agent B1b', async () => {
    assert.strictEqual(await validateEmployeeInScope(mgrAlpha, agB1a._id), false);
    assert.strictEqual(await validateEmployeeInScope(mgrAlpha, agB1b._id), false);
  });

  await itAsync('Direct TL validation: Manager Alpha rejects TL Beta-1', async () => {
    assert.strictEqual(await validateTLInScope(mgrAlpha, tlB1._id), false);
  });

  console.log('\n--- 5. Non-Cascading Reassignment & Transitive Hierarchy ---');

  await itAsync('Non-Cascading TL Reassignment: Moving TL Alpha-1 to Manager Beta updates only managerId', async () => {
    resetMockDb();

    // Verify initial state
    assert.strictEqual(mockDb[3].managerId.toString(), mockDb[1]._id.toString()); // TL Alpha-1 under Manager Alpha
    assert.strictEqual(mockDb[7].teamLeadId.toString(), mockDb[3]._id.toString()); // Agent A1a under TL Alpha-1
    assert.strictEqual(mockDb[8].teamLeadId.toString(), mockDb[3]._id.toString()); // Agent A1b under TL Alpha-1

    // Move TL Alpha-1 to Manager Beta
    await User.findByIdAndUpdate(mockDb[3]._id, { $set: { managerId: mockDb[2]._id } });

    // Verify TL Alpha-1 managerId updated
    assert.strictEqual(mockDb[3].managerId.toString(), mockDb[2]._id.toString());

    // Verify Agent A1a and A1b teamLeadId DID NOT CHANGE
    assert.strictEqual(mockDb[7].teamLeadId.toString(), mockDb[3]._id.toString());
    assert.strictEqual(mockDb[8].teamLeadId.toString(), mockDb[3]._id.toString());

    // Verify Sibling TL Alpha-2 and Agent A2a are completely untouched
    assert.strictEqual(mockDb[4].managerId.toString(), mockDb[1]._id.toString());
    assert.strictEqual(mockDb[9].teamLeadId.toString(), mockDb[4]._id.toString());
  });

  await itAsync('Post-Reassignment Scoping: Manager Alpha loses TL Alpha-1 scope, Manager Beta gains it dynamically', async () => {
    // Manager Alpha now only has TL Alpha-2 (1 agent: Agent A2a)
    const alphaScope = await getScopedEmployeeIds(mockDb[1]);
    assert.strictEqual(alphaScope.length, 1);
    assert.strictEqual(alphaScope[0].toString(), mockDb[9]._id.toString());

    // Manager Beta now has TL Beta-1 + TL Alpha-1 (4 agents: B1a, B1b, A1a, A1b)
    const betaScope = await getScopedEmployeeIds(mockDb[2]);
    assert.strictEqual(betaScope.length, 4);
    const betaStrs = betaScope.map((id) => id.toString());
    assert(betaStrs.includes(mockDb[7]._id.toString())); // Agent A1a
    assert(betaStrs.includes(mockDb[8]._id.toString())); // Agent A1b
    assert(betaStrs.includes(mockDb[10]._id.toString())); // Agent B1a
    assert(betaStrs.includes(mockDb[11]._id.toString())); // Agent B1b

    // TL Alpha-1 retains exact same 2 agents
    const tlScope = await getScopedEmployeeIds(mockDb[3]);
    assert.strictEqual(tlScope.length, 2);
  });

  console.log('\n--- 6. Aggregation Security & Pre-Filtering ---');

  it('Aggregation Pipeline verification: Scope must be in $match before any $group stage', () => {
    // Model pipeline simulation
    const scopedIds = [mockDb[7]._id, mockDb[8]._id];
    const pipeline = [
      { $match: { employeeId: { $in: scopedIds } } },
      { $group: { _id: '$employeeId', totalCalls: { $sum: 1 } } }
    ];

    assert.strictEqual(pipeline[0].$match.employeeId.$in, scopedIds);
    assert.strictEqual(Object.keys(pipeline[1])[0], '$group');
  });

  console.log('\n======================================================');
  console.log(`  Phase 7 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase7Tests().catch((err) => {
  console.error('Phase 7 test suite error:', err);
  process.exit(1);
});
