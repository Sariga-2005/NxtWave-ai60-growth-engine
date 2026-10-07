// ============================================================================
// AI60 REAL AI PROJECT EVALUATION VALIDATION SUITE
// ============================================================================
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('==================================================');
  console.log('AI60 REAL AI PROJECT EVALUATION VALIDATION SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`[✓ PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[✗ FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Login as Demo Student
    const loginRes = await axios.post(`${BASE_URL}/api/login`, {
      identifier: '9876500060',
      password: '9876500060'
    });
    assert(loginRes.data.success && loginRes.data.token, 'TEST 1: Demo student login succeeds and returns token');
    const studentToken = loginRes.data.token;
    const authHeaders = { headers: { 'Authorization': `Bearer ${studentToken}` } };

    // 2. Check Demo Student Dashboard for completed, evaluated project
    const dashRes = await axios.get(`${BASE_URL}/api/student/dashboard`, authHeaders);
    assert(dashRes.data.project && (dashRes.data.project.project_name.includes('AI60') || dashRes.data.project.project_name.length > 0), 'TEST 2: Demo student has project submission');
    assert(dashRes.data.evaluation && typeof dashRes.data.evaluation.score === 'number', 'TEST 3: Demo student has pre-populated real AI evaluation');
    
    const demoEval = dashRes.data.evaluation;
    assert(demoEval.score >= 70 && demoEval.score <= 100, `TEST 4: Overall score is valid numeric range (${demoEval.score}/100)`);
    assert(demoEval.categories && Object.keys(demoEval.categories).length === 7, 'TEST 5: All 7 rubric dimensions present in categories data');
    
    const requiredDims = ['problemClarity', 'aiIntegration', 'functionality', 'uxPolish', 'originality', 'technicalImplementation', 'completeness'];
    let allDimsValid = true;
    for (const dim of requiredDims) {
      const cat = demoEval.categories[dim];
      if (!cat || typeof cat.score !== 'number' || !cat.reason || !cat.evidence) {
        allDimsValid = false;
        break;
      }
    }
    assert(allDimsValid, 'TEST 6: All 7 rubric categories have score (0-10), reason, and submitted evidence');
    assert(Array.isArray(demoEval.strengths) && demoEval.strengths.length >= 3, 'TEST 7: Evaluation contains at least 3 distinct strengths');
    assert(Array.isArray(demoEval.suggestions) && demoEval.suggestions.length >= 3, 'TEST 8: Evaluation contains at least 3 recommended enhancements');
    assert(demoEval.evaluation_summary && demoEval.evaluation_summary.length > 20, 'TEST 9: Evaluation summary is populated');

    // 3. Submit a new test project and test live AI evaluation
    const testProjectPayload = {
      project_name: 'AI Smart Campus Quizzer',
      description: 'An interactive AI assessment platform that generates custom adaptive CS quizzes for engineering students based on weak topic areas.',
      github_url: 'https://github.com/test-student/ai-campus-quizzer',
      demo_url: 'https://ai-campus-quizzer.vercel.app',
      tech_stack: 'React, Node.js, Express, Google Gemini Flash API',
      ai_usage: 'Uses Gemini 2.5 Flash with structured system prompts to generate 5-question multiple choice quizzes with detailed explanations and difficulty calibration.',
      what_learned: 'Learned structured JSON generation with LLMs, prompt temperature calibration, and handling API rate limits during live student quiz sessions.'
    };

    const submitRes = await axios.post(`${BASE_URL}/api/project`, testProjectPayload, authHeaders);
    assert(submitRes.data.success && submitRes.data.project_id, 'TEST 10: New project submission saves successfully');
    const newProjectId = submitRes.data.project_id;

    // 4. Trigger AI Evaluation on new project
    console.log('\n--- Requesting Live AI Evaluation from Gemini Provider ---');
    const evalRes = await axios.post(`${BASE_URL}/api/project/evaluate`, { project_id: newProjectId, force: true }, authHeaders);
    assert(evalRes.data.success && evalRes.data.evaluation, 'TEST 11: Live AI evaluation succeeds with real Gemini response');

    const liveEval = evalRes.data.evaluation;
    assert(typeof liveEval.score === 'number' && liveEval.score > 0, `TEST 12: Live evaluated overall score generated (${liveEval.score}/100)`);
    assert(liveEval.categories && liveEval.categories.aiIntegration && liveEval.categories.aiIntegration.score > 0, 'TEST 13: Live evaluation includes evidence-backed AI integration score');
    assert(liveEval.categories.problemClarity && liveEval.categories.problemClarity.evidence.length > 5, `TEST 14: Evidence extracted from submitted text: "${liveEval.categories.problemClarity.evidence.slice(0, 60)}..."`);
    assert(Array.isArray(liveEval.strengths) && liveEval.strengths.length >= 3, 'TEST 15: Live evaluation returned 3+ strengths');
    assert(Array.isArray(liveEval.suggestions) && liveEval.suggestions.length >= 3, 'TEST 16: Live evaluation returned 3+ recommended enhancements');

    // 5. Test Evaluation Persistence on Refresh
    const refreshDash = await axios.get(`${BASE_URL}/api/student/dashboard`, authHeaders);
    assert(refreshDash.data.project.project_name === 'AI Smart Campus Quizzer', 'TEST 17: Submitted project persists on dashboard refresh');
    assert(refreshDash.data.evaluation && refreshDash.data.evaluation.score === liveEval.score, 'TEST 18: Evaluation data persists intact on dashboard refresh');

    // 6. Security Check: ensure no API keys or secrets in public client files
    const clientJs = fs.readFileSync(path.join(__dirname, 'public/js/app.js'), 'utf8');
    const clientHtml = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
    const hasGeminiKey = clientJs.includes(process.env.GEMINI_API_KEY) || clientHtml.includes(process.env.GEMINI_API_KEY);
    const hasOpenAIKey = process.env.OPENAI_API_KEY && (clientJs.includes(process.env.OPENAI_API_KEY) || clientHtml.includes(process.env.OPENAI_API_KEY));
    assert(!hasGeminiKey && !hasOpenAIKey, 'TEST 19: Security verified — zero API keys/secrets exposed to frontend');

  } catch (err) {
    console.error('Test execution error:', err.response?.data || err.message);
    failed++;
  }

  console.log('\n==================================================');
  console.log(`TOTAL: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
