/**
 * Quarantine Types
 * 
 * SECURITY INVARIANT: No raw message content is ever stored.
 * Only metadata about the threat detection.
 */

export type QuarantineStatus = "pending" | "approved" | "rejected" | "expired";

export interface QuarantineRecord {
  /** Unique ID (e.g., q-7f3a2b) */
  id: string;
  
  /** ISO timestamp of when blocked */
  ts: string;
  
  /** Agent that processed this (e.g., moltbook-scanner) */
  agent: string;
  
  /** Source channel/platform (e.g., moltbook, telegram) */
  source: string;
  
  /** Sender identifier if available */
  senderId?: string;
  
  /** Detected threat intent (e.g., instruction_override) */
  intent: string;
  
  /** Risk score 0-1 */
  risk: number;
  
  /** 
   * Matched patterns - rule names/descriptions, NOT raw content
   * e.g., "matched regex: ignore.*instructions"
   */
  patterns: string[];
  
  /** SHA256 hash of original content for replay detection */
  contentHash?: string;
  
  /** Current status */
  status: QuarantineStatus;
  
  /** When this record expires (ISO timestamp) */
  expiresAt?: string;
}

/**
 * Input for creating a quarantine record.
 * Note: NO originalMessage field - this is intentional.
 */
export type QuarantineInput = Omit<QuarantineRecord, "id" | "status">;
