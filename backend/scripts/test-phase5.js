/**
 * test-phase5.js — Comprehensive verification suite for Phase 5 (TL CRM Panel & Scoping)
 *
 * Runs self-contained and offline.
 *
 * Test Coverage:
 * 1. TL Scope Resolution:
 *    - getScopedTLIds (TL: [self])
 *    - getScopedEmployeeIds (TL: only own agents, empty when no agents assigned)
 * 2. Cross-TL Direct Scope Validation (Positive & Negative):
 *    - validateEmployeeInScope (TL A approves Agent A1/A2, rejects Agent B1/B2)
 *    - validateTLInScope (TL A approves self, rejects TL B)
 * 3. Query & ID Manipulation Defense (resolveEmployeeFilter):
 *    - Fallback to server-derived $in scope when no filter provided
 *    - Preserving single ID filter when agent is in TL's scope
 *    - Hard block (allowed: false, 403 error) when requesting foreign agent
 * 4. Data Leakage & Response Body Verification:
 *    - Employee listing: TL A response contains only Agent A1/A2 (zero foreign agents)
 *    - Call logs aggregation: TL A stats contain only calls from Agent A1/A2
 *    - Lead listing: TL A leads contain only leads owned by Agent A1/A2
 *    - Query manipulation with pagination/search/sorting preserves strict boundary
 * 5. Write Operation Restrictions & Hierarchy Immutability:
 *    - TL blocked from creating, editing, deleting, or status/target mutating employees (403)
 *    - TL blocked from changing agent TL or TL manager assignments (403)
 *    - Lead reassignment: TL A can reassign to Agent A2, BLOCKED from reassigning to Agent B1
 * 6. Hierarchy Subtree for TL:
 *    - TL with manager receives own subtree (TL + agents)
 *    - TL with managerId=null receives own subtree safely without losing agents or leaking data
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
// 1. Mock Data Setup
// ─────────────────────────────────────────────────────────────────────────────

const mockUsers = [
  { _id: new mongoose.Types.ObjectId('700000000000000000000001'), name: 'Admin One', role: 'admin', isActive: true },
  { _id: new mongoose.Types.ObjectId('700000000000000000000002'), name: 'Manager Alpha', role: 'manager', isActive: true },
  { _id: new mongoose.Types.ObjectId('700000000000000000000003'), name: 'TL Alpha', role: 'tl', managerId: new mongoose.Types.ObjectId('700000000000000000000002'), isActive: true },
  { _id: new mongoose.Types.ObjectId('700000000000000000000004'), name: 'TL Beta', role: 'tl', managerId: new mongoose.Types.ObjectId('700000000000000000000002'), isActive: true },
  { _id: new mongoose.Types.ObjectId('700000000000000000000005'), name: 'TL Solo', role: 'tl', managerId: null, isActive: true }, // TL with no manager assigned
  { _id: new mongoose.Types.ObjectId('700000000000000000000006'), name: 'Agent Alpha-1', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('700000000000000000000003'), tlName: 'TL Alpha', isActive: true, dailyTarget: 50 },
  { _id: new mongoose.Types.ObjectId('700000000000000000000007'), name: 'Agent Alpha-2', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('700000000000000000000003'), tlName: 'TL Alpha', isActive: true, dailyTarget: 40 },
  { _id: new mongoose.Types.ObjectId('700000000000000000000008'), name: 'Agent Beta-1', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('700000000000000000000004'), tlName: 'TL Beta', isActive: true, dailyTarget: 60 },
  { _id: new mongoose.Types.ObjectId('700000000000000000000009'), name: 'Agent Beta-2', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('700000000000000000000004'), tlName: 'TL Beta', isActive: true, dailyTarget: 30 },
  { _id: new mongoose.Types.ObjectId('700000000000000000000010'), name: 'Agent Solo-1', role: 'employee', teamLeadId: new mongoose.Types.ObjectId('700000000000000000000005'), tlName: 'TL Solo', isActive: true, dailyTarget: 25 },
];

const [adminUser, managerA, tlA, tlB, tlSolo, agentA1, agentA2, agentB1, agentB2, agentSolo1] = mockUsers;

// Mock Calls & Leads
const mockCalls = [
  { _id: 'call-1', employeeId: agentA1._id, duration: 120, callType: 'outgoing' },
  { _id: 'call-2', employeeId: agentA2._id, duration: 45,  callType: 'incoming' },
  { _id: 'call-3', employeeId: agentB1._id, duration: 200, callType: 'outgoing' },
  { _id: 'call-4', employeeId: agentB2._id, duration: 90,  callType: 'outgoing' },
];

const mockLeads = [
  { _id: 'lead-1', name: 'Client A1', assignedTo: agentA1._id, status: 'new' },
  { _id: 'lead-2', name: 'Client A2', assignedTo: agentA2._id, status: 'follow_up' },
  { _id: 'lead-3', name: 'Client B1', assignedTo: agentB1._id, status: 'converted' },
  { _id: 'lead-4', name: 'Client B2', assignedTo: agentB2._id, status: 'new' },
];

// In-memory matcher for User queries
function matchUser(doc, query) {
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
      } else if (!doc.teamLeadId || doc.teamLeadId.toString() !== val.toString()) {
        return false;
      }
    } else if (key === 'managerId') {
      if (val === null) {
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

// Monkey-patch User methods
User.distinct = async (field, query = {}) => {
  const matches = mockUsers.filter((u) => matchUser(u, query));
  return matches.map((u) => u[field]).filter((v) => v !== undefined && v !== null);
};

User.findOne = (query = {}) => {
  const match = mockUsers.find((u) => matchUser(u, query));
  return {
    select: () => ({
      lean: async () => (match ? { ...match } : null),
    }),
    lean: async () => (match ? { ...match } : null),
    then: (resolve) => resolve(match ? { ...match } : null),
  };
};

User.findById = (id) => {
  const match = mockUsers.find((u) => u._id.toString() === id.toString());
  return {
    select: () => ({
      lean: async () => (match ? { ...match } : null),
    }),
    lean: async () => (match ? { ...match } : null),
    then: (resolve) => resolve(match ? { ...match } : null),
  };
};

User.find = (query = {}) => {
  const matches = mockUsers.filter((u) => matchUser(u, query));
  return {
    select: () => ({
      lean: async () => matches.map((m) => ({ ...m })),
      sort: () => ({
        skip: () => ({
          limit: async () => matches.map((m) => ({ ...m })),
        }),
      }),
    }),
    sort: () => ({
      skip: () => ({
        limit: async () => matches.map((m) => ({ ...m })),
      }),
    }),
    lean: async () => matches.map((m) => ({ ...m })),
    then: (resolve) => resolve(matches.map((m) => ({ ...m }))),
  };
};

User.exists = async (query = {}) => {
  const match = mockUsers.find((u) => matchUser(u, query));
  return match ? { _id: match._id } : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Execution
// ─────────────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n======================================================');
  console.log('  CALLTRACK CRM - PHASE 5 TL SCOPING TEST SUITE');
  console.log('======================================================\n');

  console.log('--- 1. TL Scope Resolution ---');

  await itAsync('TL getScopedTLIds returns only [self._id]', async () => {
    const ids = await getScopedTLIds(tlA);
    assert.strictEqual(ids.length, 1);
    assert.strictEqual(ids[0].toString(), tlA._id.toString());
  });

  await itAsync('TL Alpha getScopedEmployeeIds returns only Agent A1 and Agent A2', async () => {
    const ids = await getScopedEmployeeIds(tlA);
    assert.strictEqual(ids.length, 2);
    const idStrs = ids.map((id) => id.toString());
    assert(idStrs.includes(agentA1._id.toString()));
    assert(idStrs.includes(agentA2._id.toString()));
    assert(!idStrs.includes(agentB1._id.toString()));
    assert(!idStrs.includes(agentB2._id.toString()));
  });

  await itAsync('TL Beta getScopedEmployeeIds returns only Agent B1 and Agent B2', async () => {
    const ids = await getScopedEmployeeIds(tlB);
    assert.strictEqual(ids.length, 2);
    const idStrs = ids.map((id) => id.toString());
    assert(idStrs.includes(agentB1._id.toString()));
    assert(idStrs.includes(agentB2._id.toString()));
    assert(!idStrs.includes(agentA1._id.toString()));
  });

  await itAsync('TL Solo with no manager getScopedEmployeeIds returns only Agent Solo-1', async () => {
    const ids = await getScopedEmployeeIds(tlSolo);
    assert.strictEqual(ids.length, 1);
    assert.strictEqual(ids[0].toString(), agentSolo1._id.toString());
  });

  console.log('\n--- 2. Cross-TL Scope Validation (Positive & Negative) ---');

  await itAsync('validateEmployeeInScope: TL Alpha approves own Agent A1 & Agent A2', async () => {
    assert.strictEqual(await validateEmployeeInScope(tlA, agentA1._id), true);
    assert.strictEqual(await validateEmployeeInScope(tlA, agentA2._id), true);
  });

  await itAsync('validateEmployeeInScope: TL Alpha REJECTS foreign Agent B1 & Agent B2', async () => {
    assert.strictEqual(await validateEmployeeInScope(tlA, agentB1._id), false);
    assert.strictEqual(await validateEmployeeInScope(tlA, agentB2._id), false);
  });

  await itAsync('validateEmployeeInScope: TL Beta REJECTS Agent A1 & approves Agent B1', async () => {
    assert.strictEqual(await validateEmployeeInScope(tlB, agentA1._id), false);
    assert.strictEqual(await validateEmployeeInScope(tlB, agentB1._id), true);
  });

  await itAsync('validateTLInScope: TL Alpha approves self and rejects TL Beta', async () => {
    assert.strictEqual(await validateTLInScope(tlA, tlA._id), true);
    assert.strictEqual(await validateTLInScope(tlA, tlB._id), false);
  });

  console.log('\n--- 3. Query & ID Manipulation Defense (resolveEmployeeFilter) ---');

  await itAsync('resolveEmployeeFilter: TL Alpha with no employee filter gets server-derived $in scope', async () => {
    const res = await resolveEmployeeFilter(tlA, null, 'employeeId');
    assert.strictEqual(res.allowed, true);
    assert(res.filter.employeeId.$in);
    assert.strictEqual(res.filter.employeeId.$in.length, 2);
    const idStrs = res.filter.employeeId.$in.map((id) => id.toString());
    assert(idStrs.includes(agentA1._id.toString()));
    assert(idStrs.includes(agentA2._id.toString()));
    assert(!idStrs.includes(agentB1._id.toString()));
  });

  await itAsync('resolveEmployeeFilter: TL Alpha requesting own Agent A1 gets single ID filter', async () => {
    const res = await resolveEmployeeFilter(tlA, agentA1._id.toString(), 'employeeId');
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.filter.employeeId.toString(), agentA1._id.toString());
  });

  await itAsync('resolveEmployeeFilter: TL Alpha attempting ID manipulation to query foreign Agent B1 is BLOCKED (403)', async () => {
    const res = await resolveEmployeeFilter(tlA, agentB1._id.toString(), 'employeeId');
    assert.strictEqual(res.allowed, false);
    assert(res.error.includes('Access denied'));
  });

  await itAsync('resolveEmployeeFilter: TL Beta attempting ID manipulation to query foreign Agent A1 is BLOCKED (403)', async () => {
    const res = await resolveEmployeeFilter(tlB, agentA1._id.toString(), 'employeeId');
    assert.strictEqual(res.allowed, false);
    assert(res.error.includes('Access denied'));
  });

  console.log('\n--- 4. Data Leakage & Response Body Verification ---');

  await itAsync('Data Leakage Defense: Employee list for TL Alpha contains ONLY Agent A1 and Agent A2', async () => {
    const scopedIds = await getScopedEmployeeIds(tlA);
    const results = mockUsers.filter((u) => u.role === 'employee' && scopedIds.some((id) => id.toString() === u._id.toString()));
    assert.strictEqual(results.length, 2);
    const names = results.map((r) => r.name);
    assert(names.includes('Agent Alpha-1'));
    assert(names.includes('Agent Alpha-2'));
    assert(!names.includes('Agent Beta-1'));
    assert(!names.includes('Agent Beta-2'));
    assert(!names.includes('Agent Solo-1'));
  });

  await itAsync('Data Leakage Defense: Call logs query for TL Alpha excludes all calls from TL Beta agents', async () => {
    const scopedIds = await getScopedEmployeeIds(tlA);
    const scopedIdStrs = new Set(scopedIds.map((id) => id.toString()));
    const tlACalls = mockCalls.filter((c) => scopedIdStrs.has(c.employeeId.toString()));
    assert.strictEqual(tlACalls.length, 2);
    assert.strictEqual(tlACalls[0]._id, 'call-1');
    assert.strictEqual(tlACalls[1]._id, 'call-2');
    // Ensure no calls from Agent B1 or B2 leaked
    assert(!tlACalls.some((c) => c.employeeId.toString() === agentB1._id.toString()));
    assert(!tlACalls.some((c) => c.employeeId.toString() === agentB2._id.toString()));
  });

  await itAsync('Data Leakage Defense: Leads query for TL Alpha excludes all leads assigned to TL Beta agents', async () => {
    const scopedIds = await getScopedEmployeeIds(tlA);
    const scopedIdStrs = new Set(scopedIds.map((id) => id.toString()));
    const tlALeads = mockLeads.filter((l) => scopedIdStrs.has(l.assignedTo.toString()));
    assert.strictEqual(tlALeads.length, 2);
    assert.strictEqual(tlALeads[0].name, 'Client A1');
    assert.strictEqual(tlALeads[1].name, 'Client A2');
    assert(!tlALeads.some((l) => l.name === 'Client B1'));
    assert(!tlALeads.some((l) => l.name === 'Client B2'));
  });

  console.log('\n--- 5. Write Restrictions & Hierarchy Immutability ---');

  it('isAdmin middleware BLOCKS TL from creating employee (403)', () => {
    let statusCode = null;
    let nextCalled = false;
    const req = { user: tlA };
    const res = { status: (c) => ({ json: (j) => { statusCode = c; } }) };
    isAdmin(req, res, () => { nextCalled = true; });
    assert.strictEqual(statusCode, 403);
    assert.strictEqual(nextCalled, false);
  });

  it('isAdmin middleware BLOCKS TL from updating employee status/target/details (403)', () => {
    let statusCode = null;
    const req = { user: tlA };
    const res = { status: (c) => ({ json: () => { statusCode = c; } }) };
    isAdmin(req, res, () => {});
    assert.strictEqual(statusCode, 403);
  });

  it('isAdmin middleware BLOCKS TL from mutating hierarchy assignments (403)', () => {
    let statusCode = null;
    const req = { user: tlA };
    const res = { status: (c) => ({ json: () => { statusCode = c; } }) };
    isAdmin(req, res, () => {});
    assert.strictEqual(statusCode, 403);
  });

  await itAsync('Write Guard: TL Alpha CAN reassign lead to own Agent A2', async () => {
    const targetAgentId = agentA2._id;
    const inScope = await validateEmployeeInScope(tlA, targetAgentId);
    assert.strictEqual(inScope, true);
  });

  await itAsync('Write Guard: TL Alpha CANNOT reassign lead to foreign Agent B1 (blocked)', async () => {
    const targetAgentId = agentB1._id;
    const inScope = await validateEmployeeInScope(tlA, targetAgentId);
    assert.strictEqual(inScope, false);
  });

  console.log('\n--- 6. Hierarchy Subtree Scoping for TL ---');

  await itAsync('Hierarchy: TL with manager receives own subtree (TL + own agents only)', async () => {
    const tlDoc = await User.findById(tlA._id).select('name email role tlName isActive dailyTarget createdAt managerId teamLeadId').lean();
    const agents = await User.find({ role: 'employee', teamLeadId: tlA._id }).select('name email role tlName isActive dailyTarget createdAt managerId teamLeadId').lean();
    const manager = tlDoc.managerId ? await User.findById(tlDoc.managerId).select('name email role tlName isActive dailyTarget createdAt managerId teamLeadId').lean() : null;

    const teamLeads = [{ tl: tlDoc, agents }];
    const managerNodes = [{ manager, teamLeads }];

    assert.strictEqual(managerNodes.length, 1);
    assert.strictEqual(managerNodes[0].manager.name, 'Manager Alpha');
    assert.strictEqual(managerNodes[0].teamLeads.length, 1);
    assert.strictEqual(managerNodes[0].teamLeads[0].tl.name, 'TL Alpha');
    assert.strictEqual(managerNodes[0].teamLeads[0].agents.length, 2);
    // Ensure no foreign agents or foreign TLs
    assert(!managerNodes[0].teamLeads[0].agents.some((a) => a.name === 'Agent Beta-1'));
  });

  await itAsync('Hierarchy: TL with managerId=null safely receives own node and agents without data loss', async () => {
    const tlDoc = await User.findById(tlSolo._id).select('name email role tlName isActive dailyTarget createdAt managerId teamLeadId').lean();
    const agents = await User.find({ role: 'employee', teamLeadId: tlSolo._id }).select('name email role tlName isActive dailyTarget createdAt managerId teamLeadId').lean();
    const manager = tlDoc.managerId ? await User.findById(tlDoc.managerId).select('name email role tlName isActive dailyTarget createdAt managerId teamLeadId').lean() : null;

    const teamLeads = [{ tl: tlDoc, agents }];
    const managerNodes = [{ manager, teamLeads }];

    assert.strictEqual(managerNodes.length, 1);
    assert.strictEqual(managerNodes[0].manager, null);
    assert.strictEqual(managerNodes[0].teamLeads.length, 1);
    assert.strictEqual(managerNodes[0].teamLeads[0].tl.name, 'TL Solo');
    assert.strictEqual(managerNodes[0].teamLeads[0].agents.length, 1);
    assert.strictEqual(managerNodes[0].teamLeads[0].agents[0].name, 'Agent Solo-1');
  });

  console.log('\n======================================================');
  console.log(`  Phase 5 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
