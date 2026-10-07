const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');

async function main() {
  console.log('Starting local server for comprehensive regression suite...');
  const server = spawn('node', ['server.js'], { cwd: __dirname, stdio: 'pipe' });

  server.stdout.on('data', d => process.stdout.write(d.toString()));
  server.stderr.on('data', d => process.stderr.write(d.toString()));

  // Wait 3.5s for server startup
  await new Promise(r => setTimeout(r, 3500));

  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      passed++;
      console.log(`[PASS] ${name}`);
    } else {
      failed++;
      console.log(`[FAIL] ${name} ${extra ? '(' + extra + ')' : ''}`);
    }
  }

  const BASE = 'http://localhost:3000';

  try {
    // TEST 1: Student Login creates valid session
    const sLogin = await axios.post(`${BASE}/api/login`, {
      identifier: '9876500060',
      password: '9876500060'
    });
    assert('TEST 1: Student login creates valid session', sLogin.status === 200 && Boolean(sLogin.data.token));
    const sToken = sLogin.data.token;

    // TEST 2: Student Dashboard accessible with 200
    const sDash = await axios.get(`${BASE}/api/student/dashboard`, {
      headers: { Authorization: `Bearer ${sToken}` }
    });
    assert('TEST 2: Fresh session can access /api/student/dashboard -> 200', 
      sDash.status === 200 && sDash.data.user?.referral_code === 'DEMO60');

    // TEST 3: Student Project GET accessible with 200
    const sProj = await axios.get(`${BASE}/api/project`, {
      headers: { Authorization: `Bearer ${sToken}` }
    });
    assert('TEST 3: Same session can access /api/project -> 200', 
      sProj.status === 200 && sProj.data.success === true);

    // TEST 4: Student Referrals accessible with 200
    const sRef = await axios.get(`${BASE}/api/referral/stats`, {
      headers: { Authorization: `Bearer ${sToken}` }
    });
    assert('TEST 4: Same session can access referral stats -> 200', sRef.status === 200);

    // TEST 5: Admin Login
    const aLogin = await axios.post(`${BASE}/api/login`, {
      identifier: 'demo-admin@ai60.com',
      password: 'demo-admin123'
    });
    assert('TEST 5: Admin login succeeds', aLogin.status === 200 && Boolean(aLogin.data.token));
    const aToken = aLogin.data.token;

    // TEST 6: Admin Growth Copilot executes real Gemini
    console.log('Testing Admin Growth Copilot (Gemini API)...');
    const copilot = await axios.post(`${BASE}/api/admin/growth-copilot`, {}, {
      headers: { Authorization: `Bearer ${aToken}` }
    });
    assert('TEST 6: Growth Copilot executes real Gemini analysis', 
      copilot.status === 200 && copilot.data.provider === 'Gemini' && Boolean(copilot.data.analysis?.summary));

    // TEST 7: Unauthenticated request rejected with 401
    try {
      await axios.get(`${BASE}/api/student/dashboard`);
      assert('TEST 7: Logged-out request receives 401', false);
    } catch (e) {
      assert('TEST 7: Logged-out request receives 401', e.response?.status === 401);
    }

    // TEST 8: Student cannot access Admin endpoints
    try {
      await axios.get(`${BASE}/api/admin/analytics`, {
        headers: { Authorization: `Bearer ${sToken}` }
      });
      assert('TEST 8: Student cannot access admin endpoints', false);
    } catch (e) {
      assert('TEST 8: Student cannot access admin endpoints', e.response?.status === 403);
    }

    // TEST 9: Logout invalidates session
    await axios.post(`${BASE}/api/logout`, {}, {
      headers: { Authorization: `Bearer ${sToken}` }
    });
    try {
      await axios.get(`${BASE}/api/student/dashboard`, {
        headers: { Authorization: `Bearer ${sToken}` }
      });
      assert('TEST 9: Logout invalidates session', false);
    } catch (e) {
      assert('TEST 9: Logout invalidates session', e.response?.status === 401);
    }

    console.log(`\n========================================`);
    console.log(`SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);
  } catch (err) {
    console.error('Suite error:', err.response?.status, err.response?.data || err.message);
  } finally {
    server.kill();
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
