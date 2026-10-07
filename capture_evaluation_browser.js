const puppeteer = require('puppeteer-core');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('Launching browser for visual verification...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('Navigating to http://localhost:3000/#login...');
  await page.goto('http://localhost:3000/#login', { waitUntil: 'networkidle2' });

  // Wait for splash screen to complete if showing
  await sleep(2200);

  // Login as demo student
  console.log('Logging in with Demo Student credentials...');
  await page.evaluate(async () => {
    await performLogin('9876500060', '9876500060');
  });
  await sleep(1500);

  // Navigate to My Project view (#submit)
  console.log('Navigating to My Project (#submit)...');
  await page.evaluate(() => switchView('submit'));
  await sleep(1000);

  // Take screenshot of demo student evaluation
  const artifactDir = 'C:\\Users\\SARIGASINI\\.gemini\\antigravity-ide\\brain\\49cbcecd-6dd6-4aeb-a552-3f4a1ead414d';
  const screenshot1 = path.join(artifactDir, 'demo_project_scorecard.png');
  await page.screenshot({ path: screenshot1, fullPage: false });
  console.log(`Saved screenshot 1 to: ${screenshot1}`);

  // Extract scorecard text
  const scorecardData = await page.evaluate(() => {
    return {
      title: document.getElementById('eval-proj-title')?.textContent,
      overallScore: document.getElementById('eval-overall-score')?.textContent,
      timestamp: document.getElementById('eval-timestamp-text')?.textContent,
      scores: {
        problemClarity: document.getElementById('score-clarity')?.textContent,
        aiIntegration: document.getElementById('score-ai')?.textContent,
        functionality: document.getElementById('score-func')?.textContent,
        uxPolish: document.getElementById('score-ux')?.textContent,
        originality: document.getElementById('score-orig')?.textContent,
        technicalImplementation: document.getElementById('score-tech')?.textContent,
        completeness: document.getElementById('score-comp')?.textContent
      },
      summary: document.getElementById('eval-summary-text')?.textContent,
      strengths: Array.from(document.querySelectorAll('#eval-strengths-container .eval-item-bullet')).map(el => el.textContent),
      suggestions: Array.from(document.querySelectorAll('#eval-suggestions-container .eval-item-bullet')).map(el => el.textContent)
    };
  });

  console.log('\n--- EXTRACTED EVALUATION SCORECARD DATA ---');
  console.log(JSON.stringify(scorecardData, null, 2));

  // Test Re-evaluate button
  console.log('\nTesting live Re-evaluate button...');
  await page.click('#eval-reevaluate-btn');
  
  // Wait for loading box to disappear and result container to be populated
  await page.waitForFunction(() => {
    const loading = document.getElementById('eval-loading-state');
    return loading && loading.style.display === 'none';
  }, { timeout: 30000 });

  await sleep(1000);

  const screenshot2 = path.join(artifactDir, 'reevaluated_scorecard.png');
  await page.screenshot({ path: screenshot2, fullPage: false });
  console.log(`Saved screenshot 2 (after re-evaluation) to: ${screenshot2}`);

  // Test page refresh persistence
  console.log('\nTesting page reload persistence...');
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1000);
  await page.evaluate(() => switchView('submit'));
  await sleep(1000);

  const persistedTitle = await page.$eval('#eval-proj-title', el => el.textContent);
  const persistedScore = await page.$eval('#eval-overall-score', el => el.textContent);
  console.log(`Persisted after refresh -> Title: ${persistedTitle}, Score: ${persistedScore}`);

  await browser.close();
  console.log('\n✓ Visual verification completed successfully!');
}

main().catch(err => {
  console.error('Visual test failed:', err);
  process.exit(1);
});
