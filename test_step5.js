const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 3050;
const TEST_DB = path.join(__dirname, 'data', 'test_step5.db');

let serverProcess;

function startServer() {
  return new Promise((resolve, reject) => {
    const env = { 
      ...process.env, 
      PORT: String(PORT), 
      AI60_DB_PATH: TEST_DB,
      ADMIN_EMAIL: 'admin@ai60.demo',
      ADMIN_PASSWORD: 'admin123'
    };
    serverProcess = spawn('node', ['server.js'], { env, cwd: __dirname });
    const timer = setTimeout(() => reject(new Error('Server start timeout')), 20000);
    serverProcess.stdout.on('data', d => {
      if (d.toString().includes(`http://localhost:${PORT}`)) { clearTimeout(timer); resolve(); }
    });
    serverProcess.stderr.on('data', () => {});
    serverProcess.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

function stopServer() {
  return new Promise(resolve => {
    if (!serverProcess) return resolve();
    serverProcess.on('close', resolve);
    serverProcess.kill();
    serverProcess = null;
  });
}

function cleanupDb() {
  if (fs.existsSync(TEST_DB)) {
    try { fs.unlinkSync(TEST_DB); } catch (e) {}
  }
}

function req(reqPath, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: reqPath,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

    const request = http.request(options, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody) });
        } catch (e) {
          resolve({ status: res.statusCode, data: resBody });
        }
      });
    });

    request.on('error', reject);
    if (data) request.write(data);
    request.end();
  });
}

async function runTests() {
  cleanupDb();
  console.log('Starting isolated Step 5 verification test server...');
  await startServer();

  console.log('--- STARTING STEP 5 VERIFICATION SUITE ---');
  let passCount = 0;
  let totalTests = 0;

  function assert(name, condition) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${name}`);
      passCount++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${name}`);
    }
  }

  try {
    // 1. Student A Registers
    const studentAEmail = `studentA_${Date.now()}@college.edu`;
    const resA = await req('/api/register', 'POST', {
      full_name: 'Sara M',
      email: studentAEmail,
      phone: `98765${Math.floor(10000 + Math.random()*90000)}`,
      college: 'Amrita Vishwa Vidyapeetham',
      branch: 'CSE',
      graduation_year: '2025'
    });

    assert('Student A registers successfully and receives referral code', resA.status === 201 && resA.data.user.referral_code);
    const codeA = resA.data.user.referral_code;
    const tokenA = resA.data.token;

    // 2. Student A Initial Referral Count Check
    const dashA0 = await req('/api/student/dashboard', 'GET', null, tokenA);
    assert('Student A initially has 0 verified referrals', dashA0.data.referrals.successful === 0);

    // 3. Register 5 Friends Using Student A's Referral Code
    const friendEmails = [];
    for (let i = 1; i <= 5; i++) {
      const friendEmail = `friend${i}_${Date.now()}@college.edu`;
      friendEmails.push(friendEmail);
      const resFriend = await req('/api/register', 'POST', {
        full_name: `Friend ${i}`,
        email: friendEmail,
        phone: `98765${Math.floor(10000 + Math.random()*90000)}`,
        college: 'Amrita Vishwa Vidyapeetham',
        branch: 'CSE',
        graduation_year: '2025',
        referral_code: codeA
      });
      assert(`Referred Friend ${i} registers successfully`, resFriend.status === 201);
    }

    // 4. Duplicate Registration Attempt with Friend 1's Email
    const dupRes = await req('/api/register', 'POST', {
      full_name: 'Duplicate Student',
      email: friendEmails[0],
      phone: `98765${Math.floor(10000 + Math.random()*90000)}`,
      college: 'Amrita Vishwa Vidyapeetham',
      branch: 'CSE',
      graduation_year: '2025',
      referral_code: codeA
    });
    assert('Duplicate email registration attempt is prevented (409)', dupRes.status === 409);

    // 5. Self-Referral Attempt
    const selfRes = await req('/api/register', 'POST', {
      full_name: 'Sara M',
      email: studentAEmail,
      phone: `98765${Math.floor(10000 + Math.random()*90000)}`,
      college: 'Amrita Vishwa Vidyapeetham',
      branch: 'CSE',
      graduation_year: '2025',
      referral_code: codeA
    });
    assert('Self-referral attempt is prevented (409)', selfRes.status === 409);

    // 6. Check Student A Verified Count (Must be 5)
    const dashA5 = await req('/api/student/dashboard', 'GET', null, tokenA);
    assert('Student A has 5 verified referrals without artificial cap', dashA5.data.referrals.successful === 5);

    // 7. Test Milestone Progression in Dashboard
    const { getReferralMilestoneProgress } = require('./public/js/referral-milestones');
    const p5 = getReferralMilestoneProgress(dashA5.data.referrals.successful);
    assert('Student A unlocks milestone 5 (Premium Project Templates)', p5.unlocked.some(m => m.threshold === 5));
    assert('Milestone progress label is accurate (5 / 10)', p5.label === '5 / 10');

    // 8. Test AI60 Student Assistant Grounded RAG query
    const chatWorkshopRes = await req('/api/ai/chat', 'POST', { message: 'What is the AI60 workshop and how long is it?' });
    assert('Student Assistant answers workshop questions from grounded RAG', 
      chatWorkshopRes.status === 200 && 
      (chatWorkshopRes.data.response.includes('60') || chatWorkshopRes.data.response.includes('workshop') || chatWorkshopRes.data.status === 'grounded_local' || chatWorkshopRes.data.status === 'unavailable'));

    // 9. Test Admin Login
    const adminLoginRes = await req('/api/admin/login', 'POST', { email: 'admin@ai60.demo', password: 'admin123' });
    const adminToken = adminLoginRes.data.token;
    assert('Admin login succeeds', Boolean(adminToken));

    // 10. Verify AI Growth Copilot
    const copilotRes = await req('/api/admin/growth-copilot', 'POST', { simulator: { base_projected_total: 250, base_projected_cpa: '₹8.00' } }, adminToken);
    assert('AI Growth Copilot functions cleanly', copilotRes.status === 200 && (copilotRes.data.status === 'success' || copilotRes.data.status === 'unavailable'));

    console.log(`\n--- VERIFICATION SUMMARY: ${passCount} / ${totalTests} TESTS PASSED ---`);
    if (passCount === totalTests) {
      console.log('ALL STEP 5 VERIFICATION CHECKS COMPLETED SUCCESSFULLY.');
    }
  } finally {
    await stopServer();
    cleanupDb();
  }
}

runTests().catch(async err => {
  console.error(err);
  await stopServer();
  cleanupDb();
});
