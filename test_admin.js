const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function runTests() {
  console.log('--- TEST A: Admin login works ---');
  let token;
  try {
    const res = await axios.post(`${API_BASE}/api/admin/login`, {
      email: 'admin@ai60.com',
      password: 'admin123'
    });
    token = res.data.token;
    console.log('Admin login successful. Token received.');
  } catch(e) {
    console.error('Login Failed', e.response?.data || e.message);
    return;
  }

  console.log('\n--- TEST B: Growth Overview loads ---');
  try {
    const res = await axios.get(`${API_BASE}/api/admin/analytics`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = res.data;
    console.log('Analytics data fetched.');
    console.log('Target:', data.target);
    console.log('Registrations:', data.registrations);
    console.log('Funnel:', data.funnel);
  } catch(e) {
    console.error('Analytics Failed', e.response?.data || e.message);
  }
}

runTests();
