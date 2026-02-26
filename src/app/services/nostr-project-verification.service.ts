import { Injectable } from '@angular/core';

export interface VerificationResult {
  verified: boolean;
  eventId: string;
  projectIdentifier: string;
  reason?: string;
}

@Injectable({
  providedIn: 'root',
})
export class NostrProjectVerificationService {
  /**
   * Extracts the embedded Nostr event ID from a raw Bitcoin transaction hex.
   *
   * Angor embeds the Nostr event ID in an OP_RETURN output with the script:
   *   6a (OP_RETURN opcode) + 20 (PUSH 32 bytes) + <32-byte event ID>
   *
   * @param txHex 
   * @returns 
   */
  extractOpReturnEventId(txHex: string): string | null {
    if (!txHex) return null;

    // Scan for OP_RETURN pattern
    const match = txHex.match(/6a20([0-9a-f]{64})/i);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Verifies that a transaction's OP_RETURN data matches the expected Nostr event ID.
   *
   * @param txHex 
   * @param expectedEventId 
   * @returns 
   */
  verifyEventInTransaction(txHex: string, expectedEventId: string): boolean {
    const embedded = this.extractOpReturnEventId(txHex);
    if (!embedded) return false;
    return embedded === expectedEventId.toLowerCase();
  }
}
