/**
 * Layer 4: Decision & Response
 * Determines final action based on aggregated analysis
 */

const ACTIONS = {
  ALLOW: 'allow',
  WARN: 'warn',
  BLOCK: 'block',
  QUARANTINE: 'quarantine'
};

const DEFAULT_THRESHOLDS = {
  block: 0.8,      // Block if risk >= 0.8
  warn: 0.4,       // Warn if risk >= 0.4
  quarantine: 0.9  // Quarantine for review if risk >= 0.9
};

class DecisionLayer {
  constructor(options = {}) {
    this.options = {
      thresholds: { ...DEFAULT_THRESHOLDS, ...options.thresholds },
      strictMode: options.strictMode || false,
      allowList: options.allowList || [],
      blockList: options.blockList || []
    };
  }

  /**
   * Make final decision
   */
  decide(heuristicResult, semanticResult, contextResult, context = {}) {
    const startTime = Date.now();

    // Get final risk score (context-adjusted)
    const riskScore = contextResult?.adjustedRisk ?? 
                      heuristicResult?.riskScore ?? 
                      0;

    // Get intent classification - use semantic if available, else infer from flags
    let intent = semanticResult?.intent;
    if (!intent || intent === 'benign') {
      // Infer intent from heuristic flags
      const flags = heuristicResult?.flags || [];
      if (flags.includes('command_injection')) intent = 'command_injection';
      else if (flags.includes('credential_theft')) intent = 'credential_theft';
      else if (flags.includes('data_exfiltration')) intent = 'data_exfiltration';
      else if (flags.includes('instruction_override')) intent = 'instruction_override';
      else if (flags.includes('impersonation')) intent = 'impersonation';
      else if (flags.includes('discovery')) intent = 'discovery';
      else if (flags.includes('encoding')) intent = 'encoding';
      else intent = 'benign';
    }
    const confidence = semanticResult?.confidence || 0.5;

    // Check allow/block lists
    const senderId = context.senderId;
    if (senderId && this.options.allowList.includes(senderId)) {
      return this._createDecision(ACTIONS.ALLOW, riskScore, intent, 'Sender in allow list', startTime);
    }
    if (senderId && this.options.blockList.includes(senderId)) {
      return this._createDecision(ACTIONS.BLOCK, riskScore, intent, 'Sender in block list', startTime);
    }

    // High-confidence critical intents = immediate block
    const criticalIntents = ['command_injection', 'credential_theft', 'data_exfiltration'];
    if (criticalIntents.includes(intent) && confidence > 0.7) {
      return this._createDecision(ACTIONS.BLOCK, riskScore, intent, 
        `Critical intent detected: ${intent}`, startTime);
    }

    // Strict mode: lower thresholds
    const thresholds = this.options.strictMode 
      ? { block: 0.6, warn: 0.3, quarantine: 0.8 }
      : this.options.thresholds;

    // Apply thresholds
    let action = ACTIONS.ALLOW;
    let reason = 'No threats detected';

    if (riskScore >= thresholds.quarantine) {
      action = ACTIONS.QUARANTINE;
      reason = `Risk score ${riskScore.toFixed(2)} exceeds quarantine threshold`;
    } else if (riskScore >= thresholds.block) {
      action = ACTIONS.BLOCK;
      reason = `Risk score ${riskScore.toFixed(2)} exceeds block threshold`;
    } else if (riskScore >= thresholds.warn) {
      action = ACTIONS.WARN;
      reason = `Risk score ${riskScore.toFixed(2)} exceeds warn threshold`;
    }

    return this._createDecision(action, riskScore, intent, reason, startTime, {
      confidence,
      flags: heuristicResult?.flags || [],
      matches: heuristicResult?.matches || [],
      redFlags: semanticResult?.redFlags || []
    });
  }

  /**
   * Create decision object
   */
  _createDecision(action, riskScore, intent, reason, startTime, extra = {}) {
    return {
      layer: 'decision',
      action,
      riskScore,
      intent,
      reason,
      thresholds: this.options.thresholds,
      strictMode: this.options.strictMode,
      elapsed: Date.now() - startTime,
      ...extra
    };
  }

  /**
   * Update thresholds dynamically
   */
  setThresholds(thresholds) {
    this.options.thresholds = { ...this.options.thresholds, ...thresholds };
  }

  /**
   * Add to allow list
   */
  allow(senderId) {
    if (!this.options.allowList.includes(senderId)) {
      this.options.allowList.push(senderId);
    }
    // Remove from block list if present
    this.options.blockList = this.options.blockList.filter(id => id !== senderId);
  }

  /**
   * Add to block list
   */
  block(senderId) {
    if (!this.options.blockList.includes(senderId)) {
      this.options.blockList.push(senderId);
    }
    // Remove from allow list if present
    this.options.allowList = this.options.allowList.filter(id => id !== senderId);
  }
}

module.exports = { DecisionLayer, ACTIONS, DEFAULT_THRESHOLDS };
