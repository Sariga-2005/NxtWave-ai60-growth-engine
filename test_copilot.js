const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function runTests() {
  console.log('--- TEST A: Admin login works ---');
  let token;
  try {
    const res = await axios.post(`${API_BASE}/api/admin/login`, {
      email: 'admin@ai60.demo',
      password: 'admin123'
    });
    token = res.data.token;
    console.log('Admin login successful. Token received.');
  } catch(e) {
    console.error('Login Failed', e.response?.data || e.message);
    return;
  }

  console.log('\n--- TEST B: Growth Copilot API ---');
  try {
    const res = await axios.post(`${API_BASE}/api/admin/growth-copilot`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = res.data;
    console.log('Copilot data fetched.');
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error('Copilot API Failed', e.response?.data || e.message);
  }
}

runTests();
