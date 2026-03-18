import { Injectable } from '@angular/core';

export interface VerificationResult {
  verified: boolean;
  eventId: string;
  projectIdentifier: string;
  reason?: string;
}

/**
 * On-chain project data cached after indexer validation.
 * These fields come from the Bitcoin blockchain and never change.
 */
export interface CachedProjectValidation {
  founderKey: string;
  nostrEventId: string;
  trxId: string;
  createdOnBlock: number;
}

const OPRETURN_CACHE_KEY = 'angor_opreturn_cache';
const PROJECT_VALIDATION_CACHE_KEY = 'angor_project_validation_cache';

@Injectable({
  providedIn: 'root',
})
export class NostrProjectVerificationService {
  private memoryCache = new Map<string, string>();
  private projectCache = new Map<string, CachedProjectValidation>();

  constructor() {
    this.loadCache();
    this.loadProjectCache();
  }

  // --- OP_RETURN cache (keyed by txId) ---

  /**
   * Returns a cached OP_RETURN event ID for the given transaction, or null
   * if none is cached. Bitcoin transactions are immutable, so a cached
   * result is always valid.
   */
  getCachedEventId(txId: string): string | null {
    return this.memoryCache.get(txId) ?? null;
  }

  /**
   * Stores an OP_RETURN event ID for a transaction in both the in-memory
   * cache and localStorage for persistence across page loads.
   */
  cacheEventId(txId: string, eventId: string): void {
    this.memoryCache.set(txId, eventId);
    this.saveCache();
  }

  // --- Project validation cache (keyed by projectIdentifier) ---

  /**
   * Returns cached on-chain data for a project that was previously
   * validated against the indexer, or null if not cached.
   */
  getCachedValidation(projectIdentifier: string): CachedProjectValidation | null {
    return this.projectCache.get(projectIdentifier) ?? null;
  }

  /**
   * Caches the on-chain data for a validated project. Since Bitcoin
   * transactions are immutable, a project's founderKey, trxId,
   * createdOnBlock, and nostrEventId (from OP_RETURN) never change.
   */
  cacheValidation(projectIdentifier: string, data: CachedProjectValidation): void {
    this.projectCache.set(projectIdentifier, data);
    this.saveProjectCache();
  }

  /**
   * Extracts the embedded Nostr event ID from a raw Bitcoin transaction hex.
   *
   * Angor embeds the Nostr event ID in an OP_RETURN output with the script:
   *   6a (OP_RETURN opcode) + 20 (PUSH 32 bytes) + <32-byte event ID>
   */
  extractOpReturnEventId(txHex: string): string | null {
    if (!txHex) return null;

    // Scan for OP_RETURN pattern
    const match = txHex.match(/6a20([0-9a-f]{64})/i);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Verifies that a transaction's OP_RETURN data matches the expected Nostr event ID.
   */
  verifyEventInTransaction(txHex: string, expectedEventId: string): boolean {
    const embedded = this.extractOpReturnEventId(txHex);
    if (!embedded) return false;
    return embedded === expectedEventId.toLowerCase();
  }

  // --- OP_RETURN cache persistence ---

  private loadCache(): void {
    try {
      const raw = localStorage.getItem(OPRETURN_CACHE_KEY);
      if (raw) {
        const entries: Record<string, string> = JSON.parse(raw);
        for (const [txId, eventId] of Object.entries(entries)) {
          this.memoryCache.set(txId, eventId);
        }
      }
    } catch {
      // Corrupted cache — start fresh
      localStorage.removeItem(OPRETURN_CACHE_KEY);
    }
  }

  private saveCache(): void {
    try {
      const obj: Record<string, string> = {};
      this.memoryCache.forEach((eventId, txId) => {
        obj[txId] = eventId;
      });
      localStorage.setItem(OPRETURN_CACHE_KEY, JSON.stringify(obj));
    } catch {
      // localStorage full or unavailable — cache still works in-memory
    }
  }

  // --- Project validation cache persistence ---

  private loadProjectCache(): void {
    try {
      const raw = localStorage.getItem(PROJECT_VALIDATION_CACHE_KEY);
      if (raw) {
        const entries: Record<string, CachedProjectValidation> = JSON.parse(raw);
        for (const [id, data] of Object.entries(entries)) {
          this.projectCache.set(id, data);
        }
      }
    } catch {
      localStorage.removeItem(PROJECT_VALIDATION_CACHE_KEY);
    }
  }

  private saveProjectCache(): void {
    try {
      const obj: Record<string, CachedProjectValidation> = {};
      this.projectCache.forEach((data, id) => {
        obj[id] = data;
      });
      localStorage.setItem(PROJECT_VALIDATION_CACHE_KEY, JSON.stringify(obj));
    } catch {
      // localStorage full or unavailable — cache still works in-memory
    }
  }
}
