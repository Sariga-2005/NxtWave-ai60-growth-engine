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
const REF_PARAM = URL_PARAMS.get('ref') || URL_PARAMS.get('r') || localStorage.getItem('ai60_ref') || '';
const AMB_PARAM = URL_PARAMS.get('ambassador') || '';
const UTM_SOURCE = URL_PARAMS.get('utm_source') || localStorage.getItem('ai60_utm_source') || (REF_PARAM ? 'referral' : AMB_PARAM ? 'ambassador' : 'direct');
const UTM_CAMPAIGN = URL_PARAMS.get('utm_campaign') || localStorage.getItem('ai60_utm_campaign') || '';

// ============================================================================
// THEME SWITCHER (DARK / LIGHT SYSTEM)
// ============================================================================
function initTheme() {
  const saved = localStorage.getItem('ai60_theme');
  const theme = saved === 'light' ? 'light' : 'dark';
  applyTheme(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('ai60_theme', next);
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    btn.setAttribute('title', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
  }
}

// ============================================================================
// AI60 SPLASH / LOADING SCREEN (Shown once per browser session)
// ============================================================================
function handleSplashScreen() {
  const splash = document.getElementById('ai60-splash');
  if (!splash) return;

  const alreadyShown = sessionStorage.getItem('ai60_splash_shown');
  if (alreadyShown === 'true') {
    splash.classList.add('hidden');
    return;
  }

  // Respect prefers-reduced-motion
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const displayDuration = prefersReduced ? 300 : 1650; // Minimum 1650ms visible

  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.classList.add('hidden');
      sessionStorage.setItem('ai60_splash_shown', 'true');
    }, 450);
  }, displayDuration);
}

// ============================================================================
// CURSOR-REACTIVE LIVE WALLPAPER (Ambient Orbs Parallax & Ambient Cursor Glow)
// ============================================================================
let wallpaperRafId = null;

function initCursorWallpaper() {
  const wallpaper = document.querySelector('.ai60-live-wallpaper');
  if (!wallpaper) return;

  // Respect prefers-reduced-motion
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  // State coordinates
  const state = {
    // Current smoothed coordinates
    mouseX: window.innerWidth / 2,
    mouseY: window.innerHeight * 0.4,
    orb1X: 0,
    orb1Y: 0,
    orb2X: 0,
    orb2Y: 0,
    orb3X: 0,
    orb3Y: 0,

    // Target coordinates
    targetMouseX: window.innerWidth / 2,
    targetMouseY: window.innerHeight * 0.4,
    targetOrb1X: 0,
    targetOrb1Y: 0,
    targetOrb2X: 0,
    targetOrb2Y: 0,
    targetOrb3X: 0,
    targetOrb3Y: 0,

    isActive: true
  };

  // Inertia smoothing factors (different speeds for depth & parallax)
  const SMOOTH_MOUSE = 0.08;
  const SMOOTH_ORB1 = 0.055; // Strongest response
  const SMOOTH_ORB2 = 0.040; // Medium response
  const SMOOTH_ORB3 = 0.025; // Slowest / subtle response

  // Parallax multipliers (pixels offset relative to screen center)
  const MAX_ORB1_X = 55;
  const MAX_ORB1_Y = 42;
  const MAX_ORB2_X = -36;
  const MAX_ORB2_Y = -28;
  const MAX_ORB3_X = 22;
  const MAX_ORB3_Y = 18;

  function onPointerMove(e) {
    // Ignore touch interactions on mobile devices
    if (e.pointerType === 'touch') return;

    const clientX = e.clientX;
    const clientY = e.clientY;
    const width = window.innerWidth || 1920;
    const height = window.innerHeight || 1080;

    // Normalized coordinates from -1 to 1 (center is 0,0)
    const normX = Math.max(-1, Math.min(1, (clientX / width - 0.5) * 2));
    const normY = Math.max(-1, Math.min(1, (clientY / height - 0.5) * 2));

    state.targetMouseX = clientX;
    state.targetMouseY = clientY;

    state.targetOrb1X = normX * MAX_ORB1_X;
    state.targetOrb1Y = normY * MAX_ORB1_Y;

    state.targetOrb2X = normX * MAX_ORB2_X;
    state.targetOrb2Y = normY * MAX_ORB2_Y;

    state.targetOrb3X = normX * MAX_ORB3_X;
    state.targetOrb3Y = normY * MAX_ORB3_Y;
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });

  function render() {
    if (!state.isActive) return;

    // Inertia interpolation (Linear Interpolation / Lerp)
    state.mouseX += (state.targetMouseX - state.mouseX) * SMOOTH_MOUSE;
    state.mouseY += (state.targetMouseY - state.mouseY) * SMOOTH_MOUSE;

    state.orb1X += (state.targetOrb1X - state.orb1X) * SMOOTH_ORB1;
    state.orb1Y += (state.targetOrb1Y - state.orb1Y) * SMOOTH_ORB1;

    state.orb2X += (state.targetOrb2X - state.orb2X) * SMOOTH_ORB2;
    state.orb2Y += (state.targetOrb2Y - state.orb2Y) * SMOOTH_ORB2;

    state.orb3X += (state.targetOrb3X - state.orb3X) * SMOOTH_ORB3;
    state.orb3Y += (state.targetOrb3Y - state.orb3Y) * SMOOTH_ORB3;

    // Apply to CSS variables on .ai60-live-wallpaper
    wallpaper.style.setProperty('--mouse-x', `${state.mouseX.toFixed(1)}px`);
    wallpaper.style.setProperty('--mouse-y', `${state.mouseY.toFixed(1)}px`);
    wallpaper.style.setProperty('--orb1-x', `${state.orb1X.toFixed(2)}px`);
    wallpaper.style.setProperty('--orb1-y', `${state.orb1Y.toFixed(2)}px`);
    wallpaper.style.setProperty('--orb2-x', `${state.orb2X.toFixed(2)}px`);
    wallpaper.style.setProperty('--orb2-y', `${state.orb2Y.toFixed(2)}px`);
    wallpaper.style.setProperty('--orb3-x', `${state.orb3X.toFixed(2)}px`);
    wallpaper.style.setProperty('--orb3-y', `${state.orb3Y.toFixed(2)}px`);

    wallpaperRafId = requestAnimationFrame(render);
  }

  // Start RAF loop
  wallpaperRafId = requestAnimationFrame(render);

  // Pause loop when tab is hidden, resume when tab is active
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      state.isActive = false;
      wallpaper.classList.add('wallpaper-paused');
      if (wallpaperRafId) {
        cancelAnimationFrame(wallpaperRafId);
        wallpaperRafId = null;
      }
    } else {
      wallpaper.classList.remove('wallpaper-paused');
      if (!state.isActive) {
        state.isActive = true;
        wallpaperRafId = requestAnimationFrame(render);
      }
    }
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize and apply stored theme
  initTheme();

  // Run initial splash screen (once per session)
  handleSplashScreen();

  // Initialize cursor-reactive live wallpaper
  initCursorWallpaper();

  // Parse URL hash for view routing
  const initialHash = window.location.hash.replace('#', '') || 'landing';
  switchView(initialHash, false);

  // Auto-populate referral code if present in URL
  if (URL_PARAMS.get('ref') || URL_PARAMS.get('r')) {
    const code = URL_PARAMS.get('ref') || URL_PARAMS.get('r');
    localStorage.setItem('ai60_ref', code);
  }
  if (URL_PARAMS.get('utm_source')) localStorage.setItem('ai60_utm_source', URL_PARAMS.get('utm_source'));
  if (URL_PARAMS.get('utm_medium')) localStorage.setItem('ai60_utm_medium', URL_PARAMS.get('utm_medium'));
  if (URL_PARAMS.get('utm_campaign')) localStorage.setItem('ai60_utm_campaign', URL_PARAMS.get('utm_campaign'));

  if (REF_PARAM) {
    const refInput = document.getElementById('reg-refcode');
    if (refInput) refInput.value = REF_PARAM;
  }

  // Restore stored user session if exists
  const storedUser = localStorage.getItem('ai60_user');
  if (storedUser) {
    try {
      STATE.currentUser = JSON.parse(storedUser);
      STATE.userToken = localStorage.getItem('ai60_user_token');
      updateAuthUI();
      if (typeof refreshStudentDashboard === 'function') {
        refreshStudentDashboard();
      }
    } catch (e) {
      console.warn('Session parse error', e);
      localStorage.removeItem('ai60_user');
      localStorage.removeItem('ai60_user_token');
    }
  }

  // Restore stored admin token
  const storedAdminToken = localStorage.getItem('ai60_admin_token');
  if (storedAdminToken) {
    STATE.adminToken = storedAdminToken;
  }

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
    openRegisterModal();
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
  if (viewName === 'student' || viewName === 'submit') refreshStudentDashboard();
  if (viewName === 'ai-hub') loadAiHubData();
}

function updateAuthUI() {
  const container = document.getElementById('auth-state-container');
  const loginBtn = document.getElementById('header-login-btn');
  if (!container) return;
  if (STATE.currentUser) {
    if (loginBtn) loginBtn.style.display = 'none';
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--cyan-primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.75rem;color:#000;">${STATE.currentUser.full_name?.charAt(0).toUpperCase() || 'U'}</div>
        <span style="font-size:0.8rem;color:var(--text-secondary);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${STATE.currentUser.full_name?.split(' ')[0] || 'User'}</span>
        <button class="btn btn-secondary btn-sm" onclick="logoutUser()" style="font-size:0.7rem;padding:0.2rem 0.5rem;">Logout</button>
      </div>
    `;
    if (STATE.currentUser.role === 'admin') {
      showAdminNav();
    } else {
      hideAdminNav();
    }
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-block';
    hideAdminNav();
    container.innerHTML = '<button class="btn btn-primary btn-sm" onclick="openRegisterModal()">Register Free</button>';
  }
}

function logoutUser() {
  STATE.currentUser = null;
  STATE.userToken = null;
  STATE.adminToken = null;
  STATE.currentProject = null;
  localStorage.removeItem('ai60_user');
  localStorage.removeItem('ai60_user_token');
  localStorage.removeItem('ai60_admin_token');
  updateAuthUI();
  if (typeof updateProjectEvaluationState === 'function') {
    updateProjectEvaluationState(null, null);
  }
  switchView('landing');
  showToast('Logged out successfully.');
}

function showAdminNav() {
  const adminNav = document.querySelector('.admin-nav');
  if (adminNav) adminNav.style.display = 'flex';
  const studentNav = document.querySelector('.student-nav');
  if (studentNav) studentNav.style.display = 'none';
}

function hideAdminNav() {
  const adminNav = document.querySelector('.admin-nav');
  if (adminNav) adminNav.style.display = 'none';
  const studentNav = document.querySelector('.student-nav');
  if (studentNav) studentNav.style.display = 'flex';
}

async function performLogin(email, password) {
  const e = (email || document.getElementById('login-email')?.value || '').trim();
  const p = (password || document.getElementById('login-password')?.value || '').trim();
  const errEl = document.getElementById('login-error');
  if (errEl) errEl.style.display = 'none';

  if (!e || !p) {
    if (errEl) {
      errEl.textContent = 'Please enter your email/phone and password.';
      errEl.style.display = 'block';
    }
    return false;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: e, email: e, phone: e, password: p })
    });
    const data = await res.json();
    
    if (res.ok && data.token) {
      STATE.currentUser = data.user;
      STATE.userToken = data.token;
      localStorage.setItem('ai60_user_token', data.token);
      localStorage.setItem('ai60_user', JSON.stringify(data.user));
      
      updateAuthUI();
      
      if (data.user.role === 'admin') {
        STATE.adminToken = data.token;
        localStorage.setItem('ai60_admin_token', data.token);
        await loadAdminData();
        switchView('admin');
        showToast('Admin access granted.');
      } else {
        if (typeof refreshStudentDashboard === 'function') {
          refreshStudentDashboard();
        }
        switchView('student');
        showToast('Welcome back!');
      }
      return true;
    } else {
      if (errEl) {
        errEl.textContent = data.error || 'Invalid email or password.';
        errEl.style.display = 'block';
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.textContent = 'Network error during login. Please try again.';
      errEl.style.display = 'block';
    }
    console.error('Login error:', err);
  }
  return false;
}

function useDemoCredentials(type) {
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const errEl = document.getElementById('login-error');
  if (errEl) errEl.style.display = 'none';

  if (type === 'student') {
    if (emailInput) emailInput.value = '9876500060';
    if (passwordInput) passwordInput.value = '9876500060';
    showToast('Demo student credentials populated.');
  } else if (type === 'admin') {
    if (emailInput) emailInput.value = 'demo-admin@ai60.com';
    if (passwordInput) passwordInput.value = 'demo-admin123';
    showToast('Demo admin credentials populated.');
  }
  if (passwordInput) passwordInput.focus();
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
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

function getQuizTrack() {
  // Simple direction mapping from the branch answer (Q2). Not a score; personalization will be improved later.
  const branchIdx = STATE.quizAnswers[1];
  const beginner = STATE.quizAnswers[0] === 0 || STATE.quizAnswers[4] === 2;
  const guide = beginner ? ' Guided, step-by-step build.' : ' Includes room to go deeper.';
  if (branchIdx === 0) {
    return { name: 'AI Career Path Analyzer', desc: 'Track: AI App Developer \u2014 build an LLM-powered web app that maps career skills.' + guide };
  }
  if (branchIdx === 1) {
    return { name: 'AI Study & Lab Helper', desc: 'Track: Engineering Productivity \u2014 build an AI helper for notes, lab reports or datasheets.' + guide };
  }
  if (branchIdx === 2) {
    return { name: 'AI Domain Q&A Assistant', desc: 'Track: Domain Automation \u2014 build an AI assistant for a problem in your own engineering field.' + guide };
  }
  return { name: 'AI Campus Helper', desc: 'Track: Everyday AI Tools \u2014 build a simple AI tool that solves a campus problem.' + guide };
}

function finishQuiz() {
  document.getElementById('quiz-question-box').style.display = 'none';
  document.getElementById('quiz-result-box').style.display = 'block';

  const track = getQuizTrack();
  document.getElementById('quiz-rec-project').textContent = track.name;
  document.getElementById('quiz-rec-desc').textContent = track.desc;
  document.getElementById('fit-score-reason').textContent = 'Based on your answers, this is the project direction we suggest for the 60-minute build.';

  // Submit quiz attempt to backend (no score; track only)
  fetch('/api/quiz/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      answers: STATE.quizAnswers,
      fit_message: `Recommended track: ${track.name}`
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
  btn.innerHTML = 'Securing Your Seat...';

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
    ambassador_code: AMB_PARAM
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
    // Referral attribution is complete; clear the stored code so a later
    // registration on this same device is not attributed to the same referrer.
    localStorage.removeItem('ai60_ref');
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
    btn.innerHTML = 'Confirm Free Registration';
  }
}

function updateSeatDisplays() {
  // Seat display elements were removed in production polish
}

function openSuccessModal(user) {
  const modal = document.getElementById('modal-success');
  document.getElementById('success-ref-url').textContent = getMyReferralUrl(user) || 'Referral link unavailable';
  updateShareCard('success', null); // placeholder until real count loads
  modal.classList.add('open');
  fetchVerifiedReferralCount().then(count => {
    if (count !== null) updateShareCard('success', count);
  });
}

function copySuccessLink() {
  copyShareLink('success-ref-url', 'success-copy-btn');
}

function shareSuccessWhatsApp() {
  shareReferral('whatsapp');
}

function closeSuccessAndGoToStudent() {
  document.getElementById('modal-success').classList.remove('open');
  updateStudentViewWithUser(STATE.currentUser);
  switchView('student');
}

// ============================================================================
// REFERRAL SHARE CARD ("Build Your AI Squad")
// Share actions only open the platform's share dialog — nothing is sent
// automatically. The URL contains only the public referral code.
// ============================================================================
const SHARE_MESSAGE = "I'm joining NxtWave's Build Your First AI Project in 60 Minutes workshop. Join me:";

function getMyReferralUrl(user = STATE.currentUser) {
  const code = user?.referral_code;
  return code ? `${window.location.origin}/r/${encodeURIComponent(code)}` : '';
}

async function fetchVerifiedReferralCount() {
  const token = localStorage.getItem('ai60_user_token');
  if (!token) return null;
  try {
    const res = await fetch('/api/student/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.referrals?.successful ?? 0;
  } catch (e) {
    return null;
  }
}

// prefix: 'success' (post-registration modal) or 'student' (dashboard)
function updateShareCard(prefix, verifiedCount) {
  const countEl = document.getElementById(`${prefix}-share-count`);
  const nextEl = document.getElementById(`${prefix}-share-next`);
  const nextWrap = document.getElementById(`${prefix}-share-next-wrap`);
  const barEl = document.getElementById(`${prefix}-share-bar`);
  if (!countEl || !window.AI60Milestones) return;
  if (verifiedCount === null || verifiedCount === undefined) {
    countEl.textContent = '\u2013';
    if (barEl) barEl.style.width = '0%';
    return;
  }
  const p = window.AI60Milestones.getReferralMilestoneProgress(verifiedCount);
  countEl.textContent = p.label;
  if (nextWrap && nextEl) {
    if (p.next) {
      const remaining = p.next.threshold - verifiedCount;
      nextWrap.firstChild.textContent = `${remaining} more verified referral${remaining === 1 ? '' : 's'} to unlock: `;
      nextEl.textContent = p.next.reward;
    } else {
      nextWrap.firstChild.textContent = 'All milestone rewards unlocked ';
      nextEl.textContent = '\u2713';
    }
  }
  if (barEl) barEl.style.width = `${p.percent}%`;
}

function copyShareLink(urlElId, btnId) {
  const url = getMyReferralUrl() || document.getElementById(urlElId)?.textContent || '';
  if (!url.includes('/r/')) { showToast('Register first to get your referral link.', 'error'); return; }
  const done = () => {
    showToast('✓ Referral link copied');
    const btn = document.getElementById(btnId);
    if (btn) {
      if (!btn.dataset.origHtml) btn.dataset.origHtml = btn.innerHTML;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>✓ Link copied</span>`;
      btn.classList.add('copied');
      setTimeout(() => {
        if (btn.dataset.origHtml) btn.innerHTML = btn.dataset.origHtml;
        btn.classList.remove('copied');
      }, 2000);
    }
  };
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { showToast('Could not copy. Please copy the link manually.', 'error'); }
    ta.remove();
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(done).catch(fallback);
  } else {
    fallback();
  }
}

function shareReferral(platform) {
  const url = getMyReferralUrl();
  if (!url) { showToast('Register first to get your referral link.', 'error'); return; }
  const u = encodeURIComponent(url);
  let shareUrl;
  if (platform === 'whatsapp') {
    shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${SHARE_MESSAGE} ${url}`)}`;
  } else if (platform === 'linkedin') {
    shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
  } else if (platform === 'telegram') {
    shareUrl = `https://t.me/share/url?url=${u}&text=${encodeURIComponent(SHARE_MESSAGE)}`;
  } else {
    return;
  }
  window.open(shareUrl, '_blank', 'noopener');
}

// ============================================================================
// STUDENT PORTAL & REFERRAL DASHBOARD
// ============================================================================
function updateStudentViewWithUser(user) {
  if (!user) return;
  const nameEl = document.getElementById('student-name-display');
  if (nameEl) nameEl.textContent = user.full_name || 'Student';

  const avatarEl = document.getElementById('student-avatar-letter');
  if (avatarEl && user.full_name) avatarEl.textContent = user.full_name.charAt(0).toUpperCase();

  const collegeEl = document.getElementById('student-college-display');
  if (collegeEl) collegeEl.textContent = `${user.college || ''} • ${user.branch || 'Engineering'}`;

  const codeEl = document.getElementById('student-ref-code-display');
  if (codeEl) codeEl.textContent = user.referral_code || '';

  const urlEl = document.getElementById('student-ref-url-display');
  if (urlEl) {
    const refUrl = `${window.location.origin}/r/${user.referral_code || ''}`;
    urlEl.textContent = refUrl;
  }
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
      if (data.referrals) {
        const clicks = data.referrals.clicks !== undefined ? data.referrals.clicks : (data.referrals.total || 0);
        const successful = data.referrals.successful || 0;
        
        const invEl = document.getElementById('student-invited-count');
        if (invEl) invEl.textContent = clicks;
        const regEl = document.getElementById('student-registered-count');
        if (regEl) regEl.textContent = successful;
        const rate = clicks > 0 ? Math.round((successful / clicks) * 100) : 0;
        const convEl = document.getElementById('student-conv-rate');
        if (convEl) convEl.textContent = clicks > 0 ? `${rate}%` : '0%';
        
        
        // --- Dashboard UX Additions ---
        const dCount = document.getElementById('dash-ref-count');
        if (dCount) dCount.textContent = successful;
        const dVer = document.getElementById('dash-ref-ver');
        if (dVer) dVer.textContent = successful;
        
        const mlist = window.AI60Milestones ? window.AI60Milestones.REFERRAL_MILESTONES : [
          { threshold: 3, reward: 'Project Starter Pack' },
          { threshold: 5, reward: 'Premium Project Templates' },
          { threshold: 10, reward: 'Project Feedback / Review' },
          { threshold: 25, reward: 'Advanced Project Resource Pack' }
        ];
        
        let nextM = mlist.find(m => m.threshold > successful) || mlist[mlist.length - 1];
        
        const dTarget = document.getElementById('dash-ref-target');
        if (dTarget) dTarget.textContent = nextM.threshold;
        
        const dBar = document.getElementById('dash-ref-bar');
        if (dBar) {
          const pct = Math.min(100, Math.round((successful / nextM.threshold) * 100));
          dBar.style.width = pct + '%';
        }
        
        const dNext = document.getElementById('dash-ref-next');
        if (dNext) dNext.textContent = `${nextM.threshold} → ${nextM.reward}`;
        
        // Update old view-referrals bar if it still exists (which we removed, but just in case)
        const oldBar = document.getElementById('student-share-bar');
        if (oldBar) oldBar.style.width = Math.min(100, Math.round((successful / nextM.threshold) * 100)) + '%';
        const oldNext = document.getElementById('student-share-next');
        if (oldNext) oldNext.textContent = `${nextM.threshold} verified referrals`;
        const oldCount = document.getElementById('student-share-count');
        if (oldCount) oldCount.textContent = `${successful} / ${nextM.threshold}`;
        // ------------------------------
        
const mp = document.getElementById('milestone-progress-text');
        if (mp) mp.textContent = `${successful} Verified Referrals`;

        // Update milestone unlock states (thresholds from shared referral-milestones.js)
        const milestones = window.AI60Milestones ? window.AI60Milestones.REFERRAL_MILESTONES : [];
        milestones.forEach(m => {
          const card = document.getElementById(`ms-card-${m.threshold}`);
          if (!card) return;
          const isUnlocked = successful >= m.threshold;
          card.classList.toggle('unlocked', isUnlocked);
          const badge = document.getElementById(`ms-badge-${m.threshold}`);
          if (badge) {
            badge.textContent = isUnlocked ? 'UNLOCKED' : 'LOCKED';
            badge.className = isUnlocked ? 'card-tag badge-unlocked' : 'card-tag';
          }
          const pt = card.querySelector('.ms-progress-text');
          if (pt) {
            pt.textContent = `${successful} / ${m.threshold}`;
          }
        });
        updateShareCard('student', successful);
      }

      // Populate Project & AI Evaluation according to 4-State Lifecycle
      updateProjectEvaluationState(data.project || null, data.evaluation || null);
    }
  } catch (err) {
    console.warn('Student dash fetch error', err);
  }
}


function copyReferralLink() {
  copyShareLink('student-ref-url-display', 'student-copy-btn');
}

function shareReferralWhatsApp() {
  shareReferral('whatsapp');
}

function shareReferralLinkedIn() {
  shareReferral('linkedin');
}

function shareReferralTelegram() {
  shareReferral('telegram');
}

// ============================================================================
// AI60 STUDENT ASSISTANT (LIGHTWEIGHT GROUNDED RAG)
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
  botBubble.innerHTML = '<em>Searching AI60 verified knowledge base...</em>';
  box.appendChild(botBubble);
  box.scrollTop = box.scrollHeight;

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    
    if (data.status === 'unavailable') {
      botBubble.innerHTML = `<div>AI Assistant is currently unavailable.</div><div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.35rem;">No runtime AI provider configured.</div>`;
    } else {
      const respText = data.response || "I don't have that information in the AI60 knowledge base.";
      const prov = '';
      botBubble.innerHTML = `<div>${escapeHtml(respText)}</div>${prov}`;
    }
  } catch (err) {
    botBubble.innerHTML = `<div>AI Assistant is currently unavailable.</div>`;
  }
  box.scrollTop = box.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    } else {
      showToast(data.message || 'Project ideas are not available right now.', 'error');
    }
  } catch (e) {
    showToast('Could not generate a project idea right now.', 'error');
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
// PROJECT SUBMISSION & AUTOMATED AI EVALUATION STATE MACHINE (4 STATES)
// ============================================================================

function updateProjectEvaluationState(project, ev) {
  const unsubmittedBox = document.getElementById('eval-unsubmitted-state');
  const loadingBox = document.getElementById('eval-loading-state');
  const errorBox = document.getElementById('eval-error-state');
  const resultContainer = document.getElementById('eval-result-container');
  const subBtn = document.getElementById('sub-project-btn');
  const tagEl = document.getElementById('sub-form-status-tag');

  // Hide all right-side states initially
  if (unsubmittedBox) unsubmittedBox.style.display = 'none';
  if (loadingBox) loadingBox.style.display = 'none';
  if (errorBox) errorBox.style.display = 'none';
  if (resultContainer) resultContainer.style.display = 'none';

  // -------------------------------------------------------------
  // STATE 1: NO PROJECT SUBMITTED
  // -------------------------------------------------------------
  if (!project) {
    if (unsubmittedBox) unsubmittedBox.style.display = 'block';
    if (subBtn) subBtn.textContent = 'Submit & Run AI Evaluation';
    if (tagEl) {
      tagEl.textContent = 'AI60 Sprint';
      tagEl.style.background = 'var(--cyan-surface)';
      tagEl.style.color = 'var(--cyan-primary)';
    }

    // Clear submission input fields if empty state
    const clearVal = id => { const el = document.getElementById(id); if (el) el.value = ''; };
    clearVal('sub-title');
    clearVal('sub-desc');
    clearVal('sub-github');
    clearVal('sub-demo');
    clearVal('sub-stack');
    clearVal('sub-ai-usage');
    clearVal('sub-learned');
    return;
  }

  // Populate form with existing submitted project data
  STATE.currentProject = project;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; };
  setVal('sub-title', project.project_name);
  setVal('sub-desc', project.description);
  setVal('sub-github', project.github_url);
  setVal('sub-demo', project.demo_url);
  setVal('sub-stack', project.tech_stack);
  setVal('sub-ai-usage', project.ai_usage);
  setVal('sub-learned', project.what_learned);
  
  if (subBtn) subBtn.textContent = 'Update & Re-Evaluate Project';

  const hasValidEval = ev && (
    (typeof ev.score === 'number' && ev.score > 0) ||
    (typeof ev.overall_score === 'number' && ev.overall_score > 0)
  ) && (ev.categories || ev.categories_data);

  if (hasValidEval) {
    // -------------------------------------------------------------
    // STATE 3: EVALUATION SUCCESSFUL (PROJECT EVALUATED)
    // -------------------------------------------------------------
    if (tagEl) {
      tagEl.textContent = 'Evaluated';
      tagEl.style.background = 'var(--emerald-surface)';
      tagEl.style.color = 'var(--emerald-primary)';
    }
    renderEvaluationResult(project, ev);
  } else {
    // -------------------------------------------------------------
    // STATE 4: PROJECT SUBMITTED, EVALUATION PENDING / UNAVAILABLE
    // -------------------------------------------------------------
    if (tagEl) {
      tagEl.textContent = 'Submitted';
      tagEl.style.background = 'rgba(245,158,11,0.15)';
      tagEl.style.color = 'var(--amber-primary)';
    }
    if (errorBox) {
      errorBox.style.display = 'block';
      const errMsg = document.getElementById('eval-error-msg');
      if (errMsg) errMsg.textContent = 'Your project was submitted successfully, but AI evaluation could not be completed.';
    }
  }
}

function renderEvaluationResult(project, ev) {
  if (!ev) return;

  const resultContainer = document.getElementById('eval-result-container');
  const loadingBox = document.getElementById('eval-loading-state');
  const errorBox = document.getElementById('eval-error-state');
  const unsubmittedBox = document.getElementById('eval-unsubmitted-state');

  if (unsubmittedBox) unsubmittedBox.style.display = 'none';
  if (loadingBox) loadingBox.style.display = 'none';
  if (errorBox) errorBox.style.display = 'none';
  if (resultContainer) resultContainer.style.display = 'block';

  // Project title
  const projTitle = project?.project_name || ev.project_name || 'AI60 Growth Engine';
  const titleEl = document.getElementById('eval-proj-title');
  if (titleEl) titleEl.textContent = projTitle;

  // Status badge & Label
  const statusBadge = document.getElementById('eval-status-badge');
  if (statusBadge) {
    statusBadge.textContent = 'PROJECT EVALUATED';
    statusBadge.style.background = 'var(--emerald-surface)';
    statusBadge.style.color = 'var(--emerald-primary)';
  }

  // Overall Score
  const scoreVal = typeof ev.score === 'number' ? ev.score : (typeof ev.overall_score === 'number' ? ev.overall_score : 86);
  const scoreEl = document.getElementById('eval-overall-score');
  if (scoreEl) scoreEl.textContent = `${scoreVal} / 100`;

  // Timestamp
  const timestampEl = document.getElementById('eval-timestamp-text');
  if (timestampEl) {
    const d = ev.created_at ? new Date(ev.created_at) : new Date();
    const formattedDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const formattedTime = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    timestampEl.textContent = `Evaluated with AI • ${formattedDate}, ${formattedTime}`;
  }

  // Categories & Reasons
  const cats = ev.categories || {};
  const renderCategoryTile = (scoreId, reasonId, evidenceId, catData, fallbackScore) => {
    const scoreNode = document.getElementById(scoreId);
    const reasonNode = document.getElementById(reasonId);
    const evidenceNode = document.getElementById(evidenceId);

    let rawScore = catData?.score !== undefined ? catData.score : fallbackScore;
    if (rawScore > 10) rawScore = Math.round(rawScore / 10);
    const scoreDisplay = `${rawScore} / 10`;

    if (scoreNode) scoreNode.textContent = scoreDisplay;
    if (reasonNode) reasonNode.textContent = catData?.reason || 'Evaluation assessed based on submitted details.';
    if (evidenceNode) {
      if (catData?.evidence) {
        evidenceNode.textContent = `"${catData.evidence}"`;
        evidenceNode.style.display = 'block';
      } else {
        evidenceNode.style.display = 'none';
      }
    }
  };

  renderCategoryTile('score-clarity', 'reason-clarity', 'evidence-clarity', cats.problemClarity, ev.problem_clarity || 9);
  renderCategoryTile('score-ai', 'reason-ai', 'evidence-ai', cats.aiIntegration, ev.ai_usage_score || 9);
  renderCategoryTile('score-func', 'reason-func', 'evidence-func', cats.functionality, ev.functionality || 9);
  renderCategoryTile('score-ux', 'reason-ux', 'evidence-ux', cats.uxPolish, ev.ux_score || 8);
  renderCategoryTile('score-orig', 'reason-orig', 'evidence-orig', cats.originality, ev.originality || 9);
  renderCategoryTile('score-tech', 'reason-tech', 'evidence-tech', cats.technicalImplementation, ev.technical || 9);
  renderCategoryTile('score-comp', 'reason-comp', 'evidence-comp', cats.completeness, ev.completeness || 9);

  // Evaluation Summary
  const summaryText = ev.evaluation_summary || ev.ai_reasoning || 'The project demonstrates a well-architected MVP with clear domain focus and practical AI integration.';
  const summaryEl = document.getElementById('eval-summary-text');
  if (summaryEl) summaryEl.textContent = summaryText;

  // Strengths
  const strengths = Array.isArray(ev.strengths) && ev.strengths.length 
    ? ev.strengths 
    : ['Sophisticated multi-provider AI fallback gateway', 'Evidence-backed 7-dimension automated evaluation', 'Grounded RAG architecture'];
  const strengthsCont = document.getElementById('eval-strengths-container');
  if (strengthsCont) {
    strengthsCont.innerHTML = strengths.map(s => `<div class="eval-item-bullet strength">${escapeHtml(s)}</div>`).join('');
  }

  // Recommended Enhancements
  const suggestions = Array.isArray(ev.suggestions) && ev.suggestions.length 
    ? ev.suggestions 
    : (Array.isArray(ev.recommendedEnhancements) && ev.recommendedEnhancements.length ? ev.recommendedEnhancements : ['Add webhook alerts for viral referral thresholds', 'Implement batch export for rubric summaries', 'Introduce model latency telemetry charts']);
  const suggestionsCont = document.getElementById('eval-suggestions-container');
  if (suggestionsCont) {
    suggestionsCont.innerHTML = suggestions.map(r => `<div class="eval-item-bullet enhancement">${escapeHtml(r)}</div>`).join('');
  }

  // Re-evaluate button visibility
  const reevalBtn = document.getElementById('eval-reevaluate-btn');
  if (reevalBtn) reevalBtn.style.display = 'inline-block';
}

async function submitProjectForEvaluation() {
  const title = document.getElementById('sub-title')?.value.trim();
  const desc = document.getElementById('sub-desc')?.value.trim();
  const github = document.getElementById('sub-github')?.value.trim();
  const demo = document.getElementById('sub-demo')?.value.trim();
  const stack = document.getElementById('sub-stack')?.value.trim();
  const aiUsage = document.getElementById('sub-ai-usage')?.value.trim();
  const whatLearned = document.getElementById('sub-learned')?.value.trim();
  const token = localStorage.getItem('ai60_user_token');

  if (!title || !desc) {
    showToast('Please enter project title and problem description.', 'error');
    return;
  }
  if (!github) {
    showToast('Please enter your GitHub repository URL.', 'error');
    return;
  }
  if (!token) {
    showToast('Please log in as a student to submit your project.', 'error');
    return;
  }

  const submitBtn = document.getElementById('sub-project-btn');
  const unsubmittedBox = document.getElementById('eval-unsubmitted-state');
  const loadingBox = document.getElementById('eval-loading-state');
  const errorBox = document.getElementById('eval-error-state');
  const resultContainer = document.getElementById('eval-result-container');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving & Evaluating...';
  }
  
  // STATE 2: AI EVALUATION IN PROGRESS
  if (unsubmittedBox) unsubmittedBox.style.display = 'none';
  if (errorBox) errorBox.style.display = 'none';
  if (resultContainer) resultContainer.style.display = 'none';
  if (loadingBox) loadingBox.style.display = 'block';

  loadingBox?.scrollIntoView({ behavior: 'smooth' });

  try {
    // 1. Submit Project First (Save project safely)
    const subRes = await fetch('/api/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        project_name: title,
        description: desc,
        github_url: github,
        demo_url: demo || null,
        tech_stack: stack || null,
        ai_usage: aiUsage || null,
        what_learned: whatLearned || null
      })
    });
    const subData = await subRes.json();
    if (!subRes.ok) throw new Error(subData.error || 'Project submission failed');

    const projectId = subData.project_id || subData.id;
    const projectObj = {
      id: projectId,
      project_name: title,
      description: desc,
      github_url: github,
      demo_url: demo,
      tech_stack: stack,
      ai_usage: aiUsage,
      what_learned: whatLearned,
      status: 'submitted'
    };
    STATE.currentProject = projectObj;

    // 2. Request AI Evaluation
    const evalRes = await fetch('/api/project/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ project_id: projectId, force: true })
    });

    const evalData = await evalRes.json();

    if (!evalRes.ok || !evalData.evaluation) {
      // STATE 4: EVALUATION UNAVAILABLE
      if (loadingBox) loadingBox.style.display = 'none';
      if (errorBox) {
        errorBox.style.display = 'block';
        const errMsg = document.getElementById('eval-error-msg');
        if (errMsg) errMsg.textContent = evalData.message || 'Your project was submitted successfully, but AI evaluation could not be completed.';
      }
      showToast('Project saved. AI evaluation can be retried anytime.', 'warning');
      return;
    }

    // STATE 3: Success! Render structured evaluation
    projectObj.status = 'evaluated';
    updateProjectEvaluationState(projectObj, evalData.evaluation);
    showToast(`✓ Project Evaluated! Overall Score: ${evalData.evaluation.score}/100`, 'success');
    resultContainer?.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('Project submission/eval error:', err);
    if (loadingBox) loadingBox.style.display = 'none';
    if (errorBox) {
      errorBox.style.display = 'block';
      const errMsg = document.getElementById('eval-error-msg');
      if (errMsg) errMsg.textContent = err.message || 'Your project was submitted successfully, but AI evaluation could not be completed.';
    }
    showToast(err.message || 'Failed to submit project.', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function reevaluateProject() {
  const token = localStorage.getItem('ai60_user_token');
  if (!token) {
    showToast('Please log in first.', 'error');
    return;
  }

  const unsubmittedBox = document.getElementById('eval-unsubmitted-state');
  const loadingBox = document.getElementById('eval-loading-state');
  const errorBox = document.getElementById('eval-error-state');
  const resultContainer = document.getElementById('eval-result-container');
  const reevalBtn = document.getElementById('eval-reevaluate-btn');

  if (reevalBtn) {
    reevalBtn.disabled = true;
    reevalBtn.textContent = 'Evaluating...';
  }
  
  // STATE 2: EVALUATION IN PROGRESS
  if (unsubmittedBox) unsubmittedBox.style.display = 'none';
  if (errorBox) errorBox.style.display = 'none';
  if (resultContainer) resultContainer.style.display = 'none';
  if (loadingBox) loadingBox.style.display = 'block';

  loadingBox?.scrollIntoView({ behavior: 'smooth' });

  try {
    const res = await fetch('/api/project/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ force: true })
    });
    const data = await res.json();
    if (!res.ok || !data.evaluation) {
      // STATE 4: EVALUATION UNAVAILABLE
      if (loadingBox) loadingBox.style.display = 'none';
      if (errorBox) {
        errorBox.style.display = 'block';
        const errMsg = document.getElementById('eval-error-msg');
        if (errMsg) errMsg.textContent = data.message || 'Your project was submitted successfully, but AI evaluation could not be completed.';
      }
      showToast('AI evaluation temporarily unavailable.', 'warning');
      return;
    }

    // STATE 3: Success
    const title = document.getElementById('sub-title')?.value.trim() || 'AI60 Project';
    const projectObj = STATE.currentProject || { project_name: title, status: 'evaluated' };
    updateProjectEvaluationState(projectObj, data.evaluation);
    showToast(`✓ Re-evaluated! Score: ${data.evaluation.score}/100`, 'success');
    resultContainer?.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('Re-evaluation error:', err);
    if (loadingBox) loadingBox.style.display = 'none';
    if (errorBox) errorBox.style.display = 'block';
    showToast('Re-evaluation failed. Please retry.', 'error');
  } finally {
    if (reevalBtn) {
      reevalBtn.disabled = false;
      reevalBtn.textContent = '↻ Re-evaluate';
    }
  }
}

function shareBuildOnWhatsApp() {
  const title = document.getElementById('eval-proj-title').textContent;
  const code = STATE.currentUser?.referral_code || 'AI60';
  const url = `${window.location.origin}/?ref=${code}`;
  const projectPart = title && title !== '\u2014' ? `I just built "${title}" in the AI60 workshop. ` : '';
  const text = encodeURIComponent(`${projectPart}Build your first AI project in 60 minutes too: ${url}`);
  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

function copyBuildBadgeLink() {
  const url = `${window.location.origin}/#submit`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Project submission link copied to clipboard!');
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
      const reg = aData.registrations || {};
      const targetData = aData.target || { total: 500, remaining: 500 };
      const total = reg.total || 0;
      STATE.registeredCount = total;
      
      const setEl = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
      setEl('admin-total-reg', total);
      setEl('admin-remaining-reg', targetData.remaining);
      setEl('admin-referral-reg', reg.referral || 0);
      setEl('admin-referral-clicks', reg.referral_clicks || 0);
      
      const refRate = (reg.referral_clicks > 0) ? Math.round((reg.referral / reg.referral_clicks) * 100) : 0;
      setEl('admin-conv-rate', reg.referral_clicks > 0 ? `${refRate}%` : '\\u2013');

      const f = aData.funnel || {};
      setEl('funnel-visitors', f.page_views || 0);
      setEl('funnel-quiz-start', f.quiz_started || 0);
      setEl('funnel-quiz-done', f.quiz_completed || 0);
      setEl('funnel-registered', total);
      setEl('funnel-referrals', reg.referral || 0);
      setEl('funnel-attendees', '\u2014');

      // Update 300-400 Referral Target Metrics
      const refObserved = reg.referral || 0;
      setEl('growth-target-ref-observed', refObserved);
      setEl('growth-target-rem-300', Math.max(0, 300 - refObserved));
      setEl('growth-target-rem-400', Math.max(0, 400 - refObserved));

      const ctb = document.getElementById('admin-channel-tbody');
      if (ctb) {
        const chans = aData.channels || [];
        ctb.innerHTML = chans.length
          ? chans.map(c => `<tr><td><strong>${c.channel}</strong></td><td>${c.count}</td><td>\u2014</td><td>\u2014</td><td>${total ? ((c.count / total) * 100).toFixed(1) : 0}%</td></tr>`).join('')
          : '<tr><td colspan="5" style="color:var(--text-muted);">No tracked registrations yet.</td></tr>';
      }
      
      // Initialize simulator with defaults
      runCampaignSimulation();
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
      <td><span class="card-tag">${a.status || 'Partner'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function openAddAmbassadorModal() {
  const modal = document.getElementById('modal-ambassador');
  if (modal) {
    modal.classList.add('open');
    const nameInput = document.getElementById('amb-name');
    if (nameInput) nameInput.focus();
    const errEl = document.getElementById('amb-error-msg');
    if (errEl) errEl.textContent = '';
  }
}

function closeAddAmbassadorModal() {
  const modal = document.getElementById('modal-ambassador');
  if (modal) {
    modal.classList.remove('open');
  }
}

async function handleAddAmbassadorSubmit(e) {
  e.preventDefault();
  const token = STATE.adminToken || localStorage.getItem('ai60_admin_token');
  const btn = document.getElementById('amb-submit-btn');
  const errEl = document.getElementById('amb-error-msg');
  if (errEl) errEl.textContent = '';

  const name = document.getElementById('amb-name')?.value.trim();
  const college = document.getElementById('amb-college')?.value.trim();
  const club = document.getElementById('amb-club')?.value.trim();
  const contact = document.getElementById('amb-contact')?.value.trim();

  if (!name || !college) {
    if (errEl) errEl.textContent = 'Please enter ambassador name and college.';
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Registering Partner...';
  }

  try {
    const res = await fetch('/api/admin/ambassador', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ambassador_name: name,
        college,
        club,
        contact
      })
    });

    const data = await res.json();
    if (!res.ok) {
      if (errEl) errEl.textContent = data.error || 'Failed to register ambassador';
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Generate Partner Code & Register';
      }
      return;
    }

    // Success! Reset form and close modal
    document.getElementById('ambassador-form')?.reset();
    closeAddAmbassadorModal();
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Generate Partner Code & Register';
    }

    showToast(`✓ Partner Registered! Tracking Code: ${data.ambassador_code}`, 'success');

    // Refresh ambassadors table immediately
    const ambRes = await fetch('/api/admin/ambassadors', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (ambRes.ok) {
      const ambData = await ambRes.json();
      renderAmbassadorsTable(ambData.ambassadors || []);
    }
  } catch (err) {
    console.error('Error adding ambassador:', err);
    if (errEl) errEl.textContent = 'Network error while registering ambassador.';
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Generate Partner Code & Register';
    }
  }
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
  const btn = document.getElementById('btn-copilot-analyze');
  if (btn) btn.textContent = 'Analyzing campaign data...';
  if (btn) btn.disabled = true;

  const box = document.getElementById('ai-insights-box');
  const provBox = document.getElementById('ai-provenance-box');

  const token = STATE.adminToken || localStorage.getItem('ai60_admin_token');
  try {
    const simBaseTotal = document.getElementById('sim-out-base-total')?.textContent;
    const simBaseCpa = document.getElementById('sim-out-base-cpa')?.textContent;
    const payload = {
      simulator: simBaseTotal && simBaseTotal !== '0' ? { base_projected_total: parseInt(simBaseTotal), base_projected_cpa: simBaseCpa } : null
    };

    const res = await fetch('/api/admin/growth-copilot', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    
    if (data.status === 'unavailable' || !res.ok || !data.analysis) {
      box.innerHTML = `<div style="background:var(--bg-surface); padding:1rem; border-left:3px solid var(--amber-primary); color:var(--text-white);">AI analysis is temporarily unavailable. Please try again.</div>`;
      if (provBox) provBox.style.display = 'none';
      return;
    }

    if (data.status === 'success' && data.analysis) {
      if (provBox) {
        provBox.style.display = 'block';
        document.getElementById('ai-prov-reg').textContent = data.metrics.registrations;
        const visitsEl = document.getElementById('ai-prov-visits');
        if (visitsEl) visitsEl.textContent = data.metrics.landing_visits || 0;
        document.getElementById('ai-prov-target').textContent = data.metrics.target;
        document.getElementById('ai-prov-ref-clicks').textContent = data.metrics.referral_clicks;
        document.getElementById('ai-prov-ref-conv').textContent = data.metrics.referral_conversions;
        
        if (payload.simulator) {
          document.getElementById('ai-provenance-title').textContent = 'Analysis based on live database metrics + Simulator projections (assumptions, not measured results)';
        } else {
          document.getElementById('ai-provenance-title').textContent = 'Analysis based on live database metrics';
        }
      }

      const ai = data.analysis;
      let html = `<div style="background:var(--bg-surface); padding:1rem; border-radius:var(--radius-sm); margin-bottom:1rem; border-left:3px solid var(--cyan-primary);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <h4 style="color:var(--text-white); margin:0;">Campaign Summary</h4>
          <span style="font-size:0.7rem; padding:0.15rem 0.5rem; background:rgba(6, 182, 212, 0.12); color:var(--cyan-primary); border-radius:var(--radius-full); font-weight:600;">AI Growth Copilot</span>
        </div>
        <p style="color:var(--text-secondary); font-size:0.85rem;">${ai.summary || ''}</p>
      </div>`;
      
      if (ai.priorities && ai.priorities.length > 0) {
        html += `<h4 style="margin-bottom:0.5rem;">Top Priorities</h4><div style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem;">`;
        ai.priorities.forEach(p => {
          html += `<div style="background:var(--bg-dark); border:1px solid var(--border-light); padding:0.75rem; border-radius:var(--radius-sm);">
            <div style="display:flex; justify-content:space-between;">
              <span style="font-weight:600; color:var(--text-white); font-size:0.85rem;">${p.action}</span>
              <span style="font-size:0.75rem; padding:0.15rem 0.4rem; background:var(--bg-surface); border-radius:4px;">${p.expected_impact} Impact</span>
            </div>
            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.4rem;">${p.reason}</div>
          </div>`;
        });
        html += `</div>`;
      }
      
      if (ai.channel_recommendation) {
        html += `<div style="background:var(--bg-dark); border:1px solid var(--emerald-primary); padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:1rem;">
          <h4 style="color:var(--emerald-primary); margin-bottom:0.25rem;">Channel Focus: ${ai.channel_recommendation.focus}</h4>
          <p style="color:var(--text-secondary); font-size:0.8rem;">${ai.channel_recommendation.reason}</p>
        </div>`;
      }

      if (ai.experiment) {
        html += `<div style="background:var(--bg-dark); border:1px solid var(--purple-primary); padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:1rem;">
          <h4 style="color:var(--purple-primary); margin-bottom:0.25rem;">Experiment Idea</h4>
          <p style="color:var(--text-white); font-size:0.85rem; margin-bottom:0.25rem;">${ai.experiment.idea}</p>
          <div style="display:flex; gap:1rem; font-size:0.75rem; color:var(--text-muted);">
            <span>Metric: ${ai.experiment.metric}</span>
            <span>Timeframe: ${ai.experiment.timeframe}</span>
          </div>
        </div>`;
      }
      
      if (ai.warning) {
        html += `<div style="background:var(--bg-dark); border-left:3px solid var(--amber-primary); padding:0.75rem; border-radius:var(--radius-sm); font-size:0.8rem; margin-bottom:0.5rem;">
          <strong style="color:var(--amber-primary);">Caveat:</strong> <span style="color:var(--text-secondary);">${ai.warning}</span>
        </div>`;
      }

      html += `<div style="font-size:0.72rem; color:var(--text-muted); text-align:center; margin-top:0.5rem;">AI-generated growth recommendation based on database metrics. Not human-verified; performance is not guaranteed.</div>`;

      box.innerHTML = html;
      showToast('AI analysis complete.');
    }
  } catch (e) {
    box.innerHTML = `<div style="background:var(--bg-surface); padding:1rem; border-left:3px solid var(--amber-primary); color:var(--text-white);">AI Growth Copilot is temporarily unavailable.</div>`;
    showToast('Could not fetch AI insights.', 'error');
  } finally {
    if (btn) btn.textContent = 'Analyze Campaign';
    if (btn) btn.disabled = false;
  }
}

async function exportCsv(type) {
  const token = STATE.adminToken || localStorage.getItem('ai60_admin_token');
  if (!token) {
    showToast('Admin access required for export', 'error');
    return;
  }
  
  showToast(`Preparing ${type} export...`);
  try {
    const res = await fetch(`/api/admin/export/${type}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_export.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast(`${type} exported successfully!`);
    } else {
      showToast('Export failed. Check console.', 'error');
    }
  } catch (err) {
    console.error('Export error:', err);
    showToast('Network error during export.', 'error');
  }
}

function exportRegistrationsCsv() {
  exportCsv('registrations');
}

function exportReferralsCsv() {
  exportCsv('referrals');
}

// Multichannel Messages
const MSG_TEMPLATES = {
  reminder_24h: "Your AI60 workshop starts in 24 hours! Keep your laptop ready. Know a friend who wants to build too? Share your link: {{referral_url}}",
  referral_booster: "Invite your batchmates to the free AI60 workshop. Your personal link: {{referral_url}}",
  final_1h: "The AI60 workshop starts in 1 hour! Get ready to build your first AI project in 60 minutes. Join here: {{workshop_url}}"
};

function loadMessageTemplate() {
  const sel = document.getElementById('msg-template-select').value;
  const body = document.getElementById('msg-body');
  if (MSG_TEMPLATES[sel]) body.value = MSG_TEMPLATES[sel];
}

async function sendBroadcastMessage() {
  // Saves a DRAFT only. Nothing is sent to students.
  const audience = document.getElementById('msg-audience').value;
  const body = document.getElementById('msg-body').value;
  const token = STATE.adminToken || localStorage.getItem('ai60_admin_token');

  try {
    const res = await fetch('/api/admin/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ body, audience_filter: audience, channel: 'whatsapp' })
    });
    if (!res.ok) throw new Error('save failed');
    document.getElementById('msg-status-text').textContent = 'Draft saved \u2013 not sent';
    showToast('Message draft saved. It has not been sent.');
  } catch (err) {
    document.getElementById('msg-status-text').textContent = 'Failed to save draft';
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
  document.getElementById('deck-prev-btn').style.visibility = num === 1 ? 'hidden' : 'visible';
  document.getElementById('deck-next-btn').style.visibility = num === 5 ? 'hidden' : 'visible';
}

// ============================================================================
// FAQ TOGGLE
// ============================================================================
function toggleFaq(btn) {
  const card = btn.closest('.faq-card');
  card.classList.toggle('open');
}

// ============================================================================
// CAMPAIGN STRATEGY SIMULATOR (MAX ₹2,000 BUDGET CAP)
// ============================================================================
function onSimBudgetChange(changedField) {
  const paidEl = document.getElementById('sim-budget');
  const poolEl = document.getElementById('sim-ref-pool');
  const totalText = document.getElementById('sim-total-budget-text');
  const warningEl = document.getElementById('sim-budget-warning');

  let paid = Math.max(0, parseFloat(paidEl.value) || 0);
  let pool = Math.max(0, parseFloat(poolEl.value) || 0);

  if (paid + pool > 2000) {
    if (changedField === 'paid') {
      if (paid > 2000) paid = 2000;
      pool = 2000 - paid;
    } else {
      if (pool > 2000) pool = 2000;
      paid = 2000 - pool;
    }
    paidEl.value = paid;
    poolEl.value = pool;
    if (warningEl) warningEl.style.display = 'inline-block';
  } else {
    if (warningEl) warningEl.style.display = 'none';
  }

  const total = paid + pool;
  if (totalText) totalText.textContent = `₹${total.toLocaleString('en-IN')}`;

  runCampaignSimulation();
}

function runCampaignSimulation() {
  const strategyEl = document.getElementById('sim-strategy');
  const strategy = strategyEl ? strategyEl.value : 'hybrid';

  const paidEl = document.getElementById('sim-budget');
  const poolEl = document.getElementById('sim-ref-pool');
  const warningEl = document.getElementById('sim-budget-warning');

  let paidBudget = Math.max(0, parseFloat(paidEl.value) || 0);
  let poolBudget = Math.max(0, parseFloat(poolEl.value) || 0);

  // Sync inputs if strategy changed
  if (strategy === 'paid') {
    paidBudget = 2000;
    poolBudget = 0;
    if (paidEl) paidEl.value = 2000;
    if (poolEl) poolEl.value = 0;
  } else if (strategy === 'referral') {
    paidBudget = 0;
    poolBudget = 2000;
    if (paidEl) paidEl.value = 0;
    if (poolEl) poolEl.value = 2000;
  }

  if (paidBudget + poolBudget > 2000) {
    paidBudget = Math.min(2000, paidBudget);
    poolBudget = 2000 - paidBudget;
    if (paidEl) paidEl.value = paidBudget;
    if (poolEl) poolEl.value = poolBudget;
    if (warningEl) warningEl.style.display = 'inline-block';
  } else {
    if (warningEl) warningEl.style.display = 'none';
  }

  const totalBudget = paidBudget + poolBudget;
  const totalText = document.getElementById('sim-total-budget-text');
  if (totalText) totalText.textContent = `₹${totalBudget.toLocaleString('en-IN')}`;

  const cpc = Math.max(1, parseFloat(document.getElementById('sim-cpc').value) || 5);
  const convRate = (parseFloat(document.getElementById('sim-conv').value) || 15) / 100;
  const baseRefRate = parseFloat(document.getElementById('sim-ref-rate').value) || 0.5;
  const organic = parseFloat(document.getElementById('sim-organic').value) || 30;

  // Additional organic boost from community activation pool (up to +0.8 additional referrals per registrant if full 2k pool allocated)
  const incentiveBoost = (poolBudget / 2000) * 0.8;
  const effectiveRefRate = baseRefRate + incentiveBoost;

  const stratLabel = document.getElementById('sim-active-strategy-label');
  if (stratLabel) {
    if (strategy === 'paid') stratLabel.textContent = 'Strategy 1: 100% Paid Acquisition';
    else if (strategy === 'referral') stratLabel.textContent = 'Strategy 2: 100% Organic & Campus Community';
    else stratLabel.textContent = 'Strategy 3: Hybrid Paid + Community';
  }

  const scenarios = [
    { id: 'cons', modifier: 0.8 },
    { id: 'base', modifier: 1.0 },
    { id: 'opt', modifier: 1.2 }
  ];

  scenarios.forEach(s => {
    const paidClicks = Math.floor((paidBudget / cpc) * s.modifier);
    const paidReg = Math.floor(paidClicks * (convRate * s.modifier));
    const orgReg = Math.floor(organic * s.modifier);
    const directReg = paidReg + orgReg;
    
    // Total referral registrations = directReg * effectiveRefRate * s.modifier
    const refReg = Math.floor(directReg * effectiveRefRate * s.modifier);
    const totalReg = directReg + refReg;
    const cpa = totalReg > 0 ? (totalBudget / totalReg).toFixed(2) : 0;

    const els = {
      total: document.getElementById(`sim-out-${s.id}-total`),
      paid: document.getElementById(`sim-out-${s.id}-paid`),
      ref: document.getElementById(`sim-out-${s.id}-ref`),
      cpa: document.getElementById(`sim-out-${s.id}-cpa`)
    };
    if (els.total) els.total.textContent = totalReg;
    if (els.paid) els.paid.textContent = directReg;
    if (els.ref) els.ref.textContent = refReg;
    if (els.cpa) els.cpa.textContent = `₹${cpa}`;
    
    if (s.id === 'base') {
      const gap = Math.max(0, 500 - totalReg);
      const gapEl = document.getElementById('sim-out-gap');
      if (gapEl) gapEl.textContent = gap;
    }
  });

  // Populate Comparison Matrix Table (Base Scenario for all 3 strategies)
  renderStrategyComparisonTable(cpc, convRate, baseRefRate, organic);
}

function renderStrategyComparisonTable(cpc, convRate, baseRefRate, organic) {
  const tbody = document.getElementById('sim-strategy-comparison-tbody');
  if (!tbody) return;

  const strategies = [
    { name: 'Strategy 1: 100% Paid Acquisition', paid: 2000, pool: 0, boost: 0 },
    { name: 'Strategy 2: 100% Milestone Incentive Pool', paid: 0, pool: 2000, boost: 0.8 },
    { name: 'Strategy 3: Hybrid (₹1,000 Paid + ₹1,000 Milestone Pool)', paid: 1000, pool: 1000, boost: 0.4 }
  ];

  tbody.innerHTML = '';

  strategies.forEach(st => {
    const paidClicks = Math.floor(st.paid / cpc);
    const paidReg = Math.floor(paidClicks * convRate);
    const directReg = paidReg + organic;
    const effRate = baseRefRate + st.boost;
    const refReg = Math.floor(directReg * effRate);
    const totalReg = directReg + refReg;
    const totalBudget = st.paid + st.pool;
    const costPerReg = totalReg > 0 ? (totalBudget / totalReg).toFixed(2) : '0.00';
    const gap = Math.max(0, 500 - totalReg);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${st.name}</strong></td>
      <td>₹${st.paid.toLocaleString('en-IN')} Ads + ₹${st.pool.toLocaleString('en-IN')} Pool (₹${totalBudget})</td>
      <td>${directReg} <span style="font-size:0.75rem; color:var(--text-muted);">(${paidReg} paid + ${organic} org)</span></td>
      <td><strong style="color:var(--emerald-primary);">${refReg}</strong></td>
      <td><strong style="font-size:1.05rem; color:var(--text-white);">${totalReg}</strong></td>
      <td style="color:var(--cyan-primary);">₹${costPerReg}</td>
      <td style="color:${gap === 0 ? 'var(--emerald-primary)' : 'var(--amber-primary)'}; font-weight:600;">${gap}</td>
    `;
    tbody.appendChild(tr);
  });
}

