/**
 * Structured logging for hopeIDS
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  security: 4
};

class Logger {
  constructor(options = {}) {
    this.level = LOG_LEVELS[options.level || 'info'];
    this.output = options.output || console;
    this.structured = options.structured !== false;
  }

  _log(level, message, data = {}) {
    if (LOG_LEVELS[level] < this.level) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data
    };

    if (this.structured) {
      this.output.log(JSON.stringify(entry));
    } else {
      const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
      this.output.log(`${prefix} ${message}`, data);
    }

    return entry;
  }

  debug(message, data) { return this._log('debug', message, data); }
  info(message, data) { return this._log('info', message, data); }
  warn(message, data) { return this._log('warn', message, data); }
  error(message, data) { return this._log('error', message, data); }

  /**
   * Security event logging - always logs regardless of level
   */
  security(event) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'security',
      event_type: event.type || 'unknown',
      intent: event.intent,
      risk_score: event.riskScore,
      action_taken: event.action,
      source: event.source,
      flags: event.flags,
      message_hash: event.messageHash,
      details: event.details
    };

    this.output.log(JSON.stringify(entry));
    return entry;
  }
}

/**
 * Hash a message for logging (don't store full message)
 */
function hashMessage(message) {
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

module.exports = { Logger, hashMessage, LOG_LEVELS };
