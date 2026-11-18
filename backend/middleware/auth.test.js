// Run: node --test middleware/auth.test.js
const test = require('node:test');
const assert = require('node:assert');
const { scoped, canAccessEmployee, hasFullAccess, scopeKey } = require('./auth');

const A = '64b000000000000000000001', B = '64b000000000000000000002';
const admin   = { user: { _id: 'x', role: 'admin' }, teamIds: null };
const manager = { user: { _id: 'm1', role: 'manager' }, teamIds: [A] };

test('full access', () => {
  assert.ok(hasFullAccess({ role: 'admin' }));
  assert.ok(hasFullAccess({ role: 'manager', isSuperAdmin: true }));
  assert.ok(hasFullAccess({ role: 'manager', isServiceAccount: true }));
  assert.ok(!hasFullAccess({ role: 'manager' }));
  assert.ok(!hasFullAccess({ role: 'tl' }));
});

test('scoped() leaves admin filters alone and ANDs team for managers', () => {
  assert.deepStrictEqual(scoped(admin, { x: 1 }), { x: 1 });
  // Requested employee outside the team still gets intersected with the team.
  assert.deepStrictEqual(scoped(manager, { employeeId: B }), { employeeId: B, $and: [{ employeeId: { $in: [A] } }] });
  assert.deepStrictEqual(scoped(manager, {}, 'assignedTo'), { $and: [{ assignedTo: { $in: [A] } }] });
});

test('canAccessEmployee', () => {
  assert.ok(canAccessEmployee(admin, B));
  assert.ok(canAccessEmployee(manager, A));
  assert.ok(canAccessEmployee(manager, { _id: A })); // populated doc
  assert.ok(!canAccessEmployee(manager, B));
  assert.ok(!canAccessEmployee(manager, null));      // unassigned
});

test('cache keys never shared between scopes', () => {
  assert.strictEqual(scopeKey(admin), 'all');
  assert.strictEqual(scopeKey(manager), 'u:m1');
});
