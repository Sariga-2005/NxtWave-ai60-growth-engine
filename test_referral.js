const axios = require('axios');
const http = require('http');

const API_BASE = 'http://localhost:3000';

async function runTests() {
  console.log('--- TEST A: Student A registers ---');
  const rand = Math.floor(Math.random() * 10000);
  let studentA;
  try {
    const resA = await axios.post(`${API_BASE}/api/register`, {
      full_name: 'Student A',
      email: `studentA_${rand}@example.com`,
      phone: `9876${rand.toString().padStart(6, '0')}`,
      college: 'Test College',
      branch: 'CSE',
      graduation_year: '2025'
    });
    studentA = resA.data;
    console.log('Student A registered. Ref Code:', studentA.user.referral_code);
    console.log('Ref URL:', studentA.user.referral_url);
  } catch(e) {
    console.error('Test A Failed', e.response?.data || e.message);
    return;
  }

  console.log('\n--- TEST B: Open Student A referral URL ---');
  let redirectedUrl = '';
  try {
    // using http to catch redirect
    await new Promise((resolve, reject) => {
      http.get(`${API_BASE}/r/${studentA.user.referral_code}`, (res) => {
        if(res.statusCode >= 300 && res.statusCode < 400) {
          redirectedUrl = res.headers.location;
          console.log('Redirected to:', redirectedUrl);
          resolve();
        } else {
          reject(new Error('No redirect found, status: ' + res.statusCode));
        }
      });
    });
  } catch(e) {
    console.error('Test B Failed', e.message);
    return;
  }

  console.log('\n--- TEST C: Student B registers using referral ---');
  const rand2 = Math.floor(Math.random() * 10000) + 10000;
  let studentB;
  try {
    const resB = await axios.post(`${API_BASE}/api/register`, {
      full_name: 'Student B',
      email: `studentB_${rand2}@example.com`,
      phone: `9876${rand2.toString().padStart(6, '0')}`,
      college: 'Test College',
      branch: 'CSE',
      graduation_year: '2025',
      referral_code: studentA.user.referral_code
    });
    studentB = resB.data;
    console.log('Student B registered successfully.');
  } catch(e) {
    console.error('Test C Failed', e.response?.data || e.message);
    return;
  }

  console.log('\n--- TEST D: Refresh Student A dashboard ---');
  try {
    const dashA = await axios.get(`${API_BASE}/api/student/dashboard`, {
      headers: { Authorization: `Bearer ${studentA.token}` }
    });
    console.log('Student A successful referrals:', dashA.data.referrals.successful);
    if(dashA.data.referrals.successful !== 1) console.log('ERROR: Expected 1');
  } catch(e) {
    console.error('Test D Failed', e.response?.data || e.message);
  }

  console.log('\\n--- TEST E: Student B attempts to register again ---');
  try {
    await axios.post(`${API_BASE}/api/register`, {
      full_name: 'Student B',
      email: `studentB_${rand2}@example.com`,
      phone: `9876${rand2.toString().padStart(6, '0')}`,
      college: 'Test College',
      branch: 'CSE',
      graduation_year: '2025',
      referral_code: studentA.user.referral_code
    });
    console.log('ERROR: Student B registered again!');
  } catch(e) {
    console.log('Expected error caught:', e.response?.data?.error || e.message);
  }
  // Check A's dashboard again
  try {
    const dashA2 = await axios.get(`${API_BASE}/api/student/dashboard`, {
      headers: { Authorization: `Bearer ${studentA.token}` }
    });
    console.log('Student A successful referrals after B duplicate:', dashA2.data.referrals.successful);
  } catch(e) {
    console.error('Test E Dash Failed', e.message);
  }

  console.log('\\n--- TEST F: Student A attempts self-referral ---');
  try {
    await axios.post(`${API_BASE}/api/register`, {
      full_name: 'Student A',
      email: `studentA_${rand}@example.com`,
      phone: `9876${rand.toString().padStart(6, '0')}`,
      college: 'Test College',
      branch: 'CSE',
      graduation_year: '2025',
      referral_code: studentA.user.referral_code
    });
    console.log('ERROR: Self-referral succeeded!');
  } catch(e) {
    console.log('Expected error caught:', e.response?.data?.error || e.message);
  }

  console.log('\n--- TEST G: Open nonexistent referral code ---');
  try {
    await new Promise((resolve, reject) => {
      http.get(`${API_BASE}/r/INVALID`, (res) => {
        if(res.statusCode >= 300 && res.statusCode < 400) {
          console.log('Redirected safely to:', res.headers.location);
          resolve();
        } else {
          reject(new Error('No redirect found, status: ' + res.statusCode));
        }
      });
    });
  } catch(e) {
    console.error('Test G Failed', e.message);
  }

  console.log('\nALL TESTS DONE.');
}

runTests();
