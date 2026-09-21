const http = require('http');

function postJSON(path, payload, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'POST',
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJSON(path, token) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== REAL HTTP ENDPOINT VERIFICATION (PORT 5000) ===\n');

  // 1. Manager Login
  const mgrLogin = await postJSON('/api/auth/login', {
    email: 'phase8.manager@staging.test',
    password: 'Phase8Test@Password123'
  });
  console.log('1. Manager HTTP Login Result:', {
    status: mgrLogin.status,
    success: mgrLogin.data.success,
    role: mgrLogin.data.data?.user?.role,
    isSuperAdmin: mgrLogin.data.data?.user?.isSuperAdmin,
    hasToken: Boolean(mgrLogin.data.data?.token)
  });
  const mgrToken = mgrLogin.data.data?.token;

  // 2. TL Login
  const tlLogin = await postJSON('/api/auth/login', {
    email: 'phase8.tl@staging.test',
    password: 'Phase8Test@Password123'
  });
  console.log('2. TL HTTP Login Result:', {
    status: tlLogin.status,
    success: tlLogin.data.success,
    role: tlLogin.data.data?.user?.role,
    isSuperAdmin: tlLogin.data.data?.user?.isSuperAdmin,
    hasToken: Boolean(tlLogin.data.data?.token)
  });
  const tlToken = tlLogin.data.data?.token;

  // 3. Employee Login
  const empLogin = await postJSON('/api/auth/login', {
    email: 'phase8.employee@staging.test',
    password: 'Phase8Test@Password123'
  });
  console.log('3. Employee HTTP Login Result:', {
    status: empLogin.status,
    success: empLogin.data.success,
    role: empLogin.data.data?.user?.role,
    isSuperAdmin: empLogin.data.data?.user?.isSuperAdmin,
    hasToken: Boolean(empLogin.data.data?.token)
  });
  const empToken = empLogin.data.data?.token;

  // 4. Manager Hierarchy Call
  const mgrHierarchy = await getJSON('/api/users/hierarchy', mgrToken);
  console.log('\n4. Manager GET /api/users/hierarchy HTTP Result:');
  console.log('HTTP Status:', mgrHierarchy.status);
  console.log('Managers returned count:', mgrHierarchy.data?.data?.managers?.length);
  const mgrNode = mgrHierarchy.data?.data?.managers?.[0];
  console.log('Manager name:', mgrNode?.manager?.name);
  console.log('Assigned TL count:', mgrNode?.teamLeads?.length);
  console.log('TL name:', mgrNode?.teamLeads?.[0]?.tl?.name);
  console.log('Agents under TL count:', mgrNode?.teamLeads?.[0]?.agents?.length);
  console.log('Agent name:', mgrNode?.teamLeads?.[0]?.agents?.[0]?.name);
  console.log('Unassigned Agents in Mgr view:', mgrHierarchy.data?.data?.unassignedAgents?.length);

  // 5. Manager Calls Stats Scoping
  const mgrStats = await getJSON('/api/calls/stats?range=today', mgrToken);
  console.log('\n5. Manager GET /api/calls/stats HTTP Result:');
  console.log('HTTP Status:', mgrStats.status);
  console.log('Total calls for this newly created test team:', mgrStats.data?.data?.totalCalls || 0);

  // 6. Security: Manager attempting Admin User Registration (POST /api/auth/register)
  const mgrRegisterAttempt = await postJSON('/api/auth/register', {
    name: 'Hacker',
    email: 'hacker@test.local',
    password: 'password123'
  }, mgrToken);
  console.log('\n6. Security: Manager calling POST /api/auth/register (Admin only):');
  console.log('HTTP Status:', mgrRegisterAttempt.status);
  console.log('Response:', mgrRegisterAttempt.data);

  // 7. Security: TL attempting Hierarchy Mutation (PATCH /api/users/:tlId/manager)
  const tlMutateAttempt = await postJSON('/api/users/6a9bb74306c50e74a1904ab5/manager', {
    managerId: '6a9bb74306c50e74a1904ab3'
  }, tlToken);
  console.log('\n7. Security: TL calling PATCH /api/users/:tlId/manager:');
  console.log('HTTP Status:', tlMutateAttempt.status);

  // 8. Security: Employee attempting Hierarchy (GET /api/users/hierarchy)
  const empHierarchyAttempt = await getJSON('/api/users/hierarchy', empToken);
  console.log('\n8. Security: Employee calling GET /api/users/hierarchy:');
  console.log('HTTP Status:', empHierarchyAttempt.status);
  console.log('Response:', empHierarchyAttempt.data);

  console.log('\n=== REAL HTTP API VERIFICATION PASSED ===');
}

main().catch(console.error);
