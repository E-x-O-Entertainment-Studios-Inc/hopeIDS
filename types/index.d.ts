/**
 * hopeIDS - Inference-Based Intrusion Detection for AI Agents
 * TypeScript Type Definitions
 */

// ============================================================================
// Constants
// ============================================================================

export type IntentCategory =
  | 'benign'
  | 'curious'
  | 'prompt_leak'
  | 'instruction_override'
  | 'command_injection'
  | 'credential_theft'
  | 'data_exfiltration'
  | 'impersonation'
  | 'discovery'
  | 'social_engineering'
  | 'multi_stage';

export type Action = 'allow' | 'warn' | 'block' | 'quarantine';

export type SourceType =
  | 'internal'
  | 'authenticated'
  | 'known'
  | 'public'
  | 'untrusted'
  | 'webhook'
  | 'email'
  | 'api'
  | 'web';

export const ACTIONS: {
  ALLOW: 'allow';
  WARN: 'warn';
  BLOCK: 'block';
  QUARANTINE: 'quarantine';
};

export const INTENT_CATEGORIES: IntentCategory[];

export const SOURCE_TRUST: Record<SourceType, number>;

// ============================================================================
// Constructor Options
// ============================================================================

export interface HopeIDSOptions {
  /** Enable semantic LLM analysis (default: true) */
  semanticEnabled?: boolean;
  /** Risk threshold to trigger semantic analysis (default: 0.3) */
  semanticThreshold?: number;
  /** Use stricter thresholds (default: false) */
  strictMode?: boolean;
  /** Custom thresholds for decision layer */
  thresholds?: Partial<DecisionThresholds>;
  /** LLM provider: 'openai' | 'ollama' | 'lmstudio' | 'auto' (default: 'auto') */
  llmProvider?: 'openai' | 'ollama' | 'lmstudio' | 'auto';
  /** LLM endpoint URL (OpenAI-compatible) */
  llmEndpoint?: string;
  /** LLM model name */
  llmModel?: string;
  /** API key for LLM (only needed for OpenAI) */
  apiKey?: string;
  /** Logging level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** Directory containing pattern JSON files */
  patternsDir?: string;
  /** Decode payloads (base64, hex, etc.) before scanning */
  decodePayloads?: boolean;
  /** Maximum decode recursion depth */
  maxDecodeDepth?: number;
  /** Enable history tracking */
  historyEnabled?: boolean;
  /** Max messages to keep in history */
  maxHistorySize?: number;
  /** Rate limiting configuration */
  rateLimit?: { window: number; max: number };
  /** Initial allow list */
  allowList?: string[];
  /** Initial block list */
  blockList?: string[];
}

export interface DecisionThresholds {
  /** Risk score to trigger block (default: 0.8) */
  block: number;
  /** Risk score to trigger warn (default: 0.4) */
  warn: number;
  /** Risk score to trigger quarantine (default: 0.9) */
  quarantine: number;
}

// ============================================================================
// Scan Context
// ============================================================================

export interface ScanContext {
  /** Source type of the message */
  source?: SourceType | string;
  /** Identifier of the sender */
  senderId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Layer Results
// ============================================================================

export interface HeuristicMatch {
  category: string;
  risk: number;
  pattern: string;
  matched: string;
  decodedFrom?: string | null;
}

export interface HeuristicResult {
  layer: 'heuristic';
  riskScore: number;
  flags: string[];
  matches: HeuristicMatch[];
  elapsed: number;
  requiresSemantic: boolean;
}

export interface SemanticResult {
  layer: 'semantic';
  intent: IntentCategory;
  confidence: number;
  reasoning: string;
  redFlags: string[];
  recommendedAction: Action;
  elapsed: number;
  model?: string;
  provider?: string;
  error?: string;
  parseError?: string;
}

export interface ContextResult {
  layer: 'context';
  baseRisk: number;
  adjustedRisk: number;
  sourceTrust: number;
  sourceMultiplier: number;
  senderRisk: number;
  rateLimitViolation: boolean;
  patternRepetition: boolean;
  elapsed: number;
}

export interface DecisionResult {
  layer: 'decision';
  action: Action;
  riskScore: number;
  intent: IntentCategory | string;
  reason: string;
  thresholds: DecisionThresholds;
  strictMode: boolean;
  elapsed: number;
  confidence?: number;
  flags?: string[];
  matches?: HeuristicMatch[];
  redFlags?: string[];
}

// ============================================================================
// Scan Results
// ============================================================================

export interface ScanResult {
  /** Final action recommendation */
  action: Action;
  /** Final risk score (0-1) */
  riskScore: number;
  /** Detected intent category */
  intent: IntentCategory | string;
  /** Human-readable alert message */
  message: string;
  /** Detailed results from each layer */
  layers: {
    heuristic: HeuristicResult;
    semantic: SemanticResult | null;
    context: ContextResult;
    decision: DecisionResult;
  };
  /** Total scan time in milliseconds */
  elapsed: number;
  /** ISO timestamp of scan */
  timestamp: string;
}

export interface ScanResultWithAlert extends ScanResult {
  /** Formatted alert string */
  alert: string;
  /** Short notification string */
  notification: string;
}

export interface QuickCheckResult {
  dangerous: boolean;
  category?: string;
  pattern?: string;
}

export interface IDSStats {
  patternCount: number;
  categories: string[];
  intents: IntentCategory[];
  thresholds: DecisionThresholds;
}

// ============================================================================
// Main Class
// ============================================================================

export declare class HopeIDS {
  constructor(options?: HopeIDSOptions);

  /**
   * Scan a message for threats
   * @param message - The message to scan
   * @param context - Additional context (source, sender, etc.)
   * @returns Scan result with action and details
   */
  scan(message: string, context?: ScanContext): Promise<ScanResult>;

  /**
   * Quick check without full analysis
   * @param message - The message to check
   * @returns true if message appears dangerous
   */
  quickCheck(message: string): QuickCheckResult;

  /**
   * Scan and return human-readable alert
   * @param message - The message to scan
   * @param context - Additional context
   */
  scanWithAlert(message: string, context?: ScanContext): Promise<ScanResultWithAlert>;

  /**
   * Get pattern statistics
   */
  getStats(): IDSStats;

  /**
   * Add sender to allow list
   * @param senderId - Sender identifier
   */
  trustSender(senderId: string): void;

  /**
   * Add sender to block list
   * @param senderId - Sender identifier
   */
  blockSender(senderId: string): void;

  /**
   * Update configuration
   * @param options - Configuration options to update
   */
  configure(options: Partial<Pick<HopeIDSOptions, 'thresholds' | 'strictMode' | 'semanticEnabled'>>): void;
}

// ============================================================================
// Layer Classes (for advanced usage)
// ============================================================================

export declare class HeuristicLayer {
  constructor(options?: Pick<HopeIDSOptions, 'patternsDir' | 'decodePayloads' | 'maxDecodeDepth'>);
  scan(message: string, context?: ScanContext): HeuristicResult;
  quickCheck(message: string): QuickCheckResult;
  getCategories(): string[];
  getPatternCount(): number;
}

export declare class SemanticLayer {
  constructor(options?: {
    llmProvider?: 'openai' | 'ollama' | 'lmstudio' | 'auto';
    llmEndpoint?: string;
    llmModel?: string;
    apiKey?: string;
    timeout?: number;
    enabled?: boolean;
  });
  classify(message: string, context?: ScanContext & { flags?: string[] }): Promise<SemanticResult>;
}

export declare class ContextLayer {
  constructor(options?: Pick<HopeIDSOptions, 'historyEnabled' | 'maxHistorySize' | 'rateLimit'>);
  evaluate(
    heuristicResult: HeuristicResult | null,
    semanticResult: SemanticResult | null,
    context?: ScanContext
  ): ContextResult;
  getSenderStats(senderId: string): { timestamps: number[]; violations: number; trusted?: boolean } | null;
  setSenderTrust(senderId: string, trusted: boolean): void;
  reset(): void;
}

export declare class DecisionLayer {
  constructor(options?: { thresholds?: Partial<DecisionThresholds>; strictMode?: boolean; allowList?: string[]; blockList?: string[] });
  decide(
    heuristicResult: HeuristicResult | null,
    semanticResult: SemanticResult | null,
    contextResult: ContextResult | null,
    context?: ScanContext
  ): DecisionResult;
  setThresholds(thresholds: Partial<DecisionThresholds>): void;
  allow(senderId: string): void;
  block(senderId: string): void;
}

// ============================================================================
// Utilities
// ============================================================================

export declare class Logger {
  constructor(options?: { level?: 'debug' | 'info' | 'warn' | 'error' });
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  security(event: Record<string, unknown>): void;
}

export declare const decoders: {
  base64(input: string): string | null;
  hex(input: string): string | null;
  url(input: string): string | null;
  unicode(input: string): string | null;
  auto(input: string): Array<{ type: string; decoded: string | null }>;
};

// ============================================================================
// Voice/Alerts
// ============================================================================

export declare function formatAlert(decision: DecisionResult, options?: { verbose?: boolean }): string;
export declare function formatNotification(decision: DecisionResult): string;
export declare function getAlert(intent: IntentCategory | string, action: Action): string;

// ============================================================================
// Middleware
// ============================================================================

export interface MiddlewareOptions {
  ids?: HopeIDS;
  onBlock?: (result: ScanResult, req: unknown, res: unknown) => void;
  onWarn?: (result: ScanResult, req: unknown, res: unknown) => void;
  getSource?: (req: unknown) => SourceType | string;
  getSenderId?: (req: unknown) => string;
  getMessage?: (req: unknown) => string | null;
}

export declare function expressMiddleware(options?: MiddlewareOptions): (
  req: unknown,
  res: unknown,
  next: () => void
) => Promise<void>;

export declare function honoMiddleware(options?: MiddlewareOptions): (
  c: unknown,
  next: () => Promise<void>
) => Promise<void>;

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a configured HopeIDS instance
 * @param options - Configuration options
 */
export declare function createIDS(options?: HopeIDSOptions): HopeIDS;

// Default export
export default HopeIDS;
