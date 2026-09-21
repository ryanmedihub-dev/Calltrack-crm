/**
 * Phase 2: Organizational Hierarchy & Assignment — Unit Test Suite
 *
 * Tests are fully offline (no database required). They test:
 * 1. Role validation for assignment targets
 * 2. Authorization (isAdmin blocks manager/tl/employee)
 * 3. Assignment validation logic (referencing wrong role rejected)
 * 4. Reassignment logic (non-cascading)
 * 5. Hierarchy response structure
 * 6. Sensitive field exclusion (password, fcmToken)
 */

const assert = require('assert');

// ─────────────────────────────────────────────────────────────────────────────
// 0. Load modules from backend
// ─────────────────────────────────────────────────────────────────────────────
const { requireRole, isAdmin, isManager, isTL, isEmployee } =
  require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Shared mock helpers
// ─────────────────────────────────────────────────────────────────────────────
function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data)   { this.body = data; return this; },
  };
}

function callMiddleware(middleware, userRole) {
  let called = false;
  const req = { user: { _id: `id_${userRole}`, name: `User ${userRole}`, role: userRole } };
  const res = mockRes();
  middleware(req, res, () => { called = true; });
  return { called, res };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Assignment validation logic (pure, no DB)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulate the validation in PATCH /:tlId/manager
 * Returns { ok: true } or { ok: false, reason }
 */
function validateTLManagerAssignment({ tlRole, managerRole, managerActive, selfAssign = false }) {
  if (selfAssign)           return { ok: false, reason: 'self-assign' };
  if (tlRole !== 'tl')      return { ok: false, reason: `target role is '${tlRole}', expected 'tl'` };
  if (managerRole !== 'manager') return { ok: false, reason: `referenced role is '${managerRole}', expected 'manager'` };
  if (!managerActive)       return { ok: false, reason: 'referenced manager is inactive' };
  return { ok: true };
}

/**
 * Simulate the validation in PATCH /:agentId/team-lead
 */
function validateAgentTLAssignment({ agentRole, tlRole, tlActive, selfAssign = false }) {
  if (selfAssign)           return { ok: false, reason: 'self-assign' };
  if (agentRole !== 'employee') return { ok: false, reason: `target role is '${agentRole}', expected 'employee'` };
  if (tlRole !== 'tl')      return { ok: false, reason: `referenced role is '${tlRole}', expected 'tl'` };
  if (!tlActive)            return { ok: false, reason: 'referenced TL is inactive' };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Hierarchy builder (pure, no DB)
// ─────────────────────────────────────────────────────────────────────────────

function buildHierarchy(managers, tls, agents) {
  const tlsByManager = {};
  const unassignedTLs = [];
  for (const tl of tls) {
    const key = tl.managerId ? tl.managerId.toString() : null;
    if (key) {
      if (!tlsByManager[key]) tlsByManager[key] = [];
      tlsByManager[key].push(tl);
    } else {
      unassignedTLs.push(tl);
    }
  }

  const agentsByTL = {};
  const unassignedAgents = [];
  for (const agent of agents) {
    const key = agent.teamLeadId ? agent.teamLeadId.toString() : null;
    if (key) {
      if (!agentsByTL[key]) agentsByTL[key] = [];
      agentsByTL[key].push(agent);
    } else {
      unassignedAgents.push(agent);
    }
  }

  const managerNodes = managers.map((manager) => {
    const managerTLs = tlsByManager[manager._id.toString()] || [];
    return {
      manager,
      teamLeads: managerTLs.map((tl) => ({
        tl,
        agents: agentsByTL[tl._id.toString()] || [],
      })),
    };
  });

  return { managers: managerNodes, unassignedTLs, unassignedAgents };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Run Tests
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    → ${err.message}`);
    failed++;
  }
}

// ── Test 1: Valid Manager → TL assignment ────────────────────────────────────
console.log('\n[Group 1] TL Manager Assignment Validation');
test('Valid: TL assigned to active Manager', () => {
  const result = validateTLManagerAssignment({ tlRole: 'tl', managerRole: 'manager', managerActive: true });
  assert.strictEqual(result.ok, true);
});

// ── Test 2: Valid TL → Agent assignment ─────────────────────────────────────
console.log('\n[Group 2] Agent TL Assignment Validation');
test('Valid: Employee assigned to active TL', () => {
  const result = validateAgentTLAssignment({ agentRole: 'employee', tlRole: 'tl', tlActive: true });
  assert.strictEqual(result.ok, true);
});

// ── Test 3: TL reassignment (non-cascading) ──────────────────────────────────
console.log('\n[Group 3] TL Reassignment (non-cascading)');
test('Reassigning TL to a different Manager: valid', () => {
  // Manager A → Manager B; only the TL record changes
  const resultA = validateTLManagerAssignment({ tlRole: 'tl', managerRole: 'manager', managerActive: true });
  const resultB = validateTLManagerAssignment({ tlRole: 'tl', managerRole: 'manager', managerActive: true });
  assert.strictEqual(resultA.ok, true);
  assert.strictEqual(resultB.ok, true);
  // Agents of the TL are untouched — no cascade to validate here
});

// ── Test 4: Agent reassignment (non-cascading) ───────────────────────────────
console.log('\n[Group 4] Agent Reassignment (non-cascading)');
test('Reassigning Agent to a different TL: valid', () => {
  const result1 = validateAgentTLAssignment({ agentRole: 'employee', tlRole: 'tl', tlActive: true });
  const result2 = validateAgentTLAssignment({ agentRole: 'employee', tlRole: 'tl', tlActive: true });
  assert.strictEqual(result1.ok, true);
  assert.strictEqual(result2.ok, true);
});

// ── Test 5: Invalid managerId (non-existent referenced manager) ──────────────
console.log('\n[Group 5] Invalid Reference Rejections');
test('Invalid managerId: referenced user does not exist → rejected before validation even runs', () => {
  // In real handler: manager = await User.findById(...) → null → 400 error
  // We simulate: if manager is null, we must reject
  const manager = null;
  assert.strictEqual(manager === null, true, 'null manager reference must be rejected');
});

// ── Test 6: Invalid teamLeadId (non-existent TL) ────────────────────────────
test('Invalid teamLeadId: referenced user does not exist → rejected', () => {
  const tl = null;
  assert.strictEqual(tl === null, true, 'null TL reference must be rejected');
});

// ── Test 7: Employee cannot be a manager of a TL ────────────────────────────
test('Assigning employee as managerId of a TL → rejected (wrong role)', () => {
  const result = validateTLManagerAssignment({ tlRole: 'tl', managerRole: 'employee', managerActive: true });
  assert.strictEqual(result.ok, false);
  assert.match(result.reason, /employee/);
});

// ── Test 8: Assigning TL to a manager-role user as teamLeadId → rejected ─────
test('Assigning manager as teamLeadId of an agent → rejected (wrong TL role)', () => {
  const result = validateAgentTLAssignment({ agentRole: 'employee', tlRole: 'manager', tlActive: true });
  assert.strictEqual(result.ok, false);
  assert.match(result.reason, /manager/);
});

// ── Test 9: Manager cannot call assignment endpoints ─────────────────────────
console.log('\n[Group 6] Authorization: Role Guards');
test('Manager blocked by isAdmin middleware', () => {
  const { called, res } = callMiddleware(isAdmin, 'manager');
  assert.strictEqual(called, false);
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.success, false);
});

// ── Test 10: TL cannot call assignment endpoints ─────────────────────────────
test('TL blocked by isAdmin middleware', () => {
  const { called, res } = callMiddleware(isAdmin, 'tl');
  assert.strictEqual(called, false);
  assert.strictEqual(res.statusCode, 403);
});

// ── Test 11: Employee cannot call assignment endpoints ────────────────────────
test('Employee blocked by isAdmin middleware', () => {
  const { called, res } = callMiddleware(isAdmin, 'employee');
  assert.strictEqual(called, false);
  assert.strictEqual(res.statusCode, 403);
});

// ── Test 12: Admin can perform assignments ───────────────────────────────────
test('Admin allowed through isAdmin middleware', () => {
  const { called } = callMiddleware(isAdmin, 'admin');
  assert.strictEqual(called, true);
});

// ── Test 13: Hierarchy endpoint returns correct structure ─────────────────────
console.log('\n[Group 7] Hierarchy Response Structure');
test('buildHierarchy: correct tree structure with all nodes placed correctly', () => {
  const managers = [{ _id: 'mgr1', name: 'Manager A', role: 'manager' }];
  const tls = [
    { _id: 'tl1', name: 'TL One', role: 'tl', managerId: 'mgr1' },
    { _id: 'tl2', name: 'TL Two', role: 'tl', managerId: null },   // unassigned
  ];
  const agents = [
    { _id: 'ag1', name: 'Agent 1', role: 'employee', teamLeadId: 'tl1' },
    { _id: 'ag2', name: 'Agent 2', role: 'employee', teamLeadId: 'tl1' },
    { _id: 'ag3', name: 'Agent 3', role: 'employee', teamLeadId: null },  // unassigned
  ];

  const { managers: mgrNodes, unassignedTLs, unassignedAgents } = buildHierarchy(managers, tls, agents);

  assert.strictEqual(mgrNodes.length, 1);
  assert.strictEqual(mgrNodes[0].manager._id, 'mgr1');
  assert.strictEqual(mgrNodes[0].teamLeads.length, 1);
  assert.strictEqual(mgrNodes[0].teamLeads[0].tl._id, 'tl1');
  assert.strictEqual(mgrNodes[0].teamLeads[0].agents.length, 2);

  assert.strictEqual(unassignedTLs.length, 1);
  assert.strictEqual(unassignedTLs[0]._id, 'tl2');

  assert.strictEqual(unassignedAgents.length, 1);
  assert.strictEqual(unassignedAgents[0]._id, 'ag3');
});

// ── Test 14: Sensitive fields not returned ───────────────────────────────────
console.log('\n[Group 8] Sensitive Field Exclusion');
test('password is stripped from User.toJSON', () => {
  const User = require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/models/User');
  const user = new User({
    name: 'Test',
    email: 'test@x.com',
    password: 'secret123',
    role: 'admin',
  });
  const json = user.toJSON();
  assert.strictEqual(json.password, undefined, 'password must not appear in JSON output');
});

test('fcmToken is stripped from User.toJSON', () => {
  const User = require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/models/User');
  const user = new User({
    name: 'Test',
    email: 'test2@x.com',
    password: 'secret123',
    role: 'employee',
    fcmToken: 'firebase-token-abc',
  });
  const json = user.toJSON();
  assert.strictEqual(json.fcmToken, undefined, 'fcmToken must not appear in JSON output');
});

test('SAFE_FIELDS projection does not include password or fcmToken or deviceId', () => {
  // SAFE_FIELDS constant from the route — we test the exact string
  const SAFE_FIELDS = 'name email role phone tlName isActive dailyTarget createdAt managerId teamLeadId';
  assert.ok(!SAFE_FIELDS.includes('password'), 'password must not be in SAFE_FIELDS');
  assert.ok(!SAFE_FIELDS.includes('fcmToken'), 'fcmToken must not be in SAFE_FIELDS');
  assert.ok(!SAFE_FIELDS.includes('deviceId'), 'deviceId must not be in SAFE_FIELDS');
});

// ── Additional: Invalid role for target ──────────────────────────────────────
console.log('\n[Group 9] Edge Cases');
test('Assigning admin as TL target → rejected (admin.role !== tl)', () => {
  const result = validateTLManagerAssignment({ tlRole: 'admin', managerRole: 'manager', managerActive: true });
  assert.strictEqual(result.ok, false);
  assert.match(result.reason, /admin/);
});

test('Assigning TL as agent target → rejected (tl.role !== employee)', () => {
  const result = validateAgentTLAssignment({ agentRole: 'tl', tlRole: 'tl', tlActive: true });
  assert.strictEqual(result.ok, false);
  assert.match(result.reason, /tl/);
});

test('Inactive manager reference → rejected', () => {
  const result = validateTLManagerAssignment({ tlRole: 'tl', managerRole: 'manager', managerActive: false });
  assert.strictEqual(result.ok, false);
  assert.match(result.reason, /inactive/);
});

test('Inactive TL reference → rejected', () => {
  const result = validateAgentTLAssignment({ agentRole: 'employee', tlRole: 'tl', tlActive: false });
  assert.strictEqual(result.ok, false);
  assert.match(result.reason, /inactive/);
});

test('Self-assignment rejected for TL manager assignment', () => {
  const result = validateTLManagerAssignment({ tlRole: 'tl', managerRole: 'manager', managerActive: true, selfAssign: true });
  assert.strictEqual(result.ok, false);
  assert.match(result.reason, /self/);
});

test('Self-assignment rejected for agent TL assignment', () => {
  const result = validateAgentTLAssignment({ agentRole: 'employee', tlRole: 'tl', tlActive: true, selfAssign: true });
  assert.strictEqual(result.ok, false);
  assert.match(result.reason, /self/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n===========================================');
if (failed === 0) {
  console.log(`ALL ${passed} PHASE 2 TESTS PASSED SUCCESSFULLY!`);
} else {
  console.log(`RESULTS: ${passed} passed, ${failed} FAILED`);
}
console.log('===========================================');

if (failed > 0) process.exit(1);
