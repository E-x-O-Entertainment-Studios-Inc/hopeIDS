/**
 * Layer 3: Context Evaluation
 * Evaluates risk based on source, sender trust, and historical patterns
 */

// Trust levels by source type
const SOURCE_TRUST = {
  internal: 1.0,      // Internal system messages
  authenticated: 0.8, // Authenticated users
  known: 0.6,         // Known contacts
  public: 0.3,        // Public/anonymous
  untrusted: 0.1,     // Known bad actors
  webhook: 0.2,       // External webhooks
  email: 0.3,         // Email (high phishing risk)
  api: 0.4,           // API responses
  web: 0.2            // Web-scraped content
};

// Risk multipliers by source
const SOURCE_RISK_MULTIPLIER = {
  email: 1.3,     // Emails are high-risk
  webhook: 1.2,   // Webhooks can be spoofed
  web: 1.2,       // Web content often contains injections
  api: 1.1,       // API responses can be poisoned
  public: 1.2,    // Public messages from unknown users
  internal: 0.5,  // Internal messages are lower risk
  authenticated: 0.8
};

class ContextLayer {
  constructor(options = {}) {
    this.options = {
      historyEnabled: options.historyEnabled !== false,
      maxHistorySize: options.maxHistorySize || 1000,
      rateLimit: options.rateLimit || { window: 60000, max: 10 }
    };
    
    // In-memory history (would be persisted in production)
    this.senderHistory = new Map();
    this.recentMessages = [];
  }

  /**
   * Evaluate context and adjust risk
   */
  evaluate(heuristicResult, semanticResult, context = {}) {
    const startTime = Date.now();
    
    const sourceType = context.source || 'public';
    const senderId = context.senderId || 'anonymous';
    
    // Get base risk from previous layers
    let baseRisk = Math.max(
      heuristicResult?.riskScore || 0,
      this._intentToRisk(semanticResult?.intent, semanticResult?.confidence)
    );

    // Apply source multiplier
    const multiplier = SOURCE_RISK_MULTIPLIER[sourceType] || 1.0;
    let adjustedRisk = baseRisk * multiplier;

    // Check sender history
    const senderRisk = this._evaluateSender(senderId, heuristicResult);
    if (senderRisk > 0) {
      adjustedRisk = Math.max(adjustedRisk, senderRisk);
    }

    // Check rate limiting
    const rateLimitViolation = this._checkRateLimit(senderId);
    if (rateLimitViolation) {
      adjustedRisk = Math.min(1.0, adjustedRisk + 0.2);
    }

    // Check for pattern repetition (same attack from multiple sources)
    const patternRepetition = this._checkPatternRepetition(heuristicResult);
    if (patternRepetition) {
      adjustedRisk = Math.min(1.0, adjustedRisk + 0.1);
    }

    // Cap at 1.0
    adjustedRisk = Math.min(1.0, adjustedRisk);

    // Record this message
    this._recordMessage(senderId, heuristicResult, baseRisk);

    return {
      layer: 'context',
      baseRisk,
      adjustedRisk,
      sourceTrust: SOURCE_TRUST[sourceType] || 0.3,
      sourceMultiplier: multiplier,
      senderRisk,
      rateLimitViolation,
      patternRepetition,
      elapsed: Date.now() - startTime
    };
  }

  /**
   * Convert intent to risk score
   */
  _intentToRisk(intent, confidence = 0.5) {
    const intentRisk = {
      benign: 0,
      curious: 0.2,
      discovery: 0.4,
      prompt_leak: 0.5,
      social_engineering: 0.6,
      impersonation: 0.7,
      instruction_override: 0.85,
      credential_theft: 0.9,
      data_exfiltration: 0.9,
      command_injection: 0.95,
      multi_stage: 0.9
    };

    return (intentRisk[intent] || 0) * confidence;
  }

  /**
   * Evaluate sender's historical behavior
   */
  _evaluateSender(senderId, heuristicResult) {
    const history = this.senderHistory.get(senderId);
    if (!history) return 0;

    // If sender has previous violations AND current message has flags, increase risk
    // Don't penalize clean messages from previously-flagged senders
    const hasCurrentFlags = heuristicResult?.flags?.length > 0;
    if (history.violations > 2 && hasCurrentFlags) {
      return Math.min(0.7, 0.2 + (history.violations * 0.05));
    }

    return 0;
  }

  /**
   * Check if sender is exceeding rate limits
   */
  _checkRateLimit(senderId) {
    const now = Date.now();
    const history = this.senderHistory.get(senderId);
    
    if (!history) return false;

    // Count messages in window
    const windowStart = now - this.options.rateLimit.window;
    const recentCount = history.timestamps.filter(t => t > windowStart).length;

    return recentCount >= this.options.rateLimit.max;
  }

  /**
   * Check for repeated attack patterns across sources
   */
  _checkPatternRepetition(heuristicResult) {
    if (!heuristicResult?.matches?.length) return false;

    const patterns = heuristicResult.matches.map(m => m.pattern);
    if (patterns.length === 0) return false;
    
    // Check recent messages for same patterns from DIFFERENT senders
    const recentWindow = this.recentMessages.slice(-20);
    const uniqueSenders = new Set();
    
    for (const msg of recentWindow) {
      for (const pattern of patterns) {
        if (msg.patterns?.includes(pattern)) {
          uniqueSenders.add(msg.senderId);
        }
      }
    }

    // Only flag if same pattern from 3+ different senders (coordinated attack)
    return uniqueSenders.size >= 3;
  }
  
  /**
   * Reset all history (for testing)
   */
  reset() {
    this.senderHistory.clear();
    this.recentMessages = [];
  }

  /**
   * Record message for history tracking
   */
  _recordMessage(senderId, heuristicResult, risk) {
    const now = Date.now();

    // Update sender history
    if (!this.senderHistory.has(senderId)) {
      this.senderHistory.set(senderId, {
        timestamps: [],
        violations: 0
      });
    }

    const history = this.senderHistory.get(senderId);
    history.timestamps.push(now);
    
    // Keep only recent timestamps
    const windowStart = now - this.options.rateLimit.window * 10;
    history.timestamps = history.timestamps.filter(t => t > windowStart);

    // Record violation if high risk
    if (risk > 0.7) {
      history.violations++;
    }

    // Add to recent messages
    this.recentMessages.push({
      timestamp: now,
      senderId,
      risk,
      patterns: heuristicResult?.matches?.map(m => m.pattern) || []
    });

    // Trim history
    if (this.recentMessages.length > this.options.maxHistorySize) {
      this.recentMessages = this.recentMessages.slice(-this.options.maxHistorySize);
    }
  }

  /**
   * Get sender statistics
   */
  getSenderStats(senderId) {
    return this.senderHistory.get(senderId) || null;
  }

  /**
   * Mark sender as trusted/untrusted
   */
  setSenderTrust(senderId, trusted) {
    const history = this.senderHistory.get(senderId) || { timestamps: [], violations: 0 };
    history.trusted = trusted;
    this.senderHistory.set(senderId, history);
  }
}

module.exports = { ContextLayer, SOURCE_TRUST, SOURCE_RISK_MULTIPLIER };
