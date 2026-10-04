// ============================================================================
// AI60 Workshop Platform — Client Application
// ============================================================================

const STATE = {
  activeView: 'landing',
  adminToken: null,
  currentUser: null,
  registeredCount: 0,
  quizAnswers: {},
  currentQuizStep: 0,
  currentSlide: 1,
  allRegistrations: []
};

// URL query parameter extraction
const URL_PARAMS = new URLSearchParams(window.location.search);
const REF_PARAM = URL_PARAMS.get('ref') || '';
const AMB_PARAM = URL_PARAMS.get('ambassador') || '';
const UTM_SOURCE = URL_PARAMS.get('utm_source') || (REF_PARAM ? 'referral' : AMB_PARAM ? 'ambassador' : 'direct');
const UTM_CAMPAIGN = URL_PARAMS.get('utm_campaign') || 'ai60_challenge';

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Parse URL hash for view routing
  const initialHash = window.location.hash.replace('#', '') || 'landing';
  switchView(initialHash, false);

  // Auto-populate referral code if present in URL
  if (REF_PARAM) {
    const refInput = document.getElementById('reg-refcode');
    if (refInput) refInput.value = REF_PARAM;
  }

  // Restore stored user session if exists
  const storedUser = localStorage.getItem('ai60_user');
  if (storedUser) {
    try {
      STATE.currentUser = JSON.parse(storedUser);
      updateAuthUI();
      updateStudentViewWithUser(STATE.currentUser);
    } catch (e) {
      console.warn('Session parse error', e);
      localStorage.removeItem('ai60_user');
    }
  }

  // Check for stored admin token
  const storedAdminToken = localStorage.getItem('ai60_admin_token');
  if (storedAdminToken) {
    STATE.adminToken = storedAdminToken;
    showAdminNav();
  }

  // Load leaderboard
  await loadLeaderboard();
  if (STATE.adminToken) await loadAdminData();

  // Keyboard navigation for strategy deck
  document.addEventListener('keydown', (e) => {
    if (STATE.activeView === 'strategy') {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    }
  });

  // Init quiz questions
  renderQuizQuestion(0);
});

// Hash navigation listener
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '') || 'landing';
  if (hash !== STATE.activeView) {
    switchView(hash, false);
  }
});

// ============================================================================
// VIEW SWITCHER & ROUTER
// ============================================================================
function switchView(viewName, updateHash = true) {
  // Auth-gate: require login for protected views
  const protectedViews = ['student', 'workshop', 'submit'];
  if (protectedViews.includes(viewName) && !STATE.currentUser) {
    openRegisterModal();
    return;
  }
  // Admin-gate: require admin token for admin views
  const adminViews = ['admin', 'strategy'];
  if (adminViews.includes(viewName) && !STATE.adminToken) {
    showToast('Admin access required.', 'error');
    return;
  }

  const targetId = `view-${viewName}`;
  const targetEl = document.getElementById(targetId);
  if (!targetEl) return;

  // Toggle sections
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  targetEl.classList.add('active');

  // Update tabs
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  STATE.activeView = viewName;
  if (updateHash) {
    window.location.hash = viewName;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Refresh view-specific data
  if (viewName === 'admin') loadAdminData();
  if (viewName === 'student') refreshStudentDashboard();
  if (viewName === 'ai-hub') loadAiHubData();
}

function updateAuthUI() {
  const container = document.getElementById('auth-state-container');
  if (!container) return;
  if (STATE.currentUser) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--cyan-primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.75rem;color:#000;">${STATE.currentUser.full_name?.charAt(0).toUpperCase() || 'U'}</div>
        <span style="font-size:0.8rem;color:var(--text-secondary);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${STATE.currentUser.full_name?.split(' ')[0] || 'Student'}</span>
        <button class="btn btn-secondary btn-sm" onclick="logoutUser()" style="font-size:0.7rem;padding:0.2rem 0.5rem;">Logout</button>
      </div>
    `;
  } else {
    container.innerHTML = '<button class="btn btn-primary btn-sm" onclick="openRegisterModal()">Register Free</button>';
  }
}

function logoutUser() {
  STATE.currentUser = null;
  STATE.userToken = null;
  localStorage.removeItem('ai60_user');
  localStorage.removeItem('ai60_user_token');
  updateAuthUI();
  switchView('landing');
  showToast('Logged out successfully.');
}

function showAdminNav() {
  const adminNav = document.querySelector('.admin-nav');
  if (adminNav) adminNav.style.display = 'flex';
}

async function loginAdmin(email, password) {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.token) {
      STATE.adminToken = data.token;
      localStorage.setItem('ai60_admin_token', data.token);
      showAdminNav();
      await loadAdminData();
      showToast('Admin access granted.');
      return true;
    }
  } catch (err) {
    console.error('Admin login error:', err);
  }
  return false;
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ============================================================================
// AUTHENTICATION & SESSIONS
// ============================================================================

// ============================================================================
// "IS THIS FOR ME?" QUALIFICATION QUIZ
// ============================================================================
const QUIZ_QUESTIONS = [
  {
    title: "What is your current experience with AI tools & APIs?",
    subtitle: "Be honest — this helps us calibrate the build complexity to your baseline.",
    options: [
      { text: "Complete Beginner — I've used ChatGPT/Claude as a consumer, but never built an app.", score: 95 },
      { text: "Curious Tinkerer — I've written basic Python or JS, but never integrated an LLM API.", score: 92 },
      { text: "Intermediate Builder — I understand REST APIs and want to deploy a full stack AI app.", score: 90 },
      { text: "Experienced Coder — Looking for advanced prompt orchestration & evaluation patterns.", score: 86 }
    ]
  },
  {
    title: "What is your engineering branch & college background?",
    subtitle: "AI skills are democratized across all domains.",
    options: [
      { text: "Computer Science (CSE) / Information Tech (IT) / AI & ML", score: 94 },
      { text: "Electronics (ECE) / Electrical (EEE)", score: 92 },
      { text: "Mechanical / Civil / Chemical / Biotech", score: 90 },
      { text: "Other Engineering or Applied Sciences", score: 88 }
    ]
  },
  {
    title: "What is your primary goal for this 60-minute workshop?",
    subtitle: "We prioritize tangible outcomes over passive video watching.",
    options: [
      { text: "Have a verified, demonstrable AI project to showcase in campus placements.", score: 96 },
      { text: "Learn how to build and ship real AI applications fast without weeks of theory.", score: 94 },
      { text: "Understand systemic prompt engineering and API integration patterns.", score: 91 },
      { text: "Build with my batchmates and earn completion credentials.", score: 89 }
    ]
  },
  {
    title: "Have you ever deployed a coding project or shared a live demo?",
    subtitle: "Zero deployment experience is 100% fine — we cover it step by step.",
    options: [
      { text: "Never — I've only written code locally on my laptop.", score: 95 },
      { text: "A couple of times for college lab assignments.", score: 92 },
      { text: "Yes, I have an active GitHub profile with some repositories.", score: 89 }
    ]
  },
  {
    title: "How comfortable are you with code basics (loops, functions, variables)?",
    subtitle: "Even simple familiarity allows you to complete the 60-minute build.",
    options: [
      { text: "Comfortable with basic syntax in any language (Python, C, Java, or JS).", score: 95 },
      { text: "A bit rusty, but I can understand logic if guided step-by-step.", score: 92 },
      { text: "Absolute beginner — looking to see what building with AI actually looks like.", score: 88 }
    ]
  }
];

function renderQuizQuestion(idx) {
  STATE.currentQuizStep = idx;
  const q = QUIZ_QUESTIONS[idx];
  document.getElementById('quiz-step-text').textContent = `Question ${idx + 1} of ${QUIZ_QUESTIONS.length}`;
  document.getElementById('quiz-progress-bar').style.width = `${((idx + 1) / QUIZ_QUESTIONS.length) * 100}%`;
  document.getElementById('quiz-question-title').textContent = q.title;
  document.getElementById('quiz-question-subtitle').textContent = q.subtitle;

  const prevBtn = document.getElementById('quiz-prev-btn');
  prevBtn.style.visibility = idx > 0 ? 'visible' : 'hidden';

  const container = document.getElementById('quiz-options-container');
  container.innerHTML = '';

  q.options.forEach((opt, optIdx) => {
    const btn = document.createElement('button');
    btn.className = `quiz-opt-btn ${STATE.quizAnswers[idx] === optIdx ? 'selected' : ''}`;
    btn.innerHTML = `<span>${opt.text}</span> <span style="color:var(--text-muted)">→</span>`;
    btn.onclick = () => selectQuizOption(idx, optIdx, opt.score);
    container.appendChild(btn);
  });
}

function selectQuizOption(qIdx, optIdx, score) {
  STATE.quizAnswers[qIdx] = optIdx;
  if (!STATE.quizScores) STATE.quizScores = [];
  STATE.quizScores[qIdx] = score;

  if (qIdx < QUIZ_QUESTIONS.length - 1) {
    renderQuizQuestion(qIdx + 1);
  } else {
    // Show quiz results
    finishQuiz();
  }
}

function prevQuizQuestion() {
  if (STATE.currentQuizStep > 0) {
    renderQuizQuestion(STATE.currentQuizStep - 1);
  }
}

function finishQuiz() {
  document.getElementById('quiz-question-box').style.display = 'none';
  document.getElementById('quiz-result-box').style.display = 'block';

  const avgScore = Math.round(STATE.quizScores.reduce((a, b) => a + b, 0) / STATE.quizScores.length);
  document.getElementById('fit-score-val').textContent = `${avgScore}%`;

  // Submit quiz attempt to backend
  fetch('/api/quiz/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      answers: STATE.quizAnswers,
      score: avgScore,
      fit_message: `Qualified at ${avgScore}% match`
    })
  }).catch(e => console.warn('Quiz submit err', e));
}

function proceedFromQuizToRegister() {
  openRegisterModal();
}

// ============================================================================
// REGISTRATION FLOW & VIRAL REFERRAL CAPTURE
// ============================================================================
function openRegisterModal() {
  const modal = document.getElementById('modal-register');
  modal.classList.add('open');
}

function closeRegisterModal() {
  const modal = document.getElementById('modal-register');
  modal.classList.remove('open');
}

async function handleRegistrationSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('reg-submit-btn');
  const errEl = document.getElementById('reg-error-msg');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span> Securing Your Seat...';

  const payload = {
    full_name: document.getElementById('reg-name').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    phone: document.getElementById('reg-phone').value.trim(),
    college: document.getElementById('reg-college').value,
    branch: document.getElementById('reg-branch').value,
    graduation_year: document.getElementById('reg-year').value,
    referral_code: document.getElementById('reg-refcode').value.trim() || REF_PARAM,
    utm_source: UTM_SOURCE,
    utm_campaign: UTM_CAMPAIGN,
    ambassador_code: AMB_PARAM,
    quiz_score: STATE.quizScores ? Math.round(STATE.quizScores.reduce((a,b)=>a+b,0)/STATE.quizScores.length) : 90
  };

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Registration failed. Please try again.');
    }

    // Success! Save user session
    STATE.currentUser = data.user;
    if (data.token) {
      STATE.userToken = data.token;
      localStorage.setItem('ai60_user_token', data.token);
    }
    localStorage.setItem('ai60_user', JSON.stringify(data.user));
    updateAuthUI();

    // Close register modal, open success celebration modal
    closeRegisterModal();
    openSuccessModal(data.user);
    showToast('Registration Confirmed! Welcome to AI60.');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>⚡</span> Confirm Free Registration';
  }
}

function updateSeatDisplays() {
  // Seat display elements were removed in production polish
}

function openSuccessModal(user) {
  const modal = document.getElementById('modal-success');
  const refUrl = `${window.location.origin}/?ref=${user.referral_code}`;
  document.getElementById('success-ref-url').textContent = refUrl;
  modal.classList.add('open');
}

function copySuccessLink() {
  const url = document.getElementById('success-ref-url').textContent;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Referral link copied to clipboard!');
  });
}

function shareSuccessWhatsApp() {
  const code = STATE.currentUser?.referral_code || '';
  const url = `${window.location.origin}/?ref=${code}`;
  const text = encodeURIComponent(`Hey! I just registered for the free AI60 workshop: Build Your First AI Project in 60 Minutes. Join with my link: ${url}`);
  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

function closeSuccessAndGoToStudent() {
  document.getElementById('modal-success').classList.remove('open');
  updateStudentViewWithUser(STATE.currentUser);
  switchView('student');
}

// ============================================================================
// STUDENT PORTAL & REFERRAL DASHBOARD
// ============================================================================
function updateStudentViewWithUser(user) {
  if (!user) return;
  document.getElementById('student-name-display').textContent = user.full_name;
  document.getElementById('student-avatar-letter').textContent = user.full_name.charAt(0).toUpperCase();
  document.getElementById('student-college-display').textContent = `${user.college} • ${user.branch || 'Engineering'}`;
  document.getElementById('student-ref-code-display').textContent = user.referral_code;

  const refUrl = `${window.location.origin}/?ref=${user.referral_code}`;
  document.getElementById('student-ref-url-display').textContent = refUrl;
}

async function refreshStudentDashboard() {
  const token = localStorage.getItem('ai60_user_token');
  if (!token) return;
  try {
    const res = await fetch('/api/student/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.referral_stats) {
        document.getElementById('student-invited-count').textContent = data.referral_stats.total_referrals || 0;
        document.getElementById('student-registered-count').textContent = data.referral_stats.successful || 0;
        const rate = data.referral_stats.total_referrals ? Math.round((data.referral_stats.successful / data.referral_stats.total_referrals) * 100) : 0;
        document.getElementById('student-conv-rate').textContent = `${rate}%`;
      }
    }
  } catch (err) {
    console.warn('Student dash fetch error', err);
  }
}

function copyReferralLink() {
  const url = document.getElementById('student-ref-url-display').textContent;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Personal referral link copied to clipboard!');
  });
}

function shareReferralWhatsApp() {
  const code = STATE.currentUser?.referral_code || document.getElementById('student-ref-code-display').textContent || 'AMR882';
  const url = `${window.location.origin}/?ref=${code}`;
  const text = encodeURIComponent(`Hey! I just registered for the free AI60 workshop: Build Your First AI Project in 60 Minutes. Join with my invite link to unlock the project starter repos: ${url}`);
  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

// ============================================================================
// AI WORKSHOP ASSISTANT (APPROVED KNOWLEDGE BASE)
// ============================================================================
function sendQuickPrompt(promptText) {
  document.getElementById('chat-input-text').value = promptText;
  sendChatMessage();
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input-text');
  const msg = input.value.trim();
  if (!msg) return;

  const box = document.getElementById('chat-messages-box');
  // Append user bubble
  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble user';
  userBubble.textContent = msg;
  box.appendChild(userBubble);
  input.value = '';
  box.scrollTop = box.scrollHeight;

  // Typing placeholder
  const botBubble = document.createElement('div');
  botBubble.className = 'chat-bubble bot';
  botBubble.innerHTML = '<em>Consulting workshop knowledge base...</em>';
  box.appendChild(botBubble);
  box.scrollTop = box.scrollHeight;

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    botBubble.textContent = data.response || "I don't have enough verified information to answer that accurately.";
  } catch (err) {
    botBubble.textContent = "The workshop covers: 60-minute MVP build, prompt engineering, zero install cloud setup, and automated rubric evaluation. All engineering branches are welcome!";
  }
  box.scrollTop = box.scrollHeight;
}

// ============================================================================
// AI PROJECT IDEA GENERATOR
// ============================================================================
async function generateProjectIdea() {
  const domain = document.getElementById('idea-domain').value;
  const skill = document.getElementById('idea-skill').value;
  const resBox = document.getElementById('idea-result-box');

  try {
    const res = await fetch('/api/ai/project-idea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, skill_level: skill, branch: 'CSE' })
    });
    const data = await res.json();
    const idea = data.idea;
    if (idea) {
      document.getElementById('idea-title').textContent = idea.title;
      document.getElementById('idea-difficulty').textContent = idea.difficulty;
      document.getElementById('idea-problem').textContent = idea.problem;
      document.getElementById('idea-mvp').textContent = idea.sixty_min_mvp;
      resBox.style.display = 'block';
      STATE.currentIdea = idea;
    }
  } catch (e) {
    resBox.style.display = 'block';
  }
}

async function saveProjectIdea() {
  if (!STATE.currentIdea) return;
  const token = localStorage.getItem('ai60_user_token');
  if (token) {
    await fetch('/api/ai/save-idea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idea: STATE.currentIdea })
    }).catch(e => console.warn(e));
  }
  showToast('Project idea saved to your student profile!');
}

// ============================================================================
// LEADERBOARD
// ============================================================================
async function loadLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById('student-leaderboard-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = data.leaderboard || [];

    list.slice(0, 5).forEach((item, idx) => {
      const tr = document.createElement('tr');
      const badgeIcon = idx === 0 ? '🥇 Gold' : idx === 1 ? '🥈 Silver' : idx === 2 ? '🥉 Bronze' : '⭐ Builder';
      tr.innerHTML = `
        <td><strong style="color:var(--cyan-primary)">#${idx + 1}</strong></td>
        <td><strong>${item.full_name}</strong></td>
        <td>${item.college}</td>
        <td>${item.branch || 'CSE'}</td>
        <td><strong style="color:var(--emerald-primary);">${item.referral_count}</strong> Referrals</td>
        <td><span class="card-tag">${badgeIcon}</span></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.warn('Leaderboard error', err);
  }
}

// ============================================================================
// WORKSHOP ROOM
// ============================================================================
function updateWorkshopMilestones() {
  const checks = [
    document.getElementById('check-1').checked,
    document.getElementById('check-2').checked,
    document.getElementById('check-3').checked,
    document.getElementById('check-4').checked
  ];
  const completed = checks.filter(Boolean).length;
  const pct = Math.round((completed / 4) * 100);

  document.getElementById('workshop-progress-pct').textContent = `${pct}% Complete`;
  document.getElementById('workshop-progress-fill').style.width = `${pct}%`;

  // Persist to backend if student logged in
  const token = localStorage.getItem('ai60_user_token');
  if (token) {
    fetch('/api/workshop/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ progress: pct, status: pct === 100 ? 'completed' : 'in_progress' })
    }).catch(e => console.warn(e));
  }
}

// Stream toggle placeholder
function toggleStreamSimulation() {
  showToast('Workshop stream will begin when the session starts.');
}

// ============================================================================
// PROJECT SUBMISSION & AUTOMATED AI EVALUATION
// ============================================================================
async function submitProjectForEvaluation() {
  const title = document.getElementById('sub-title').value.trim();
  const desc = document.getElementById('sub-desc').value.trim();
  const github = document.getElementById('sub-github').value.trim();
  const stack = document.getElementById('sub-stack').value.trim();
  const token = localStorage.getItem('ai60_user_token');

  if (!title || !desc || !github) {
    showToast('Please fill in title, description, and GitHub URL.', 'error');
    return;
  }
  if (!token) {
    showToast('Please log in first.', 'error');
    return;
  }

  showToast('Submitting project and running AI evaluation...');

  try {
    // Submit the project
    const subRes = await fetch('/api/project/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ project_name: title, description: desc, github_url: github, tech_stack: stack, ai_usage: 'LLM API integration' })
    });
    const subData = await subRes.json();
    if (!subRes.ok) throw new Error(subData.error || 'Submission failed');

    // Request AI evaluation
    const evalRes = await fetch('/api/project/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ project_id: subData.project?.id || subData.id })
    });
    const evalData = await evalRes.json();
    const ev = evalData.evaluation || {};

    document.getElementById('eval-proj-title').textContent = title;
    document.getElementById('eval-overall-score').textContent = ev.score || 0;
    document.getElementById('score-clarity').textContent = `${ev.problem_clarity || 0}%`;
    document.getElementById('score-ai').textContent = `${ev.ai_usage_score || 0}%`;
    document.getElementById('score-func').textContent = `${ev.functionality || 0}%`;
    document.getElementById('score-ux').textContent = `${ev.ux_score || 0}%`;
    document.getElementById('score-orig').textContent = `${ev.originality || 0}%`;
    document.getElementById('score-tech').textContent = `${ev.technical || 0}%`;
    document.getElementById('score-comp').textContent = `${ev.completeness || 0}%`;

    document.getElementById('eval-result-container').scrollIntoView({ behavior: 'smooth' });
    showToast(`Evaluation Complete! Overall Score: ${ev.score || 0}/100.`);
  } catch (err) {
    showToast(err.message || 'Failed to submit project.', 'error');
  }
}

function shareBuildOnWhatsApp() {
  const title = document.getElementById('eval-proj-title').textContent;
  const score = document.getElementById('eval-overall-score').textContent;
  const code = STATE.currentUser?.referral_code || 'AI60';
  const url = `${window.location.origin}/?ref=${code}`;
  const text = encodeURIComponent(`🚀 I just built and deployed "${title}" in 60 minutes at the AI60 sprint! Automated AI Rubric Score: ${score}/100. Build your first AI project too: ${url}`);
  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

function copyBuildBadgeLink() {
  const url = `${window.location.origin}/#submit`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Verified Builder Badge link copied to clipboard!');
  });
}

// ============================================================================
// ADMIN GROWTH OS
// ============================================================================
async function loadAdminData() {
  const token = STATE.adminToken || localStorage.getItem('ai60_admin_token');
  if (!token) return;

  try {
    // 1. Fetch Analytics Overview
    const aRes = await fetch('/api/admin/analytics', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (aRes.ok) {
      const aData = await aRes.json();
      if (aData.metrics) {
        const total = aData.metrics.total_registrations || 0;
        STATE.registeredCount = total;
        document.getElementById('admin-total-reg').textContent = total;
        document.getElementById('admin-gap-reg').textContent = 'N/A';
        document.getElementById('admin-referral-reg').textContent = aData.metrics.referral_registrations || 0;
      }
    }

    // 2. Fetch Registrations Table
    const rRes = await fetch('/api/admin/registrations?limit=50', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (rRes.ok) {
      const rData = await rRes.json();
      STATE.allRegistrations = rData.registrations || [];
      renderRegistrationsTable(STATE.allRegistrations);
    }

    // 3. Fetch Ambassadors
    const ambRes = await fetch('/api/admin/ambassadors', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (ambRes.ok) {
      const ambData = await ambRes.json();
      renderAmbassadorsTable(ambData.ambassadors || []);
    }

    // 4. Fetch Experiments
    const expRes = await fetch('/api/admin/experiments', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (expRes.ok) {
      const expData = await expRes.json();
      renderExperimentsList(expData.experiments || []);
    }
  } catch (err) {
    console.warn('Admin data load err', err);
  }
}

function renderRegistrationsTable(regs) {
  const tbody = document.getElementById('admin-registrations-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  regs.slice(0, 50).forEach(r => {
    const tr = document.createElement('tr');
    const intentClass = r.intent_level === 'high' ? 'intent-high' : r.intent_level === 'low' ? 'intent-low' : 'intent-medium';
    tr.innerHTML = `
      <td><strong>${r.full_name}</strong><br><span style="font-size:0.75rem;color:var(--text-muted);">${r.email}</span></td>
      <td>${r.college}</td>
      <td>${r.branch || 'CSE'}</td>
      <td style="font-family:var(--font-mono); font-size:0.8rem;">+91 ${r.phone.slice(-10)}</td>
      <td><span class="card-tag">${r.utm_source || 'direct'}</span></td>
      <td style="font-family:var(--font-mono); font-size:0.8rem; color:var(--cyan-primary);">${r.referral_code}</td>
      <td><span class="intent-pill ${intentClass}">${r.intent_level || 'medium'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function filterRegistrationsTable() {
  const query = (document.getElementById('reg-search-input')?.value || '').toLowerCase();
  const intent = document.getElementById('reg-intent-filter')?.value || 'all';

  const filtered = STATE.allRegistrations.filter(r => {
    const matchesQ = (r.full_name || '').toLowerCase().includes(query) || (r.college || '').toLowerCase().includes(query);
    const matchesIntent = intent === 'all' || r.intent_level === intent;
    return matchesQ && matchesIntent;
  });
  renderRegistrationsTable(filtered);
}

function renderAmbassadorsTable(ambs) {
  const tbody = document.getElementById('admin-ambassadors-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (ambs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem;">No ambassadors registered yet.</td></tr>';
    return;
  }
  ambs.forEach(a => {
    const conv = a.visits ? ((a.registrations / a.visits) * 100).toFixed(1) : '0';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${a.ambassador_name}</strong></td>
      <td>${a.college}<br><span style="font-size:0.75rem;color:var(--text-muted);">${a.club || ''}</span></td>
      <td><span style="font-family:var(--font-mono); color:var(--cyan-primary);">${a.ambassador_code}</span></td>
      <td>${a.visits}</td>
      <td><strong style="color:var(--emerald-primary);">${a.registrations}</strong></td>
      <td>${conv}%</td>
      <td><span class="card-tag" style="background:var(--emerald-surface); color:var(--emerald-primary);">Active Partner</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderExperimentsList(exps) {
  const container = document.getElementById('admin-experiments-list');
  if (!container) return;
  container.innerHTML = '';

  if (exps.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;">No A/B experiments configured yet.</div>';
    return;
  }
  exps.forEach(e => {
    const card = document.createElement('div');
    card.style.background = 'var(--bg-surface)';
    card.style.borderRadius = 'var(--radius-md)';
    card.style.padding = '1rem';
    card.style.border = '1px solid var(--border-light)';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
        <strong style="color:var(--text-white); font-size:0.9rem;">${e.name}</strong>
        <span class="card-tag" style="background:rgba(16,185,129,0.15); color:var(--emerald-primary);">${e.status || 'Active Test'}</span>
      </div>
      <div style="font-size:0.78rem; color:var(--text-secondary); display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.4rem;">
        <div style="background:var(--bg-card); padding:0.5rem; border-radius:var(--radius-sm);">
          <strong>Variant A:</strong> "${e.variant_a}"<br>
          <span style="color:var(--emerald-primary); font-weight:600;">${e.variant_a_registrations || 0} Regs</span>
        </div>
        <div style="background:var(--bg-card); padding:0.5rem; border-radius:var(--radius-sm);">
          <strong>Variant B:</strong> "${e.variant_b}"<br>
          <span style="color:var(--cyan-primary); font-weight:600;">${e.variant_b_registrations || 0} Regs</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

async function generateAiInsights() {
  showToast('AI Growth Copilot analyzing channel velocities...');
  const token = STATE.adminToken || localStorage.getItem('ai60_admin_token');
  try {
    const res = await fetch('/api/admin/insights', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      showToast('AI Growth Insights Refreshed with active data!');
    }
  } catch (e) {
    showToast('AI Insights updated.');
  }
}

function exportRegistrationsCsv() {
  window.open('/api/admin/export/registrations', '_blank');
  showToast('Exporting registrations CSV...');
}

// Multichannel Messages
const MSG_TEMPLATES = {
  reminder_24h: "Your AI60 workshop starts in 24 hours! Keep your laptop ready. Know a friend who wants to build too? Share your link to unlock starter repos: {{referral_url}}",
  referral_booster: "🚀 Squad Challenge: Invite 3 batchmates to the AI60 live workshop and unlock our complete library of 5 production AI templates. Your personal link: {{referral_url}}",
  final_1h: "🔴 We go live in 1 hour! Get ready to build your first AI project in 60 minutes. Join here: {{workshop_url}}"
};

function loadMessageTemplate() {
  const sel = document.getElementById('msg-template-select').value;
  const body = document.getElementById('msg-body');
  if (MSG_TEMPLATES[sel]) body.value = MSG_TEMPLATES[sel];
}

async function sendBroadcastMessage() {
  const audience = document.getElementById('msg-audience').value;
  const body = document.getElementById('msg-body').value;
  const token = STATE.adminToken || localStorage.getItem('ai60_admin_token');

  showToast('Queueing message broadcast...');
  try {
    const res = await fetch('/api/admin/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ body, audience_filter: audience, channel: 'whatsapp', status: 'sent' })
    });
    const data = await res.json();
    const count = data.recipients || STATE.registeredCount;
    document.getElementById('msg-status-text').textContent = `✅ Broadcast queued for ${count} students`;
    showToast(`Message queued for ${count} students.`);
  } catch (err) {
    document.getElementById('msg-status-text').textContent = '⚠️ Failed to queue broadcast';
  }
}

// ============================================================================
// AI HUB & OBSERVABILITY
// ============================================================================
async function loadAiHubData() {
  const token = STATE.adminToken || localStorage.getItem('ai60_admin_token');
  if (!token) return;

  try {
    const healthRes = await fetch('/api/admin/ai/health', { headers: { 'Authorization': `Bearer ${token}` } });
    if (healthRes.ok) {
      const data = await healthRes.json();
      renderAiHealth(data.health);
    }
    const usageRes = await fetch('/api/admin/ai/usage', { headers: { 'Authorization': `Bearer ${token}` } });
    if (usageRes.ok) {
      const data = await usageRes.json();
      renderAiUsage(data.usage);
    }
    const kbRes = await fetch('/api/admin/knowledge', { headers: { 'Authorization': `Bearer ${token}` } });
    if (kbRes.ok) {
      const data = await kbRes.json();
      renderKnowledgeBase(data.knowledge);
    }
  } catch (err) {
    console.warn('AI Hub load error', err);
  }
}

function renderAiHealth(health) {
  const container = document.getElementById('ai-health-container');
  if (!container) return;
  container.innerHTML = '';
  
  if (!health || Object.keys(health).length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No providers configured.</div>';
    return;
  }
  
  Object.keys(health).forEach(provider => {
    const info = health[provider];
    const isHealthy = info.status === 'HEALTHY';
    const row = document.createElement('div');
    row.style = `display:flex; justify-content:space-between; padding:0.75rem; background:var(--bg-primary); border-radius:var(--radius-sm); border:1px solid var(--border-light); margin-bottom:0.5rem;`;
    row.innerHTML = `
      <div>
        <strong>${provider}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${info.model || 'Unknown model'}</div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end;">
        <span class="card-tag" style="background:${isHealthy ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${isHealthy ? 'var(--emerald-primary)' : 'var(--red-primary)'};">${info.status}</span>
      </div>
    `;
    container.appendChild(row);
  });
}

function renderAiUsage(logs) {
  if (!logs) return;
  const totalRequests = logs.length;
  const fallbacks = logs.filter(l => l.fallback_used).length;
  const successes = logs.filter(l => l.status === 'SUCCESS').length;
  
  const fallbackRate = totalRequests > 0 ? Math.round((fallbacks / totalRequests) * 100) : 0;
  const successRate = totalRequests > 0 ? Math.round((successes / totalRequests) * 100) : 0;
  
  document.getElementById('ai-total-requests').textContent = totalRequests;
  document.getElementById('ai-fallback-rate').textContent = `${fallbackRate}%`;
  document.getElementById('ai-success-rate').textContent = `${successRate}%`;
  
  // Fake cost estimation based on logs
  const cost = (totalRequests * 0.05).toFixed(2);
  document.getElementById('ai-est-cost').textContent = `₹${cost}`;
}

async function triggerFailureSim(provider) {
  const token = STATE.adminToken || localStorage.getItem('ai60_admin_token');
  try {
    const res = await fetch('/api/admin/ai/simulate-failure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ provider: provider.charAt(0).toUpperCase() + provider.slice(1) })
    });
    if (res.ok) {
      showToast(`Simulated outage for ${provider}. Will auto-recover in 60s.`);
      setTimeout(loadAiHubData, 1000);
    }
  } catch(e) {}
}

async function runSimulationTest() {
  const resEl = document.getElementById('sim-test-result');
  resEl.style.display = 'block';
  resEl.textContent = 'Running fallback test (requesting project idea)...\n';
  const token = localStorage.getItem('ai60_user_token'); // Needs user token
  
  try {
    const res = await fetch('/api/ai/project-idea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'Test Simulator', skill_level: 'Beginner', branch: 'CSE' })
    });
    const data = await res.json();
    if (data.idea) {
      resEl.textContent += `Success! Answered by: ${data.provider} (${data.model})\n`;
      if (data.provider === 'DEMO') {
        resEl.textContent += `Note: Responded in safe DEMO mode because all providers failed.`;
      }
    } else {
      resEl.textContent += `Failed to generate project idea.`;
    }
    setTimeout(loadAiHubData, 1000);
  } catch(e) {
    resEl.textContent += `Request error: ${e.message}`;
  }
}

async function addKnowledgeFact() {
  const title = document.getElementById('kb-title').value.trim();
  const content = document.getElementById('kb-content').value.trim();
  if (!title || !content) return showToast('Please provide both title and content.', 'error');
  
  const token = STATE.adminToken || localStorage.getItem('ai60_admin_token');
  try {
    const res = await fetch('/api/admin/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ title, content })
    });
    if (res.ok) {
      document.getElementById('kb-title').value = '';
      document.getElementById('kb-content').value = '';
      showToast('Knowledge fact added successfully!');
      loadAiHubData();
    }
  } catch(e) {}
}

function renderKnowledgeBase(kbList) {
  const container = document.getElementById('kb-list-container');
  if (!container) return;
  container.innerHTML = '';
  
  if (!kbList || kbList.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No knowledge facts added yet.</div>';
    return;
  }
  
  kbList.forEach(item => {
    const row = document.createElement('div');
    row.style = `padding:0.75rem; background:var(--bg-primary); border-radius:var(--radius-sm); border:1px solid var(--border-light); margin-bottom:0.5rem;`;
    row.innerHTML = `
      <div style="font-weight:700; margin-bottom:0.2rem;">${item.title}</div>
      <div style="font-size:0.8rem; color:var(--text-secondary);">${item.content}</div>
    `;
    container.appendChild(row);
  });
}

// ============================================================================
// 5-SLIDE GROWTH STRATEGY DECK
// ============================================================================
function nextSlide() {
  if (STATE.currentSlide < 5) {
    showSlide(STATE.currentSlide + 1);
  }
}

function prevSlide() {
  if (STATE.currentSlide > 1) {
    showSlide(STATE.currentSlide - 1);
  }
}

function showSlide(num) {
  STATE.currentSlide = num;
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`slide-${i}`);
    if (el) el.style.display = i === num ? 'block' : 'none';
  }
  document.getElementById('slide-num-badge').textContent = `SLIDE ${num} OF 5`;
  document.getElementById('deck-prev-btn').disabled = num === 1;
  document.getElementById('deck-next-btn').disabled = num === 5;
}

// ============================================================================
// FAQ TOGGLE
// ============================================================================
function toggleFaq(btn) {
  const card = btn.closest('.faq-card');
  card.classList.toggle('open');
}
