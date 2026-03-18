import { Injectable } from '@angular/core';

export interface VerificationResult {
  verified: boolean;
  eventId: string;
  projectIdentifier: string;
  reason?: string;
}

const OPRETURN_CACHE_KEY = 'angor_opreturn_cache';

@Injectable({
  providedIn: 'root',
})
export class NostrProjectVerificationService {
  private memoryCache = new Map<string, string>();

  constructor() {
    this.loadCache();
  }

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
}
