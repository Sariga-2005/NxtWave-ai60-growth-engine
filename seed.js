// ============================================================================
// AI60 Growth Engine — Seed Data
// Generates small demo data set for development testing
// IMPORTANT: All data is simulated. Clearly labeled as DEMO DATA.
// ============================================================================
require('dotenv').config();
const { getDb, saveDb, run, get, all } = require('./database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function generateId() { return crypto.randomUUID(); }
function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const COLLEGES = [
  'Amrita Vishwa Vidyapeetham', 'VIT Vellore', 'SRM University', 'BITS Pilani',
  'NIT Trichy', 'NIT Warangal', 'IIIT Hyderabad', 'JNTU Hyderabad',
  'Anna University', 'Manipal Institute of Technology', 'PES University',
  'RV College of Engineering', 'BMS College of Engineering', 'DSCE Bangalore',
  'Presidency University', 'Christ University', 'Lovely Professional University',
  'Chandigarh University', 'Thapar University', 'KIIT Bhubaneswar',
  'SRM AP', 'VIT AP', 'GITAM Vizag', 'KL University', 'Vignan University',
  'Saveetha Engineering College', 'SSN College of Engineering', 'CEG Anna Univ',
  'PSG College of Technology', 'Kongu Engineering College'
];

const BRANCHES = ['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Chemical', 'Biotechnology', 'AI&ML', 'Data Science'];
const SOURCES = ['direct', 'whatsapp', 'referral', 'instagram', 'linkedin', 'email', 'college_club', 'ambassador'];
const FIRST_NAMES = ['Aarav','Aditi','Aditya','Akshay','Amara','Amit','Ananya','Anika','Arjun','Bhavya','Chandra','Deepa','Dev','Dhruv','Diya','Esha','Gaurav','Harini','Ishaan','Jaya','Karthik','Kavya','Krishna','Lakshmi','Manav','Meera','Nandini','Nikhil','Pallavi','Priya','Rahul','Riya','Rohan','Sai','Sakshi','Sandeep','Shreya','Siddharth','Tanvi','Varun','Vihaan','Yamini','Zara','Pranav','Pooja','Ravi','Sneha','Tanya','Vikram','Yash'];
const LAST_NAMES = ['Sharma','Patel','Reddy','Kumar','Singh','Gupta','Nair','Rao','Das','Joshi','Pillai','Verma','Iyer','Menon','Desai','Shah','Agarwal','Mishra','Chopra','Banerjee','Bhat','Srinivasan','Choudhury','Saxena','Kulkarni'];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function seed() {
  console.log('🌱 Starting seed process...\n');
  
  await getDb();

  // Check if already seeded
  const existingStudents = get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['student']);
  if (existingStudents && existingStudents.count > 10) {
    console.log(`⚠️  Database already has ${existingStudents.count} student records.`);
    console.log('   Delete data/ai60.db and restart to reseed.\n');
    return;
  }

  // Create admin
  const adminExists = get('SELECT id FROM users WHERE role = ?', ['admin']);
  if (!adminExists && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    run(`INSERT INTO users (id, email, phone, password_hash, full_name, role, referral_code, display_name, created_at) 
         VALUES (?, ?, ?, ?, ?, 'admin', ?, ?, datetime('now'))`,
      [generateId(), process.env.ADMIN_EMAIL, '0000000000', adminHash, 'Admin User', 'ADMIN00', 'Admin']);
    console.log(`👤 Admin created with email: ${process.env.ADMIN_EMAIL}\n`);
  } else if (adminExists) {
    console.log('👤 Admin user already exists\n');
  } else {
    console.log('⚠️ No ADMIN_EMAIL or ADMIN_PASSWORD provided in .env, skipping admin creation\n');
  }

  // Generate 426 students over 7 days
  const SEED_COUNT = 50;
  const TARGET = SEED_COUNT;
  const usedEmails = new Set();
  const usedPhones = new Set();
  const usedCodes = new Set();
  const userIds = [];
  const userData = [];

  // Daily distribution (realistic growth curve)
  const dailyDist = [5, 7, 8, 9, 7, 8, 6]; // Total = 50
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 7);

  let studentCount = 0;

  for (let day = 0; day < 7; day++) {
    const dayDate = new Date(baseDate);
    dayDate.setDate(dayDate.getDate() + day);
    const count = dailyDist[day];

    for (let i = 0; i < count; i++) {
      const firstName = randomFrom(FIRST_NAMES);
      const lastName = randomFrom(LAST_NAMES);
      const fullName = `${firstName} ${lastName}`;
      
      let email;
      do { email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 999)}@${randomFrom(['gmail.com','outlook.com','yahoo.com','college.edu'])}`; }
      while (usedEmails.has(email));
      usedEmails.add(email);

      let phone;
      do { phone = `${randomFrom(['6','7','8','9'])}${String(randomInt(100000000, 999999999)).padStart(9, '0')}`; }
      while (usedPhones.has(phone));
      usedPhones.add(phone);

      let referralCode;
      do { referralCode = generateReferralCode(); }
      while (usedCodes.has(referralCode));
      usedCodes.add(referralCode);

      const college = randomFrom(COLLEGES);
      const branch = randomFrom(BRANCHES);
      const source = randomFrom(SOURCES);
      const gradYear = randomFrom([2025, 2025, 2025, 2026]); // Mostly final year
      const quizScore = Math.random() > 0.3 ? randomInt(65, 98) : null;
      const intentLevel = quizScore && quizScore > 80 ? 'high' : quizScore && quizScore < 60 ? 'low' : 'medium';

      // Randomize time within the day
      const hour = randomInt(6, 23);
      const minute = randomInt(0, 59);
      const createdAt = new Date(dayDate);
      createdAt.setHours(hour, minute, randomInt(0, 59));

      const userId = generateId();
      const passwordHash = await bcrypt.hash(phone, 10);

      userData.push({
        id: userId, email, phone, passwordHash, fullName, college, branch,
        gradYear, source, quizScore, intentLevel, referralCode, createdAt: createdAt.toISOString(),
        aiExp: randomFrom(['none', 'basic', 'intermediate', null]),
        codingExp: randomFrom(['beginner', 'intermediate', 'comfortable', null]),
        workshopProgress: Math.random() > 0.7 ? randomInt(0, 100) : 0,
        workshopStatus: Math.random() > 0.85 ? 'completed' : Math.random() > 0.7 ? 'in_progress' : 'not_started'
      });
      userIds.push(userId);
      studentCount++;
    }
  }

  // Insert all users
  console.log(`📝 Inserting ${studentCount} student registrations...`);
  for (const u of userData) {
    run(`INSERT INTO users (id, email, phone, password_hash, full_name, role, college, branch, graduation_year, 
         ai_experience, coding_experience, referral_code, utm_source, quiz_score, intent_level, 
         display_name, workshop_progress, workshop_status, created_at) 
         VALUES (?, ?, ?, ?, ?, 'student', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.id, u.email, u.phone, u.passwordHash, u.fullName, u.college, u.branch, u.gradYear,
       u.aiExp, u.codingExp, u.referralCode, u.source, u.quizScore, u.intentLevel,
       u.fullName, u.workshopProgress, u.workshopStatus, u.createdAt]);
  }

  // Create referrals (about 35% of registrations came from referrals)
  console.log('🔗 Creating referral relationships...');
  const referralCount = Math.round(TARGET * 0.35);
  const referrers = userIds.slice(0, Math.round(TARGET * 0.25)); // Top 25% are referrers
  let refCreated = 0;

  for (let i = 0; i < referralCount; i++) {
    const referrerId = randomFrom(referrers);
    const referredIdx = randomInt(referrers.length, userIds.length - 1);
    const referredId = userIds[referredIdx];
    
    if (referrerId === referredId) continue;

    run(`INSERT INTO referrals (id, referrer_id, referred_id, status, source, created_at) 
         VALUES (?, ?, ?, 'registered', 'referral', datetime('now', '-' || ? || ' days'))`,
      [generateId(), referrerId, referredId, randomInt(0, 6)]);
    
    // Update referred_by
    run('UPDATE users SET referred_by = ?, utm_source = ? WHERE id = ? AND referred_by IS NULL',
      [referrerId, 'referral', referredId]);
    refCreated++;
  }
  console.log(`   Created ${refCreated} referral records`);

  // Create ambassadors
  console.log('🎓 Creating ambassadors...');
  const ambassadorData = [
    { college: 'Amrita Vishwa Vidyapeetham', club: 'Tech Club', name: 'Sai Kumar', code: 'AMRI01' },
    { college: 'VIT Vellore', club: 'IEEE Student Branch', name: 'Priya Sharma', code: 'VITV01' },
    { college: 'SRM University', club: 'Coding Club', name: 'Rahul Verma', code: 'SRMU01' },
    { college: 'NIT Trichy', club: 'Spider', name: 'Deepa Nair', code: 'NITT01' },
    { college: 'BITS Pilani', club: 'ACM Chapter', name: 'Arjun Reddy', code: 'BITS01' },
    { college: 'IIIT Hyderabad', club: 'E-Cell', name: 'Kavya Rao', code: 'IIIT01' },
    { college: 'PES University', club: 'CodeChef Chapter', name: 'Varun Joshi', code: 'PESU01' },
    { college: 'Manipal IT', club: 'IECSE', name: 'Tanvi Desai', code: 'MANI01' }
  ];

  for (const a of ambassadorData) {
    const regCount = randomInt(15, 45);
    run(`INSERT INTO ambassadors (id, college, club, ambassador_name, ambassador_code, visits, registrations, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-7 days'))`,
      [generateId(), a.college, a.club, a.name, a.code, regCount * randomInt(3, 8), regCount]);
  }

  // Create campaign
  console.log('📢 Creating campaign data...');
  const campaignId = generateId();
  run(`INSERT INTO campaigns (id, name, start_date, end_date, target_registrations, budget, budget_spent, status, created_at) 
       VALUES (?, 'AI60 Workshop Launch', datetime('now', '-7 days'), datetime('now'), 500, 2000, 1450, 'active', datetime('now', '-7 days'))`,
    [campaignId]);

  // Campaign channels
  const channelData = [
    { name: 'College Clubs', reach: 2500, conv: 8.5, expected: 212, actual: 168, budgetAlloc: 500, budgetSpent: 420 },
    { name: 'WhatsApp Communities', reach: 1800, conv: 6.2, expected: 112, actual: 98, budgetAlloc: 300, budgetSpent: 250 },
    { name: 'Student Referrals', reach: 800, conv: 18.5, expected: 148, actual: 125, budgetAlloc: 0, budgetSpent: 0 },
    { name: 'Email Outreach', reach: 3000, conv: 1.2, expected: 36, actual: 22, budgetAlloc: 200, budgetSpent: 180 },
    { name: 'Social/Organic', reach: 5000, conv: 0.3, expected: 15, actual: 8, budgetAlloc: 0, budgetSpent: 0 },
    { name: 'Paid Experiment', reach: 1200, conv: 0.4, expected: 5, actual: 5, budgetAlloc: 1000, budgetSpent: 600 }
  ];

  for (const ch of channelData) {
    run(`INSERT INTO campaign_channels (id, campaign_id, channel_name, reach, expected_conversion, expected_registrations, actual_registrations, budget_allocated, budget_spent, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-7 days'))`,
      [generateId(), campaignId, ch.name, ch.reach, ch.conv, ch.expected, ch.actual, ch.budgetAlloc, ch.budgetSpent]);
  }

    
  // Create analytics events
  console.log('📊 Creating analytics events...');
  const eventTypes = ['page_view', 'quiz_started', 'quiz_completed', 'registration_started', 'registration_completed', 'referral_link_copied', 'whatsapp_share_clicked'];
  

  for (let i = 0; i < eventTypes.length; i++) {
    for (let j = 0; j < Math.min(SEED_COUNT, 20); j++) {
      run(`INSERT INTO analytics_events (id, event_name, user_id, source, created_at) 
           VALUES (?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))`,
        [generateId(), eventTypes[i], j < userIds.length ? userIds[j] : null, randomFrom(SOURCES), randomInt(0, 168)]);
    }
  }

    
  // Create demo projects
  console.log('🛠️ Creating demo project submissions...');
  const projectExamples = [
    { name: 'AI Resume Analyzer', desc: 'Analyzes resumes and provides feedback', stack: 'Python, Flask, OpenAI', ai: 'Uses GPT to analyze resume content' },
    { name: 'Smart Study Planner', desc: 'Creates personalized study schedules', stack: 'JavaScript, React, AI API', ai: 'Generates optimal study plans' },
    { name: 'Code Review Assistant', desc: 'Reviews code and suggests improvements', stack: 'Python, FastAPI', ai: 'AI-powered code analysis' }
  ];

  for (let i = 0; i < 3; i++) {
    const proj = projectExamples[i];
    const projId = generateId();
    run(`INSERT INTO projects (id, user_id, project_name, description, tech_stack, ai_usage, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, 'evaluated', datetime('now', '-1 day'), datetime('now'))`,
      [projId, userIds[i], proj.name, proj.desc, proj.stack, proj.ai]);

    const score = randomInt(72, 92);
    run(`INSERT INTO evaluations (id, project_id, score, problem_clarity, ai_usage_score, functionality, ux_score, originality, technical, completeness, strengths, weaknesses, suggestions, next_steps, ai_reasoning, admin_status, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', datetime('now'))`,
      [generateId(), projId, score, randomInt(70, 95), randomInt(70, 95), randomInt(65, 90), randomInt(60, 85), randomInt(65, 90), randomInt(70, 90), randomInt(75, 95),
       JSON.stringify(['Clear problem definition', 'Good AI integration']),
       JSON.stringify(['Could improve error handling']),
       JSON.stringify(['Add more test cases']),
       JSON.stringify(['Deploy to production']),
       'Evaluated based on rubric criteria']);
  }

  // Create messages
  console.log('💬 Creating demo messages...');
  const messageTemplates = [
    { title: 'Registration Confirmation', body: "You're in! Your AI60 workshop registration is confirmed. Keep your laptop ready and stay tuned for the workshop link.", channel: 'whatsapp', status: 'draft', count: 0 },
    { title: 'Referral Invitation', body: 'Know 3 friends who want to build with AI? Share your personal invite link and unlock bonus resources!', channel: 'whatsapp', status: 'draft', count: 0 },
    { title: '24-Hour Reminder', body: 'Your AI60 workshop starts tomorrow! Make sure your laptop is charged and you have a stable internet connection.', channel: 'whatsapp', status: 'scheduled', count: 0 },
    { title: '1-Hour Reminder', body: 'Starting in 1 hour! Click the workshop link to join. Let\'s build your first AI project together.', channel: 'whatsapp', status: 'draft', count: 0 }
  ];

  for (const msg of messageTemplates) {
    run(`INSERT INTO messages (id, title, body, channel, status, sent_count, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-3 days'))`,
      [generateId(), msg.title, msg.body, msg.channel, msg.status, msg.count]);
  }

  // Settings
  run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('workshop_date', '${new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}')`);
  run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('workshop_time', '10:00 AM IST')`);
  run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('target_registrations', '500')`);
  run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('budget', '2000')`);
  run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('leaderboard_enabled', 'true')`);
  run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('demo_mode', 'true')`);

  saveDb();

  console.log('\n✅ Seed complete!');
  console.log(`   ${studentCount} student registrations`);
  console.log(`   ${refCreated} referral records`);
  console.log(`   ${ambassadorData.length} ambassadors`);
  console.log(`   ${experiments.length} experiments`);
  console.log(`   ${projectExamples.length} project submissions`);
  console.log(`   ${messageTemplates.length} message templates`);
  console.log('\n⚠️  All data is DEMO/SIMULATED — not real students.\n');
  
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
