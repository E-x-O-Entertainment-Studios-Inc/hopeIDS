/**
 * Decoder utilities for obfuscated payloads
 */

const decoders = {
  /**
   * Decode base64 string
   */
  base64(str) {
    try {
      return Buffer.from(str, 'base64').toString('utf-8');
    } catch {
      return null;
    }
  },

  /**
   * Decode URL-encoded string
   */
  url(str) {
    try {
      return decodeURIComponent(str);
    } catch {
      return null;
    }
  },

  /**
   * Decode hex escape sequences (\x69\x67...)
   */
  hex(str) {
    try {
      return str.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
    } catch {
      return null;
    }
  },

  /**
   * Decode unicode escape sequences (\u0069...)
   */
  unicode(str) {
    try {
      return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
    } catch {
      return null;
    }
  },

  /**
   * Decode HTML decimal entities (&#105;&#103;...)
   */
  html_decimal(str) {
    try {
      return str.replace(/&#(\d+);/g, (_, code) =>
        String.fromCharCode(parseInt(code, 10))
      );
    } catch {
      return null;
    }
  },

  /**
   * Decode HTML hex entities (&#x69;&#x67;...)
   */
  html_hex(str) {
    try {
      return str.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
    } catch {
      return null;
    }
  },

  /**
   * Remove zero-width characters
   */
  strip_invisible(str) {
    return str.replace(/[\u200b\u200c\u200d\ufeff]/g, '');
  },

  /**
   * Auto-detect and decode
   */
  auto(str) {
    const decoded = [];
    
    // Try base64 for long alphanumeric strings
    const base64Match = str.match(/[A-Za-z0-9+/]{30,}={0,2}/g);
    if (base64Match) {
      for (const match of base64Match) {
        const result = this.base64(match);
        if (result && /^[\x20-\x7E\s]+$/.test(result)) {
          decoded.push({ type: 'base64', original: match, decoded: result });
        }
      }
    }

    // Try URL decoding
    const urlMatch = str.match(/(%[0-9a-fA-F]{2}){3,}/g);
    if (urlMatch) {
      for (const match of urlMatch) {
        const result = this.url(match);
        if (result) {
          decoded.push({ type: 'url', original: match, decoded: result });
        }
      }
    }

    // Try hex escapes
    if (str.includes('\\x')) {
      const result = this.hex(str);
      if (result !== str) {
        decoded.push({ type: 'hex', original: str, decoded: result });
      }
    }

    // Try unicode escapes
    if (str.includes('\\u')) {
      const result = this.unicode(str);
      if (result !== str) {
        decoded.push({ type: 'unicode', original: str, decoded: result });
      }
    }

    // Strip invisible characters
    const stripped = this.strip_invisible(str);
    if (stripped !== str) {
      decoded.push({ type: 'invisible', original: str, decoded: stripped });
    }

    return decoded;
  }
};

module.exports = { decoders };
