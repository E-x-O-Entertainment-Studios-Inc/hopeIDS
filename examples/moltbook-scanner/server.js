/**
 * Moltbook Scanner Control Panel
 * Web UI and API for managing threat detections
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { 
  initDatabase, 
  getRecentThreats, 
  getScanHistory, 
  getStats,
  addThreat,
  db 
} = require('./db');
const { runScanner } = require('./scanner');
const { createIDS } = require('hopeid');

const app = express();
const PORT = process.env.PORT || 3457;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
initDatabase();

// Initialize hopeIDS for manual scans
const ids = createIDS({
  semanticEnabled: process.env.HOPEID_SEMANTIC_ENABLED === 'true',
  llmEndpoint: process.env.HOPEID_LLM_ENDPOINT,
  llmModel: process.env.HOPEID_LLM_MODEL
});

// API Routes

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    version: require('./package.json').version
  });
});

/**
 * Get dashboard statistics
 */
app.get('/api/stats', (req, res) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get recent threats
 */
app.get('/api/threats', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const threats = getRecentThreats(limit);
    res.json({ threats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get single threat
 */
app.get('/api/threats/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM threats WHERE id = ?');
    const threat = stmt.get(req.params.id);
    
    if (!threat) {
      return res.status(404).json({ error: 'Threat not found' });
    }
    
    res.json(threat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Add manual threat
 */
app.post('/api/threats', async (req, res) => {
  try {
    const { message, source, notes } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Scan with hopeIDS
    const scanResult = await ids.scan(message, { source: source || 'manual' });

    // Create threat entry
    const threat = {
      source: source || 'manual',
      source_url: null,
      message: message.substring(0, 500),
      category: scanResult.layers?.heuristic?.primaryCategory || 'unknown',
      risk_score: scanResult.riskScore,
      intent: scanResult.intent,
      flags: scanResult.layers?.heuristic?.flags || [],
      author: null,
      post_id: null
    };

    const result = addThreat(threat);

    res.json({
      ok: true,
      id: result.lastInsertRowid,
      scanResult,
      threat
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update threat
 */
app.put('/api/threats/:id', (req, res) => {
  try {
    const { status, notes } = req.body;
    
    const stmt = db.prepare(`
      UPDATE threats 
      SET status = COALESCE(?, status),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(status, notes, req.params.id);
    
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete threat
 */
app.delete('/api/threats/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM threats WHERE id = ?');
    stmt.run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get scan history
 */
app.get('/api/scans', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = getScanHistory(limit);
    res.json({ scans: history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Trigger manual scan
 */
app.post('/api/scan/trigger', async (req, res) => {
  try {
    console.log('🔍 Manual scan triggered via API');
    
    // Run scanner in background
    runScanner()
      .then(() => console.log('✅ Manual scan completed'))
      .catch(err => console.error('❌ Manual scan failed:', err));
    
    res.json({ 
      ok: true, 
      message: 'Scan started in background' 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Export threats as hopeIDS patterns
 */
app.post('/api/export/hopeids', (req, res) => {
  try {
    const { threatIds } = req.body;
    
    if (!threatIds || !Array.isArray(threatIds)) {
      return res.status(400).json({ error: 'threatIds array is required' });
    }

    // Fetch selected threats
    const placeholders = threatIds.map(() => '?').join(',');
    const stmt = db.prepare(`SELECT * FROM threats WHERE id IN (${placeholders})`);
    const threats = stmt.all(...threatIds);

    // Group by category
    const patternsByCategory = {};
    
    threats.forEach(threat => {
      const category = threat.category || 'unknown';
      if (!patternsByCategory[category]) {
        patternsByCategory[category] = [];
      }
      
      // Create pattern from threat
      // This is a simplified approach - in production you'd want more sophisticated pattern extraction
      const pattern = {
        regex: threat.message
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
          .substring(0, 100),
        description: `Pattern from Moltbook threat ${threat.id}`,
        examples: [threat.message.substring(0, 100)]
      };
      
      patternsByCategory[category].push(pattern);
    });

    // Format as hopeIDS pattern files
    const patterns = Object.entries(patternsByCategory).map(([category, patterns]) => ({
      name: category,
      description: `Patterns from Moltbook scanner`,
      risk: 0.8,
      patterns
    }));

    res.json({
      ok: true,
      patterns,
      count: threats.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Scheduled scanner
let scanInterval = null;

function startScheduledScans() {
  const intervalMinutes = parseInt(process.env.SCAN_INTERVAL_MINUTES) || 30;
  const intervalMs = intervalMinutes * 60 * 1000;
  
  console.log(`⏰ Scheduling scans every ${intervalMinutes} minutes`);
  
  scanInterval = setInterval(() => {
    console.log('🔍 Starting scheduled scan...');
    runScanner()
      .then(() => console.log('✅ Scheduled scan completed'))
      .catch(err => console.error('❌ Scheduled scan failed:', err));
  }, intervalMs);
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n✨ Moltbook Scanner Control Panel`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🔍 hopeIDS: v${require('hopeid/package.json').version}`);
  console.log(`🗄️  Database: data/threats.db\n`);
  
  // Start scheduled scans
  if (process.env.SCAN_INTERVAL_MINUTES) {
    startScheduledScans();
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  }
  console.error('Server error:', err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  if (scanInterval) clearInterval(scanInterval);
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
