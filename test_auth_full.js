const axios = require('axios');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';

async function runAuthTests() {
  console.log('==============================================');
  console.log('STARTING CRITICAL AUTHENTICATION TEST SUITE');
  console.log('==============================================\n');

  let passed = 0;
  let failed = 0;

  function check(name, condition, details = '') {
    if (condition) {
      passed++;
      console.log(`[PASS] ${name}`);
    } else {
      failed++;
      console.log(`[FAIL] ${name} ${details ? '— ' + details : ''}`);
    }
  }

  const testStudentPhone = '9876543299';
  const testStudentEmail = `student_${Date.now()}@college.edu`;
  let studentToken = '';
  let adminToken = '';

  // 1. Student Registration
  console.log('--- 1. Student Registration ---');
  try {
    const regRes = await axios.post(`${BASE}/api/register`, {
      full_name: 'Test Student',
      email: testStudentEmail,
      phone: `+91 ${testStudentPhone}`,
      college: 'RV College of Engineering',
      branch: 'CSE',
      graduation_year: '2025'
    });
    studentToken = regRes.data.token;
    check('Student registration succeeds (201)', regRes.status === 201 && Boolean(studentToken));
    check('Student user object returned with referral code', Boolean(regRes.data.user?.referral_code));
  } catch (e) {
    check('Student registration succeeds (201)', false, e.response?.data?.error || e.message);
  }

  // 2. Student Login with Phone Identifier + Phone Password
  console.log('\n--- 2. Student Login (Phone + Phone) ---');
  try {
    const loginRes = await axios.post(`${BASE}/api/login`, {
      identifier: testStudentPhone,
      password: testStudentPhone
    });
    check('Student login with phone identifier and phone password succeeds', 
      loginRes.status === 200 && Boolean(loginRes.data.token) && loginRes.data.user.role === 'student');
  } catch (e) {
    check('Student login with phone identifier and phone password succeeds', false, e.response?.data?.error || e.message);
  }

  // 3. Student Login with Formatted Phone (+91 with spaces)
  console.log('\n--- 3. Student Login (Formatted Phone +91 ...) ---');
  try {
    const loginRes = await axios.post(`${BASE}/api/login`, {
      identifier: `+91 ${testStudentPhone}`,
      password: `+91 ${testStudentPhone}`
    });
    check('Student login with formatted phone (+91 ...) succeeds', 
      loginRes.status === 200 && Boolean(loginRes.data.token));
  } catch (e) {
    check('Student login with formatted phone (+91 ...) succeeds', false, e.response?.data?.error || e.message);
  }

  // 4. Student Login with Email Identifier + Phone Password
  console.log('\n--- 4. Student Login (Email + Phone Password) ---');
  try {
    const loginRes = await axios.post(`${BASE}/api/login`, {
      identifier: testStudentEmail,
      password: testStudentPhone
    });
    check('Student login with email identifier and phone password succeeds', 
      loginRes.status === 200 && Boolean(loginRes.data.token));
  } catch (e) {
    check('Student login with email identifier and phone password succeeds', false, e.response?.data?.error || e.message);
  }

  // 5. Student Login with Wrong Password Rejected
  console.log('\n--- 5. Student Login Wrong Password Rejection ---');
  try {
    await axios.post(`${BASE}/api/login`, {
      identifier: testStudentEmail,
      password: 'wrongpassword123'
    });
    check('Student wrong password rejected (401)', false, 'Should have failed with 401');
  } catch (e) {
    check('Student wrong password rejected (401)', e.response?.status === 401);
  }

  // 6. Admin Login
  console.log('\n--- 6. Admin Login ---');
  try {
    const adminRes = await axios.post(`${BASE}/api/admin/login`, {
      email: 'admin@ai60.com',
      password: 'admin123'
    });
    adminToken = adminRes.data.token;
    check('Admin login succeeds via /api/admin/login', 
      adminRes.status === 200 && Boolean(adminToken) && adminRes.data.user.role === 'admin');
  } catch (e) {
    check('Admin login succeeds via /api/admin/login', false, e.response?.data?.error || e.message);
  }

  // 7. Admin Universal Login via /api/login
  console.log('\n--- 7. Admin Universal Login via /api/login ---');
  try {
    const adminUniRes = await axios.post(`${BASE}/api/login`, {
      identifier: 'admin@ai60.com',
      password: 'admin123'
    });
    check('Admin login succeeds via universal /api/login endpoint', 
      adminUniRes.status === 200 && Boolean(adminUniRes.data.token) && adminUniRes.data.user.role === 'admin');
  } catch (e) {
    check('Admin login succeeds via universal /api/login endpoint', false, e.response?.data?.error || e.message);
  }

  // 8. Admin Wrong Password Rejected
  console.log('\n--- 8. Admin Wrong Password Rejection ---');
  try {
    await axios.post(`${BASE}/api/admin/login`, {
      email: 'admin@ai60.com',
      password: 'wrongpassword999'
    });
    check('Admin wrong password rejected (401)', false, 'Should have failed with 401');
  } catch (e) {
    check('Admin wrong password rejected (401)', e.response?.status === 401);
  }

  // 9. Role Separation: Student Cannot Access Admin Endpoint
  console.log('\n--- 9. Role Separation Check ---');
  try {
    await axios.get(`${BASE}/api/admin/analytics`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    check('Student token blocked from admin routes (403)', false, 'Should have failed with 403');
  } catch (e) {
    check('Student token blocked from admin routes (403)', e.response?.status === 403);
  }

  // 10. Unauthenticated User Blocked from Protected Routes
  console.log('\n--- 10. Unauthenticated Access Blocked ---');
  try {
    await axios.get(`${BASE}/api/student/dashboard`);
    check('Unauthenticated access blocked (401)', false, 'Should have failed with 401');
  } catch (e) {
    check('Unauthenticated access blocked (401)', e.response?.status === 401);
  }

  // 11. Authenticated Student Dashboard Data Retrieval
  console.log('\n--- 11. Student Dashboard Data Retrieval ---');
  try {
    const dashRes = await axios.get(`${BASE}/api/student/dashboard`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    check('Student dashboard loads with authenticated session', 
      dashRes.status === 200 && Boolean(dashRes.data.user));
  } catch (e) {
    check('Student dashboard loads with authenticated session', false, e.response?.data?.error || e.message);
  }

  console.log('\n==============================================');
  console.log(`AUTH TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==============================================');

  process.exit(failed > 0 ? 1 : 0);
}

runAuthTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
