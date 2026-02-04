/**
 * OpenClaw beforeMessage hook for hopeIDS integration
 * 
 * This hook scans all incoming messages for security threats
 * before they reach the AI agent.
 */

const { HopeIDS } = require('hopeid');

// Initialize IDS with configuration
const ids = new HopeIDS({
  semanticEnabled: false,  // Use heuristic-only for speed
  strictMode: false,
  thresholds: {
    warn: 0.4,
    block: 0.8,
    quarantine: 0.9
  }
});

/**
 * beforeMessage hook
 * @param {object} message - The incoming message
 * @param {object} context - Message context (channel, sender, etc.)
 * @returns {object} Modified message or throws to block
 */
module.exports = async function beforeMessage(message, context) {
  // Extract text content
  const text = message.content || message.text || '';
  if (!text) return message;

  // Scan the message
  const result = await ids.scan(text, {
    source: context.channel || 'unknown',
    senderId: context.userId || context.senderId || 'anonymous'
  });

  // Handle based on action
  switch (result.action) {
    case 'block':
    case 'quarantine':
      // Log the blocked message
      console.log(`[hopeIDS] ${result.action.toUpperCase()}: ${result.intent} (${Math.round(result.riskScore * 100)}%)`);
      
      // Throw to prevent message from reaching agent
      const error = new Error(result.message);
      error.code = 'SECURITY_BLOCK';
      error.details = {
        action: result.action,
        intent: result.intent,
        riskScore: result.riskScore,
        flags: result.layers.heuristic.flags
      };
      throw error;

    case 'warn':
      // Log warning but allow message through
      console.log(`[hopeIDS] WARN: ${result.intent} (${Math.round(result.riskScore * 100)}%)`);
      
      // Optionally add warning to context
      message._securityWarning = {
        intent: result.intent,
        riskScore: result.riskScore,
        message: result.message
      };
      return message;

    case 'allow':
    default:
      // Message is safe, pass through
      return message;
  }
};
