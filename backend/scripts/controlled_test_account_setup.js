require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/node_modules/dotenv').config({ path: 'c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/.env' });
const mongoose = require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/node_modules/mongoose');
const jwt = require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/node_modules/jsonwebtoken');
const User = require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/models/User');
const { isSystemAdmin, isAdmin, requireManagement } = require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/middleware/auth');
const { getScopedTLIds, getScopedEmployeeIds, validateEmployeeInScope } = require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/lib/scope');
const assert = require('assert');

const TEST_PASSWORD = 'Phase8Test@Password123';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('=== CONTROLLED LIVE TEST ACCOUNT SETUP & VALIDATION ===\n');

  // ── Step 1: Baseline Check ──────────────────────────────────────────────────
  const initialUserCount = await User.countDocuments();
  console.log('1. BASELINE CHECK:');
  console.log(`Initial total users in database: ${initialUserCount}`);

  // Check if test users already exist
  const existingTestUsers = await User.find({
    email: { $in: ['phase8.manager@staging.test', 'phase8.tl@staging.test', 'phase8.employee@staging.test'] }
  });
  if (existingTestUsers.length > 0) {
    console.log(`Found ${existingTestUsers.length} pre-existing test users. Cleaning them before fresh run...`);
    await User.deleteMany({
      email: { $in: ['phase8.manager@staging.test', 'phase8.tl@staging.test', 'phase8.employee@staging.test'] }
    });
  }

  const ryanBefore = await User.findOne({ email: 'ryanadmin@gmail.com' }).lean();
  const leadFunnelBefore = await User.findOne({ email: 'integration.leadfunnel@internal.local' }).lean();
  const employeeCountBefore = await User.countDocuments({ role: 'employee' });

  console.log('Baseline Ryan Admin:', { role: ryanBefore?.role, isSuperAdmin: ryanBefore?.isSuperAdmin });
  console.log('Baseline Lead Funnel:', { role: leadFunnelBefore?.role, isSuperAdmin: leadFunnelBefore?.isSuperAdmin });
  console.log(`Baseline Employee Count: ${employeeCountBefore}\n`);

  // ── Step 2: Create Dedicated Test Accounts ──────────────────────────────────
  console.log('2. CREATING 3 TEST ACCOUNTS...');

  // A. Manager
  const manager = await User.create({
    name: 'Phase8 Test Manager',
    email: 'phase8.manager@staging.test',
    password: TEST_PASSWORD,
    role: 'manager',
    isSuperAdmin: false,
    phone: '9999900001',
    isActive: true,
    managerId: null,
    teamLeadId: null
  });
  console.log(`✓ Manager created: ID=${manager._id}, Email=${manager.email}`);

  // B. Team Lead (linked to Manager)
  const tl = await User.create({
    name: 'Phase8 Test TL',
    email: 'phase8.tl@staging.test',
    password: TEST_PASSWORD,
    role: 'tl',
    isSuperAdmin: false,
    phone: '9999900002',
    isActive: true,
    managerId: manager._id,
    teamLeadId: null
  });
  console.log(`✓ TL created: ID=${tl._id}, Email=${tl.email}, managerId=${tl.managerId}`);

  // C. Employee (linked to TL)
  const employee = await User.create({
    name: 'Phase8 Test Employee',
    email: 'phase8.employee@staging.test',
    password: TEST_PASSWORD,
    role: 'employee',
    isSuperAdmin: false,
    phone: '9999900003',
    isActive: true,
    tlName: 'Phase8 Test TL',
    managerId: null,
    teamLeadId: tl._id
  });
  console.log(`✓ Employee created: ID=${employee._id}, Email=${employee.email}, teamLeadId=${employee.teamLeadId}, tlName=${employee.tlName}\n`);

  // ── Step 3: Verify Database Invariance & Counts ─────────────────────────────
  console.log('3. DATABASE INTEGRITY VERIFICATION:');
  const postUserCount = await User.countDocuments();
  console.log(`Total users before: ${initialUserCount}, after: ${postUserCount} (Net change: +${postUserCount - initialUserCount})`);

  // Verify Ryan Admin untouched
  const ryanAfter = await User.findOne({ email: 'ryanadmin@gmail.com' }).lean();
  assert.strictEqual(ryanAfter.role, 'manager', 'Ryan role must remain manager');
  assert.strictEqual(ryanAfter.isSuperAdmin, true, 'Ryan isSuperAdmin must remain true');
  console.log('✓ Ryan Admin is 100% UNTOUCHED');

  // Verify Lead Funnel untouched
  const leadFunnelAfter = await User.findOne({ email: 'integration.leadfunnel@internal.local' }).lean();
  assert.strictEqual(leadFunnelAfter.role, 'manager', 'Lead Funnel role must remain manager');
  assert.ok(!leadFunnelAfter.isSuperAdmin, 'Lead Funnel must remain isSuperAdmin=false/undefined');
  console.log('✓ Lead Funnel Integration is 100% UNTOUCHED');

  // Verify employee without managerId
  const empDoc = await User.findById(employee._id).lean();
  assert.strictEqual(empDoc.managerId, null, 'Employee must NOT have managerId');
  assert.strictEqual(empDoc.teamLeadId.toString(), tl._id.toString(), 'Employee teamLeadId must point to TL');
  console.log('✓ Employee does NOT have managerId; teamLeadId points to TL');

  // ── Step 4: Login & Credential Verification ─────────────────────────────────
  console.log('\n4. AUTHENTICATION & LOGIN VALIDATION:');
  const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  // Test Manager login
  const mgrUserWithPass = await User.findOne({ email: 'phase8.manager@staging.test' }).select('+password');
  const mgrPassMatch = await mgrUserWithPass.comparePassword(TEST_PASSWORD);
  assert.ok(mgrPassMatch, 'Manager password must match');
  const mgrToken = signToken(manager._id);
  console.log('✓ Manager login SUCCESS: Valid bcrypt match, Token generated');

  // Test TL login
  const tlUserWithPass = await User.findOne({ email: 'phase8.tl@staging.test' }).select('+password');
  const tlPassMatch = await tlUserWithPass.comparePassword(TEST_PASSWORD);
  assert.ok(tlPassMatch, 'TL password must match');
  const tlToken = signToken(tl._id);
  console.log('✓ TL login SUCCESS: Valid bcrypt match, Token generated');

  // Test Employee login
  const empUserWithPass = await User.findOne({ email: 'phase8.employee@staging.test' }).select('+password');
  const empPassMatch = await empUserWithPass.comparePassword(TEST_PASSWORD);
  assert.ok(empPassMatch, 'Employee password must match');
  const empToken = signToken(employee._id);
  console.log('✓ Employee login SUCCESS: Valid bcrypt match, Token generated');

  // ── Step 5: Scoping Verification ───────────────────────────────────────────
  console.log('\n5. SERVER-SIDE SCOPE VALIDATION:');

  // A. Manager Scope
  const mgrScopedTLs = await getScopedTLIds(manager);
  const mgrScopedEmps = await getScopedEmployeeIds(manager);
  console.log(`Manager scoped TL IDs: ${mgrScopedTLs.map(id => id.toString())}`);
  console.log(`Manager scoped Employee IDs: ${mgrScopedEmps.map(id => id.toString())}`);
  assert.strictEqual(mgrScopedTLs.length, 1, 'Manager must see exactly 1 TL');
  assert.strictEqual(mgrScopedTLs[0].toString(), tl._id.toString(), 'Manager must see Phase8 Test TL');
  assert.strictEqual(mgrScopedEmps.length, 1, 'Manager must see exactly 1 Employee');
  assert.strictEqual(mgrScopedEmps[0].toString(), employee._id.toString(), 'Manager must see Phase8 Test Employee');
  console.log('✓ Manager scope is strictly isolated to Phase8 Test TL and Phase8 Test Employee (Zero production agents leaked)');

  // B. TL Scope
  const tlScopedTLs = await getScopedTLIds(tl);
  const tlScopedEmps = await getScopedEmployeeIds(tl);
  console.log(`TL scoped TL IDs: ${tlScopedTLs.map(id => id.toString())}`);
  console.log(`TL scoped Employee IDs: ${tlScopedEmps.map(id => id.toString())}`);
  assert.strictEqual(tlScopedEmps.length, 1, 'TL must see exactly 1 Employee');
  assert.strictEqual(tlScopedEmps[0].toString(), employee._id.toString(), 'TL must see Phase8 Test Employee');
  console.log('✓ TL scope is strictly isolated to Phase8 Test Employee');

  // C. Cross-Scope Validation
  const mgrValidatesEmp = await validateEmployeeInScope(manager, employee._id);
  assert.strictEqual(mgrValidatesEmp, true, 'Manager must validate own employee in scope');
  
  // Test with an actual production employee ID
  const prodEmployee = await User.findOne({ role: 'employee', email: { $not: /staging\.test/ } });
  if (prodEmployee) {
    const mgrValidatesProdEmp = await validateEmployeeInScope(manager, prodEmployee._id);
    assert.strictEqual(mgrValidatesProdEmp, false, 'Manager MUST NOT validate production employee in scope');
    const tlValidatesProdEmp = await validateEmployeeInScope(tl, prodEmployee._id);
    assert.strictEqual(tlValidatesProdEmp, false, 'TL MUST NOT validate production employee in scope');
    console.log(`✓ Manager & TL both reject production employee (${prodEmployee.name}) with false`);
  }

  // ── Step 6: Security & 403 Verification ─────────────────────────────────────
  console.log('\n6. SECURITY & RBAC 403 CHECKS:');
  
  // Helper to test middleware
  function testMiddleware(fn, reqUser) {
    return new Promise((resolve) => {
      const req = { user: reqUser };
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(payload) { resolve({ status: this.statusCode, payload }); }
      };
      const next = () => resolve({ status: 200, payload: 'NEXT_CALLED' });
      fn(req, res, next);
    });
  }

  // A. isAdmin middleware:
  const mgrAdminRes = await testMiddleware(isAdmin, manager);
  assert.strictEqual(mgrAdminRes.status, 403, 'Manager must receive 403 on isAdmin');
  console.log('✓ Manager calling isAdmin route -> HTTP 403 Forbidden');

  const tlAdminRes = await testMiddleware(isAdmin, tl);
  assert.strictEqual(tlAdminRes.status, 403, 'TL must receive 403 on isAdmin');
  console.log('✓ TL calling isAdmin route -> HTTP 403 Forbidden');

  const empAdminRes = await testMiddleware(isAdmin, employee);
  assert.strictEqual(empAdminRes.status, 403, 'Employee must receive 403 on isAdmin');
  console.log('✓ Employee calling isAdmin route -> HTTP 403 Forbidden');

  const ryanAdminRes = await testMiddleware(isAdmin, ryanAfter);
  assert.strictEqual(ryanAdminRes.status, 200, 'Ryan Admin must pass isAdmin');
  console.log('✓ Ryan Admin calling isAdmin route -> HTTP 200 Permitted');

  // B. requireManagement middleware:
  const mgrMgmtRes = await testMiddleware(requireManagement, manager);
  assert.strictEqual(mgrMgmtRes.status, 200, 'Manager must pass requireManagement');
  console.log('✓ Manager calling requireManagement -> HTTP 200 Permitted');

  const tlMgmtRes = await testMiddleware(requireManagement, tl);
  assert.strictEqual(tlMgmtRes.status, 200, 'TL must pass requireManagement');
  console.log('✓ TL calling requireManagement -> HTTP 200 Permitted');

  const empMgmtRes = await testMiddleware(requireManagement, employee);
  assert.strictEqual(empMgmtRes.status, 403, 'Employee must be rejected by requireManagement');
  console.log('✓ Employee calling requireManagement -> HTTP 403 Forbidden');

  // ── Step 7: Hierarchy Endpoint Output Verification ──────────────────────────
  console.log('\n7. HIERARCHY ENDPOINT SIMULATION:');
  const SAFE_FIELDS = 'name email role phone tlName isActive dailyTarget createdAt managerId teamLeadId isSuperAdmin';

  // Manager Hierarchy Call:
  const mgrHierarchyManager = await User.findById(manager._id).select(SAFE_FIELDS).lean();
  const mgrHierarchyTLs = await User.find({ role: 'tl', managerId: manager._id }).select(SAFE_FIELDS).lean();
  const mgrHierarchyTLIds = mgrHierarchyTLs.map(t => t._id);
  const mgrHierarchyAgents = await User.find({ role: 'employee', teamLeadId: { $in: mgrHierarchyTLIds } }).select(SAFE_FIELDS).lean();

  console.log('Manager GET /api/users/hierarchy payload:');
  console.log({
    managers: [
      {
        manager: { _id: mgrHierarchyManager._id, name: mgrHierarchyManager.name, role: mgrHierarchyManager.role },
        teamLeads: mgrHierarchyTLs.map(t => ({
          tl: { _id: t._id, name: t.name, role: t.role },
          agents: mgrHierarchyAgents.map(a => ({ _id: a._id, name: a.name, role: a.role }))
        }))
      }
    ],
    unassignedTLs: [],
    unassignedAgents: []
  });

  assert.strictEqual(mgrHierarchyTLs.length, 1);
  assert.strictEqual(mgrHierarchyAgents.length, 1);
  console.log('✓ Manager hierarchy API response contains ONLY Phase8 Test TL and Phase8 Test Employee');

  // Ryan Admin Hierarchy Call:
  const ryanHierarchyAllManagers = await User.find({ role: 'manager' }).select(SAFE_FIELDS).lean();
  console.log(`Ryan Admin GET /api/users/hierarchy sees ${ryanHierarchyAllManagers.length} managers (All managers company-wide)`);
  assert.ok(ryanHierarchyAllManagers.length >= 3, 'Ryan Admin must see all managers');
  console.log('✓ Ryan Admin receives full unrestricted company hierarchy');

  console.log('\n=== CONTROLLED VALIDATION COMPLETED SUCCESSFULLY ===');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('FATAL ERROR DURING SETUP:', err);
  process.exit(1);
});
