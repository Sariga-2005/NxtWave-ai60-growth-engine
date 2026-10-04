// ============================================================================
// AI60 Growth Engine — Main Server
// Express backend serving API + static frontend
// ============================================================================
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getDb, saveDb, run, get, all } = require('./database');
const { aiGateway } = require('./ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Simple session/token management
const sessions = new Map();

function generateId() {
  return crypto.randomUUID();
}

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = sessions.get(token);
  next();
}

function adminMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = sessions.get(token);
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  req.user = user;
  next();
}

// ============================================================================
// AUTH ROUTES
// ============================================================================

// Student Registration
app.post('/api/register', async (req, res) => {
  try {
    const { full_name, email, phone, college, branch, graduation_year, 
            ai_experience, coding_experience, project_interest,
            referral_code: referrerCode, utm_source, utm_medium, 
            utm_campaign, utm_content, utm_term, ambassador_code,
            quiz_score, quiz_data } = req.body;

    // Validation
    if (!full_name || !email || !phone || !college || !branch || !graduation_year) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // Indian phone validation (10 digits, optionally with +91)
    const cleanPhone = phone.replace(/[\s\-\+]/g, '').replace(/^91/, '');
    if (!/^\d{10}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit Indian phone number' });
    }

    // Graduation year validation
    const year = parseInt(graduation_year);
    if (year < 2024 || year > 2030) {
      return res.status(400).json({ error: 'Please enter a valid graduation year (2024-2030)' });
    }

    // Duplicate check
    const existingEmail = get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existingEmail) {
      return res.status(409).json({ error: 'This email is already registered for the workshop' });
    }

    const existingPhone = get('SELECT id FROM users WHERE phone = ?', [cleanPhone]);
    if (existingPhone) {
      return res.status(409).json({ error: 'This phone number is already registered for the workshop' });
    }

    // Generate unique referral code
    let myReferralCode;
    do {
      myReferralCode = generateReferralCode();
    } while (get('SELECT id FROM users WHERE referral_code = ?', [myReferralCode]));

    const userId = generateId();
    const passwordHash = await bcrypt.hash(cleanPhone, 10);
    
    // Determine referrer
    let referredBy = null;
    let utmSourceFinal = utm_source || 'direct';
    
    if (referrerCode) {
      const referrer = get('SELECT id, email FROM users WHERE referral_code = ?', [referrerCode]);
      if (referrer && referrer.id !== userId) {
        referredBy = referrer.id;
        utmSourceFinal = utm_source || 'referral';
        
        // Create referral record
        run(`INSERT INTO referrals (id, referrer_id, referred_id, referred_email, status, source, created_at) 
             VALUES (?, ?, ?, ?, 'registered', ?, datetime('now'))`,
          [generateId(), referrer.id, userId, email.toLowerCase(), 'referral']);
      }
    }

    // Handle ambassador tracking
    if (ambassador_code) {
      const ambassador = get('SELECT id FROM ambassadors WHERE ambassador_code = ?', [ambassador_code]);
      if (ambassador) {
        run('UPDATE ambassadors SET registrations = registrations + 1 WHERE ambassador_code = ?', [ambassador_code]);
        utmSourceFinal = utm_source || 'ambassador';
      }
    }

    // Calculate intent level
    let intentLevel = 'medium';
    if (quiz_score && quiz_score > 80) intentLevel = 'high';
    else if (quiz_score && quiz_score < 40) intentLevel = 'low';
    if (referrerCode) intentLevel = 'high'; // Referred users tend to have higher intent

    // Create user
    run(`INSERT INTO users (id, email, phone, password_hash, full_name, role, college, branch, 
         graduation_year, ai_experience, coding_experience, project_interest, referral_code, 
         referred_by, utm_source, utm_medium, utm_campaign, utm_content, utm_term, 
         ambassador_code, quiz_score, quiz_data, intent_level, display_name, created_at) 
         VALUES (?, ?, ?, ?, ?, 'student', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [userId, email.toLowerCase(), cleanPhone, passwordHash, full_name, college, branch, 
       year, ai_experience || null, coding_experience || null, project_interest || null,
       myReferralCode, referredBy, utmSourceFinal, utm_medium || null, 
       utm_campaign || null, utm_content || null, utm_term || null,
       ambassador_code || null, quiz_score || null, quiz_data ? JSON.stringify(quiz_data) : null,
       intentLevel, full_name]);

    // Track registration event
    run(`INSERT INTO analytics_events (id, event_name, user_id, source, campaign, metadata, created_at) 
         VALUES (?, 'registration_completed', ?, ?, ?, ?, datetime('now'))`,
      [generateId(), userId, utmSourceFinal, utm_campaign || null,
       JSON.stringify({ college, branch, graduation_year: year, referrer: referrerCode || null })]);

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { id: userId, email: email.toLowerCase(), role: 'student', full_name });

    saveDb();

    res.status(201).json({
      success: true,
      user: {
        id: userId,
        full_name,
        email: email.toLowerCase(),
        college,
        referral_code: myReferralCode,
        referral_url: `${req.protocol}://${req.get('host')}/register?ref=${myReferralCode}`
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Something went wrong while saving your registration. Please try again.' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { id: user.id, email: user.email, role: user.role, full_name: user.full_name });

    res.json({
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        referral_code: user.referral_code,
        college: user.college
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = get('SELECT * FROM users WHERE email = ? AND role = ?', [email.toLowerCase(), 'admin']);
    if (!user) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { id: user.id, email: user.email, role: 'admin', full_name: user.full_name });

    run(`INSERT INTO audit_log (id, actor_id, action, details, created_at) 
         VALUES (?, ?, 'admin_login', ?, datetime('now'))`,
      [generateId(), user.id, JSON.stringify({ ip: req.ip })]);
    saveDb();

    res.json({ success: true, user: { id: user.id, full_name: user.full_name, role: 'admin' }, token });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) sessions.delete(token);
  res.json({ success: true });
});

// Get current user
app.get('/api/me', authMiddleware, (req, res) => {
  const user = get('SELECT id, full_name, email, phone, college, branch, graduation_year, referral_code, role, workshop_progress, workshop_status, display_name, intent_level, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  // Get referral stats
  const referralCount = get('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ? AND status = ?', [req.user.id, 'registered']);
  user.referral_count = referralCount?.count || 0;
  
  res.json(user);
});

// ============================================================================
// STUDENT DASHBOARD
// ============================================================================

app.get('/api/student/dashboard', authMiddleware, (req, res) => {
  try {
    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const referralStats = get(`
      SELECT 
        COUNT(*) as total_referrals,
        SUM(CASE WHEN status = 'registered' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM referrals WHERE referrer_id = ?
    `, [req.user.id]);

    const recentReferrals = all(`
      SELECT r.created_at, u.full_name, u.college 
      FROM referrals r 
      LEFT JOIN users u ON r.referred_id = u.id 
      WHERE r.referrer_id = ? 
      ORDER BY r.created_at DESC LIMIT 5
    `, [req.user.id]);

    const savedIdeas = all('SELECT * FROM saved_ideas WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    const project = get('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [req.user.id]);
    let evaluation = null;
    if (project) {
      evaluation = get('SELECT * FROM evaluations WHERE project_id = ?', [project.id]);
    }

    res.json({
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        college: user.college,
        branch: user.branch,
        referral_code: user.referral_code,
        workshop_progress: user.workshop_progress,
        workshop_status: user.workshop_status,
        display_name: user.display_name || user.full_name,
        created_at: user.created_at
      },
      referrals: {
        total: referralStats?.total_referrals || 0,
        successful: referralStats?.successful || 0,
        pending: referralStats?.pending || 0,
        conversion_rate: referralStats?.total_referrals > 0 
          ? Math.round((referralStats.successful / referralStats.total_referrals) * 100 * 10) / 10 
          : 0,
        recent: recentReferrals
      },
      savedIdeas: savedIdeas.map(i => ({ ...i, idea_data: JSON.parse(i.idea_data || '{}') })),
      project,
      evaluation
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// ============================================================================
// REFERRAL ROUTES
// ============================================================================

app.get('/api/referral/stats', authMiddleware, (req, res) => {
  try {
    const stats = get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'registered' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM referrals WHERE referrer_id = ?
    `, [req.user.id]);

    const referrals = all(`
      SELECT r.id, r.status, r.created_at, u.full_name, u.college
      FROM referrals r
      LEFT JOIN users u ON r.referred_id = u.id
      WHERE r.referrer_id = ?
      ORDER BY r.created_at DESC
    `, [req.user.id]);

    res.json({
      total: stats?.total || 0,
      successful: stats?.successful || 0,
      pending: stats?.pending || 0,
      conversion_rate: stats?.total > 0 ? Math.round((stats.successful / stats.total) * 100 * 10) / 10 : 0,
      referrals
    });
  } catch (error) {
    console.error('Referral stats error:', error);
    res.status(500).json({ error: 'Failed to load referral data' });
  }
});

// Track referral link click
app.post('/api/referral/track', (req, res) => {
  try {
    const { referral_code } = req.body;
    if (!referral_code) return res.status(400).json({ error: 'Referral code required' });
    
    run(`INSERT INTO analytics_events (id, event_name, source, metadata, created_at) 
         VALUES (?, 'referral_link_clicked', 'referral', ?, datetime('now'))`,
      [generateId(), JSON.stringify({ referral_code })]);
    saveDb();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to track referral' });
  }
});

// ============================================================================
// LEADERBOARD
// ============================================================================

app.get('/api/leaderboard', (req, res) => {
  try {
    const { type = 'global', college } = req.query;
    
    let query = `
      SELECT u.id, u.display_name, u.full_name, u.college,
        COUNT(r.id) as referral_count,
        SUM(CASE WHEN r.status = 'registered' THEN 1 ELSE 0 END) as successful_referrals
      FROM users u
      LEFT JOIN referrals r ON u.id = r.referrer_id
      WHERE u.role = 'student'
    `;
    const params = [];

    if (type === 'college' && college) {
      query += ` AND u.college = ?`;
      params.push(college);
    }

    query += ` GROUP BY u.id HAVING successful_referrals > 0 ORDER BY successful_referrals DESC, u.created_at ASC LIMIT 50`;

    const leaderboard = all(query, params);

    res.json({
      leaderboard: leaderboard.map((entry, i) => ({
        rank: i + 1,
        display_name: entry.display_name || entry.full_name,
        college: entry.college,
        successful_referrals: entry.successful_referrals,
        total_referrals: entry.referral_count
      }))
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// ============================================================================
// AI ASSISTANT (Demo Mode)
// ============================================================================

const WORKSHOP_KB = {
  name: "Build Your First AI Project in 60 Minutes",
  duration: "60 minutes",
  cost: "FREE",
  format: "Live online workshop",
  target: "Final-year engineering students",
  requirements: "Laptop with internet. Basic coding knowledge helpful but not required.",
  python_needed: "Basic Python knowledge is helpful but we'll guide you through every step.",
  what_you_build: "A working AI project — from idea to demo — in 60 minutes.",
  beginner_friendly: "Yes! This workshop is designed specifically for beginners.",
  placements: "Building an AI project demonstrates practical skills that recruiters value. Many students add their workshop project to their resume.",
  after_registration: "You'll receive a confirmation with your personal referral link. Share it with friends to earn rewards. On workshop day, join the live session link.",
  schedule: [
    "0-10 min: Understand the problem",
    "10-20 min: Plan the AI solution", 
    "20-40 min: Build the project",
    "40-50 min: Connect and test",
    "50-60 min: Demo and improve"
  ]
};

function getAIResponse(question) {
  const q = question.toLowerCase();
  
  if (q.includes('python') || q.includes('programming') || q.includes('coding') || q.includes('language')) {
    return `${WORKSHOP_KB.python_needed} The workshop is designed to be beginner-friendly, and we'll provide step-by-step guidance throughout.`;
  }
  if (q.includes('beginner') || q.includes('no experience') || q.includes('suitable') || q.includes('first time')) {
    return `Absolutely! ${WORKSHOP_KB.beginner_friendly} You don't need any prior AI experience. We'll start from scratch and guide you through building a real AI project step by step.`;
  }
  if (q.includes('build') || q.includes('make') || q.includes('create') || q.includes('what will')) {
    return `You'll build ${WORKSHOP_KB.what_you_build} The specific project will depend on your interests, but examples include AI Resume Feedback Assistant, Smart Study Planner, and more.`;
  }
  if (q.includes('placement') || q.includes('resume') || q.includes('job') || q.includes('career') || q.includes('recruiter')) {
    return WORKSHOP_KB.placements;
  }
  if (q.includes('long') || q.includes('duration') || q.includes('time') || q.includes('how much time')) {
    return `The workshop is ${WORKSHOP_KB.duration}. It's a focused, intensive session designed to get you from idea to working project in a single sitting.`;
  }
  if (q.includes('cost') || q.includes('fee') || q.includes('price') || q.includes('free') || q.includes('pay')) {
    return `The workshop is completely ${WORKSHOP_KB.cost}! No hidden charges. Just register and show up with your laptop.`;
  }
  if (q.includes('need') || q.includes('bring') || q.includes('requirement') || q.includes('laptop') || q.includes('prepare')) {
    return `${WORKSHOP_KB.requirements} That's all you need! We'll provide all the learning materials and code templates.`;
  }
  if (q.includes('after') || q.includes('register') || q.includes('next') || q.includes('then what')) {
    return WORKSHOP_KB.after_registration;
  }
  if (q.includes('schedule') || q.includes('agenda') || q.includes('timeline') || q.includes('plan')) {
    return `Here's the 60-minute plan:\n${WORKSHOP_KB.schedule.join('\n')}`;
  }
  if (q.includes('referral') || q.includes('invite') || q.includes('friend') || q.includes('share')) {
    return `After registering, you'll get a personal referral link. Share it with friends — when they register using your link, you both benefit! It's a great way to learn together and unlock bonus resources.`;
  }
  
  return `That's a great question! The "${WORKSHOP_KB.name}" is a ${WORKSHOP_KB.duration} ${WORKSHOP_KB.cost} live online session designed for ${WORKSHOP_KB.target}. You'll go from idea to a working AI project in one focused session. Is there something specific about the workshop you'd like to know?`;
}

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Please enter a message' });
    }

    const prompt = `You are the AI60 Workshop Assistant. Answer this question briefly, keeping in mind the workshop helps beginners build an AI project in 60 minutes. Workshop details: ${JSON.stringify(WORKSHOP_KB)}\n\nQuestion: ${message}`;
    const result = await aiGateway.executeTask('workshop_chat', prompt);

    // Track event
    run(`INSERT INTO analytics_events (id, event_name, metadata, created_at) 
         VALUES (?, 'ai_chat', ?, datetime('now'))`,
      [generateId(), JSON.stringify({ question: message.substring(0, 200) })]);
    saveDb();

    res.json({
      response: result.text,
      demo_mode: result.provider === 'DEMO',
      disclaimer: result.provider === 'DEMO' ? "AI responses are generated from approved workshop knowledge base." : undefined
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'The AI assistant encountered an error. Please try again.' });
  }
});

// ============================================================================
// AI PROJECT IDEA GENERATOR
// ============================================================================

app.post('/api/ai/project-idea', async (req, res) => {
  try {
    const { branch, interest, skill_level, domain } = req.body;
    
    const prompt = `Generate a 60-minute AI project idea for an engineering student.
Branch: ${branch}, Interest: ${interest}, Skill: ${skill_level}, Domain: ${domain}.
The project must be feasible to build as a basic MVP within a 60-minute workshop timeframe.`;
    
    const schema = {
      title: "string",
      problem: "string",
      why_it_matters: "string",
      mvp: "string",
      tech_stack: ["string"],
      ai_component: "string",
      build_steps: ["string"],
      expected_output: "string",
      extensions: ["string"]
    };

    const result = await aiGateway.executeTask('project_ideas', prompt, { schema });

    // Track event
    run(`INSERT INTO analytics_events (id, event_name, metadata, created_at) 
         VALUES (?, 'project_idea_generated', ?, datetime('now'))`,
      [generateId(), JSON.stringify({ branch, interest, skill_level, domain, idea_title: result.data?.title })]);
    saveDb();

    res.json({
      idea: result.data,
      demo_mode: result.provider === 'DEMO',
      disclaimer: result.provider === 'DEMO' ? "Project idea generated from curated workshop examples." : undefined
    });
  } catch (error) {
    console.error('Project idea error:', error);
    res.status(500).json({ error: 'Failed to generate project idea. Please try again.' });
  }
});

// Save idea
app.post('/api/ai/save-idea', authMiddleware, (req, res) => {
  try {
    const { idea } = req.body;
    if (!idea) return res.status(400).json({ error: 'Idea data required' });

    run(`INSERT INTO saved_ideas (id, user_id, idea_data, created_at) VALUES (?, ?, ?, datetime('now'))`,
      [generateId(), req.user.id, JSON.stringify(idea)]);
    
    run(`INSERT INTO analytics_events (id, event_name, user_id, metadata, created_at) 
         VALUES (?, 'project_idea_saved', ?, ?, datetime('now'))`,
      [generateId(), req.user.id, JSON.stringify({ title: idea.title })]);
    saveDb();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save idea' });
  }
});

// ============================================================================
// QUIZ
// ============================================================================

app.post('/api/quiz/submit', (req, res) => {
  try {
    const { answers, session_id } = req.body;
    if (!answers) return res.status(400).json({ error: 'Answers required' });

    // Calculate fit score
    let score = 70; // Base score
    const a = answers;
    
    if (a.ai_experience === 'none' || a.ai_experience === 'basic') score += 10; // Workshop is for beginners
    if (a.branch && ['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil'].includes(a.branch)) score += 5;
    if (a.goal === 'learn_ai' || a.goal === 'resume' || a.goal === 'project') score += 10;
    if (a.has_built_project === 'no') score += 5; // Great fit for first-timers
    if (a.coding_comfort === 'comfortable' || a.coding_comfort === 'basic') score += 5;

    score = Math.min(score, 98); // Cap at 98

    let fitMessage = '';
    if (score >= 90) fitMessage = "You're an excellent fit! This workshop is designed exactly for students like you who want practical AI experience.";
    else if (score >= 75) fitMessage = "You're a great fit! The workshop will help you build your first real AI project with step-by-step guidance.";
    else fitMessage = "This workshop can work for you! It's beginner-friendly and designed to get you building, regardless of your starting point.";

    const quizId = generateId();
    run(`INSERT INTO quiz_attempts (id, session_id, answers, score, fit_message, created_at) 
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [quizId, session_id || null, JSON.stringify(answers), score, fitMessage]);

    run(`INSERT INTO analytics_events (id, event_name, session_id, metadata, created_at) 
         VALUES (?, 'quiz_completed', ?, ?, datetime('now'))`,
      [generateId(), session_id || null, JSON.stringify({ score })]);
    saveDb();

    res.json({ score, fit_message: fitMessage, quiz_id: quizId });
  } catch (error) {
    console.error('Quiz error:', error);
    res.status(500).json({ error: 'Failed to process quiz' });
  }
});

// ============================================================================
// PROJECT SUBMISSION
// ============================================================================

app.post('/api/project', authMiddleware, (req, res) => {
  try {
    const { project_name, description, github_url, demo_url, tech_stack, ai_usage, what_learned } = req.body;
    
    if (!project_name || !description) {
      return res.status(400).json({ error: 'Project name and description are required' });
    }

    // Validate URLs if provided
    if (github_url && !github_url.match(/^https?:\/\//)) {
      return res.status(400).json({ error: 'Please enter a valid GitHub URL' });
    }
    if (demo_url && !demo_url.match(/^https?:\/\//)) {
      return res.status(400).json({ error: 'Please enter a valid demo URL' });
    }

    const projectId = generateId();
    run(`INSERT INTO projects (id, user_id, project_name, description, github_url, demo_url, tech_stack, ai_usage, what_learned, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', datetime('now'), datetime('now'))`,
      [projectId, req.user.id, project_name, description, github_url || null, demo_url || null, 
       tech_stack || null, ai_usage || null, what_learned || null]);

    run(`INSERT INTO analytics_events (id, event_name, user_id, metadata, created_at) 
         VALUES (?, 'project_submitted', ?, ?, datetime('now'))`,
      [generateId(), req.user.id, JSON.stringify({ project_name })]);
    saveDb();

    res.status(201).json({ success: true, project_id: projectId });
  } catch (error) {
    console.error('Project submission error:', error);
    res.status(500).json({ error: 'Failed to submit project. Please try again.' });
  }
});

// AI Project Evaluation
app.post('/api/project/evaluate', authMiddleware, async (req, res) => {
  try {
    const { project_id } = req.body;
    const project = get('SELECT * FROM projects WHERE id = ? AND user_id = ?', [project_id, req.user.id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Check if already evaluated
    const existing = get('SELECT * FROM evaluations WHERE project_id = ?', [project_id]);
    if (existing) {
      existing.strengths = JSON.parse(existing.strengths || '[]');
      existing.weaknesses = JSON.parse(existing.weaknesses || '[]');
      existing.suggestions = JSON.parse(existing.suggestions || '[]');
      existing.next_steps = JSON.parse(existing.next_steps || '[]');
      return res.json({ evaluation: existing, demo_mode: false });
    }

    const prompt = `Evaluate this student AI project. Name: ${project.project_name}, Description: ${project.description}, Tech: ${project.tech_stack}, AI: ${project.ai_usage}.`;
    const schema = {
      problem_clarity: "number (0-100)",
      ai_usage_score: "number (0-100)",
      functionality: "number (0-100)",
      ux_score: "number (0-100)",
      originality: "number (0-100)",
      technical: "number (0-100)",
      completeness: "number (0-100)",
      overall_score: "number (0-100)",
      strengths: ["string"],
      weaknesses: ["string"],
      suggestions: ["string"],
      next_steps: ["string"]
    };

    const result = await aiGateway.executeTask('project_evaluation', prompt, { schema });
    const scores = result.data || {};
    const totalScore = scores.overall_score || 85;

    const evalId = generateId();
    run(`INSERT INTO evaluations (id, project_id, score, problem_clarity, ai_usage_score, functionality, ux_score, originality, technical, completeness, strengths, weaknesses, suggestions, next_steps, ai_reasoning, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [evalId, project_id, totalScore, scores.problem_clarity, scores.ai_usage_score,
       scores.functionality, scores.ux_score, scores.originality, scores.technical, scores.completeness,
       JSON.stringify(scores.strengths || []), JSON.stringify(scores.weaknesses || []),
       JSON.stringify(scores.suggestions || []), JSON.stringify(scores.next_steps || []),
       "AI evaluation based on project details."]);

    run('UPDATE projects SET status = ? WHERE id = ?', ['evaluated', project_id]);
    saveDb();
    
    const evaluation = get('SELECT * FROM evaluations WHERE id = ?', [evalId]);
    evaluation.strengths = JSON.parse(evaluation.strengths || '[]');
    evaluation.weaknesses = JSON.parse(evaluation.weaknesses || '[]');
    evaluation.suggestions = JSON.parse(evaluation.suggestions || '[]');
    evaluation.next_steps = JSON.parse(evaluation.next_steps || '[]');

    res.json({
      evaluation,
      demo_mode: result.provider === 'DEMO',
      disclaimer: result.provider === 'DEMO' ? "This is an AI-assisted evaluation." : undefined
    });
  } catch (error) {
    console.error('Evaluation error:', error);
    res.status(500).json({ error: 'Failed to evaluate project' });
  }
});

// ============================================================================
// WORKSHOP PROGRESS
// ============================================================================

app.post('/api/workshop/progress', authMiddleware, (req, res) => {
  try {
    const { progress, status } = req.body;
    run('UPDATE users SET workshop_progress = ?, workshop_status = ?, updated_at = datetime(?) WHERE id = ?',
      [progress || 0, status || 'not_started', 'now', req.user.id]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// ============================================================================
// ANALYTICS EVENTS
// ============================================================================

app.post('/api/analytics/event', (req, res) => {
  try {
    const { event_name, user_id, session_id, source, campaign, metadata } = req.body;
    if (!event_name) return res.status(400).json({ error: 'Event name required' });

    run(`INSERT INTO analytics_events (id, event_name, user_id, session_id, source, campaign, metadata, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [generateId(), event_name, user_id || null, session_id || null, source || null, 
       campaign || null, metadata ? JSON.stringify(metadata) : null]);
    saveDb();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// ============================================================================
// ADMIN: ANALYTICS & DASHBOARD
// ============================================================================

app.get('/api/admin/analytics', adminMiddleware, (req, res) => {
  try {
    const totalRegistrations = get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['student']);
    const todayRegistrations = get(`SELECT COUNT(*) as count FROM users WHERE role = 'student' AND date(created_at) = date('now')`);
    const yesterdayRegistrations = get(`SELECT COUNT(*) as count FROM users WHERE role = 'student' AND date(created_at) = date('now', '-1 day')`);
    const weekRegistrations = get(`SELECT COUNT(*) as count FROM users WHERE role = 'student' AND created_at >= datetime('now', '-7 days')`);
    
    const referralRegistrations = get(`SELECT COUNT(*) as count FROM users WHERE role = 'student' AND referred_by IS NOT NULL`);
    const organicRegistrations = get(`SELECT COUNT(*) as count FROM users WHERE role = 'student' AND referred_by IS NULL`);
    
    // Channel distribution
    const channelDist = all(`
      SELECT COALESCE(utm_source, 'direct') as channel, COUNT(*) as count 
      FROM users WHERE role = 'student' 
      GROUP BY utm_source ORDER BY count DESC
    `);

    // College performance
    const collegePerf = all(`
      SELECT college, COUNT(*) as count 
      FROM users WHERE role = 'student' AND college IS NOT NULL 
      GROUP BY college ORDER BY count DESC LIMIT 10
    `);

    // Daily registration trend (last 7 days)
    const dailyTrend = all(`
      SELECT date(created_at) as date, COUNT(*) as count 
      FROM users WHERE role = 'student' AND created_at >= datetime('now', '-7 days')
      GROUP BY date(created_at) ORDER BY date ASC
    `);

    // Branch distribution
    const branchDist = all(`
      SELECT branch, COUNT(*) as count 
      FROM users WHERE role = 'student' AND branch IS NOT NULL 
      GROUP BY branch ORDER BY count DESC
    `);

    // Referral contribution
    const topReferrers = all(`
      SELECT u.display_name, u.full_name, u.college, COUNT(r.id) as referral_count
      FROM users u
      JOIN referrals r ON u.id = r.referrer_id AND r.status = 'registered'
      WHERE u.role = 'student'
      GROUP BY u.id ORDER BY referral_count DESC LIMIT 5
    `);

    // Funnel data
    const pageViews = get(`SELECT COUNT(*) as count FROM analytics_events WHERE event_name = 'page_view'`);
    const quizStarted = get(`SELECT COUNT(*) as count FROM analytics_events WHERE event_name = 'quiz_started'`);
    const quizCompleted = get(`SELECT COUNT(*) as count FROM analytics_events WHERE event_name = 'quiz_completed'`);
    const regStarted = get(`SELECT COUNT(*) as count FROM analytics_events WHERE event_name = 'registration_started'`);
    const regCompleted = get(`SELECT COUNT(*) as count FROM analytics_events WHERE event_name = 'registration_completed'`);
    const referralActivated = get(`SELECT COUNT(DISTINCT referrer_id) as count FROM referrals`);
    const projectSubmitted = get(`SELECT COUNT(*) as count FROM analytics_events WHERE event_name = 'project_submitted'`);

    // Intent distribution
    const intentDist = all(`
      SELECT intent_level, COUNT(*) as count 
      FROM users WHERE role = 'student' 
      GROUP BY intent_level
    `);

    // Target tracking
    const target = 500;
    const current = totalRegistrations?.count || 0;
    const remaining = Math.max(0, target - current);
    const progress = Math.min(100, Math.round((current / target) * 100 * 10) / 10);

    // Conversion rate
    const totalVisitors = pageViews?.count || current * 3; // Estimate if no page view data
    const conversionRate = totalVisitors > 0 ? Math.round((current / totalVisitors) * 100 * 10) / 10 : 0;

    res.json({
      target: { total: target, current, remaining, progress },
      registrations: {
        total: current,
        today: todayRegistrations?.count || 0,
        yesterday: yesterdayRegistrations?.count || 0,
        week: weekRegistrations?.count || 0,
        referral: referralRegistrations?.count || 0,
        organic: organicRegistrations?.count || 0,
        conversion_rate: conversionRate
      },
      channels: channelDist,
      colleges: collegePerf,
      dailyTrend,
      branchDistribution: branchDist,
      topReferrers: topReferrers.map(r => ({ name: r.display_name || r.full_name, college: r.college, count: r.referral_count })),
      funnel: {
        page_views: pageViews?.count || 0,
        quiz_started: quizStarted?.count || 0,
        quiz_completed: quizCompleted?.count || 0,
        registration_started: regStarted?.count || 0,
        registration_completed: regCompleted?.count || 0,
        referral_activated: referralActivated?.count || 0,
        project_submitted: projectSubmitted?.count || 0
      },
      intentDistribution: intentDist,
      demo_data: true
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// Admin: All registrations
app.get('/api/admin/registrations', adminMiddleware, (req, res) => {
  try {
    const { search, college, branch, source, intent, sort = 'created_at', order = 'DESC', page = 1, limit = 50 } = req.query;
    let query = `SELECT id, full_name, email, phone, college, branch, graduation_year, utm_source, intent_level, referral_code, workshop_progress, created_at FROM users WHERE role = 'student'`;
    const params = [];

    if (search) {
      query += ` AND (full_name LIKE ? OR email LIKE ? OR college LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (college) { query += ` AND college = ?`; params.push(college); }
    if (branch) { query += ` AND branch = ?`; params.push(branch); }
    if (source) { query += ` AND utm_source = ?`; params.push(source); }
    if (intent) { query += ` AND intent_level = ?`; params.push(intent); }

    const countQuery = query.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as count FROM');
    const total = get(countQuery, params);

    query += ` ORDER BY ${sort === 'created_at' ? 'created_at' : 'full_name'} ${order === 'ASC' ? 'ASC' : 'DESC'}`;
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const registrations = all(query, params);

    res.json({
      registrations,
      total: total?.count || 0,
      page: parseInt(page),
      totalPages: Math.ceil((total?.count || 0) / parseInt(limit))
    });
  } catch (error) {
    console.error('Registrations error:', error);
    res.status(500).json({ error: 'Failed to load registrations' });
  }
});

// Admin: Referrals overview
app.get('/api/admin/referrals', adminMiddleware, (req, res) => {
  try {
    const stats = get(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status = 'registered' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM referrals
    `);

    const topReferrers = all(`
      SELECT u.id, u.full_name, u.college, u.display_name,
        COUNT(r.id) as total_referrals,
        SUM(CASE WHEN r.status = 'registered' THEN 1 ELSE 0 END) as successful
      FROM users u
      JOIN referrals r ON u.id = r.referrer_id
      GROUP BY u.id ORDER BY successful DESC LIMIT 20
    `);

    res.json({ stats, topReferrers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load referral data' });
  }
});

// Admin: Colleges
app.get('/api/admin/colleges', adminMiddleware, (req, res) => {
  try {
    const colleges = all(`
      SELECT college, COUNT(*) as registrations,
        COUNT(DISTINCT CASE WHEN referred_by IS NOT NULL THEN id END) as from_referrals,
        AVG(CASE WHEN quiz_score IS NOT NULL THEN quiz_score ELSE NULL END) as avg_quiz_score
      FROM users WHERE role = 'student' AND college IS NOT NULL
      GROUP BY college ORDER BY registrations DESC
    `);
    res.json({ colleges });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load college data' });
  }
});

// Admin: Campaigns
app.get('/api/admin/campaigns', adminMiddleware, (req, res) => {
  try {
    const campaigns = all('SELECT * FROM campaigns ORDER BY created_at DESC');
    const channels = all('SELECT * FROM campaign_channels ORDER BY actual_registrations DESC');
    res.json({ campaigns, channels });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load campaigns' });
  }
});

app.post('/api/admin/campaign', adminMiddleware, (req, res) => {
  try {
    const { name, start_date, end_date, target_registrations, budget, channels } = req.body;
    const campaignId = generateId();
    run(`INSERT INTO campaigns (id, name, start_date, end_date, target_registrations, budget, channels, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [campaignId, name, start_date, end_date, target_registrations || 500, budget || 2000, JSON.stringify(channels || [])]);
    saveDb();
    res.status(201).json({ success: true, id: campaignId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Admin: Experiments
app.get('/api/admin/experiments', adminMiddleware, (req, res) => {
  try {
    const experiments = all('SELECT * FROM experiments ORDER BY created_at DESC');
    res.json({ experiments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load experiments' });
  }
});

app.post('/api/admin/experiment', adminMiddleware, (req, res) => {
  try {
    const { name, description, test_element, variant_a, variant_b } = req.body;
    if (!name) return res.status(400).json({ error: 'Experiment name required' });
    
    const id = generateId();
    run(`INSERT INTO experiments (id, name, description, test_element, variant_a, variant_b, status, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, 'draft', datetime('now'))`,
      [id, name, description || null, test_element || null, variant_a || null, variant_b || null]);
    saveDb();
    res.status(201).json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create experiment' });
  }
});

// Admin: Projects
app.get('/api/admin/projects', adminMiddleware, (req, res) => {
  try {
    const projects = all(`
      SELECT p.*, u.full_name, u.college, u.email,
        e.score as eval_score, e.admin_status
      FROM projects p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN evaluations e ON p.id = e.project_id
      ORDER BY p.created_at DESC
    `);
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

// Admin: AI Insights (Demo Mode)
app.post('/api/admin/insights', adminMiddleware, (req, res) => {
  try {
    const totalReg = get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['student']);
    const refReg = get('SELECT COUNT(*) as count FROM users WHERE role = ? AND referred_by IS NOT NULL', ['student']);
    const topChannel = get(`SELECT COALESCE(utm_source, 'direct') as channel, COUNT(*) as count FROM users WHERE role = 'student' GROUP BY utm_source ORDER BY count DESC LIMIT 1`);
    const topCollege = get(`SELECT college, COUNT(*) as count FROM users WHERE role = 'student' AND college IS NOT NULL GROUP BY college ORDER BY count DESC LIMIT 1`);

    const total = totalReg?.count || 0;
    const referrals = refReg?.count || 0;
    const referralPct = total > 0 ? Math.round((referrals / total) * 100) : 0;
    
    const insights = [
      {
        type: 'opportunity',
        title: 'Referral Engine Performance',
        insight: `Referral traffic accounts for ${referralPct}% of total registrations (${referrals} of ${total}). ${referralPct > 30 ? 'This is strong — consider doubling down on referral incentives.' : 'There is room to grow referral contribution through better activation.'}`,
        metric: `${referralPct}%`,
        evidence: `${referrals} referral registrations out of ${total} total`,
        recommendation: referralPct > 30 
          ? 'Increase referral reward visibility and add milestone notifications to active referrers.'
          : 'Implement referral reminders for registered students who haven\'t shared their link yet.'
      },
      {
        type: 'insight',
        title: 'Top Acquisition Channel',
        insight: `"${topChannel?.channel || 'Direct'}" is the highest-performing channel with ${topChannel?.count || 0} registrations.`,
        metric: topChannel?.count || 0,
        evidence: `Channel performance data from UTM tracking`,
        recommendation: 'Allocate more of the ₹2,000 budget to the top-performing channel and test creative variations.'
      },
      {
        type: 'alert',
        title: 'Registration Pace',
        insight: total >= 400 
          ? `With ${total} registrations, the campaign is ${Math.round((total/500)*100)}% towards the 500 target. On track for completion.`
          : `Current pace: ${total} registrations. Need ${500 - total} more to reach the 500 target.`,
        metric: `${total}/500`,
        evidence: 'Registration database count',
        recommendation: total < 400 
          ? 'Consider activating additional college clubs or increasing WhatsApp community outreach.'
          : 'Maintain current strategy and focus on activation quality.'
      },
      {
        type: 'opportunity',
        title: 'College Concentration',
        insight: `"${topCollege?.college || 'N/A'}" leads with ${topCollege?.count || 0} registrations. Consider ambassador activation at similar colleges.`,
        metric: topCollege?.count || 0,
        evidence: 'College-wise registration data',
        recommendation: 'Identify 3 similar-profile colleges and deploy ambassador campaigns within the next 48 hours.'
      }
    ];

    run(`INSERT INTO audit_log (id, actor_id, action, details, created_at) 
         VALUES (?, ?, 'generated_ai_insights', ?, datetime('now'))`,
      [generateId(), req.user.id, JSON.stringify({ insights_count: insights.length })]);
    saveDb();

    res.json({ 
      insights, 
      generated_at: new Date().toISOString(),
      demo_mode: true,
      disclaimer: "Insights generated from campaign data analysis. All recommendations are based on actual registration metrics."
    });
  } catch (error) {
    console.error('AI insights error:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// Admin: Messages
app.get('/api/admin/messages', adminMiddleware, (req, res) => {
  try {
    const messages = all('SELECT * FROM messages ORDER BY created_at DESC');
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

app.post('/api/admin/message', adminMiddleware, (req, res) => {
  try {
    const { title, body, channel, audience_filter, scheduled_at } = req.body;
    if (!body) return res.status(400).json({ error: 'Message body required' });

    const id = generateId();
    run(`INSERT INTO messages (id, title, body, channel, audience_filter, status, scheduled_at, created_at) 
         VALUES (?, ?, ?, ?, ?, 'draft', ?, datetime('now'))`,
      [id, title || null, body, channel || 'whatsapp', audience_filter ? JSON.stringify(audience_filter) : null, scheduled_at || null]);
    saveDb();
    res.status(201).json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create message' });
  }
});

app.post('/api/admin/message/:id/send', adminMiddleware, (req, res) => {
  try {
    const msg = get('SELECT * FROM messages WHERE id = ?', [req.params.id]);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    // Demo mode: simulate sending
    const recipientCount = get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['student']);
    run(`UPDATE messages SET status = 'sent', sent_at = datetime('now'), sent_count = ? WHERE id = ?`,
      [recipientCount?.count || 0, req.params.id]);
    
    run(`INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, details, created_at) 
         VALUES (?, ?, 'message_sent', 'message', ?, ?, datetime('now'))`,
      [generateId(), req.user.id, req.params.id, JSON.stringify({ channel: msg.channel, recipients: recipientCount?.count || 0, demo_mode: true })]);
    saveDb();

    res.json({ 
      success: true, 
      sent_count: recipientCount?.count || 0,
      demo_mode: true,
      disclaimer: "Message simulated in demo mode. Connect production credentials to send real messages."
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Admin: Settings
app.get('/api/admin/settings', adminMiddleware, (req, res) => {
  try {
    const settings = all('SELECT * FROM settings');
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });
    res.json({ settings: settingsMap });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.post('/api/admin/settings', adminMiddleware, (req, res) => {
  try {
    const { settings } = req.body;
    for (const [key, value] of Object.entries(settings)) {
      const existing = get('SELECT key FROM settings WHERE key = ?', [key]);
      if (existing) {
        run('UPDATE settings SET value = ?, updated_at = datetime(?) WHERE key = ?', [String(value), 'now', key]);
      } else {
        run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
      }
    }
    saveDb();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Admin: Audit Log
app.get('/api/admin/audit-log', adminMiddleware, (req, res) => {
  try {
    const logs = all('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100');
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load audit log' });
  }
});

// Admin: Ambassadors
app.get('/api/admin/ambassadors', adminMiddleware, (req, res) => {
  try {
    const ambassadors = all('SELECT * FROM ambassadors ORDER BY registrations DESC');
    res.json({ ambassadors });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load ambassadors' });
  }
});

app.post('/api/admin/ambassador', adminMiddleware, (req, res) => {
  try {
    const { college, club, ambassador_name, contact, campaign_start, campaign_end } = req.body;
    if (!college || !ambassador_name) return res.status(400).json({ error: 'College and name required' });

    let code;
    do {
      code = college.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X') + Math.floor(Math.random() * 100).toString().padStart(2, '0');
    } while (get('SELECT id FROM ambassadors WHERE ambassador_code = ?', [code]));

    const id = generateId();
    run(`INSERT INTO ambassadors (id, college, club, ambassador_name, ambassador_code, contact, campaign_start, campaign_end, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, college, club || null, ambassador_name, code, contact || null, campaign_start || null, campaign_end || null]);
    saveDb();
    res.status(201).json({ success: true, id, ambassador_code: code });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ambassador' });
  }
});

// Admin: Daily targets
app.get('/api/admin/daily-targets', adminMiddleware, (req, res) => {
  try {
    const targets = all('SELECT * FROM daily_targets ORDER BY day_number ASC');
    res.json({ targets });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load daily targets' });
  }
});

// Admin: Export CSV
app.get('/api/admin/export/:type', adminMiddleware, (req, res) => {
  try {
    let data, filename;
    
    switch (req.params.type) {
      case 'registrations':
        data = all(`SELECT full_name, email, college, branch, graduation_year, utm_source, intent_level, referral_code, created_at FROM users WHERE role = 'student' ORDER BY created_at DESC`);
        filename = 'registrations.csv';
        break;
      case 'referrals':
        data = all(`SELECT r.id, u1.full_name as referrer, u2.full_name as referred, r.status, r.created_at FROM referrals r LEFT JOIN users u1 ON r.referrer_id = u1.id LEFT JOIN users u2 ON r.referred_id = u2.id ORDER BY r.created_at DESC`);
        filename = 'referrals.csv';
        break;
      case 'colleges':
        data = all(`SELECT college, COUNT(*) as registrations FROM users WHERE role = 'student' GROUP BY college ORDER BY registrations DESC`);
        filename = 'colleges.csv';
        break;
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }

    if (data.length === 0) return res.status(404).json({ error: 'No data to export' });

    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// ============================================================================
// SIMULATOR
// ============================================================================

app.post('/api/admin/simulate', adminMiddleware, (req, res) => {
  try {
    const { clubs, club_reach, club_conversion, whatsapp_groups, whatsapp_reach, whatsapp_conversion,
            referral_participants, avg_referrals, email_reach, email_conversion,
            paid_budget, cpc, paid_conversion } = req.body;

    const clubReg = Math.round((clubs || 0) * (club_reach || 0) * ((club_conversion || 0) / 100));
    const whatsappReg = Math.round((whatsapp_groups || 0) * (whatsapp_reach || 0) * ((whatsapp_conversion || 0) / 100));
    const referralReg = Math.round((referral_participants || 0) * (avg_referrals || 0));
    const emailReg = Math.round((email_reach || 0) * ((email_conversion || 0) / 100));
    
    let paidReg = 0;
    if (paid_budget && cpc) {
      const clicks = Math.round(paid_budget / cpc);
      paidReg = Math.round(clicks * ((paid_conversion || 0) / 100));
    }

    const totalProjected = clubReg + whatsappReg + referralReg + emailReg + paidReg;
    const totalReach = ((clubs || 0) * (club_reach || 0)) + ((whatsapp_groups || 0) * (whatsapp_reach || 0)) + (email_reach || 0);
    const costPerReg = totalProjected > 0 ? Math.round((paid_budget || 0) / totalProjected * 100) / 100 : 0;

    res.json({
      results: {
        clubs: { reach: (clubs || 0) * (club_reach || 0), registrations: clubReg },
        whatsapp: { reach: (whatsapp_groups || 0) * (whatsapp_reach || 0), registrations: whatsappReg },
        referrals: { participants: referral_participants || 0, registrations: referralReg },
        email: { reach: email_reach || 0, registrations: emailReg },
        paid: { budget: paid_budget || 0, registrations: paidReg },
        total: {
          projected_reach: totalReach,
          projected_registrations: totalProjected,
          cost_per_registration: costPerReg,
          referral_contribution: totalProjected > 0 ? Math.round((referralReg / totalProjected) * 100) : 0,
          probability_500: Math.min(99, Math.round((totalProjected / 500) * 100)),
          gap: Math.max(0, 500 - totalProjected)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Simulation failed' });
  }
});

// ============================================================================
// ADMIN AI MANAGEMENT
// ============================================================================

app.get('/api/admin/ai/health', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const health = await aiGateway.getHealth();
    res.json({ health });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch AI health' });
  }
});

app.get('/api/admin/ai/usage', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const usage = await aiGateway.getUsage();
    res.json({ usage });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch AI usage' });
  }
});

app.post('/api/admin/ai/simulate-failure', authMiddleware, adminMiddleware, async (req, res) => {
  const { provider } = req.body;
  try {
    await aiGateway.simulateFailure(provider);
    res.json({ success: true, message: `Simulated failure for ${provider}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to simulate failure' });
  }
});

app.post('/api/admin/knowledge', authMiddleware, adminMiddleware, async (req, res) => {
  const { title, content } = req.body;
  try {
    const kbId = generateId();
    run(`INSERT INTO ai_knowledge (id, title, content, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))`, [kbId, title, content]);
    saveDb();
    res.json({ success: true, id: kbId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save knowledge' });
  }
});

app.get('/api/admin/knowledge', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const items = all('SELECT * FROM ai_knowledge ORDER BY created_at DESC') || [];
    res.json({ knowledge: items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load knowledge' });
  }
});

// ============================================================================
// SPA FALLBACK - serve index.html for all non-API routes
// ============================================================================

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================================
// START SERVER
// ============================================================================

async function start() {
  try {
    await getDb();
    console.log('📦 Database initialized');
    
    // Create default admin if none exists
    const adminExists = get('SELECT id FROM users WHERE role = ?', ['admin']);
    if (!adminExists) {
      const adminId = generateId();
      const adminHash = await bcrypt.hash('admin123', 10);
      run(`INSERT INTO users (id, email, phone, password_hash, full_name, role, referral_code, display_name, created_at) 
           VALUES (?, ?, ?, ?, ?, 'admin', ?, ?, datetime('now'))`,
        [adminId, 'admin@ai60.demo', '0000000000', adminHash, 'Admin User', 'ADMIN00', 'Admin']);
      saveDb();
      console.log('👤 Default admin created: admin@ai60.demo / admin123');
    }

    app.listen(PORT, () => {
      console.log(`\n🚀 AI60 Growth Engine running at http://localhost:${PORT}`);
      console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
      console.log(`🎯 Landing Page: http://localhost:${PORT}/`);
      console.log(`\n📋 Admin Login: admin@ai60.demo / admin123`);
      console.log(`\n💡 Run 'npm run seed' to populate demo data\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
