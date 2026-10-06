const axios = require('axios');

const BASE = 'http://localhost:3000';

async function testPersistence() {
  console.log('Testing authentication persistence across server restarts...');
  
  // 1. Admin login
  const adminRes = await axios.post(`${BASE}/api/login`, {
    identifier: 'admin@ai60.com',
    password: 'admin123'
  });
  console.log('[PASS] Admin login succeeded:', adminRes.data.user.email);

  // 2. Student login (using existing student in DB)
  const { getDb, get } = require('./database');
  await getDb();
  const student = get('SELECT email, phone FROM users WHERE role = ? ORDER BY created_at DESC LIMIT 1', ['student']);
  if (!student) {
    throw new Error('No student found in DB');
  }

  const studentRes = await axios.post(`${BASE}/api/login`, {
    identifier: student.phone,
    password: student.phone
  });
  console.log('[PASS] Student login with phone succeeded for:', student.email);

  console.log('\nAll persistence checks passed!');
}

testPersistence().catch(err => {
  console.error('[FAIL]', err.response?.data || err.message);
  process.exit(1);
});
