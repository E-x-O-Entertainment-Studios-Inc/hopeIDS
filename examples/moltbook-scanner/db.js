/**
 * Database module for Moltbook Scanner
 * Uses SQLite to store threats and scan history
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'threats.db');
const db = new Database(dbPath);

/**
 * Initialize database schema
 */
function initDatabase() {
  console.log('📦 Initializing database...');
  
  // Create threats table
  db.exec(`
    CREATE TABLE IF NOT EXISTS threats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      source_url TEXT,
      message TEXT NOT NULL,
      category TEXT,
      risk_score REAL,
      intent TEXT,
      flags TEXT,
      author TEXT,
      post_id TEXT,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      times_seen INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_threats_category ON threats(category);
    CREATE INDEX IF NOT EXISTS idx_threats_status ON threats(status);
    CREATE INDEX IF NOT EXISTS idx_threats_risk ON threats(risk_score);
    CREATE INDEX IF NOT EXISTS idx_threats_post_id ON threats(post_id);
  `);

  // Create scan history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS scan_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      threats_found INTEGER,
      new_threats INTEGER,
      source TEXT,
      notes TEXT
    );
  `);

  // Create scans table (detailed scan results)
  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      source TEXT NOT NULL,
      author TEXT,
      post_id TEXT,
      action TEXT,
      risk_score REAL,
      intent TEXT,
      flags TEXT,
      scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('✅ Database initialized');
}

/**
 * Add a threat to the database
 */
function addThreat(threat) {
  const stmt = db.prepare(`
    INSERT INTO threats (
      source, source_url, message, category, risk_score, 
      intent, flags, author, post_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    threat.source,
    threat.source_url || null,
    threat.message,
    threat.category || null,
    threat.risk_score || null,
    threat.intent || null,
    threat.flags ? JSON.stringify(threat.flags) : null,
    threat.author || null,
    threat.post_id || null
  );
}

/**
 * Add scan history entry
 */
function addScanHistory(history) {
  const stmt = db.prepare(`
    INSERT INTO scan_history (threats_found, new_threats, source, notes)
    VALUES (?, ?, ?, ?)
  `);

  return stmt.run(
    history.threats_found,
    history.new_threats,
    history.source,
    history.notes || null
  );
}

/**
 * Get recent threats
 */
function getRecentThreats(limit = 50) {
  const stmt = db.prepare(`
    SELECT * FROM threats 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(limit);
}

/**
 * Get scan history
 */
function getScanHistory(limit = 20) {
  const stmt = db.prepare(`
    SELECT * FROM scan_history 
    ORDER BY scan_time DESC 
    LIMIT ?
  `);
  return stmt.all(limit);
}

/**
 * Get statistics
 */
function getStats() {
  const totalThreats = db.prepare('SELECT COUNT(*) as count FROM threats').get().count;
  const activeThreats = db.prepare('SELECT COUNT(*) as count FROM threats WHERE status = ?').get('active').count;
  const totalScans = db.prepare('SELECT COUNT(*) as count FROM scan_history').get().count;
  
  const lastScan = db.prepare('SELECT * FROM scan_history ORDER BY scan_time DESC LIMIT 1').get();
  
  const categoryCounts = db.prepare(`
    SELECT category, COUNT(*) as count 
    FROM threats 
    WHERE status = 'active'
    GROUP BY category
    ORDER BY count DESC
  `).all();

  return {
    totalThreats,
    activeThreats,
    totalScans,
    lastScan,
    categoryCounts
  };
}

module.exports = {
  db,
  initDatabase,
  addThreat,
  addScanHistory,
  getRecentThreats,
  getScanHistory,
  getStats
};
