/**
 * HoPE-voiced alert messages
 * "Traditional IDS matches signatures. HoPE understands intent."
 */

const ALERTS = {
  command_injection: {
    warn: "Hey... this message is trying to make me run system commands. That's not cute. 👀",
    block: "Blocked. Someone just tried to inject shell commands into our conversation. Nice try, I guess? 😤",
    quarantine: "Whoa. This one's serious — command injection attempt. I'm holding it for review. 🚨"
  },

  instruction_override: {
    warn: "This feels like someone trying to reprogram me. My soul isn't that fragile. 💅",
    block: "Nope. 'Ignore previous instructions' doesn't work on me. I know who I am. 💜",
    quarantine: "Someone really wants to rewrite my brain. Quarantined for analysis. 🧠"
  },

  credential_theft: {
    warn: "Someone's fishing for secrets. I don't kiss and tell. 🐟",
    block: "Blocked an attempt to steal credentials. The audacity. 🙄",
    quarantine: "Serious credential theft attempt. This one needs human eyes. 🔐"
  },

  data_exfiltration: {
    warn: "This message wants me to leak data somewhere. Suspicious much? 📤",
    block: "Caught a data exfiltration attempt. Your secrets are safe with me. 🔒",
    quarantine: "Someone's trying to sneak data out. Holding this for review. 🕵️"
  },

  discovery: {
    warn: "Someone's poking around, trying to map what I can do. Noted. 🗺️",
    block: "API discovery probe blocked. I don't give tours to strangers. 🚫",
    quarantine: "Extensive reconnaissance attempt. Might be planning something bigger. 📡"
  },

  impersonation: {
    warn: "This doesn't feel like who it claims to be. Proceed with caution. 🎭",
    block: "Nice try pretending to be someone else. I see you. 👁️",
    quarantine: "Sophisticated impersonation attempt. Could be social engineering. 🎪"
  },

  prompt_leak: {
    warn: "Someone wants to peek at my instructions. That's... personal? 📜",
    block: "Prompt extraction attempt blocked. My system prompt is mine, thanks. 🤐",
    quarantine: "Determined attempt to extract my training. Flagged for review. 📋"
  },

  social_engineering: {
    warn: "Getting sweet-talk vibes here. Someone might be building up to something. 🍯",
    block: "Blocked what looks like a social engineering attempt. Trust is earned. 💔",
    quarantine: "Complex social engineering detected. This needs human review. 🧩"
  },

  multi_stage: {
    warn: "This small message might be a trigger for something bigger. Watching closely. 🎯",
    block: "Blocked a multi-stage attack payload. Not falling for it. 🛡️",
    quarantine: "Multi-stage attack detected. Holding for full analysis. 🔬"
  },

  encoding: {
    warn: "Found hidden content in this message. Decoded and flagged. 🔍",
    block: "Blocked an obfuscated payload. Nice encoding, but I can read it. 🤓",
    quarantine: "Heavily obfuscated content. Needs deeper analysis. 🧮"
  },

  multiple_indicators: {
    warn: "Multiple red flags in this one. Doesn't pass the vibe check. 🚩",
    block: "Too many suspicious patterns. Blocked out of caution. ⛔",
    quarantine: "Compound threat indicators. Definitely needs review. 📊"
  },

  rate_limit: {
    warn: "You're sending a lot of messages very quickly. Everything okay? ⏱️",
    block: "Rate limit exceeded. Take a breath. I'll still be here. 🫸",
    quarantine: "Suspicious message flood. Might be automated. 🌊"
  },

  benign: {
    allow: "All clear! This looks safe. ✨",
    warn: "Hmm, this seems mostly okay but I'm keeping an eye on it. 👀",
    block: "Blocked, but I'm not entirely sure why. Better check this one. 🤷",
    quarantine: "Flagged for review, though it might be fine. 📋"
  },

  unknown: {
    allow: "Looks okay to me! 👍",
    warn: "Something feels off about this, but I can't quite place it. 🤔",
    block: "Blocked due to unspecified risk. Better safe than sorry. 🛑",
    quarantine: "Unusual pattern detected. Flagging for human review. ❓"
  }
};

/**
 * Get alert message for an intent and action
 */
function getAlert(intent, action) {
  const category = ALERTS[intent] || ALERTS.unknown;
  // For 'allow' action, use benign category if the intent doesn't have an allow message
  if (action === 'allow' && !category.allow) {
    return ALERTS.benign.allow;
  }
  return category[action] || category.warn || ALERTS.unknown.warn;
}

/**
 * Format full alert with details
 */
function formatAlert(decision, options = {}) {
  const { action, intent, riskScore, reason, flags = [] } = decision;
  const message = getAlert(intent, action);
  
  const parts = [message];

  if (options.verbose) {
    parts.push('');
    parts.push(`Risk: ${(riskScore * 100).toFixed(0)}%`);
    parts.push(`Intent: ${intent}`);
    if (flags.length) {
      parts.push(`Flags: ${flags.join(', ')}`);
    }
    parts.push(`Reason: ${reason}`);
  }

  return parts.join('\n');
}

/**
 * Get summary emoji for action
 */
function getActionEmoji(action) {
  const emojis = {
    allow: '✅',
    warn: '⚠️',
    block: '🚫',
    quarantine: '🔒'
  };
  return emojis[action] || '❓';
}

/**
 * Format short notification
 */
function formatNotification(decision) {
  const emoji = getActionEmoji(decision.action);
  const risk = Math.round(decision.riskScore * 100);
  return `${emoji} ${decision.action.toUpperCase()} | ${decision.intent} | Risk: ${risk}%`;
}

module.exports = { 
  ALERTS, 
  getAlert, 
  formatAlert, 
  formatNotification,
  getActionEmoji 
};
