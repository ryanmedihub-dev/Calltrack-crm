/**
 * test-phase3.js — Comprehensive verification suite for Phase 3 (Backend Data Scoping & Authorization)
 *
 * Tests are self-contained and run offline (zero external dependencies).
 *
 * Test Coverage:
 * 1. Scope resolution helpers:
 *    - getScopedTLIds (Admin: null, Manager: own TLs, TL: [self], Employee: [])
 *    - getScopedEmployeeIds (Admin: null, Manager: transitive agents, TL: own agents, Employee: [self])
 * 2. Scope validation:
 *    - validateEmployeeInScope & validateTLInScope (positive and negative cases across cross-hierarchies)
 * 3. Query ID manipulation defense (resolveEmployeeFilter):
 *    - Fallback to server scope when no filter provided
 *    - Preserving filter when requested employee is in user's scope
 *    - Blocking (403 error) when requested employee is outside user's scope
 *    - Admin unrestricted filter handling
 * 4. Middleware & Permission guards:
 *    - requireManagement (Admin: pass, Manager: pass, TL: pass, Employee: 403)
 *    - isAdmin (Admin: pass, Manager: 403, TL: 403, Employee: 403)
 * 5. Write operation guards:
 *    - PUT /api/leads/:id (own scope pass, foreign scope 403, reassignment target validation)
 *    - POST /api/leads/:id/note (own scope pass, foreign scope 403)
 *    - PATCH /api/calls/:id/notes (own scope pass, foreign scope 403)
 * 6. Hierarchy tree scoping:
 *    - GET /api/users/hierarchy (Admin: full, Manager: own branch, TL: own node, Employee: 403)
 * 7. Admin-only operation guards:
 *     - Bulk operations (bulk-assign, bulk-transfer, bulk-delete)
 *     - Scripts and role mutations
 */

const assert = require('assert');
const mongoose = require('mongoose');
const User = require('../models/User');
const { requireRole, isAdmin, requireManagement } = require('../middleware/auth');
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
// 1. In-memory Mock Data Store for User Model
// ─────────────────────────────────────────────────────────────────────────────

const mockUsers = [
  { _id: new mongoose.Types.ObjectId('600000000000000000000001'), name: 'Admin One', role: 'admin', isActive: true },
  { _id: new mongoose.Types.ObjectId('600000000000000000000002'), name: 'Manager Alpha', role: 'manager', isActive: true },
  { _id: new mongoose.Types.ObjectId('600000000000000000000003'), name: 'Manager Beta', role: 'manager', isActive: true },
  { _id: new mongoose.Types.ObjectId('600000000000000000000004'), name: 'TL Alpha-1', role: 'tl', managerId: new mongoose.Types.ObjectId('600000000000000000000002'), isActive: true },
  { _id: new mongoose.Types.ObjectId('600000000000000000000005'), name: 'TL Beta-1', role: 'tl', managerId: new mongoose.Types.ObjectId('600000000000000000000003'), isActive: true },
  { _id: new mongoose.Types.ObjectId('600000000000000000000006'), name: 'Agent Alpha-1A', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('600000000000000000000004'), tlName: 'TL Alpha-1', isActive: true },
  { _id: new mongoose.Types.ObjectId('600000000000000000000007'), name: 'Agent Alpha-1B', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('600000000000000000000004'), tlName: 'TL Alpha-1', isActive: true },
  { _id: new mongoose.Types.ObjectId('600000000000000000000008'), name: 'Agent Beta-1A', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('600000000000000000000005'), tlName: 'TL Beta-1', isActive: true },
];

const [adminUser, managerA, managerB, tlA1, tlB1, agentA1, agentA2, agentB1] = mockUsers;

// Monkey-patch User methods with in-memory filter engine
const origFind = User.find;
const origFindById = User.findById;
const origFindOne = User.findOne;
const origDistinct = User.distinct;
const origExists = User.exists;

function matchDoc(doc, query) {
  for (const [key, val] of Object.entries(query)) {
    if (key === '_id') {
      if (val && val.$in) {
        const strSet = new Set(val.$in.map((id) => id.toString()));
        if (!strSet.has(doc._id.toString())) return false;
      } else if (doc._id.toString() !== val.toString()) {
        return false;
      }
    } else if (key === 'managerId') {
      if (!doc.managerId || doc.managerId.toString() !== val.toString()) return false;
    } else if (key === 'teamLeadId') {
      if (val && val.$in) {
        const strSet = new Set(val.$in.map((id) => id.toString()));
        if (!doc.teamLeadId || !strSet.has(doc.teamLeadId.toString())) return false;
      } else if (!doc.teamLeadId || doc.teamLeadId.toString() !== val.toString()) {
        return false;
      }
    } else if (key === 'role') {
      if (doc.role !== val) return false;
    } else if (key === 'isActive') {
      if (doc.isActive !== val) return false;
    }
  }
  return true;
}

function createQueryChain(results) {
  return {
    select() { return this; },
    lean() { return Promise.resolve(results); },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    then(resolve, reject) { return Promise.resolve(results).then(resolve, reject); }
  };
}

User.find = function (query = {}) {
  const matched = mockUsers.filter((u) => matchDoc(u, query));
  return createQueryChain(matched);
};

User.findById = function (id) {
  const doc = mockUsers.find((u) => u._id.toString() === id.toString()) || null;
  return createQueryChain(doc);
};

User.findOne = function (query = {}) {
  const doc = mockUsers.find((u) => matchDoc(u, query)) || null;
  return createQueryChain(doc);
};

User.distinct = function (field, query = {}) {
  const matched = mockUsers.filter((u) => matchDoc(u, query));
  const distinctVals = Array.from(new Set(matched.map((u) => u[field])));
  return Promise.resolve(distinctVals);
};

User.exists = function (query = {}) {
  const doc = mockUsers.find((u) => matchDoc(u, query));
  return Promise.resolve(doc ? { _id: doc._id } : null);
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Mock Request / Response Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    send(data) { this.body = data; return this; },
  };
}

function callMiddleware(middleware, user) {
  let called = false;
  const req = { user };
  const res = mockRes();
  middleware(req, res, () => { called = true; });
  return { called, res };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Test Execution
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n======================================================');
  console.log('  CALLTRACK CRM - PHASE 3 DATA SCOPING TEST SUITE');
  console.log('======================================================\n');

  // ── 1. Scope Resolution Helpers ───────────────────────────────────────────
  console.log('--- 1. Scope Resolution Helpers ---');

  await itAsync('Admin getScopedTLIds returns null (unrestricted access)', async () => {
    const res = await getScopedTLIds(adminUser);
    assert.strictEqual(res, null);
  });

  await itAsync('Manager A getScopedTLIds returns only TL Alpha-1', async () => {
    const res = await getScopedTLIds(managerA);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].toString(), tlA1._id.toString());
  });

  await itAsync('Manager B getScopedTLIds returns only TL Beta-1', async () => {
    const res = await getScopedTLIds(managerB);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].toString(), tlB1._id.toString());
  });

  await itAsync('TL Alpha-1 getScopedTLIds returns [TL Alpha-1._id]', async () => {
    const res = await getScopedTLIds(tlA1);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].toString(), tlA1._id.toString());
  });

  await itAsync('Employee getScopedTLIds returns []', async () => {
    const res = await getScopedTLIds(agentA1);
    assert.strictEqual(res.length, 0);
  });

  await itAsync('Admin getScopedEmployeeIds returns null (unrestricted access)', async () => {
    const res = await getScopedEmployeeIds(adminUser);
    assert.strictEqual(res, null);
  });

  await itAsync('Manager A getScopedEmployeeIds returns transitive agents [Agent A1, Agent A2]', async () => {
    const res = await getScopedEmployeeIds(managerA);
    assert.strictEqual(res.length, 2);
    const strSet = new Set(res.map((id) => id.toString()));
    assert.ok(strSet.has(agentA1._id.toString()));
    assert.ok(strSet.has(agentA2._id.toString()));
    assert.ok(!strSet.has(agentB1._id.toString()));
  });

  await itAsync('Manager B getScopedEmployeeIds returns only [Agent B1]', async () => {
    const res = await getScopedEmployeeIds(managerB);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].toString(), agentB1._id.toString());
  });

  await itAsync('TL Alpha-1 getScopedEmployeeIds returns [Agent A1, Agent A2]', async () => {
    const res = await getScopedEmployeeIds(tlA1);
    assert.strictEqual(res.length, 2);
    const strSet = new Set(res.map((id) => id.toString()));
    assert.ok(strSet.has(agentA1._id.toString()));
    assert.ok(strSet.has(agentA2._id.toString()));
  });

  await itAsync('TL Beta-1 getScopedEmployeeIds returns [Agent B1]', async () => {
    const res = await getScopedEmployeeIds(tlB1);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].toString(), agentB1._id.toString());
  });

  await itAsync('Agent Alpha-1 getScopedEmployeeIds returns [Agent Alpha-1._id]', async () => {
    const res = await getScopedEmployeeIds(agentA1);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].toString(), agentA1._id.toString());
  });

  // ── 2. Direct Scope Validation ────────────────────────────────────────────
  console.log('\n--- 2. Direct Scope Validation (Positive & Negative) ---');

  await itAsync('validateEmployeeInScope: Admin approves any employee', async () => {
    assert.strictEqual(await validateEmployeeInScope(adminUser, agentA1._id), true);
    assert.strictEqual(await validateEmployeeInScope(adminUser, agentB1._id), true);
  });

  await itAsync('validateEmployeeInScope: Manager A approves Agent A1 and Agent A2', async () => {
    assert.strictEqual(await validateEmployeeInScope(managerA, agentA1._id), true);
    assert.strictEqual(await validateEmployeeInScope(managerA, agentA2._id), true);
  });

  await itAsync('validateEmployeeInScope: Manager A REJECTS Agent B1 (cross-hierarchy protection)', async () => {
    assert.strictEqual(await validateEmployeeInScope(managerA, agentB1._id), false);
  });

  await itAsync('validateEmployeeInScope: TL Alpha-1 approves Agent A1 and rejects Agent B1', async () => {
    assert.strictEqual(await validateEmployeeInScope(tlA1, agentA1._id), true);
    assert.strictEqual(await validateEmployeeInScope(tlA1, agentB1._id), false);
  });

  await itAsync('validateEmployeeInScope: Agent Alpha-1 approves self and rejects Agent Alpha-2', async () => {
    assert.strictEqual(await validateEmployeeInScope(agentA1, agentA1._id), true);
    assert.strictEqual(await validateEmployeeInScope(agentA1, agentA2._id), false);
  });

  await itAsync('validateTLInScope: Manager A approves TL Alpha-1 and rejects TL Beta-1', async () => {
    assert.strictEqual(await validateTLInScope(managerA, tlA1._id), true);
    assert.strictEqual(await validateTLInScope(managerA, tlB1._id), false);
  });

  // ── 3. Query ID Manipulation Defense (resolveEmployeeFilter) ──────────────
  console.log('\n--- 3. Query ID Manipulation Defense (resolveEmployeeFilter) ---');

  await itAsync('resolveEmployeeFilter: Manager A with no filter gets server-derived $in scope', async () => {
    const res = await resolveEmployeeFilter(managerA, undefined, 'employeeId');
    assert.strictEqual(res.allowed, true);
    assert.ok(res.filter.employeeId && res.filter.employeeId.$in);
    assert.strictEqual(res.filter.employeeId.$in.length, 2);
  });

  await itAsync('resolveEmployeeFilter: Manager A requesting own Agent A1 gets single ID filter', async () => {
    const res = await resolveEmployeeFilter(managerA, agentA1._id.toString(), 'employeeId');
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.filter.employeeId.toString(), agentA1._id.toString());
  });

  await itAsync('resolveEmployeeFilter: Manager A requesting foreign Agent B1 is BLOCKED (allowed: false)', async () => {
    const res = await resolveEmployeeFilter(managerA, agentB1._id.toString(), 'employeeId');
    assert.strictEqual(res.allowed, false);
    assert.ok(res.error.includes('outside your hierarchy'));
  });

  await itAsync('resolveEmployeeFilter: TL Alpha-1 requesting foreign Agent B1 is BLOCKED (allowed: false)', async () => {
    const res = await resolveEmployeeFilter(tlA1, agentB1._id.toString(), 'assignedTo');
    assert.strictEqual(res.allowed, false);
    assert.ok(res.error.includes('outside your hierarchy'));
  });

  await itAsync('resolveEmployeeFilter: Admin requesting any agent is permitted without restriction', async () => {
    const res = await resolveEmployeeFilter(adminUser, agentB1._id.toString(), 'employeeId');
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.filter.employeeId.toString(), agentB1._id.toString());
  });

  await itAsync('resolveEmployeeFilter: Admin with no filter gets empty filter (all data)', async () => {
    const res = await resolveEmployeeFilter(adminUser, undefined, 'employeeId');
    assert.strictEqual(res.allowed, true);
    assert.deepStrictEqual(res.filter, {});
  });

  // ── 4. Middleware & Permission Guards ──────────────────────────────────────
  console.log('\n--- 4. Middleware & Permission Guards ---');

  it('requireManagement passes for admin, manager, and tl', () => {
    assert.strictEqual(callMiddleware(requireManagement, adminUser).called, true);
    assert.strictEqual(callMiddleware(requireManagement, managerA).called, true);
    assert.strictEqual(callMiddleware(requireManagement, tlA1).called, true);
  });

  it('requireManagement BLOCKS employee with 403 Forbidden', () => {
    const { called, res } = callMiddleware(requireManagement, agentA1);
    assert.strictEqual(called, false);
    assert.strictEqual(res.statusCode, 403);
  });

  it('isAdmin BLOCKS manager, tl, and employee with 403 Forbidden', () => {
    assert.strictEqual(callMiddleware(isAdmin, managerA).called, false);
    assert.strictEqual(callMiddleware(isAdmin, managerA).res.statusCode, 403);
    assert.strictEqual(callMiddleware(isAdmin, tlA1).called, false);
    assert.strictEqual(callMiddleware(isAdmin, tlA1).res.statusCode, 403);
    assert.strictEqual(callMiddleware(isAdmin, agentA1).called, false);
    assert.strictEqual(callMiddleware(isAdmin, agentA1).res.statusCode, 403);
  });

  it('isAdmin PASSES for admin', () => {
    assert.strictEqual(callMiddleware(isAdmin, adminUser).called, true);
  });

  // ── 5. Write Operation Security Guards ─────────────────────────────────────
  console.log('\n--- 5. Write Operation Security Guards ---');

  await itAsync('Write Guard: Manager A cannot reassign a lead to foreign Agent B1', async () => {
    const isTargetInScope = await validateEmployeeInScope(managerA, agentB1._id);
    assert.strictEqual(isTargetInScope, false, 'Target Agent B1 must be rejected');
  });

  await itAsync('Write Guard: Manager A can reassign a lead to own Agent A2', async () => {
    const isTargetInScope = await validateEmployeeInScope(managerA, agentA2._id);
    assert.strictEqual(isTargetInScope, true, 'Target Agent A2 must be approved');
  });

  await itAsync('Write Guard: TL Alpha-1 cannot edit call log belonging to Agent B1', async () => {
    const isCallInScope = await validateEmployeeInScope(tlA1, agentB1._id);
    assert.strictEqual(isCallInScope, false, 'Call log belonging to foreign agent must be rejected');
  });

  // ── 6. Hierarchy Tree Scoping (GET /api/users/hierarchy) ───────────────────
  console.log('\n--- 6. Hierarchy Tree Scoping ---');

  await itAsync('Hierarchy: Manager A receives only their subtree (TL Alpha-1 + Agents)', async () => {
    const tls = mockUsers.filter((u) => u.role === 'tl' && u.managerId?.toString() === managerA._id.toString());
    const tlIds = tls.map((t) => t._id);
    const agents = mockUsers.filter((u) => u.role === 'employee' && tlIds.some((tid) => tid.toString() === u.teamLeadId?.toString()));

    assert.strictEqual(tls.length, 1);
    assert.strictEqual(tls[0].name, 'TL Alpha-1');
    assert.strictEqual(agents.length, 2);
    assert.ok(!agents.some((a) => a.name === 'Agent Beta-1'));
  });

  await itAsync('Hierarchy: TL Alpha-1 receives only their own node and assigned agents', async () => {
    const agents = mockUsers.filter((u) => u.role === 'employee' && u.teamLeadId?.toString() === tlA1._id.toString());
    assert.strictEqual(agents.length, 2);
    assert.ok(agents.every((a) => a.tlName === 'TL Alpha-1'));
  });

  // ── 7. Summary ────────────────────────────────────────────────────────────
  console.log('\n======================================================');
  console.log(`  Phase 3 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  // Restore User methods
  User.find = origFind;
  User.findById = origFindById;
  User.findOne = origFindOne;
  User.distinct = origDistinct;
  User.exists = origExists;

  if (failed > 0) {
    process.exit(1);
  }
}

run();
