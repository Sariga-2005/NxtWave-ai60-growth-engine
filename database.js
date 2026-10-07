// ============================================================================
// AI60 Growth Engine — Database Layer
// Pure JavaScript SQLite via sql.js
// ============================================================================
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// AI60_DB_PATH is an optional override used only by isolated test scripts
// (e.g. test_referrals.js) so test data never touches the real database.
const DB_PATH = process.env.AI60_DB_PATH
  ? path.resolve(process.env.AI60_DB_PATH)
  : path.join(__dirname, 'data', 'ai60.db');
let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  initSchema(db);
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, buffer);
}

// Auto-save every 5 seconds
setInterval(() => { if (db) saveDb(); }, 5000);

function initSchema(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'student' CHECK(role IN ('student','ambassador','admin')),
      college TEXT,
      branch TEXT,
      graduation_year INTEGER,
      ai_experience TEXT,
      coding_experience TEXT,
      project_interest TEXT,
      referral_code TEXT UNIQUE NOT NULL,
      referred_by TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT,
      ambassador_code TEXT,
      quiz_score INTEGER,
      quiz_data TEXT,
      intent_level TEXT DEFAULT 'medium' CHECK(intent_level IN ('low','medium','high')),
      workshop_progress INTEGER DEFAULT 0,
      workshop_status TEXT DEFAULT 'not_started',
      display_name TEXT,
      avatar_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      referred_id TEXT,
      referred_email TEXT,
      referred_phone TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','registered','active','expired')),
      source TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (referrer_id) REFERENCES users(id),
      FOREIGN KEY (referred_id) REFERENCES users(id)
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      target_registrations INTEGER DEFAULT 500,
      budget REAL DEFAULT 2000,
      budget_spent REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      channels TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS campaign_channels (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      channel_name TEXT NOT NULL,
      reach INTEGER DEFAULT 0,
      expected_conversion REAL DEFAULT 0,
      expected_registrations INTEGER DEFAULT 0,
      actual_registrations INTEGER DEFAULT 0,
      budget_allocated REAL DEFAULT 0,
      budget_spent REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS ambassadors (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      college TEXT NOT NULL,
      club TEXT,
      ambassador_name TEXT NOT NULL,
      ambassador_code TEXT UNIQUE NOT NULL,
      contact TEXT,
      campaign_start TEXT,
      campaign_end TEXT,
      visits INTEGER DEFAULT 0,
      registrations INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      user_id TEXT,
      session_id TEXT,
      source TEXT,
      campaign TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      description TEXT,
      github_url TEXT,
      demo_url TEXT,
      screenshot_url TEXT,
      tech_stack TEXT,
      ai_usage TEXT,
      what_learned TEXT,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','submitted','under_review','evaluated')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      score INTEGER,
      problem_clarity INTEGER,
      ai_usage_score INTEGER,
      functionality INTEGER,
      ux_score INTEGER,
      originality INTEGER,
      technical INTEGER,
      completeness INTEGER,
      strengths TEXT,
      weaknesses TEXT,
      suggestions TEXT,
      next_steps TEXT,
      ai_reasoning TEXT,
      categories_data TEXT,
      evaluation_summary TEXT,
      eval_model TEXT,
      eval_provider TEXT,
      admin_status TEXT DEFAULT 'pending' CHECK(admin_status IN ('pending','approved','rejected','changes_requested')),
      admin_override_score INTEGER,
      admin_notes TEXT,
      reviewed_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  try { database.run(`ALTER TABLE evaluations ADD COLUMN categories_data TEXT`); } catch (e) {}
  try { database.run(`ALTER TABLE evaluations ADD COLUMN evaluation_summary TEXT`); } catch (e) {}
  try { database.run(`ALTER TABLE evaluations ADD COLUMN eval_model TEXT`); } catch (e) {}
  try { database.run(`ALTER TABLE evaluations ADD COLUMN eval_provider TEXT`); } catch (e) {}

  database.run(`
    CREATE TABLE IF NOT EXISTS ai_knowledge (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      test_element TEXT,
      variant_a TEXT,
      variant_b TEXT,
      variant_a_impressions INTEGER DEFAULT 0,
      variant_a_clicks INTEGER DEFAULT 0,
      variant_a_registrations INTEGER DEFAULT 0,
      variant_b_impressions INTEGER DEFAULT 0,
      variant_b_clicks INTEGER DEFAULT 0,
      variant_b_registrations INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','running','paused','completed')),
      winner TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      title TEXT,
      body TEXT NOT NULL,
      channel TEXT DEFAULT 'whatsapp',
      audience_filter TEXT,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','scheduled','sent','failed')),
      scheduled_at TEXT,
      sent_at TEXT,
      sent_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS saved_ideas (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      idea_data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      session_id TEXT,
      answers TEXT NOT NULL,
      score INTEGER,
      fit_message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS daily_targets (
      id TEXT PRIMARY KEY,
      day_number INTEGER NOT NULL,
      date TEXT NOT NULL,
      target INTEGER NOT NULL,
      actual INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      user_type TEXT NOT NULL CHECK(user_type IN ('ADMIN', 'STUDENT')),
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);


  // Create indexes
  database.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_users_college ON users(college);`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event_name);`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);`);
}

// Helper to run queries
function run(sql, params = []) {
  const d = db;
  if (!d) throw new Error('Database not initialized');
  return d.run(sql, params);
}

function get(sql, params = []) {
  const d = db;
  if (!d) throw new Error('Database not initialized');
  const stmt = d.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const d = db;
  if (!d) throw new Error('Database not initialized');
  const results = [];
  const stmt = d.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

module.exports = { getDb, saveDb, run, get, all };
