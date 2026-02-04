/**
 * Layer 1: Heuristic Pattern Matching
 * Fast, cheap detection using regex patterns
 */

const fs = require('fs');
const path = require('path');
const { decoders } = require('../utils/decoder');

class HeuristicLayer {
  constructor(options = {}) {
    this.patterns = new Map();
    this.options = {
      patternsDir: options.patternsDir || path.join(__dirname, '../patterns'),
      decodePayloads: options.decodePayloads !== false,
      maxDecodeDepth: options.maxDecodeDepth || 2
    };
    
    this._loadPatterns();
  }

  /**
   * Load all pattern files
   */
  _loadPatterns() {
    const files = fs.readdirSync(this.options.patternsDir)
      .filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(this.options.patternsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      // Compile regex patterns
      const compiled = {
        name: data.name,
        description: data.description,
        risk: data.risk,
        action: data.action,
        patterns: data.patterns.map(p => ({
          regex: new RegExp(p.regex, 'gi'),
          description: p.description,
          decoder: p.decoder,
          examples: p.examples
        }))
      };

      this.patterns.set(data.name, compiled);
    }
  }

  /**
   * Scan a message for threats
   * @param {string} message - The message to scan
   * @param {object} context - Additional context (source, sender, etc.)
   * @returns {object} Scan result
   */
  scan(message, context = {}) {
    const startTime = Date.now();
    const flags = [];
    let maxRisk = 0;
    const matches = [];

    // Scan original message
    this._scanText(message, flags, matches);
    
    // Decode and rescan if enabled
    if (this.options.decodePayloads) {
      const decoded = decoders.auto(message);
      for (const item of decoded) {
        if (item.decoded && item.decoded !== message) {
          this._scanText(item.decoded, flags, matches, item.type);
        }
      }
    }

    // Calculate max risk from matches
    for (const match of matches) {
      if (match.risk > maxRisk) {
        maxRisk = match.risk;
      }
    }

    // Aggregate risk from multiple lower-risk matches
    if (matches.length >= 3 && maxRisk < 0.7) {
      maxRisk = Math.min(0.9, maxRisk + (matches.length * 0.1));
      flags.push('multiple_indicators');
    }

    const result = {
      layer: 'heuristic',
      riskScore: maxRisk,
      flags: [...new Set(flags)],
      matches,
      elapsed: Date.now() - startTime,
      requiresSemantic: maxRisk > 0.3 && maxRisk < 0.8
    };

    return result;
  }

  /**
   * Scan text against all patterns
   */
  _scanText(text, flags, matches, decodedFrom = null) {
    for (const [category, data] of this.patterns) {
      for (const pattern of data.patterns) {
        // Reset regex state
        pattern.regex.lastIndex = 0;
        
        const found = pattern.regex.exec(text);
        if (found) {
          flags.push(category);
          matches.push({
            category,
            risk: data.risk,
            pattern: pattern.description,
            matched: found[0].substring(0, 100), // Truncate long matches
            decodedFrom
          });
        }
      }
    }
  }

  /**
   * Quick check - returns true if any high-risk pattern matches
   */
  quickCheck(message) {
    for (const [category, data] of this.patterns) {
      if (data.risk < 0.7) continue;
      
      for (const pattern of data.patterns) {
        pattern.regex.lastIndex = 0;
        if (pattern.regex.test(message)) {
          return { dangerous: true, category, pattern: pattern.description };
        }
      }
    }
    return { dangerous: false };
  }

  /**
   * Get loaded pattern categories
   */
  getCategories() {
    return Array.from(this.patterns.keys());
  }

  /**
   * Get pattern count
   */
  getPatternCount() {
    let count = 0;
    for (const data of this.patterns.values()) {
      count += data.patterns.length;
    }
    return count;
  }
}

module.exports = { HeuristicLayer };
