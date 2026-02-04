/**
 * Hono middleware for hopeIDS
 * 
 * Drop-in protection for Hono APIs:
 * 
 * import { honoMiddleware } from 'hopeid';
 * app.use(honoMiddleware({ threshold: 0.7 }));
 * 
 * @module hopeid/middleware/hono
 */

const { HopeIDS } = require('../index');

/**
 * Detect source type from request
 * @param {object} req - Hono request
 * @returns {string} Source identifier
 */
function detectSource(req) {
  const contentType = req.header('content-type') || '';
  const path = new URL(req.url).pathname;
  
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
 * @param {object} c - Hono context
 * @returns {Promise<Array<{text: string, path: string}>>} Array of text segments to scan
 */
async function extractTexts(c) {
  const texts = [];
  const req = c.req;
  
  // Scan query parameters
  const query = req.query();
  if (query && Object.keys(query).length > 0) {
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string' && value.length > 0) {
        texts.push({ text: value, path: `query.${key}` });
      }
    }
  }
  
  // Scan body (if present)
  // Clone request to avoid consuming body multiple times
  const contentType = req.header('content-type') || '';
  
  if (contentType.includes('application/json')) {
    try {
      const body = await req.json();
      
      if (body && typeof body === 'object') {
        // Handle different body formats
        if (typeof body === 'string') {
          // Raw body
          texts.push({ text: body, path: 'body' });
        } else if (body.message) {
          // Common pattern: { message: "..." }
          texts.push({ text: body.message, path: 'body.message' });
        } else if (body.text) {
          // Alternative: { text: "..." }
          texts.push({ text: body.text, path: 'body.text' });
        } else if (body.content) {
          // Alternative: { content: "..." }
          texts.push({ text: body.content, path: 'body.content' });
        } else if (body.query) {
          // GraphQL or search: { query: "..." }
          texts.push({ text: body.query, path: 'body.query' });
        } else {
          // Scan all string fields in body
          for (const [key, value] of Object.entries(body)) {
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
    } catch (error) {
      // Body parsing failed or body already consumed - skip
    }
  }
  
  return texts;
}

/**
 * Default block handler
 * @param {object} result - Scan result
 * @param {object} c - Hono context
 */
function defaultBlockHandler(result, c) {
  return c.json({
    error: 'Request blocked by security policy',
    message: result.message,
    action: result.action,
    intent: result.intent,
    riskScore: result.riskScore
  }, 403);
}

/**
 * Default warn handler
 * @param {object} result - Scan result
 * @param {object} c - Hono context
 * @param {function} next - Hono next function
 */
async function defaultWarnHandler(result, c, next) {
  // Attach warning to context for logging/monitoring
  c.set('securityWarning', {
    intent: result.intent,
    riskScore: result.riskScore,
    message: result.message,
    flags: result.layers?.heuristic?.flags || []
  });
  await next();
}

/**
 * Create Hono middleware for hopeIDS
 * 
 * @param {object} options - Configuration options
 * @param {number} [options.threshold=0.7] - Risk threshold (0-1) for blocking
 * @param {boolean} [options.semanticEnabled=false] - Enable LLM-based semantic analysis
 * @param {string} [options.llmEndpoint] - LLM API endpoint
 * @param {string} [options.llmModel] - LLM model name
 * @param {string} [options.apiKey] - LLM API key
 * @param {object} [options.thresholds] - Custom action thresholds { warn, block, quarantine }
 * @param {boolean} [options.strictMode=false] - Use strict mode (lower thresholds)
 * @param {function} [options.onBlock] - Custom block handler (result, c)
 * @param {function} [options.onWarn] - Custom warn handler (result, c, next)
 * @param {function} [options.getSenderId] - Extract sender ID from context (c => string)
 * @param {boolean} [options.scanQuery=true] - Scan query parameters
 * @param {boolean} [options.scanBody=true] - Scan request body
 * @param {string} [options.logLevel='info'] - Log level
 * @returns {function} Hono middleware function
 * 
 * @example
 * // Basic usage
 * import { Hono } from 'hono';
 * import { honoMiddleware } from 'hopeid';
 * 
 * const app = new Hono();
 * app.use(honoMiddleware({ threshold: 0.7 }));
 * 
 * @example
 * // Custom handlers
 * app.use(honoMiddleware({
 *   threshold: 0.8,
 *   onWarn: (result, c, next) => {
 *     console.warn('Security warning:', result.intent);
 *     c.set('securityWarning', result);
 *     return next();
 *   },
 *   onBlock: (result, c) => {
 *     return c.text('Forbidden', 403);
 *   }
 * }));
 * 
 * @example
 * // With semantic analysis and custom sender ID
 * app.use(honoMiddleware({
 *   semanticEnabled: true,
 *   llmEndpoint: 'http://localhost:1234/v1/chat/completions',
 *   llmModel: 'qwen2.5-32b',
 *   getSenderId: (c) => c.get('user')?.id || c.req.header('x-forwarded-for') || 'anonymous'
 * }));
 */
function honoMiddleware(options = {}) {
  // Extract middleware-specific options
  const {
    threshold = 0.7,
    onBlock = defaultBlockHandler,
    onWarn = defaultWarnHandler,
    getSenderId = (c) => {
      const user = c.get('user');
      return user?.id || c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'anonymous';
    },
    scanQuery = true,
    scanBody = true,
    ...idsOptions
  } = options;
  
  // Create hopeIDS instance
  const ids = new HopeIDS({
    semanticEnabled: false,  // Default to fast heuristic-only
    strictMode: false,
    ...idsOptions
  });
  
  // Return middleware function
  return async function hopeIDSMiddleware(c, next) {
    try {
      const req = c.req;
      
      // Extract texts to scan
      const textsToScan = [];
      
      if (scanQuery) {
        const query = req.query();
        if (query && Object.keys(query).length > 0) {
          for (const [key, value] of Object.entries(query)) {
            if (typeof value === 'string' && value.length > 0) {
              textsToScan.push({ text: value, path: `query.${key}` });
            }
          }
        }
      }
      
      if (scanBody) {
        const bodyTexts = await extractTexts(c);
        textsToScan.push(...bodyTexts);
      }
      
      // Skip if nothing to scan
      if (textsToScan.length === 0) {
        return await next();
      }
      
      // Scan each text segment
      for (const { text, path } of textsToScan) {
        const result = await ids.scan(text, {
          source: detectSource(req),
          senderId: getSenderId(c),
          metadata: {
            path,
            method: req.method,
            url: req.url,
            ip: c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip'),
            userAgent: req.header('user-agent')
          }
        });
        
        // Handle based on action
        if (result.action === 'block' || result.action === 'quarantine') {
          // Block the request
          return onBlock(result, c);
        } else if (result.action === 'warn') {
          // Warn but continue
          return await onWarn(result, c, next);
        }
      }
      
      // All scans passed - allow request
      await next();
      
    } catch (error) {
      // Handle errors gracefully - fail open to avoid breaking the app
      console.error('[hopeIDS] Middleware error:', error.message);
      await next();
    }
  };
}

module.exports = { honoMiddleware, detectSource, extractTexts };
