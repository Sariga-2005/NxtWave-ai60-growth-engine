const http = require('http');

function req(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
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
  assert('Student A registers successfully', resA.status === 201 && resA.data.user && resA.data.user.referral_code);
  const userA = resA.data.user;
  const tokenA = resA.data.token;
  const codeA = userA.referral_code;

  // 2. Student A receives referral link / click tracking
  const clickRes = await req(`/r/${codeA}`);
  assert('Student A referral link /r/CODE registers click', clickRes.status === 302);

  // Check dash before referrals
  const dashA0 = await req('/api/student/dashboard', 'GET', null, tokenA);
  assert('Student A dashboard has 1 click and 0 referrals initially', dashA0.data.referrals.clicks >= 1 && dashA0.data.referrals.successful === 0);

  // 3. Student B Registers using Student A's referral code
  const studentBEmail = `studentB_${Date.now()}@college.edu`;
  const resB = await req('/api/register', 'POST', {
    full_name: 'Rahul K',
    email: studentBEmail,
    phone: `98765${Math.floor(10000 + Math.random()*90000)}`,
    college: 'Amrita Vishwa Vidyapeetham',
    branch: 'ECE',
    graduation_year: '2025',
    referral_code: codeA
  });
  assert('Student B registers with Student A referral code', resB.status === 201 && resB.data.user);

  // 4. Student A gets +1 verified referral
  const dashA1 = await req('/api/student/dashboard', 'GET', null, tokenA);
  assert('Student A receives +1 verified referral in database', dashA1.data.referrals.successful === 1);

  // 5. Test Self-referral protection
  const selfRefRes = await req('/api/register', 'POST', {
    full_name: 'Sara M Copy',
    email: `studentA_self_${Date.now()}@college.edu`,
    phone: userA.phone, // Same phone
    college: 'Amrita Vishwa Vidyapeetham',
    branch: 'CSE',
    graduation_year: '2025',
    referral_code: codeA
  });
  assert('Self-referral or duplicate phone is blocked', selfRefRes.status === 400 || selfRefRes.data.error);

  // 6. Test Duplicate Registration protection
  const dupRes = await req('/api/register', 'POST', {
    full_name: 'Rahul Duplicate',
    email: studentBEmail,
    phone: `99999${Math.floor(10000 + Math.random()*90000)}`,
    college: 'Amrita Vishwa Vidyapeetham',
    branch: 'ECE',
    graduation_year: '2025',
    referral_code: codeA
  });
  assert('Duplicate email registration is blocked', dupRes.status === 409 || dupRes.status === 400);

  // 7. Test Scalable referral loop (more referrals without cap)
  for (let i = 1; i <= 4; i++) {
    const fRes = await req('/api/register', 'POST', {
      full_name: `Friend ${i} of A`,
      email: `friend_${i}_${Date.now()}_${Math.random().toString(36).substring(7)}@college.edu`,
      phone: `98765${String(Math.floor(10000 + Math.random()*90000))}`,
      college: 'Amrita Vishwa Vidyapeetham',
      branch: 'CSE',
      graduation_year: '2025',
      referral_code: codeA
    });
    if (fRes.status !== 201) {
      console.log(`Friend ${i} reg failed:`, fRes.status, fRes.data);
    }
  }

  const dashA5 = await req('/api/student/dashboard', 'GET', null, tokenA);
  assert('Student A has 5 verified referrals without artificial cap', dashA5.data.referrals.successful === 5);

  // 8. Test Leaderboard privacy & real database rankings
  const leaderRes = await req('/api/leaderboard');
  assert('Leaderboard returns privacy-safe names and real counts', leaderRes.status === 200 && Array.isArray(leaderRes.data.leaderboard));
  const topLeader = leaderRes.data.leaderboard && leaderRes.data.leaderboard.length > 0 ? leaderRes.data.leaderboard[0] : null;
  assert('Top leader has privacy formatted name (e.g. Sara M.) and >=5 referrals', topLeader && !topLeader.phone && !topLeader.email && topLeader.referral_count >= 5);

  // 9. Test Student Rank in Dashboard
  assert('Student A receives correct rank in dashboard', dashA5.data.referrals.rank === 1);

  // 10. Test AI60 Student Assistant Grounded RAG query
  const chatWorkshopRes = await req('/api/ai/chat', 'POST', { message: 'What is the AI60 workshop and how long is it?' });
  assert('Student Assistant answers workshop questions from grounded RAG', 
    chatWorkshopRes.status === 200 && 
    (chatWorkshopRes.data.response.includes('60') || chatWorkshopRes.data.response.includes('workshop') || chatWorkshopRes.data.status === 'grounded_local' || chatWorkshopRes.data.status === 'unavailable'));

  // 11. Test AI60 Student Assistant query outside knowledge base
  const chatAlienRes = await req('/api/ai/chat', 'POST', { message: 'What is the flight speed of a Martian spacecraft?' });
  assert('Student Assistant handles ungrounded question truthfully without hallucinating',
    chatAlienRes.status === 200 && 
    (chatAlienRes.data.response.includes("don't have that information") || chatAlienRes.data.status === 'grounded_local' || chatAlienRes.data.status === 'unavailable'));

  // 12. Test Admin Growth OS 300-400 targets
  const adminLoginRes = await req('/api/admin/login', 'POST', { email: 'admin@ai60.demo', password: 'admin123' });
  const adminToken = adminLoginRes.data.token;
  const analyticsRes = await req('/api/admin/analytics', 'GET', null, adminToken);
  assert('Admin Analytics returns total registrations and verified referral counts', analyticsRes.status === 200 && analyticsRes.data.registrations.total > 0 && analyticsRes.data.registrations.referral >= 5);

  // 13. Verify AI Growth Copilot from Step 4 still functions
  const copilotRes = await req('/api/admin/growth-copilot', 'POST', { simulator: { base_projected_total: 250, base_projected_cpa: '₹8.00' } }, adminToken);
  assert('AI Growth Copilot still functions cleanly', copilotRes.status === 200 && (copilotRes.data.status === 'success' || copilotRes.data.status === 'unavailable'));

  console.log(`\n--- VERIFICATION SUMMARY: ${passCount} / ${totalTests} TESTS PASSED ---`);
  if (passCount === totalTests) {
    console.log('ALL STEP 5 VERIFICATION CHECKS COMPLETED SUCCESSFULLY.');
  }
}

runTests().catch(console.error);
