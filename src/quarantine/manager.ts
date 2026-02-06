/**
 * Quarantine Manager
 * 
 * File-based storage for blocked message metadata.
 * 
 * SECURITY INVARIANT: This manager NEVER stores raw message content.
 * Only structured metadata about the threat detection.
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { QuarantineRecord, QuarantineStatus, QuarantineInput } from "./types.js";

export interface QuarantineManager {
  /** Create a new quarantine record */
  create(input: QuarantineInput): Promise<QuarantineRecord>;
  
  /** Update status of a record */
  updateStatus(id: string, status: QuarantineStatus): Promise<boolean>;
  
  /** Get a record by ID */
  get(id: string): Promise<QuarantineRecord | null>;
  
  /** List all pending records */
  listPending(): Promise<QuarantineRecord[]>;
  
  /** List all records (for admin/debug) */
  listAll(): Promise<QuarantineRecord[]>;
  
  /** Clean up expired records */
  cleanExpired(): Promise<number>;
  
  /** Check if a content hash was recently blocked (replay detection) */
  wasRecentlyBlocked(contentHash: string): Promise<boolean>;
}

export interface QuarantineManagerOptions {
  /** Base directory for storage */
  baseDir: string;
  
  /** Default expiry in hours (default: 24) */
  defaultExpiryHours?: number;
}

export function createQuarantineManager(options: QuarantineManagerOptions): QuarantineManager {
  const { baseDir, defaultExpiryHours = 24 } = options;

  async function ensureDir(): Promise<void> {
    await fs.mkdir(baseDir, { recursive: true });
  }

  function recordPath(id: string): string {
    // Sanitize ID to prevent path traversal
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
    return path.join(baseDir, `${safeId}.json`);
  }

  function genId(): string {
    return `q-${crypto.randomBytes(4).toString("hex")}`;
  }

  function computeExpiry(): string {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + defaultExpiryHours);
    return expiry.toISOString();
  }

  async function readRecord(filePath: string): Promise<QuarantineRecord | null> {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw) as QuarantineRecord;
    } catch {
      return null;
    }
  }

  async function writeRecord(record: QuarantineRecord): Promise<void> {
    await fs.writeFile(recordPath(record.id), JSON.stringify(record, null, 2), "utf8");
  }

  async function getAllRecords(): Promise<QuarantineRecord[]> {
    await ensureDir();
    const files = await fs.readdir(baseDir);
    const records: QuarantineRecord[] = [];
    
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const record = await readRecord(path.join(baseDir, f));
      if (record) records.push(record);
    }
    
    return records.sort((a, b) => b.ts.localeCompare(a.ts)); // newest first
  }

  return {
    async create(input) {
      await ensureDir();
      
      const id = genId();
      const record: QuarantineRecord = {
        id,
        status: "pending",
        expiresAt: input.expiresAt || computeExpiry(),
        ...input,
      };
      
      await writeRecord(record);
      return record;
    },

    async updateStatus(id, status) {
      await ensureDir();
      const record = await readRecord(recordPath(id));
      if (!record) return false;
      
      record.status = status;
      await writeRecord(record);
      return true;
    },

    async get(id) {
      await ensureDir();
      return readRecord(recordPath(id));
    },

    async listPending() {
      const all = await getAllRecords();
      const now = new Date().toISOString();
      
      return all.filter(r => 
        r.status === "pending" && 
        (!r.expiresAt || r.expiresAt > now)
      );
    },

    async listAll() {
      return getAllRecords();
    },

    async cleanExpired() {
      const all = await getAllRecords();
      const now = new Date().toISOString();
      let cleaned = 0;
      
      for (const record of all) {
        if (record.status === "pending" && record.expiresAt && record.expiresAt < now) {
          record.status = "expired";
          await writeRecord(record);
          cleaned++;
        }
      }
      
      return cleaned;
    },

    async wasRecentlyBlocked(contentHash) {
      if (!contentHash) return false;
      
      const all = await getAllRecords();
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);
      const cutoff = oneDayAgo.toISOString();
      
      return all.some(r => 
        r.contentHash === contentHash && 
        r.ts > cutoff
      );
    },
  };
}

/**
 * Compute SHA256 hash of content for replay detection.
 * This is the ONLY place raw content is processed, and only to hash it.
 */
export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}
