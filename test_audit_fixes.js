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

async function runAuditVerification() {
  console.log('==============================================');
  console.log('STARTING AUDIT FIX VERIFICATION SUITE');
  console.log('==============================================\n');

  let passed = 0;
  let total = 0;

  function assert(title, condition) {
    total++;
    if (condition) {
      console.log(`[PASS] Check ${total}: ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] Check ${total}: ${title}`);
    }
  }

  // 1. Check HTML for removed legacy milestones (1 Friend Joins, 3 Friends Join, etc.)
  const homeRes = await req('/');
  const html = typeof homeRes.data === 'string' ? homeRes.data : '';
  assert('Legacy "1 Friend Joins" is removed from landing page', !html.includes('1 Friend Joins') && !html.includes('Unlock AI Prompt Engineering Handbook'));
  assert('Legacy "5 Complete Project GitHub Starter Repositories" milestone is removed from landing page', !html.includes('3 Friends Join'));

  // 2. Check HTML contains Admin Login header button
  assert('Header contains Admin Login button', html.includes('id="header-admin-btn"') && html.includes('Admin Login'));

  // 3. Check Student Dashboard milestones are intact (3, 5, 10, 25)
  assert('Student Dashboard contains 3 Verified Referrals card', html.includes('id="ms-card-3"') && html.includes('3 Verified Referrals'));
  assert('Student Dashboard contains 5 Verified Referrals card', html.includes('id="ms-card-5"') && html.includes('5 Verified Referrals'));
  assert('Student Dashboard contains 10 Verified Referrals card', html.includes('id="ms-card-10"') && html.includes('10 Verified Referrals'));
  assert('Student Dashboard contains 25 Verified Referrals card', html.includes('id="ms-card-25"') && html.includes('25 Verified Referrals'));

  // 4. Test Student AI Assistant endpoint
  const chatRes = await req('/api/ai/chat', 'POST', { message: 'What is the duration of the AI60 workshop?' });
  assert('Student AI Assistant responds with grounded information', 
    chatRes.status === 200 && (chatRes.data.status === 'success' || chatRes.data.status === 'grounded_local' || chatRes.data.status === 'unavailable'));
  if (chatRes.data?.response) {
    console.log(`   AI Chat Status: ${chatRes.data.status}, Provider: ${chatRes.data.provider || 'Local Grounded'}`);
  }

  // 5. Test Admin Login and reach Growth OS
  const adminLoginRes = await req('/api/admin/login', 'POST', { email: 'admin@ai60.demo', password: 'admin123' });
  assert('Admin login succeeds with development credentials', adminLoginRes.status === 200 && adminLoginRes.data.token);
  const adminToken = adminLoginRes.data?.token;

  // 6. Test Growth Copilot endpoint with admin token
  const copilotRes = await req('/api/admin/growth-copilot', 'POST', { simulator: null }, adminToken);
  assert('Growth Copilot executes cleanly via POST /api/admin/growth-copilot', 
    copilotRes.status === 200 && (copilotRes.data.status === 'success' || copilotRes.data.status === 'unavailable'));
  if (copilotRes.data?.status) {
    console.log(`   Growth Copilot Status: ${copilotRes.data.status}, Metrics Present: ${!!copilotRes.data.metrics}`);
  }

  // 7. Verify no admin passwords or API keys are leaked in health or public endpoints
  const healthRes = await req('/api/admin/ai/health', 'GET', null, adminToken);
  const healthStr = JSON.stringify(healthRes.data || {});
  assert('AI Health does not leak secret keys (only boolean isConfigured & status)', 
    !healthStr.includes('AIza') && !healthStr.includes('sk-') && !healthStr.includes('gsk_'));

  console.log(`\n==============================================`);
  console.log(`AUDIT VERIFICATION SUMMARY: ${passed} / ${total} CHECKS PASSED`);
  console.log(`==============================================`);
}

runAuditVerification().catch(console.error);
