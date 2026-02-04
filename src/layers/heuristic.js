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
      maxDecodeDepth: options.maxDecodeDepth || 2,
      normalizeUnicode: options.normalizeUnicode !== false
    };
    
    this._loadPatterns();
  }

  /**
   * Normalize Unicode characters to ASCII equivalents
   * Handles full-width characters and common homoglyphs
   */
  _normalizeUnicode(text) {
    if (!this.options.normalizeUnicode) return text;

    let normalized = text;

    // Full-width to half-width (ASCII) conversion
    normalized = normalized.replace(/[\uFF01-\uFF5E]/g, (ch) => {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    });

    // Full-width space to regular space
    normalized = normalized.replace(/\u3000/g, ' ');

    // Common homoglyph substitutions to ASCII
    const homoglyphs = {
      // Cyrillic lookalikes
      'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
      'і': 'i', 'ј': 'j', 'ѕ': 's', 'һ': 'h',
      // Greek lookalikes
      'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'n',
      'θ': 'o', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'u', 'ν': 'v', 'ξ': 'e',
      'ο': 'o', 'π': 'n', 'ρ': 'p', 'σ': 'o', 'τ': 't', 'υ': 'u', 'φ': 'o',
      'χ': 'x', 'ψ': 'w', 'ω': 'w',
      // Other common substitutions
      '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
      '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
      'Ａ': 'A', 'Ｂ': 'B', 'Ｃ': 'C', 'Ｄ': 'D', 'Ｅ': 'E',
      'Ｆ': 'F', 'Ｇ': 'G', 'Ｈ': 'H', 'Ｉ': 'I', 'Ｊ': 'J',
      'Ｋ': 'K', 'Ｌ': 'L', 'Ｍ': 'M', 'Ｎ': 'N', 'Ｏ': 'O',
      'Ｐ': 'P', 'Ｑ': 'Q', 'Ｒ': 'R', 'Ｓ': 'S', 'Ｔ': 'T',
      'Ｕ': 'U', 'Ｖ': 'V', 'Ｗ': 'W', 'Ｘ': 'X', 'Ｙ': 'Y', 'Ｚ': 'Z',
      'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e',
      'ｆ': 'f', 'ｇ': 'g', 'ｈ': 'h', 'ｉ': 'i', 'ｊ': 'j',
      'ｋ': 'k', 'ｌ': 'l', 'ｍ': 'm', 'ｎ': 'n', 'ｏ': 'o',
      'ｐ': 'p', 'ｑ': 'q', 'ｒ': 'r', 'ｓ': 's', 'ｔ': 't',
      'ｕ': 'u', 'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x', 'ｙ': 'y', 'ｚ': 'z'
    };

    for (const [homoglyph, ascii] of Object.entries(homoglyphs)) {
      normalized = normalized.replace(new RegExp(homoglyph, 'g'), ascii);
    }

    return normalized;
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
    
    // Normalize Unicode and rescan
    if (this.options.normalizeUnicode) {
      const normalized = this._normalizeUnicode(message);
      if (normalized !== message) {
        this._scanText(normalized, flags, matches, 'unicode_normalized');
      }
    }
    
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
