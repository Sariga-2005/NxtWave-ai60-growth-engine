require('dotenv').config();
const axios = require('axios');
const { spawn } = require('child_process');

const PORT = 3010;
const URL = `http://localhost:${PORT}`;
process.env.PORT = PORT;

let serverProcess;

function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['server.js'], { env: { ...process.env, PORT } });
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes(`http://localhost:${PORT}`)) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[SERVER STDERR]:', data.toString());
    });

    serverProcess.on('error', (err) => reject(err));
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

async function runTests() {
  try {
    console.log('Starting server...');
    await startServer();
    
    console.log('Testing AI Gateway directly...');
    const { aiGateway } = require('./ai');
    
    // Check configs safely
    console.log('\n--- Provider Configurations ---');
    for (const [name, provider] of aiGateway.providers.entries()) {
      console.log(`${name}: configured=${provider.isConfigured}`);
    }

    // Call Gateway executeTask directly
    console.log('\n--- Gateway executeTask ---');
    const result = await aiGateway.executeTask('workshop_chat', 'What is the AI60 workshop?');
    if (result.provider !== 'DEMO' && result.text) {
      console.log('AI Gateway Test: PASS');
      console.log('Provider used:', result.provider);
      console.log('Model used:', result.model);
    } else {
      console.log('AI Gateway Test: FAIL');
      console.log('Result:', result);
    }

    // Test API Endpoint
    console.log('\n--- HTTP API Endpoint ---');
    try {
      const res = await axios.post(`${URL}/api/ai/chat`, { message: 'Explain the AI60 workshop in one sentence.' });
      if (res.data.status !== 'unavailable' && res.data.response) {
        console.log('API /api/ai/chat Test: PASS');
        console.log('Response excerpt:', res.data.response.substring(0, 100) + '...');
      } else {
        console.log('API /api/ai/chat Test: FAIL (Returned unavailable/demo mode)');
        console.log('Response data:', res.data);
      }
    } catch (e) {
      console.log('API /api/ai/chat Test: FAIL');
      console.log('Error:', e.response ? e.response.data : e.message);
    }

  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    await stopServer();
    process.exit(0);
  }
}

runTests();
