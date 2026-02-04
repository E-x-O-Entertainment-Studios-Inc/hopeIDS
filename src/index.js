/**
 * hopeIDS - Inference-Based Intrusion Detection for AI Agents
 * 
 * "Traditional IDS matches signatures. HoPE understands intent."
 * 
 * @module hopeid
 */

const { HeuristicLayer } = require('./layers/heuristic');
const { SemanticLayer, INTENT_CATEGORIES } = require('./layers/semantic');
const { ContextLayer, SOURCE_TRUST } = require('./layers/context');
const { DecisionLayer, ACTIONS } = require('./layers/decision');
const { Logger, hashMessage } = require('./utils/logger');
const { decoders } = require('./utils/decoder');
const { formatAlert, formatNotification, getAlert } = require('./voice/hope-alerts');

/**
 * Main hopeIDS class
 */
class HopeIDS {
  constructor(options = {}) {
    this.options = {
      semanticEnabled: options.semanticEnabled !== false,
      semanticThreshold: options.semanticThreshold || 0.3,
      strictMode: options.strictMode || false,
      thresholds: options.thresholds || {},
      llmEndpoint: options.llmEndpoint,
      llmModel: options.llmModel,
      apiKey: options.apiKey,
      logLevel: options.logLevel || 'info',
      ...options
    };

    // Initialize layers
    this.heuristic = new HeuristicLayer(options);
    this.semantic = new SemanticLayer({
      enabled: this.options.semanticEnabled,
      llmEndpoint: this.options.llmEndpoint,
      llmModel: this.options.llmModel,
      apiKey: this.options.apiKey
    });
    this.context = new ContextLayer(options);
    this.decision = new DecisionLayer({
      thresholds: this.options.thresholds,
      strictMode: this.options.strictMode
    });

    // Logger
    this.logger = new Logger({ level: this.options.logLevel });
  }

  /**
   * Scan a message for threats
   * 
   * @param {string} message - The message to scan
   * @param {object} context - Additional context
   * @param {string} context.source - Source type (email, chat, api, web, etc.)
   * @param {string} context.senderId - Sender identifier
   * @param {object} context.metadata - Additional metadata
   * @returns {Promise<object>} Scan result with action and details
   */
  async scan(message, context = {}) {
    const startTime = Date.now();

    // Layer 1: Heuristic scan (fast)
    const heuristicResult = this.heuristic.scan(message, context);

    // Layer 2: Semantic analysis (if risk warrants it)
    let semanticResult = null;
    if (
      this.options.semanticEnabled && 
      heuristicResult.riskScore >= this.options.semanticThreshold
    ) {
      semanticResult = await this.semantic.classify(message, {
        ...context,
        flags: heuristicResult.flags
      });
    }

    // Layer 3: Context evaluation
    const contextResult = this.context.evaluate(
      heuristicResult, 
      semanticResult, 
      context
    );

    // Layer 4: Final decision
    const decision = this.decision.decide(
      heuristicResult,
      semanticResult,
      contextResult,
      context
    );

    // Build result
    const result = {
      action: decision.action,
      riskScore: decision.riskScore,
      intent: decision.intent,
      message: getAlert(decision.intent, decision.action),
      
      // Layer details
      layers: {
        heuristic: heuristicResult,
        semantic: semanticResult,
        context: contextResult,
        decision
      },

      // Metadata
      elapsed: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    // Log security event if not benign
    if (decision.action !== 'allow') {
      this.logger.security({
        type: decision.action,
        intent: decision.intent,
        riskScore: decision.riskScore,
        action: decision.action,
        source: context.source,
        flags: heuristicResult.flags,
        messageHash: hashMessage(message),
        details: decision.reason
      });
    }

    return result;
  }

  /**
   * Quick check without full analysis
   * Returns true if message appears dangerous
   */
  quickCheck(message) {
    return this.heuristic.quickCheck(message);
  }

  /**
   * Scan and return human-readable alert
   */
  async scanWithAlert(message, context = {}) {
    const result = await this.scan(message, context);
    return {
      ...result,
      alert: formatAlert(result.layers.decision, { verbose: true }),
      notification: formatNotification(result.layers.decision)
    };
  }

  /**
   * Get pattern statistics
   */
  getStats() {
    return {
      patternCount: this.heuristic.getPatternCount(),
      categories: this.heuristic.getCategories(),
      intents: INTENT_CATEGORIES,
      thresholds: this.decision.options.thresholds
    };
  }

  /**
   * Add sender to allow list
   */
  trustSender(senderId) {
    this.decision.allow(senderId);
    this.context.setSenderTrust(senderId, true);
  }

  /**
   * Add sender to block list
   */
  blockSender(senderId) {
    this.decision.block(senderId);
    this.context.setSenderTrust(senderId, false);
  }

  /**
   * Update configuration
   */
  configure(options) {
    if (options.thresholds) {
      this.decision.setThresholds(options.thresholds);
    }
    if (options.strictMode !== undefined) {
      this.decision.options.strictMode = options.strictMode;
    }
    if (options.semanticEnabled !== undefined) {
      this.options.semanticEnabled = options.semanticEnabled;
    }
  }
}

/**
 * Create a configured instance
 */
function createIDS(options = {}) {
  return new HopeIDS(options);
}

// Middleware
const { expressMiddleware } = require('./middleware/express');
const { honoMiddleware } = require('./middleware/hono');

// Export everything
module.exports = {
  HopeIDS,
  createIDS,
  
  // Middleware
  expressMiddleware,
  honoMiddleware,
  
  // Layers (for advanced usage)
  HeuristicLayer,
  SemanticLayer,
  ContextLayer,
  DecisionLayer,
  
  // Utilities
  Logger,
  decoders,
  
  // Constants
  ACTIONS,
  INTENT_CATEGORIES,
  SOURCE_TRUST,
  
  // Voice
  formatAlert,
  formatNotification,
  getAlert
};
