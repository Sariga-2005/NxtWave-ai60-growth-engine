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



// ============================================================================
// QUIZ
// ============================================================================



// ============================================================================
// PROJECT SUBMISSION
// ============================================================================



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
