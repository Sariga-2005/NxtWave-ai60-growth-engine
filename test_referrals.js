// ============================================================================
// test_referrals.js — End-to-end referral attribution test (TEST-ONLY)
//
// Spawns the real server against an ISOLATED throwaway database
// (data/test_referrals.db via AI60_DB_PATH) so no test accounts or referral
// counts are written to the real data/ai60.db. All users are simulated.
// Tokens/passwords are never printed.
//
// Run: node test_referrals.js
// ============================================================================
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { getReferralMilestoneProgress, REFERRAL_MILESTONES } = require('./public/js/referral-milestones');

const PORT = 3020;
const BASE = `http://localhost:${PORT}`;
const TEST_DB = path.join(__dirname, 'data', 'test_referrals.db');

let serverProcess;
let passed = 0;
let failed = 0;

function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`[PASS] ${name}`); }
  else { failed++; console.log(`[FAIL] ${name}${detail ? ' — ' + detail : ''}`); }
}

function cleanupDb() {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
}

function startServer() {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PORT: String(PORT), AI60_DB_PATH: TEST_DB };
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

// Simulated test student factory (unique, obviously-fake data)
let seq = 0;
const runId = Date.now().toString().slice(-4);
function fakeStudent(label, extra = {}) {
  seq++;
  return {
    full_name: `Test ${label}`,
    email: `ai60.test.${label.toLowerCase().replace(/\s+/g, '')}.${runId}${seq}@example.test`,
    phone: `90${runId}${String(seq).padStart(4, '0')}`,
    college: 'Simulated Test College',
    branch: 'CSE',
    graduation_year: '2026',
    ...extra
  };
}

async function register(student) {
  try {
    const res = await axios.post(`${BASE}/api/register`, student);
    return { status: res.status, data: res.data };
  } catch (e) {
    return { status: e.response?.status || 0, data: e.response?.data || {} };
  }
}

async function verifiedCount(token) {
  const res = await axios.get(`${BASE}/api/student/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
  return res.data.referrals.successful;
}

function openReferralLink(code) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}/r/${code}`, res => {
      res.resume();
      resolve({ status: res.statusCode, location: res.headers.location });
    }).on('error', reject);
  });
}

async function run() {
  cleanupDb();
  console.log('Starting isolated test server (throwaway DB)...');
  await startServer();

  // ---------------------------------------------------------------- Student A
  console.log('\n--- Student A registers (organic) ---');
  const regA = await register(fakeStudent('Student A'));
  check('Student A can register', regA.status === 201);
  const A = regA.data;
  const codeA = A.user?.referral_code;
  const urlA = A.user?.referral_url || '';
  check('Student A gets a referral code', /^[A-Z2-9]{6}$/.test(codeA || ''), `got ${codeA}`);
  check('Referral URL uses /r/<code>', urlA.endsWith(`/r/${codeA}`));
  check('Referral URL exposes no email / id / token',
    !urlA.includes('@') && !urlA.includes(A.user.id) && !urlA.includes(A.token) && !urlA.toLowerCase().includes('test.student'));
  check('Student A starts at 0 verified referrals', (await verifiedCount(A.token)) === 0);

  // ------------------------------------------------- Referral link visits only
  console.log('\n--- Student B opens Student A\'s referral link (twice = refresh) ---');
  const visit1 = await openReferralLink(codeA);
  const visit2 = await openReferralLink(codeA);
  check('Referral link redirects to landing with ?r=<code>',
    visit1.status === 302 && visit1.location === `/?r=${codeA}`, `${visit1.status} ${visit1.location}`);
  check('Refreshed visits redirect consistently', visit2.location === visit1.location);
  check('Visits alone do NOT count as referrals (B not counted before registering)', (await verifiedCount(A.token)) === 0);
  const lower = await openReferralLink(codeA.toLowerCase());
  check('Lower-cased link still resolves to the same code', lower.location === `/?r=${codeA}`);

  // ------------------------------------------------- Organic registration
  console.log('\n--- Organic student registers without referral ---');
  const regC = await register(fakeStudent('Organic C'));
  check('Organic registration succeeds', regC.status === 201);
  check('Organic registration does not change A\'s count', (await verifiedCount(A.token)) === 0);

  const regInvalid = await register(fakeStudent('Invalid Ref', { referral_code: 'ZZZZZZ' }));
  check('Unknown referral code still allows registration', regInvalid.status === 201);
  check('Unknown referral code creates no attribution for A', (await verifiedCount(A.token)) === 0);

  // ------------------------------------------------- Referred registrations 0→1→2→3
  console.log('\n--- 3 simulated friends register via A\'s link (0 → 1 → 2 → 3) ---');
  const friends = [];
  for (let i = 1; i <= 3; i++) {
    const before = await verifiedCount(A.token);
    // Friend #2 uses a lower-cased code to verify normalization
    const code = i === 2 ? codeA.toLowerCase() : codeA;
    const reg = await register(fakeStudent(`Friend B${i}`, { referral_code: code }));
    friends.push(reg.data);
    const after = await verifiedCount(A.token);
    check(`Friend B${i} registers`, reg.status === 201);
    check(`A's verified count ${before} → ${after} (exactly +1)`, after === before + 1 && after === i);
    const p = getReferralMilestoneProgress(after);
    console.log(`       milestone progress: ${p.label} → ${p.next ? p.next.reward : 'all reached'}`);
  }

  const B1 = friends[0];
  check('Referred student gets their OWN distinct referral code', B1.user.referral_code !== codeA);
  check('Referred student starts with 0 referrals of their own', (await verifiedCount(B1.token)) === 0);

  // ------------------------------------------------- Duplicate prevention
  console.log('\n--- Duplicate / repeat registration attempts ---');
  const B1Payload = fakeStudent('dup');
  // Re-use B1's exact email (duplicate email)
  const dupEmail = await register({ ...B1Payload, email: B1.user.email, referral_code: codeA });
  check('Duplicate email registration rejected (409)', dupEmail.status === 409);
  check('Duplicate attempt does not increase A\'s count', (await verifiedCount(A.token)) === 3);

  // ------------------------------------------------- Self-referral
  console.log('\n--- Student A attempts self-referral ---');
  const self = await register({ ...fakeStudent('self'), email: A.user.email, referral_code: codeA });
  check('Self-referral (same account re-registering with own code) rejected', self.status === 409);
  check('Self-referral does not increase A\'s count', (await verifiedCount(A.token)) === 3);

  // ------------------------------------------------- Milestone at 3
  console.log('\n--- Milestone logic ---');
  const p3 = getReferralMilestoneProgress(3);
  check('At 3 verified: Project Starter Pack unlocked',
    p3.unlocked.some(m => m.threshold === 3 && m.reward === 'Project Starter Pack'));
  check('At 3 verified: next milestone is 5 → Premium Project Templates', p3.next?.threshold === 5 && p3.label === '3 / 5');
  check('0 → "0 / 3" Project Starter Pack', getReferralMilestoneProgress(0).label === '0 / 3' && getReferralMilestoneProgress(0).next.reward === 'Project Starter Pack');
  check('2 → "2 / 3" (nothing unlocked yet)', getReferralMilestoneProgress(2).label === '2 / 3' && getReferralMilestoneProgress(2).unlocked.length === 0);
  check('5 → "5 / 10"', getReferralMilestoneProgress(5).label === '5 / 10');
  check('10 → "10 / 25"', getReferralMilestoneProgress(10).label === '10 / 25');
  check('Milestone definitions remain 3/5/10/25', REFERRAL_MILESTONES.map(m => m.threshold).join(',') === '3,5,10,25');
  check('25 verified referrals unlocks Advanced Project Resource Pack',
    getReferralMilestoneProgress(25).unlocked.some(m => m.threshold === 25 && m.reward === 'Advanced Project Resource Pack'));
  
  // Independent milestone qualification (No rank competition)
  const pA25 = getReferralMilestoneProgress(25);
  const pB25 = getReferralMilestoneProgress(25);
  check('Multiple students with 25 referrals both qualify for Advanced Project Resource Pack equally',
    pA25.unlocked.length === 4 && pB25.unlocked.length === 4);


  // ------------------------------------------------- Record integrity
  console.log('\n--- Referral record integrity ---');
  const statsA = (await axios.get(`${BASE}/api/referral/stats`, { headers: { Authorization: `Bearer ${A.token}` } })).data;
  check('A has exactly 3 referral records', statsA.total === 3 && statsA.referrals.length === 3);
  check('All A\'s records are status=registered', statsA.referrals.every(r => r.status === 'registered'));
  const names = statsA.referrals.map(r => r.full_name).sort().join(',');
  check('Records point to the 3 friends (no organic/invalid users)', names === 'Test Friend B1,Test Friend B2,Test Friend B3', names);
  const me = (await axios.get(`${BASE}/api/me`, { headers: { Authorization: `Bearer ${A.token}` } })).data;
  check('/api/me referral_count agrees with dashboard (3)', me.referral_count === 3);
  const dashA = (await axios.get(`${BASE}/api/student/dashboard`, { headers: { Authorization: `Bearer ${A.token}` } })).data;
  check('Dashboard reports A\'s referral link clicks (3 visits)', dashA.referrals.clicks === 3);
  const statsC = (await axios.get(`${BASE}/api/referral/stats`, { headers: { Authorization: `Bearer ${regC.data.token}` } })).data;
  check('Organic student has no referral records', statsC.total === 0);

  let unauth = 0;
  try { await axios.get(`${BASE}/api/student/dashboard`); } catch (e) { unauth = e.response?.status; }
  check('Dashboard requires authentication', unauth === 401);
}

run()
  .catch(err => { failed++; console.error('Test execution error:', err.message); })
  .finally(async () => {
    await stopServer();
    await new Promise(r => setTimeout(r, 300));
    try { cleanupDb(); } catch (e) {}
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  });
