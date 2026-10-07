const puppeteer = require('puppeteer-core');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('Launching browser for state machine lifecycle verification...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const artifactDir = 'C:\\Users\\SARIGASINI\\.gemini\\antigravity-ide\\brain\\49cbcecd-6dd6-4aeb-a552-3f4a1ead414d';
  const ts = Date.now();
  const phone = `98111${String(ts).slice(-5)}`;
  const email = `lifecycle_vis_${ts}@test.com`;

  console.log(`1. Registering fresh student (${email})...`);
  await page.goto('http://localhost:3000/#landing', { waitUntil: 'networkidle2' });
  await sleep(2200); // splash

  // Register programmatically or via form
  await page.evaluate(async (data) => {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const regData = await res.json();
    STATE.currentUser = regData.user;
    STATE.userToken = regData.token;
    localStorage.setItem('ai60_user', JSON.stringify(regData.user));
    localStorage.setItem('ai60_user_token', regData.token);
    updateAuthUI();
  }, {
    full_name: 'Visual Lifecycle Student',
    email,
    phone,
    college: 'IIT Delhi',
    branch: 'CSE',
    graduation_year: 2026
  });

  console.log('2. Switching to My Project (#submit)...');
  await page.evaluate(() => switchView('submit'));
  await sleep(1000);

  // Verify STATE 1: PROJECT NOT SUBMITTED
  const state1Visibility = await page.evaluate(() => {
    const unsubmitted = document.getElementById('eval-unsubmitted-state');
    const loading = document.getElementById('eval-loading-state');
    const error = document.getElementById('eval-error-state');
    const result = document.getElementById('eval-result-container');
    const statusTag = document.getElementById('sub-form-status-tag')?.textContent;
    const btnText = document.getElementById('sub-project-btn')?.textContent?.trim();

    return {
      unsubmittedVisible: unsubmitted && window.getComputedStyle(unsubmitted).display !== 'none',
      loadingVisible: loading && window.getComputedStyle(loading).display !== 'none',
      errorVisible: error && window.getComputedStyle(error).display !== 'none',
      resultVisible: result && window.getComputedStyle(result).display !== 'none',
      statusTag,
      btnText
    };
  });

  console.log('State 1 DOM check:', state1Visibility);
  if (!state1Visibility.unsubmittedVisible || state1Visibility.resultVisible) {
    throw new Error('Fresh student must see unsubmitted state and result container must be hidden!');
  }

  const screenshot1 = path.join(artifactDir, 'unsubmitted_state_browser.png');
  await page.screenshot({ path: screenshot1, fullPage: false });
  console.log(`Saved screenshot 1 (Unsubmitted State) to: ${screenshot1}`);

  // Fill form and submit
  console.log('3. Filling submission form and clicking Submit & Run AI Evaluation...');
  await page.evaluate(() => {
    document.getElementById('sub-title').value = 'Automated AI Resume Grader';
    document.getElementById('sub-desc').value = 'Analyzes technical resumes against ATS formatting benchmarks and role requirements for fresh grads.';
    document.getElementById('sub-github').value = 'https://github.com/freshstudent/ai-resume-grader';
    document.getElementById('sub-demo').value = 'https://ai-resume-grader.vercel.app';
    document.getElementById('sub-stack').value = 'React, Node.js, Express, Gemini 2.5 Flash API';
    document.getElementById('sub-ai-usage').value = 'Uses Gemini Flash with structured JSON system prompts to assess technical depth, impact metrics, and clarity.';
    document.getElementById('sub-learned').value = 'Learned how to construct structured output schemas, tune prompt instructions, and handle API retries in 60 minutes.';
  });

  await page.click('#sub-project-btn');
  await sleep(400);

  // Check STATE 2: Loading State
  const loadingCheck = await page.evaluate(() => {
    const loading = document.getElementById('eval-loading-state');
    return loading && window.getComputedStyle(loading).display !== 'none';
  });
  console.log('State 2 (Evaluating in progress) active:', loadingCheck);

  // Wait for evaluation to complete (STATE 3)
  console.log('4. Waiting for Gemini evaluation response...');
  await page.waitForFunction(() => {
    const result = document.getElementById('eval-result-container');
    return result && window.getComputedStyle(result).display !== 'none';
  }, { timeout: 35000 });

  await sleep(1000);

  const state3Data = await page.evaluate(() => {
    return {
      title: document.getElementById('eval-proj-title')?.textContent,
      overallScore: document.getElementById('eval-overall-score')?.textContent,
      statusTag: document.getElementById('sub-form-status-tag')?.textContent,
      btnText: document.getElementById('sub-project-btn')?.textContent?.trim()
    };
  });
  console.log('State 3 Evaluated Data:', state3Data);

  const screenshot2 = path.join(artifactDir, 'fresh_student_evaluated_scorecard.png');
  await page.screenshot({ path: screenshot2, fullPage: false });
  console.log(`Saved screenshot 2 (Evaluated Scorecard) to: ${screenshot2}`);

  // Test Refresh Persistence
  console.log('5. Reloading page to verify persistence of evaluated state...');
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1000);
  await page.evaluate(() => switchView('submit'));
  await sleep(1000);

  const persistedTitle = await page.$eval('#eval-proj-title', el => el.textContent);
  const persistedScore = await page.$eval('#eval-overall-score', el => el.textContent);
  console.log(`Persisted on refresh -> Title: ${persistedTitle}, Score: ${persistedScore}`);

  if (persistedScore === '—' || persistedScore.includes('null')) {
    throw new Error('Score did not persist properly on refresh!');
  }

  await browser.close();
  console.log('\n✓ All browser visual lifecycle tests passed seamlessly!');
}

main().catch(err => {
  console.error('\n❌ Browser test failed:', err);
  process.exit(1);
});
