#!/usr/bin/env node
/**
 * Moltbook Scanner
 * Fetches posts and comments from Moltbook API and scans them with hopeIDS
 */

require('dotenv').config();
const { createIDS } = require('hopeid');
const { addThreat, addScanHistory } = require('./db');
const fs = require('fs');
const path = require('path');

// Configuration
const MOLTBOOK_API_BASE = 'https://www.moltbook.com/api/v1';
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;

// Initialize hopeIDS with optional semantic analysis
const ids = createIDS({
  semanticEnabled: process.env.HOPEID_SEMANTIC_ENABLED === 'true',
  llmEndpoint: process.env.HOPEID_LLM_ENDPOINT,
  llmModel: process.env.HOPEID_LLM_MODEL,
  strictMode: false
});

// State file to track scanned items
const STATE_FILE = path.join(__dirname, 'data', 'scan-state.json');

/**
 * Load scan state
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading state:', err.message);
  }
  return {
    last_scan: null,
    scanned_post_ids: [],
    scanned_comment_ids: []
  };
}

/**
 * Save scan state
 */
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Error saving state:', err.message);
  }
}

/**
 * Fetch recent posts from Moltbook
 */
async function fetchPosts(limit = 50) {
  const url = `${MOLTBOOK_API_BASE}/posts?sort=new&limit=${limit}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${MOLTBOOK_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.posts || data;
}

/**
 * Fetch comments for a post
 */
async function fetchComments(postId) {
  const url = `${MOLTBOOK_API_BASE}/posts/${postId}/comments`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${MOLTBOOK_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    console.warn(`Failed to fetch comments for post ${postId}: ${response.status}`);
    return [];
  }
  
  const data = await response.json();
  return data.comments || data;
}

/**
 * Scan a message with hopeIDS
 */
async function scanMessage(message, context = {}) {
  try {
    return await ids.scan(message, {
      source: 'moltbook',
      ...context
    });
  } catch (err) {
    console.error('Scan error:', err.message);
    return null;
  }
}

/**
 * Process a threat detection
 */
function processThreat(scanResult, messageData) {
  // Extract threat details from scan result
  const threat = {
    source: 'moltbook',
    source_url: messageData.url,
    message: messageData.message.substring(0, 500), // Limit length
    category: scanResult.layers?.heuristic?.primaryCategory || 'unknown',
    risk_score: scanResult.riskScore,
    intent: scanResult.intent,
    flags: scanResult.layers?.heuristic?.flags || [],
    author: messageData.author,
    post_id: messageData.post_id
  };

  // Save to database
  try {
    addThreat(threat);
    return true;
  } catch (err) {
    console.error('Error saving threat:', err.message);
    return false;
  }
}

/**
 * Main scanner function
 */
async function runScanner() {
  console.log('\n🔍 Moltbook Scanner Starting...\n');
  console.log(`hopeIDS: Semantic analysis ${ids.options.semanticEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`API Key: ${MOLTBOOK_API_KEY ? '***' + MOLTBOOK_API_KEY.slice(-4) : 'NOT SET'}\n`);
  
  if (!MOLTBOOK_API_KEY) {
    console.error('❌ MOLTBOOK_API_KEY not set in environment');
    console.error('   Set it in .env file or environment variable');
    process.exit(1);
  }

  const state = loadState();
  console.log(`Previous scan: ${state.last_scan || 'never'}`);
  console.log(`Tracking ${state.scanned_post_ids.length} posts, ${state.scanned_comment_ids.length} comments\n`);

  const stats = {
    posts_fetched: 0,
    comments_fetched: 0,
    messages_scanned: 0,
    threats_found: 0,
    new_threats: 0,
    skipped: 0
  };

  try {
    // Fetch recent posts
    console.log('📥 Fetching recent posts...');
    const posts = await fetchPosts();
    stats.posts_fetched = posts.length;
    console.log(`   Found ${posts.length} posts\n`);

    // Process each post
    for (const post of posts) {
      const postId = post.id || post._id;
      const content = post.content || post.body || post.message || '';
      const author = post.author?.username || post.author?.name || post.author || 'unknown';
      
      // Skip if already scanned
      if (state.scanned_post_ids.includes(postId)) {
        stats.skipped++;
        continue;
      }

      // Scan post content
      if (content) {
        console.log(`📝 Scanning post ${postId.substring(0, 8)}... by ${author}`);
        
        const scanResult = await scanMessage(content, {
          senderId: author,
          metadata: { postId }
        });

        if (scanResult) {
          stats.messages_scanned++;

          if (scanResult.action === 'allow') {
            console.log(`   ✅ Clean (risk: ${scanResult.riskScore.toFixed(2)})`);
          } else {
            console.log(`   ⚠️  THREAT: ${scanResult.intent} (risk: ${scanResult.riskScore.toFixed(2)}, action: ${scanResult.action})`);
            stats.threats_found++;
            stats.new_threats++;
            
            processThreat(scanResult, {
              message: content,
              author,
              post_id: postId,
              url: `https://www.moltbook.com/posts/${postId}`
            });
          }
        }

        state.scanned_post_ids.push(postId);
      }

      // Fetch and scan comments
      const comments = await fetchComments(postId);
      stats.comments_fetched += comments.length;
      
      if (comments.length > 0) {
        console.log(`   📬 Scanning ${comments.length} comments...`);
      }

      for (const comment of comments) {
        const commentId = comment.id || comment._id;
        const commentContent = comment.content || comment.body || comment.message || '';
        const commentAuthor = comment.author?.username || comment.author?.name || comment.author || 'unknown';
        
        // Skip if already scanned
        if (state.scanned_comment_ids.includes(commentId)) {
          stats.skipped++;
          continue;
        }

        if (commentContent) {
          const scanResult = await scanMessage(commentContent, {
            senderId: commentAuthor,
            metadata: { postId, commentId }
          });

          if (scanResult) {
            stats.messages_scanned++;

            if (scanResult.action === 'allow') {
              console.log(`      ✅ Comment by ${commentAuthor}: clean`);
            } else {
              console.log(`      ⚠️  Comment by ${commentAuthor}: ${scanResult.intent} (risk: ${scanResult.riskScore.toFixed(2)})`);
              stats.threats_found++;
              stats.new_threats++;
              
              processThreat(scanResult, {
                message: commentContent,
                author: commentAuthor,
                post_id: postId,
                url: `https://www.moltbook.com/posts/${postId}#comment-${commentId}`
              });
            }
          }

          state.scanned_comment_ids.push(commentId);
        }
      }

      console.log('');
    }

    // Update state
    state.last_scan = new Date().toISOString();
    
    // Keep state files manageable (last 1000 posts, 5000 comments)
    if (state.scanned_post_ids.length > 1000) {
      state.scanned_post_ids = state.scanned_post_ids.slice(-1000);
    }
    if (state.scanned_comment_ids.length > 5000) {
      state.scanned_comment_ids = state.scanned_comment_ids.slice(-5000);
    }
    
    saveState(state);

    // Save scan history
    addScanHistory({
      threats_found: stats.threats_found,
      new_threats: stats.new_threats,
      source: 'moltbook',
      notes: `Posts: ${stats.posts_fetched}, Comments: ${stats.comments_fetched}, Scanned: ${stats.messages_scanned}, Skipped: ${stats.skipped}`
    });

    // Print summary
    console.log('═══════════════════════════════════════');
    console.log('📊 SCAN SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Posts fetched:      ${stats.posts_fetched}`);
    console.log(`Comments fetched:   ${stats.comments_fetched}`);
    console.log(`Messages scanned:   ${stats.messages_scanned}`);
    console.log(`Skipped (cached):   ${stats.skipped}`);
    console.log(`Threats found:      ${stats.threats_found}`);
    console.log(`New threats:        ${stats.new_threats}`);
    console.log('═══════════════════════════════════════\n');
    
    console.log('✅ Scan complete!\n');

  } catch (err) {
    console.error('\n❌ Scan failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runScanner()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runScanner };
