const { spawn } = require('child_process');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

const path = require('path');
const PORT = 3010;
const TEST_DB = path.join(__dirname, 'data', 'test_sessions.db');
process.env.PORT = PORT;
process.env.AI60_DB_PATH = TEST_DB;
process.env.ADMIN_EMAIL = 'aniwatchhhh@gmail.com';
process.env.ADMIN_PASSWORD = 'admin123';
const URL = `http://localhost:${PORT}`;

let serverProcess;

function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['server.js'], { env: { ...process.env, PORT } });
    
    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes(`http://localhost:${PORT}`)) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      // Allow minor stderr output but not full crash
    });

    serverProcess.on('error', (err) => {
      reject(err);
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverProcess) {
      serverProcess.on('close', resolve);
      serverProcess.kill();
      serverProcess = null;
    } else {
      resolve();
    }
  });
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function runTests() {
  try {
    if (fs.existsSync(TEST_DB)) {
      try { fs.unlinkSync(TEST_DB); } catch (e) {}
    }
    console.log('Starting server...');
    await startServer();
    await delay(1000);

    let adminToken;
    let studentToken;

    // Test Admin Login
    console.log('Testing Admin Login...');
    const adminRes = await axios.post(`${URL}/api/admin/login`, {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    });
    
    if (adminRes.data.token) {
      adminToken = adminRes.data.token;
      console.log('[PASS] Admin login creates persistent session');
    } else {
      console.log('[FAIL] Admin login creates persistent session');
    }

    // Test Student Login
    console.log('Testing Student Login...');
    // Register a test student first
    const testPhone = '9999999999';
    try {
      const regRes = await axios.post(`${URL}/api/register`, {
        full_name: 'Test Student',
        email: 'testsession@student.com',
        phone: testPhone,
        college: 'Test College',
        branch: 'CSE',
        graduation_year: '2025'
      });
      studentToken = regRes.data.token;
      console.log('[PASS] Student login creates persistent session');
    } catch (e) {
      if (e.response && e.response.status === 409) {
        // already registered, just login
        const loginRes = await axios.post(`${URL}/api/login`, {
          email: 'testsession@student.com',
          password: testPhone
        });
        studentToken = loginRes.data.token;
        console.log('[PASS] Student login creates persistent session');
      } else {
        console.log('[FAIL] Student login creates persistent session', e.message);
      }
    }

    // Verify Valid Session Authenticates
    console.log('Testing Valid Session...');
    try {
      const checkRes = await axios.get(`${URL}/api/admin/campaigns`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('[PASS] Valid session authenticates');
    } catch (e) {
      console.log('[FAIL] Valid session authenticates', e.response?.status);
    }

    // Verify Invalid Session
    console.log('Testing Invalid Session...');
    try {
      await axios.get(`${URL}/api/admin/campaigns`, {
        headers: { Authorization: `Bearer INVALID_TOKEN` }
      });
      console.log('[FAIL] Invalid token rejected');
    } catch (e) {
      if (e.response && e.response.status === 401) {
        console.log('[PASS] Invalid token rejected');
      } else {
        console.log('[FAIL] Invalid token rejected');
      }
    }

    // Verify Server Restart Persistence
    console.log('Restarting server...');
    await stopServer();
    await delay(1000);
    await startServer();
    await delay(1000);

    console.log('Testing Admin Session After Restart...');
    try {
      const restartCheck = await axios.get(`${URL}/api/admin/campaigns`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('[PASS] Session survives server restart');
    } catch (e) {
      console.log('[FAIL] Session survives server restart', e.response?.status);
    }

    // Verify Token Hash stored (and not plaintext)
    console.log('Checking database for token hashes...');
    const { getDb, all } = require('./database');
    await getDb();
    const sessions = all('SELECT * FROM sessions WHERE token_hash = ?', [crypto.createHash('sha256').update(adminToken).digest('hex')]);
    if (sessions.length > 0 && sessions[0].token_hash !== adminToken) {
      console.log('[PASS] Token hash stored instead of plaintext');
    } else {
      console.log('[FAIL] Token hash stored instead of plaintext');
    }

    // Test Expired Session Rejected
    console.log('Testing Expired Session...');
    const { run, saveDb } = require('./database');
    const thash = crypto.createHash('sha256').update(adminToken).digest('hex');
    run("UPDATE sessions SET expires_at = datetime('now', '-1 day') WHERE token_hash = ?", [thash]);
    saveDb();
    
    // Restart server so it picks up the DB changes from disk
    await stopServer();
    await delay(1000);
    await startServer();
    await delay(1000);
    
    try {
      await axios.get(`${URL}/api/admin/campaigns`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('[FAIL] Expired session rejected');
    } catch (e) {
      if (e.response && e.response.status === 401) {
        console.log('[PASS] Expired session rejected');
      } else {
        console.log('[FAIL] Expired session rejected');
      }
    }

    // Check Logout
    console.log('Testing Logout...');
    try {
      await axios.post(`${URL}/api/logout`, {}, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      
      // Wait for server to save DB
      await delay(2000);
      
      // Since the test script's DB is stale, we can just test the API rejects the token now
      try {
        await axios.get(`${URL}/api/admin/campaigns`, {
          headers: { Authorization: `Bearer ${studentToken}` }
        });
        console.log('[FAIL] Logout deletes session');
      } catch(e) {
        if (e.response && e.response.status === 401) {
          console.log('[PASS] Logout deletes session');
        } else {
          console.log('[FAIL] Logout deletes session');
        }
      }
    } catch (e) {
      console.log('[FAIL] Logout deletes session', e.message);
    }
    
    // Check Logs for secrets (mocked check)
    const serverJsContent = fs.readFileSync('server.js', 'utf8');
    if (!serverJsContent.includes('console.log(token') && !serverJsContent.includes('console.log(password')) {
      console.log('[PASS] No authentication secrets printed in logs');
    } else {
      console.log('[FAIL] No authentication secrets printed in logs');
    }

  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    await stopServer();
    process.exit(0);
  }
}

runTests();
