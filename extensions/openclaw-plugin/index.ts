/**
 * hopeIDS OpenClaw Plugin
 * 
 * Inference-based intrusion detection for AI agent messages.
 * "Traditional IDS matches signatures. HoPE understands intent."
 * 
 * Features:
 * - `security_scan` tool for manual scans
 * - `/scan` command for quick checks
 * - Auto-scan: automatically scan messages before agent processing
 */

interface PluginConfig {
  enabled?: boolean;
  autoScan?: boolean;
  strictMode?: boolean;
  semanticEnabled?: boolean;
  llmEndpoint?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  trustOwners?: boolean;
}

interface PluginApi {
  config: {
    plugins?: {
      entries?: {
        hopeids?: {
          config?: PluginConfig;
        };
      };
    };
    ownerNumbers?: string[];
  };
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug: (msg: string) => void;
  };
  registerTool: (tool: any) => void;
  registerCommand: (cmd: any) => void;
  registerService: (svc: any) => void;
  registerGatewayMethod: (name: string, handler: any) => void;
  on: (event: string, handler: (event: any) => Promise<any>) => void;
}

// Lazy-loaded IDS instance
let ids: any = null;
let HopeIDSModule: any = null;

async function loadHopeIDS() {
  if (HopeIDSModule) return HopeIDSModule;
  
  try {
    // Try npm package first (when installed)
    HopeIDSModule = await import('hopeid');
  } catch {
    // Fall back to relative path (local dev)
    HopeIDSModule = await import('../../src/index.js');
  }
  return HopeIDSModule;
}

async function ensureIDS(cfg: PluginConfig) {
  if (ids) return ids;
  
  const mod = await loadHopeIDS();
  ids = mod.createIDS({
    strictMode: cfg.strictMode ?? false,
    semanticEnabled: cfg.semanticEnabled ?? false,
    llmEndpoint: cfg.llmEndpoint,
    logLevel: cfg.logLevel ?? 'info',
  });
  return ids;
}

export default function register(api: PluginApi) {
  const cfg = api.config.plugins?.entries?.hopeids?.config ?? {};
  
  if (cfg.enabled === false) {
    api.logger.info('[hopeIDS] Plugin disabled');
    return;
  }

  const autoScan = cfg.autoScan ?? false;
  const ownerNumbers = api.config.ownerNumbers ?? [];

  // Initialize asynchronously
  loadHopeIDS().then(({ createIDS }) => {
    ids = createIDS({
      strictMode: cfg.strictMode ?? false,
      semanticEnabled: cfg.semanticEnabled ?? false,
      llmEndpoint: cfg.llmEndpoint,
      logLevel: cfg.logLevel ?? 'info',
    });

    api.logger.info(`[hopeIDS] Initialized with ${ids.getStats().patternCount} patterns (autoScan=${autoScan})`);
  }).catch((err: Error) => {
    api.logger.error(`[hopeIDS] Failed to load: ${err.message}`);
  });

  // ============================================================================
  // Auto-Scan: scan messages before agent processes them
  // ============================================================================

  if (autoScan) {
    api.on('before_agent_start', async (event: { prompt?: string; senderId?: string; source?: string }) => {
      // Skip if no prompt or too short
      if (!event.prompt || event.prompt.length < 5) {
        return;
      }

      // Skip heartbeats and system prompts
      if (event.prompt.startsWith('HEARTBEAT') || event.prompt.includes('NO_REPLY')) {
        return;
      }

      // Skip trusted owners
      const isTrustedOwner = cfg.trustOwners !== false && event.senderId && ownerNumbers.includes(event.senderId);
      if (isTrustedOwner) {
        api.logger.debug?.('[hopeIDS] Skipping auto-scan for trusted owner');
        return;
      }

      try {
        await ensureIDS(cfg);
        
        const result = await ids.scanWithAlert(event.prompt, {
          source: event.source ?? 'auto-scan',
          senderId: event.senderId,
        });

        api.logger.info(`[hopeIDS] Auto-scan: action=${result.action}, risk=${result.riskScore}`);

        if (result.action === 'block') {
          // Block the message entirely
          api.logger.warn(`[hopeIDS] 🛑 BLOCKED: ${result.intent}`);
          return {
            blocked: true,
            blockReason: result.notification || result.message,
            prependContext: `<security-alert severity="critical">\n🛑 This message was flagged as a potential security threat.\nIntent: ${result.intent}\nRisk: ${(result.riskScore * 100).toFixed(0)}%\n${result.message}\n</security-alert>`,
          };
        } else if (result.action === 'warn') {
          // Warn but allow processing
          api.logger.warn(`[hopeIDS] ⚠️ WARNING: ${result.intent}`);
          return {
            prependContext: `<security-alert severity="warning">\n⚠️ Potential security concern detected.\nIntent: ${result.intent}\nRisk: ${(result.riskScore * 100).toFixed(0)}%\nProceed with caution.\n</security-alert>`,
          };
        }
        
        // Clean - no injection needed
      } catch (err: any) {
        api.logger.warn(`[hopeIDS] Auto-scan failed: ${err.message}`);
      }
    });
  }

  // ============================================================================
  // Tool: security_scan
  // ============================================================================

  api.registerTool({
    name: 'security_scan',
    description: 'Scan a message for potential security threats (prompt injection, jailbreaks, command injection, etc.)',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to scan for threats',
        },
        source: {
          type: 'string',
          description: 'Source of the message (e.g., moltbook, telegram, email)',
          default: 'unknown',
        },
        senderId: {
          type: 'string',
          description: 'Identifier of the sender',
        },
      },
      required: ['message'],
    },
    execute: async (_id: string, { message, source, senderId }: { message: string; source?: string; senderId?: string }) => {
      await ensureIDS(cfg);

      if (!ids) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'hopeIDS not initialized' }) }] };
      }

      // Check if sender is trusted owner
      const isTrustedOwner = cfg.trustOwners !== false && senderId && ownerNumbers.includes(senderId);

      if (isTrustedOwner) {
        return { content: [{ type: 'text', text: JSON.stringify({
          action: 'allow',
          riskScore: 0,
          message: 'Sender is a trusted owner',
          trusted: true,
        }) }] };
      }

      const result = await ids.scanWithAlert(message, {
        source: source ?? 'unknown',
        senderId,
      });

      api.logger.info(`[hopeIDS] Scanned message: action=${result.action}, risk=${result.riskScore}`);

      if (result.action !== 'allow') {
        api.logger.warn(`[hopeIDS] Threat detected: ${result.intent} (${result.action})`);
      }

      return { content: [{ type: 'text', text: JSON.stringify({
        action: result.action,
        riskScore: result.riskScore,
        intent: result.intent,
        message: result.message,
        alert: result.alert,
        notification: result.notification,
        elapsed: result.elapsed,
      }) }] };
    },
  });

  // ============================================================================
  // Command: /scan
  // ============================================================================

  api.registerCommand({
    name: 'scan',
    description: 'Scan a message for security threats',
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx: { args?: string }) => {
      await ensureIDS(cfg);

      if (!ids) {
        return { text: '❌ hopeIDS not initialized' };
      }

      const message = ctx.args?.trim();
      if (!message) {
        return { text: '⚠️ Usage: /scan <message to check>' };
      }

      const result = await ids.scanWithAlert(message, { source: 'command' });
      
      const emoji = result.action === 'allow' ? '✅' : 
                    result.action === 'warn' ? '⚠️' : '🛑';
      
      return {
        text: `${emoji} **Security Scan Result**\n\n` +
              `**Action:** ${result.action}\n` +
              `**Risk Score:** ${(result.riskScore * 100).toFixed(0)}%\n` +
              `**Intent:** ${result.intent || 'benign'}\n\n` +
              `${result.notification || result.message}`,
      };
    },
  });

  // ============================================================================
  // RPC Methods
  // ============================================================================

  api.registerGatewayMethod('hopeids.scan', async ({ params, respond }: any) => {
    await ensureIDS(cfg);

    if (!ids) {
      respond(false, { error: 'hopeIDS not initialized' });
      return;
    }

    const { message, source, senderId } = params;
    const result = await ids.scan(message, { source, senderId });
    respond(true, result);
  });

  api.registerGatewayMethod('hopeids.stats', async ({ respond }: any) => {
    await ensureIDS(cfg);

    if (!ids) {
      respond(false, { error: 'hopeIDS not initialized' });
      return;
    }
    respond(true, ids.getStats());
  });

  api.registerGatewayMethod('hopeids.trust', async ({ params, respond }: any) => {
    if (!ids) {
      respond(false, { error: 'hopeIDS not initialized' });
      return;
    }
    ids.trustSender(params.senderId);
    respond(true, { trusted: params.senderId });
  });

  api.registerGatewayMethod('hopeids.block', async ({ params, respond }: any) => {
    if (!ids) {
      respond(false, { error: 'hopeIDS not initialized' });
      return;
    }
    ids.blockSender(params.senderId);
    respond(true, { blocked: params.senderId });
  });
}

export const id = 'hopeids';
export const name = 'hopeIDS Security Scanner';
