/**
 * Express.js middleware for hopeIDS
 * 
 * Drop-in protection for Express APIs:
 * 
 * const { expressMiddleware } = require('hopeid');
 * app.use(expressMiddleware({ threshold: 0.7 }));
 * 
 * @module hopeid/middleware/express
 */

// Lazy-load to avoid circular dependency with index.js
let HopeIDS = null;
function getHopeIDS() {
  if (!HopeIDS) {
    HopeIDS = require('../index').HopeIDS;
  }
  return HopeIDS;
}

/**
 * Detect source type from request
 * @param {object} req - Express request
 * @returns {string} Source identifier
 */
function detectSource(req) {
  const contentType = req.get('content-type') || '';
  const path = req.path || '';
  
  // API endpoints
  if (path.startsWith('/api')) return 'api';
  
  // GraphQL
  if (path.includes('graphql') || contentType.includes('graphql')) {
    return 'graphql';
  }
  
  // JSON API
  if (contentType.includes('application/json')) {
    return 'api';
  }
  
  // Form submissions
  if (contentType.includes('application/x-www-form-urlencoded') || 
      contentType.includes('multipart/form-data')) {
    return 'form';
  }
  
  // Webhooks
  if (path.includes('webhook') || path.includes('callback')) {
    return 'webhook';
  }
  
  // Default web traffic
  return 'web';
}

/**
 * Extract scannable text from request
 * @param {object} req - Express request
 * @returns {Array<{text: string, path: string}>} Array of text segments to scan
 */
function extractTexts(req) {
  const texts = [];
  
  // Scan query parameters
  if (req.query && Object.keys(req.query).length > 0) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string' && value.length > 0) {
        texts.push({ text: value, path: `query.${key}` });
      }
    }
  }
  
  // Scan body (if present)
  if (req.body && typeof req.body === 'object') {
    // Handle different body formats
    if (typeof req.body === 'string') {
      // Raw body
      texts.push({ text: req.body, path: 'body' });
    } else if (req.body.message) {
      // Common pattern: { message: "..." }
      texts.push({ text: req.body.message, path: 'body.message' });
    } else if (req.body.text) {
      // Alternative: { text: "..." }
      texts.push({ text: req.body.text, path: 'body.text' });
    } else if (req.body.content) {
      // Alternative: { content: "..." }
      texts.push({ text: req.body.content, path: 'body.content' });
    } else if (req.body.query) {
      // GraphQL or search: { query: "..." }
      texts.push({ text: req.body.query, path: 'body.query' });
    } else {
      // Scan all string fields in body
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof value === 'string' && value.length > 0) {
          texts.push({ text: value, path: `body.${key}` });
        } else if (typeof value === 'object' && value !== null) {
          // One level deep for nested objects
          for (const [nestedKey, nestedValue] of Object.entries(value)) {
            if (typeof nestedValue === 'string' && nestedValue.length > 0) {
              texts.push({ text: nestedValue, path: `body.${key}.${nestedKey}` });
            }
          }
        }
      }
    }
  }
  
  return texts;
}

/**
 * Default block handler
 * @param {object} result - Scan result
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
function defaultBlockHandler(result, req, res) {
  res.status(403).json({
    error: 'Request blocked by security policy',
    message: result.message,
    action: result.action,
    intent: result.intent,
    riskScore: result.riskScore
  });
}

/**
 * Default warn handler
 * @param {object} result - Scan result
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
function defaultWarnHandler(result, req, res, next) {
  // Attach warning to request for logging/monitoring
  req.securityWarning = {
    intent: result.intent,
    riskScore: result.riskScore,
    message: result.message,
    flags: result.layers?.heuristic?.flags || []
  };
  next();
}

/**
 * Create Express middleware for hopeIDS
 * 
 * @param {object} options - Configuration options
 * @param {number} [options.threshold=0.7] - Risk threshold (0-1) for blocking
 * @param {boolean} [options.semanticEnabled=false] - Enable LLM-based semantic analysis
 * @param {string} [options.llmEndpoint] - LLM API endpoint
 * @param {string} [options.llmModel] - LLM model name
 * @param {string} [options.apiKey] - LLM API key
 * @param {object} [options.thresholds] - Custom action thresholds { warn, block, quarantine }
 * @param {boolean} [options.strictMode=false] - Use strict mode (lower thresholds)
 * @param {function} [options.onBlock] - Custom block handler (result, req, res)
 * @param {function} [options.onWarn] - Custom warn handler (result, req, res, next)
 * @param {function} [options.getSenderId] - Extract sender ID from request (req => string)
 * @param {boolean} [options.scanQuery=true] - Scan query parameters
 * @param {boolean} [options.scanBody=true] - Scan request body
 * @param {string} [options.logLevel='info'] - Log level
 * @returns {function} Express middleware function
 * 
 * @example
 * // Basic usage
 * app.use(expressMiddleware({ threshold: 0.7 }));
 * 
 * @example
 * // Custom handlers
 * app.use(expressMiddleware({
 *   threshold: 0.8,
 *   onWarn: (result, req, res, next) => {
 *     console.warn('Security warning:', result.intent);
 *     req.securityWarning = result;
 *     next();
 *   },
 *   onBlock: (result, req, res) => {
 *     res.status(403).send('Forbidden');
 *   }
 * }));
 * 
 * @example
 * // With semantic analysis and custom sender ID
 * app.use(expressMiddleware({
 *   semanticEnabled: true,
 *   llmEndpoint: 'http://localhost:1234/v1/chat/completions',
 *   llmModel: 'qwen2.5-32b',
 *   getSenderId: (req) => req.user?.id || req.ip
 * }));
 */
function expressMiddleware(options = {}) {
  // Extract middleware-specific options
  const {
    threshold = 0.7,
    onBlock = defaultBlockHandler,
    onWarn = defaultWarnHandler,
    getSenderId = (req) => req.user?.id || req.ip || 'anonymous',
    scanQuery = true,
    scanBody = true,
    ...idsOptions
  } = options;
  
  // Create hopeIDS instance (lazy-load to avoid circular dep)
  const IDS = getHopeIDS();
  const ids = new IDS({
    semanticEnabled: false,  // Default to fast heuristic-only
    strictMode: false,
    ...idsOptions
  });
  
  // Return middleware function
  return async function hopeIDSMiddleware(req, res, next) {
    try {
      // Extract texts to scan
      const textsToScan = [];
      
      if (scanQuery && req.query) {
        textsToScan.push(...extractTexts(req).filter(t => t.path.startsWith('query')));
      }
      
      if (scanBody && req.body) {
        textsToScan.push(...extractTexts(req).filter(t => t.path.startsWith('body')));
      }
      
      // Skip if nothing to scan
      if (textsToScan.length === 0) {
        return next();
      }
      
      // Scan each text segment
      for (const { text, path } of textsToScan) {
        const result = await ids.scan(text, {
          source: detectSource(req),
          senderId: getSenderId(req),
          metadata: {
            path,
            method: req.method,
            url: req.originalUrl || req.url,
            ip: req.ip,
            userAgent: req.get('user-agent')
          }
        });
        
        // Handle based on action
        if (result.action === 'block' || result.action === 'quarantine') {
          // Block the request
          return onBlock(result, req, res);
        } else if (result.action === 'warn') {
          // Warn but continue
          return onWarn(result, req, res, next);
        }
      }
      
      // All scans passed - allow request
      next();
      
    } catch (error) {
      // Handle errors gracefully - fail open to avoid breaking the app
      console.error('[hopeIDS] Middleware error:', error.message);
      next();
    }
  };
}

module.exports = { expressMiddleware, detectSource, extractTexts };
