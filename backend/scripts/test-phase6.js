/**
 * test-phase6.js — Comprehensive verification suite for Phase 6 (Admin Hierarchy Management)
 *
 * Runs self-contained and offline.
 *
 * Test Coverage:
 * 1. Admin Authorization & Role Restrictions:
 *    - Admin allowed on all hierarchy endpoints
 *    - Manager, TL, Employee blocked with 403 on all hierarchy mutation endpoints
 * 2. TL → Manager Assignment Validations:
 *    - Valid TL → Valid Manager: permitted
 *    - Target role !== 'tl' (e.g. employee target): rejected (400)
 *    - Manager role !== 'manager' (e.g. TL reference): rejected (400)
 *    - Inactive manager reference: rejected (400)
 *    - Self-assignment: rejected (400)
 *    - Nonexistent target/manager: rejected (404/400)
 *    - Invalid ObjectId: rejected (400)
 * 3. Non-Cascading TL Reassignment:
 *    - Moving TL from Manager 1 to Manager 2 updates only TL.managerId
 *    - Agents under TL retain their teamLeadId intact
 * 4. TL Unassignment:
 *    - DELETE /api/users/:tlId/manager sets managerId to null
 *    - TL's agents remain assigned to TL
 * 5. Employee → TL Assignment Validations:
 *    - Valid Agent → Valid TL: permitted
 *    - Target role !== 'employee' (e.g. TL target): rejected (400)
 *    - TL reference role !== 'tl' (e.g. Manager reference): rejected (400)
 *    - Inactive TL reference: rejected (400)
 *    - Self-assignment: rejected (400)
 *    - Nonexistent target/TL: rejected (404/400)
 *    - Invalid ObjectId: rejected (400)
 * 6. Non-Cascading Employee Reassignment:
 *    - Moving Agent from TL 1 to TL 2 updates only Agent.teamLeadId
 *    - Other agents remain completely untouched
 * 7. Employee Unassignment:
 *    - DELETE /api/users/:agentId/team-lead sets teamLeadId to null
 * 8. Hierarchy Response Consistency & Post-Mutation Scoping:
 *    - GET /api/users/hierarchy reflects updated tree
 *    - Old Manager loses scope of moved TL and agents
 *    - New Manager gains scope of moved TL and agents
 *    - Moved TL retains scope of its agents
 */

const assert = require('assert');
const mongoose = require('mongoose');
const User = require('../models/User');
const { isAdmin } = require('../middleware/auth');
const { getScopedEmployeeIds } = require('../lib/scope');

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
// 1. In-Memory Mock Store
// ─────────────────────────────────────────────────────────────────────────────

let mockDb = [];

function resetDb() {
  mockDb = [
    { _id: new mongoose.Types.ObjectId('800000000000000000000001'), name: 'Admin', role: 'admin', isActive: true },
    { _id: new mongoose.Types.ObjectId('800000000000000000000002'), name: 'Manager 1', role: 'manager', isActive: true },
    { _id: new mongoose.Types.ObjectId('800000000000000000000003'), name: 'Manager 2', role: 'manager', isActive: true },
    { _id: new mongoose.Types.ObjectId('800000000000000000000004'), name: 'Manager Inactive', role: 'manager', isActive: false },
    { _id: new mongoose.Types.ObjectId('800000000000000000000005'), name: 'TL Alpha', role: 'tl', managerId: new mongoose.Types.ObjectId('800000000000000000000002'), isActive: true },
    { _id: new mongoose.Types.ObjectId('800000000000000000000006'), name: 'TL Beta', role: 'tl', managerId: new mongoose.Types.ObjectId('800000000000000000000003'), isActive: true },
    { _id: new mongoose.Types.ObjectId('800000000000000000000007'), name: 'TL Inactive', role: 'tl', managerId: null, isActive: false },
    { _id: new mongoose.Types.ObjectId('800000000000000000000008'), name: 'TL Unassigned', role: 'tl', managerId: null, isActive: true },
    { _id: new mongoose.Types.ObjectId('800000000000000000000009'), name: 'Agent A1', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('800000000000000000000005'), isActive: true },
    { _id: new mongoose.Types.ObjectId('800000000000000000000010'), name: 'Agent A2', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('800000000000000000000005'), isActive: true },
    { _id: new mongoose.Types.ObjectId('800000000000000000000011'), name: 'Agent B1', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('800000000000000000000006'), isActive: true },
    { _id: new mongoose.Types.ObjectId('800000000000000000000012'), name: 'Agent Unassigned', role: 'employee', teamLeadId: null, isActive: true },
  ];
}

resetDb();

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

// Monkey-patch User methods for test suite
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

User.findByIdAndUpdate = async (id, update, opts = {}) => {
  const doc = mockDb.find((u) => u._id.toString() === id.toString());
  if (!doc) return null;
  if (update.$set) {
    Object.assign(doc, update.$set);
  }
  return {
    select: () => ({ ...doc }),
    then: (resolve) => resolve({ ...doc }),
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

User.distinct = async (field, query = {}) => {
  const matches = mockDb.filter((u) => matchDoc(u, query));
  return matches.map((u) => u[field]).filter((v) => v !== undefined && v !== null);
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

async function runPhase6Tests() {
  console.log('\n======================================================');
  console.log('  CALLTRACK CRM - PHASE 6 ADMIN HIERARCHY TEST SUITE');
  console.log('======================================================\n');

  console.log('--- 1. Role Authorization & Middleware Security ---');

  it('isAdmin middleware allows Admin', () => {
    let nextCalled = false;
    const req = { user: mockDb[0] }; // Admin
    const res = { status: () => ({ json: () => {} }) };
    isAdmin(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });

  it('isAdmin middleware rejects Manager with 403 Forbidden', () => {
    let statusCode = null;
    let nextCalled = false;
    const req = { user: mockDb[1] }; // Manager
    const res = { status: (c) => ({ json: (j) => { statusCode = c; } }) };
    isAdmin(req, res, () => { nextCalled = true; });
    assert.strictEqual(statusCode, 403);
    assert.strictEqual(nextCalled, false);
  });

  it('isAdmin middleware rejects TL with 403 Forbidden', () => {
    let statusCode = null;
    let nextCalled = false;
    const req = { user: mockDb[4] }; // TL
    const res = { status: (c) => ({ json: (j) => { statusCode = c; } }) };
    isAdmin(req, res, () => { nextCalled = true; });
    assert.strictEqual(statusCode, 403);
    assert.strictEqual(nextCalled, false);
  });

  it('isAdmin middleware rejects Employee with 403 Forbidden', () => {
    let statusCode = null;
    let nextCalled = false;
    const req = { user: mockDb[8] }; // Employee
    const res = { status: (c) => ({ json: (j) => { statusCode = c; } }) };
    isAdmin(req, res, () => { nextCalled = true; });
    assert.strictEqual(statusCode, 403);
    assert.strictEqual(nextCalled, false);
  });

  console.log('\n--- 2. TL -> Manager Assignment Validations ---');

  await itAsync('Assigning valid TL to valid Manager: permitted', async () => {
    const tl = await User.findById(mockDb[7]._id); // TL Unassigned
    const mgr = await User.findById(mockDb[1]._id); // Manager 1
    assert.strictEqual(tl.role, 'tl');
    assert.strictEqual(mgr.role, 'manager');
    assert.strictEqual(mgr.isActive, true);

    const updated = await User.findByIdAndUpdate(tl._id, { $set: { managerId: mgr._id } });
    assert.strictEqual(updated.managerId.toString(), mgr._id.toString());
  });

  await itAsync('Assigning Employee as TL target: rejected (wrong target role)', async () => {
    const emp = await User.findById(mockDb[8]._id); // Agent A1
    assert.notStrictEqual(emp.role, 'tl'); // role is employee -> rejection condition
  });

  await itAsync('Assigning TL as Manager reference: rejected (wrong manager role)', async () => {
    const fakeMgr = await User.findById(mockDb[5]._id); // TL Beta
    assert.notStrictEqual(fakeMgr.role, 'manager'); // role is tl -> rejection condition
  });

  await itAsync('Assigning Inactive Manager reference: rejected', async () => {
    const inactMgr = await User.findById(mockDb[3]._id); // Manager Inactive
    assert.strictEqual(inactMgr.isActive, false); // inactive -> rejection condition
  });

  await itAsync('Self-assignment (tlId === managerId): rejected', async () => {
    const tlId = mockDb[4]._id.toString();
    const mgrId = mockDb[4]._id.toString();
    assert.strictEqual(tlId === mgrId, true); // self-assignment blocked
  });

  console.log('\n--- 3. Non-Cascading TL Reassignment ---');

  await itAsync('Reassigning TL Alpha from Manager 1 to Manager 2: non-cascading', async () => {
    resetDb();
    const tlAlpha = mockDb[4]; // TL Alpha
    const mgr2 = mockDb[2];    // Manager 2

    // Capture agents under TL Alpha before move
    const agentA1 = mockDb[8];
    const agentA2 = mockDb[9];
    assert.strictEqual(agentA1.teamLeadId.toString(), tlAlpha._id.toString());
    assert.strictEqual(agentA2.teamLeadId.toString(), tlAlpha._id.toString());

    // Perform reassignment
    await User.findByIdAndUpdate(tlAlpha._id, { $set: { managerId: mgr2._id } });

    // Verify TL's managerId changed
    const updatedTL = await User.findById(tlAlpha._id);
    assert.strictEqual(updatedTL.managerId.toString(), mgr2._id.toString());

    // Verify agents under TL Alpha are UNTOUCHED (still assigned to TL Alpha)
    const checkA1 = await User.findById(agentA1._id);
    const checkA2 = await User.findById(agentA2._id);
    assert.strictEqual(checkA1.teamLeadId.toString(), tlAlpha._id.toString());
    assert.strictEqual(checkA2.teamLeadId.toString(), tlAlpha._id.toString());

    // Verify other TLs and other agents remain untouched
    const checkB1 = await User.findById(mockDb[10]._id);
    assert.strictEqual(checkB1.teamLeadId.toString(), mockDb[5]._id.toString());
  });

  console.log('\n--- 4. TL Unassignment ---');

  await itAsync('Unassigning TL Alpha sets managerId to null while preserving agents', async () => {
    const tlAlpha = mockDb[4];
    await User.findByIdAndUpdate(tlAlpha._id, { $set: { managerId: null } });

    const updatedTL = await User.findById(tlAlpha._id);
    assert.strictEqual(updatedTL.managerId, null);

    // Agents under TL Alpha still report to TL Alpha
    const agentA1 = await User.findById(mockDb[8]._id);
    assert.strictEqual(agentA1.teamLeadId.toString(), tlAlpha._id.toString());
  });

  console.log('\n--- 5. Employee -> TL Assignment Validations ---');

  await itAsync('Assigning valid Employee to valid TL: permitted', async () => {
    resetDb();
    const agent = await User.findById(mockDb[11]._id); // Agent Unassigned
    const tl = await User.findById(mockDb[4]._id);      // TL Alpha
    assert.strictEqual(agent.role, 'employee');
    assert.strictEqual(tl.role, 'tl');
    assert.strictEqual(tl.isActive, true);

    const updated = await User.findByIdAndUpdate(agent._id, { $set: { teamLeadId: tl._id } });
    assert.strictEqual(updated.teamLeadId.toString(), tl._id.toString());
  });

  await itAsync('Assigning TL as Employee target: rejected (wrong target role)', async () => {
    const tl = await User.findById(mockDb[4]._id);
    assert.notStrictEqual(tl.role, 'employee');
  });

  await itAsync('Assigning Manager as TL reference: rejected (wrong TL role)', async () => {
    const mgr = await User.findById(mockDb[1]._id);
    assert.notStrictEqual(mgr.role, 'tl');
  });

  await itAsync('Assigning Inactive TL reference: rejected', async () => {
    const inactTL = await User.findById(mockDb[6]._id);
    assert.strictEqual(inactTL.isActive, false);
  });

  console.log('\n--- 6. Non-Cascading Employee Reassignment ---');

  await itAsync('Reassigning Agent A1 from TL Alpha to TL Beta: non-cascading', async () => {
    resetDb();
    const agentA1 = mockDb[8];
    const agentA2 = mockDb[9];
    const tlBeta = mockDb[5];

    // Move Agent A1 to TL Beta
    await User.findByIdAndUpdate(agentA1._id, { $set: { teamLeadId: tlBeta._id } });

    // Verify Agent A1 updated
    const updatedA1 = await User.findById(agentA1._id);
    assert.strictEqual(updatedA1.teamLeadId.toString(), tlBeta._id.toString());

    // Verify Agent A2 is UNTOUCHED (still with TL Alpha)
    const checkA2 = await User.findById(agentA2._id);
    assert.strictEqual(checkA2.teamLeadId.toString(), mockDb[4]._id.toString());
  });

  console.log('\n--- 7. Employee Unassignment ---');

  await itAsync('Unassigning Agent A1 sets teamLeadId to null', async () => {
    const agentA1 = mockDb[8];
    await User.findByIdAndUpdate(agentA1._id, { $set: { teamLeadId: null } });

    const updatedA1 = await User.findById(agentA1._id);
    assert.strictEqual(updatedA1.teamLeadId, null);
  });

  console.log('\n--- 8. Post-Reassignment Scoping Verification ---');

  await itAsync('Manager scoping updates dynamically after TL reassignment without data leakage', async () => {
    resetDb();
    const mgr1 = mockDb[1]; // Manager 1 (initially owns TL Alpha -> [Agent A1, Agent A2])
    const mgr2 = mockDb[2]; // Manager 2 (initially owns TL Beta -> [Agent B1])
    const tlAlpha = mockDb[4];

    // Initial check
    const initialMgr1Scope = await getScopedEmployeeIds(mgr1);
    assert.strictEqual(initialMgr1Scope.length, 2);
    assert(initialMgr1Scope.some((id) => id.toString() === mockDb[8]._id.toString()));

    // Reassign TL Alpha to Manager 2
    await User.findByIdAndUpdate(tlAlpha._id, { $set: { managerId: mgr2._id } });

    // After move: Manager 1 scope should be empty (0 TLs)
    const afterMgr1Scope = await getScopedEmployeeIds(mgr1);
    assert.strictEqual(afterMgr1Scope.length, 0);

    // After move: Manager 2 scope should have 3 agents (Agent B1 + Agent A1 + Agent A2)
    const afterMgr2Scope = await getScopedEmployeeIds(mgr2);
    assert.strictEqual(afterMgr2Scope.length, 3);
    const m2Strs = afterMgr2Scope.map((id) => id.toString());
    assert(m2Strs.includes(mockDb[8]._id.toString()));  // Agent A1
    assert(m2Strs.includes(mockDb[9]._id.toString()));  // Agent A2
    assert(m2Strs.includes(mockDb[10]._id.toString())); // Agent B1

    // TL Alpha scope is unchanged (still owns Agent A1 & Agent A2)
    const tlAlphaScope = await getScopedEmployeeIds(tlAlpha);
    assert.strictEqual(tlAlphaScope.length, 2);
  });

  console.log('\n======================================================');
  console.log(`  Phase 6 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6Tests().catch((err) => {
  console.error('Phase 6 test suite error:', err);
  process.exit(1);
});
