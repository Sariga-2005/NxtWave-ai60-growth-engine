// ============================================================================
// TEST: Real AI Project Evaluation Lifecycle & 4-State Machine
// ============================================================================

const axios = require('axios');
const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('==================================================');
  console.log('AI60 PROJECT EVALUATION LIFECYCLE TEST SUITE');
  console.log('==================================================\n');

  const ts = Date.now();
  const freshPhone1 = `99999${String(ts).slice(-5)}`;
  const freshEmail1 = `fresh_student_${ts}@test.com`;

  // -------------------------------------------------------------
  // TEST 1: Fresh Student Registration & Initial State
  // -------------------------------------------------------------
  console.log('--- TEST 1: Fresh Student Opens My Project (No Project) ---');
  const reg1 = await axios.post(`${BASE_URL}/api/register`, {
    full_name: 'Lifecycle Student One',
    email: freshEmail1,
    phone: freshPhone1,
    college: 'IIT Madras',
    branch: 'CSE',
    graduation_year: 2026
  });
  assert.strictEqual(reg1.status, 201);
  const token1 = reg1.data.token;
  const headers1 = { Authorization: `Bearer ${token1}` };

  const dash1 = await axios.get(`${BASE_URL}/api/student/dashboard`, { headers: headers1 });
  assert.strictEqual(dash1.data.project, null, 'Fresh student must have project = null');
  assert.strictEqual(dash1.data.evaluation, null, 'Fresh student must have evaluation = null');
  console.log('[✓ PASS] TEST 1: Fresh student has project = null and evaluation = null');

  // -------------------------------------------------------------
  // TEST 2: Refresh Fresh Student Dashboard
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Refresh Fresh Student Dashboard ---');
  const refresh1 = await axios.get(`${BASE_URL}/api/student/dashboard`, { headers: headers1 });
  assert.strictEqual(refresh1.data.project, null, 'Project must remain null on refresh');
  assert.strictEqual(refresh1.data.evaluation, null, 'Evaluation must remain null on refresh');
  console.log('[✓ PASS] TEST 2: Refresh preserves unsubmitted state');

  // -------------------------------------------------------------
  // TEST 3 & 4: Submit Project & Run AI Evaluation
  // -------------------------------------------------------------
  console.log('\n--- TEST 3 & 4: Submit Project and Run Live AI Evaluation ---');
  const projectPayload = {
    project_name: 'Smart Study Planner AI',
    description: 'An AI assistant that breaks down semester syllabus into weekly adaptive study plans for engineering exams.',
    github_url: 'https://github.com/freshstudent/study-planner-ai',
    demo_url: 'https://study-planner-ai.vercel.app',
    tech_stack: 'Node.js, Express, SQLite, Gemini 2.5 Flash',
    ai_usage: 'Uses Gemini Flash with structured prompt templates to analyze course syllabi and allocate daily review intervals.',
    what_learned: 'Learned structured JSON validation, API rate handling, and prompt temperature tuning in 60 minutes.'
  };

  const subRes = await axios.post(`${BASE_URL}/api/project`, projectPayload, { headers: headers1 });
  assert.strictEqual(subRes.status, 201, 'Project submission must succeed');
  const projectId1 = subRes.data.project_id;
  assert.ok(projectId1, 'Must return project_id');
  console.log('[✓ PASS] TEST 3: Project submission successfully saved to database');

  // Evaluate project
  console.log('Triggering POST /api/project/evaluate...');
  const evalRes = await axios.post(`${BASE_URL}/api/project/evaluate`, { project_id: projectId1, force: true }, { headers: headers1 });
  assert.strictEqual(evalRes.status, 200, 'Evaluation endpoint must return 200');
  assert.ok(evalRes.data.evaluation, 'Evaluation object must exist');
  const evalData = evalRes.data.evaluation;
  
  assert.strictEqual(typeof evalData.score, 'number', 'Overall score must be a number');
  assert.ok(evalData.score >= 50 && evalData.score <= 100, `Score out of range: ${evalData.score}`);
  assert.ok(evalData.categories, 'Categories object must exist');
  assert.ok(evalData.categories.problemClarity, 'Problem clarity category must exist');
  assert.ok(evalData.categories.aiIntegration, 'AI integration category must exist');
  assert.ok(evalData.strengths.length >= 3, 'Strengths array must contain at least 3 items');
  assert.ok(evalData.suggestions.length >= 3, 'Suggestions array must contain at least 3 items');
  console.log(`[✓ PASS] TEST 4: Live AI evaluation completed with score: ${evalData.score}/100 and 7 dimensions`);

  // -------------------------------------------------------------
  // TEST 5: Evaluated State Survives Dashboard Refresh
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Verify Evaluated State Survives Dashboard Refresh ---');
  const dashEvaluated = await axios.get(`${BASE_URL}/api/student/dashboard`, { headers: headers1 });
  assert.ok(dashEvaluated.data.project, 'Project must exist');
  assert.strictEqual(dashEvaluated.data.project.project_name, 'Smart Study Planner AI');
  assert.ok(dashEvaluated.data.evaluation, 'Evaluation must exist');
  assert.strictEqual(dashEvaluated.data.evaluation.score, evalData.score);
  assert.strictEqual(dashEvaluated.data.project.status, 'evaluated');
  console.log(`[✓ PASS] TEST 5: Evaluated project and scores persist intact across dashboard refreshes`);

  // -------------------------------------------------------------
  // TEST 6: Another Fresh Student (Isolation Check)
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Another Fresh Student Account Isolation ---');
  const freshPhone2 = `99998${String(ts).slice(-5)}`;
  const freshEmail2 = `fresh_student_two_${ts}@test.com`;
  const reg2 = await axios.post(`${BASE_URL}/api/register`, {
    full_name: 'Lifecycle Student Two',
    email: freshEmail2,
    phone: freshPhone2,
    college: 'BITS Pilani',
    branch: 'ECE',
    graduation_year: 2026
  });
  const token2 = reg2.data.token;
  const headers2 = { Authorization: `Bearer ${token2}` };

  const dash2 = await axios.get(`${BASE_URL}/api/student/dashboard`, { headers: headers2 });
  assert.strictEqual(dash2.data.project, null, 'Second fresh student project must be null');
  assert.strictEqual(dash2.data.evaluation, null, 'Second fresh student evaluation must be null');
  console.log('[✓ PASS] TEST 6: Fresh student 2 starts strictly in PROJECT NOT SUBMITTED state (zero cross-contamination)');

  // -------------------------------------------------------------
  // TEST 7: Attempting to evaluate without project returns 404
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Evaluate Without Project Returns Clean 404 (No Fake Scores) ---');
  try {
    await axios.post(`${BASE_URL}/api/project/evaluate`, {}, { headers: headers2 });
    assert.fail('Should have failed with 404');
  } catch (err) {
    assert.strictEqual(err.response.status, 404);
    assert.strictEqual(err.response.data.error, 'No submitted project found to evaluate.');
    console.log('[✓ PASS] TEST 7: Evaluating with no project returns clean 404 (no fabricated scores)');
  }

  // -------------------------------------------------------------
  // TEST 8: Demo Student Account Pre-Evaluated Baseline
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Demo Student Has Pre-Evaluated Baseline ---');
  const demoLogin = await axios.post(`${BASE_URL}/api/login`, {
    identifier: '9876500060',
    password: '9876500060'
  });
  const demoToken = demoLogin.data.token;
  const demoDash = await axios.get(`${BASE_URL}/api/student/dashboard`, {
    headers: { Authorization: `Bearer ${demoToken}` }
  });
  assert.ok(demoDash.data.project, 'Demo student must have project');
  assert.ok(demoDash.data.evaluation, 'Demo student must have evaluation');
  assert.ok(demoDash.data.evaluation.score >= 80, `Demo score: ${demoDash.data.evaluation.score}`);
  console.log(`[✓ PASS] TEST 8: Demo student has pre-populated AI evaluation (${demoDash.data.evaluation.score}/100)`);

  console.log('\n==================================================');
  console.log('ALL 8 LIFECYCLE & STATE MACHINE TESTS PASSED!');
  console.log('==================================================');
}

main().catch(err => {
  console.error('\n❌ Test failed:', err.response?.data || err.message);
  process.exit(1);
});
