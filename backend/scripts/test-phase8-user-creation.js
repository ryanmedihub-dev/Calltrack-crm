/**
 * test-phase8-user-creation.js — Automated test suite for Phase 8
 * Safe Admin User Creation Role Support
 *
 * Runs self-contained and offline using an in-process Express instance
 * and mocked/in-memory Mongoose store to avoid modifying staging database.
 */

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase8-test-jwt-secret-xyz123';

const assert = require('assert');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

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
// Mock In-Memory Database
// ─────────────────────────────────────────────────────────────────────────────

const mockDb = [
  {
    _id: new mongoose.Types.ObjectId('888800000000000000000001'),
    name: 'Admin Test User',
    email: 'admin.test@example.com',
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
  },
  {
    _id: new mongoose.Types.ObjectId('888800000000000000000002'),
    name: 'Active Manager User',
    email: 'active.manager@example.com',
    role: 'manager',
    isActive: true,
    createdAt: new Date(),
  },
  {
    _id: new mongoose.Types.ObjectId('888800000000000000000003'),
    name: 'Inactive Manager User',
    email: 'inactive.manager@example.com',
    role: 'manager',
    isActive: false,
    createdAt: new Date(),
  },
  {
    _id: new mongoose.Types.ObjectId('888800000000000000000004'),
    name: 'Active TL User',
    email: 'active.tl@example.com',
    role: 'tl',
    managerId: new mongoose.Types.ObjectId('888800000000000000000002'),
    isActive: true,
    createdAt: new Date(),
  },
  {
    _id: new mongoose.Types.ObjectId('888800000000000000000005'),
    name: 'Inactive TL User',
    email: 'inactive.tl@example.com',
    role: 'tl',
    isActive: false,
    createdAt: new Date(),
  },
  {
    _id: new mongoose.Types.ObjectId('888800000000000000000006'),
    name: 'Standard Employee User',
    email: 'standard.emp@example.com',
    role: 'employee',
    isActive: true,
    createdAt: new Date(),
  },
];

// Save original methods
const origFindById = User.findById;
const origFindOne = User.findOne;
const origCreate = User.create;

// Patch User methods
User.findById = (id) => {
  const doc = mockDb.find((u) => u._id.toString() === id.toString());
  return {
    select: () => ({ ...doc }),
    lean: async () => (doc ? { ...doc } : null),
    then: (resolve) => resolve(doc ? { ...doc } : null),
  };
};

User.findOne = (query) => {
  const doc = mockDb.find((u) => {
    if (query.email && u.email.toLowerCase() === query.email.toLowerCase()) return true;
    return false;
  });
  return {
    select: () => ({ ...doc }),
    lean: async () => (doc ? { ...doc } : null),
    then: (resolve) => resolve(doc ? { ...doc } : null),
  };
};

User.create = async (doc) => {
  const newDoc = {
    _id: new mongoose.Types.ObjectId(),
    isActive: true,
    createdAt: new Date(),
    ...doc,
  };
  mockDb.push(newDoc);
  return {
    ...newDoc,
    toJSON: () => {
      const copy = { ...newDoc };
      delete copy.password;
      return copy;
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Setup Test Server
// ─────────────────────────────────────────────────────────────────────────────

const employeeRoutes = require('../routes/employees');
const app = express();
app.use(express.json());
app.use('/api/employees', employeeRoutes);

function signToken(userId) {
  return jwt.sign({ id: userId.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function request(server, options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path: options.path,
        method: options.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (_) {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite Execution
// ─────────────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n======================================================');
  console.log('  CALLTRACK CRM - PHASE 8 SAFE USER CREATION SUITE');
  console.log('======================================================\n');

  const server = app.listen(0);
  const adminToken = signToken(mockDb[0]._id);
  const managerToken = signToken(mockDb[1]._id);
  const tlToken = signToken(mockDb[3]._id);
  const empToken = signToken(mockDb[5]._id);

  try {
    console.log('--- 1. Admin Role-Based Creation Capabilities ---');

    await itAsync('Admin can create employee with explicit role: employee', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        { name: 'New Agent', email: 'agent.new@example.com', password: 'password123', role: 'employee' }
      );
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.role, 'employee');
      assert.strictEqual(res.body.message, 'Employee created');
    });

    await itAsync('Admin can create manager with role: manager', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        { name: 'New Manager', email: 'mgr.new@example.com', password: 'password123', role: 'manager' }
      );
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.role, 'manager');
      assert.strictEqual(res.body.data.managerId, null);
      assert.strictEqual(res.body.data.teamLeadId, null);
    });

    await itAsync('Admin can create TL with role: tl (unassigned)', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        { name: 'New TL', email: 'tl.new@example.com', password: 'password123', role: 'tl' }
      );
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.role, 'tl');
      assert.strictEqual(res.body.data.managerId, null);
      assert.strictEqual(res.body.data.teamLeadId, null);
    });

    await itAsync('Existing employee creation without role field defaults to employee', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        { name: 'Default Agent', email: 'agent.default@example.com', password: 'password123' }
      );
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.role, 'employee');
      assert.strictEqual(res.body.message, 'Employee created');
    });

    console.log('\n--- 2. Role Validation & Access Control ---');

    await itAsync('Admin cannot create user with invalid role', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        { name: 'Invalid User', email: 'invalid.role@example.com', password: 'password123', role: 'superadmin' }
      );
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /Invalid role/);
    });

    await itAsync('Non-admin (Manager) cannot create manager (403 Forbidden)', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${managerToken}` } },
        { name: 'Rogue Manager', email: 'rogue.mgr@example.com', password: 'password123', role: 'manager' }
      );
      assert.strictEqual(res.status, 403);
    });

    await itAsync('Non-admin (TL) cannot create TL (403 Forbidden)', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${tlToken}` } },
        { name: 'Rogue TL', email: 'rogue.tl@example.com', password: 'password123', role: 'tl' }
      );
      assert.strictEqual(res.status, 403);
    });

    await itAsync('Non-admin (Employee) cannot create user (403 Forbidden)', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${empToken}` } },
        { name: 'Rogue Agent', email: 'rogue.emp@example.com', password: 'password123', role: 'employee' }
      );
      assert.strictEqual(res.status, 403);
    });

    console.log('\n--- 3. Role-Specific Hierarchy Field Enforcement ---');

    await itAsync('Employee cannot receive managerId (400 Bad Request)', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        {
          name: 'Bad Agent',
          email: 'bad.agent@example.com',
          password: 'password123',
          role: 'employee',
          managerId: mockDb[1]._id.toString(),
        }
      );
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /cannot be assigned a managerId/i);
    });

    await itAsync('Manager cannot receive managerId (400 Bad Request)', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        {
          name: 'Bad Manager',
          email: 'bad.mgr@example.com',
          password: 'password123',
          role: 'manager',
          managerId: mockDb[1]._id.toString(),
        }
      );
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /cannot be assigned a managerId/i);
    });

    await itAsync('Manager cannot receive teamLeadId (400 Bad Request)', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        {
          name: 'Bad Manager TL',
          email: 'bad.mgr.tl@example.com',
          password: 'password123',
          role: 'manager',
          teamLeadId: mockDb[3]._id.toString(),
        }
      );
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /cannot be assigned a teamLeadId/i);
    });

    await itAsync('Admin cannot receive hierarchy assignment fields (400 Bad Request)', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        {
          name: 'Bad Admin',
          email: 'bad.admin@example.com',
          password: 'password123',
          role: 'admin',
          managerId: mockDb[1]._id.toString(),
        }
      );
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /cannot be assigned a managerId/i);
    });

    await itAsync('TL teamLeadId must be rejected (400 Bad Request)', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        {
          name: 'Bad TL Nesting',
          email: 'bad.tl.nest@example.com',
          password: 'password123',
          role: 'tl',
          teamLeadId: mockDb[3]._id.toString(),
        }
      );
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /cannot be assigned a teamLeadId/i);
    });

    console.log('\n--- 4. Validated Reference Lookups ---');

    await itAsync('TL managerId must reference an actual manager (rejects employee reference)', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        {
          name: 'TL Wrong Mgr',
          email: 'tl.wrongmgr@example.com',
          password: 'password123',
          role: 'tl',
          managerId: mockDb[5]._id.toString(), // employee ID
        }
      );
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /managerId must point to a user with role 'manager'/i);
    });

    await itAsync('TL managerId rejects inactive manager', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        {
          name: 'TL Inact Mgr',
          email: 'tl.inactmgr@example.com',
          password: 'password123',
          role: 'tl',
          managerId: mockDb[2]._id.toString(), // Inactive manager
        }
      );
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /inactive/i);
    });

    await itAsync('TL managerId with valid active manager is accepted', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        {
          name: 'TL Valid Mgr',
          email: 'tl.validmgr@example.com',
          password: 'password123',
          role: 'tl',
          managerId: mockDb[1]._id.toString(), // Active manager
        }
      );
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.role, 'tl');
      assert.strictEqual(res.body.data.managerId.toString(), mockDb[1]._id.toString());
    });

    await itAsync('Employee teamLeadId must reference an actual TL (rejects manager reference)', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        {
          name: 'Emp Wrong TL',
          email: 'emp.wrongtl@example.com',
          password: 'password123',
          role: 'employee',
          teamLeadId: mockDb[1]._id.toString(), // Manager ID
        }
      );
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /teamLeadId must point to a user with role 'tl'/i);
    });

    await itAsync('Employee teamLeadId rejects inactive TL', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        {
          name: 'Emp Inact TL',
          email: 'emp.inacttl@example.com',
          password: 'password123',
          role: 'employee',
          teamLeadId: mockDb[4]._id.toString(), // Inactive TL
        }
      );
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /inactive/i);
    });

    await itAsync('Employee teamLeadId with valid active TL is accepted', async () => {
      const res = await request(
        server,
        { path: '/api/employees', headers: { authorization: `Bearer ${adminToken}` } },
        {
          name: 'Emp Valid TL',
          email: 'emp.validtl@example.com',
          password: 'password123',
          role: 'employee',
          teamLeadId: mockDb[3]._id.toString(), // Active TL
        }
      );
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.role, 'employee');
      assert.strictEqual(res.body.data.teamLeadId.toString(), mockDb[3]._id.toString());
    });

    console.log('\n======================================================');
    console.log(`  Phase 8 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
  } finally {
    server.close();
    // Restore original User methods
    User.findById = origFindById;
    User.findOne = origFindOne;
    User.create = origCreate;
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
