import { Injectable, signal, computed } from '@angular/core';
import { nip19 } from 'nostr-tools';
import { environment } from '../../environment';

export type HubMode = 'whitelist' | 'blacklist';

@Injectable({
  providedIn: 'root',
})
export class HubConfigService {
  // Configuration comes solely from environment.ts (which reads window.__ANGOR_HUB_CONFIG__ for Docker).
  // There is no localStorage persistence -- other visitors wouldn't have it.

  private _hubMode = signal<HubMode>(environment.hubMode || 'blacklist');
  private _adminPubkeys = signal<string[]>([...environment.adminPubkeys]);

  // Whitelist/deny caches populated by FeaturedService and DenyService
  private _whitelistedProjects = signal<Set<string>>(new Set());
  private _deniedProjects = signal<Set<string>>(new Set());
  private _listsLoaded = signal<boolean>(false);

  // Public readonly signals
  readonly hubMode = this._hubMode.asReadonly();
  readonly adminPubkeys = this._adminPubkeys.asReadonly();
  readonly listsLoaded = this._listsLoaded.asReadonly();

  // Computed properties
  readonly isWhitelistMode = computed(() => this._hubMode() === 'whitelist');
  readonly isBlacklistMode = computed(() => this._hubMode() === 'blacklist');

  /**
   * Get admin pubkeys in npub format (for display and storage).
   */
  getAdminPubkeys(): string[] {
    return this._adminPubkeys();
  }

  /**
   * Get admin pubkeys decoded to hex format.
   * Use this when passing pubkeys to NDK/Nostr protocol queries.
   */
  getAdminPubkeysHex(): string[] {
    return this._adminPubkeys()
      .map(pk => this.npubToHex(pk))
      .filter((hex): hex is string => hex !== null);
  }

  /**
   * Check if a given pubkey is in the configured admin pubkeys list.
   * Accepts hex or npub -- compares in npub space.
   */
  isAdmin(pubkey: string | null): boolean {
    if (!pubkey) return false;
    const asNpub = this.ensureNpub(pubkey);
    return this._adminPubkeys().includes(asNpub);
  }

  /**
   * Update the cached whitelist from external source.
   * Called by FeaturedService when whitelist is loaded.
   * Stores Nostr hex pubkeys (project nostrPubKey from 'p' tags).
   */
  updateWhitelistedProjects(nostrPubKeys: string[]): void {
    this._whitelistedProjects.set(new Set(nostrPubKeys));
  }

  /**
   * Update the cached deny list from external source.
   * Called by DenyService when deny list is loaded.
   * Stores Nostr hex pubkeys (project nostrPubKey from 'p' tags).
   */
  updateDeniedProjects(nostrPubKeys: string[]): void {
    this._deniedProjects.set(new Set(nostrPubKeys));
  }

  /**
   * Mark lists as loaded.
   */
  setListsLoaded(loaded: boolean): void {
    this._listsLoaded.set(loaded);
  }

  /**
   * Check if a project is in the whitelist by its Nostr pubkey.
   */
  isProjectWhitelisted(nostrPubKey: string): boolean {
    return this._whitelistedProjects().has(nostrPubKey);
  }

  /**
   * Check if a project's Nostr pubkey is in the deny list.
   * The deny list (kind 30000) stores Nostr hex pubkeys in 'p' tags.
   */
  isProjectDenied(nostrPubKey: string): boolean {
    return this._deniedProjects().has(nostrPubKey);
  }

  /**
   * Determine if a project should be displayed based on hub mode.
   * This is the main filtering method used by IndexerService.
   *
   * Both deny list and whitelist use the project's Nostr pubkey (nostrPubKey)
   * stored in 'p' tags — NOT the founderKey (which is a 66-char compressed
   * secp256k1 Bitcoin key and would never match).
   *
   * Blacklist mode: Show all projects EXCEPT those in the deny list
   * Whitelist mode: Show ONLY projects in the whitelist
   */
  shouldShowProject(nostrPubKey: string): boolean {
    if (this._deniedProjects().has(nostrPubKey)) {
      return false;
    }

    const mode = this._hubMode();
    if (mode === 'blacklist') {
      return true;
    }

    // Whitelist mode
    return this._whitelistedProjects().has(nostrPubKey);
  }

  /**
   * Format a pubkey for display (truncated).
   */
  formatPubkey(pubkey: string): string {
    if (!pubkey || pubkey.length < 16) return pubkey;
    return `${pubkey.slice(0, 12)}...${pubkey.slice(-8)}`;
  }

  // ==================== CONVERSION HELPERS ====================

  /**
   * Convert an npub (bech32) to hex pubkey.
   * Returns null if the input is not a valid npub.
   */
  npubToHex(npub: string): string | null {
    try {
      const decoded = nip19.decode(npub);
      if (decoded.type !== 'npub') return null;
      return decoded.data as string;
    } catch {
      return null;
    }
  }

  /**
   * Convert a hex pubkey to npub (bech32).
   * Returns null if the input is not a valid 64-char hex string.
   */
  hexToNpub(hex: string): string | null {
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
    try {
      return nip19.npubEncode(hex);
    } catch {
      return null;
    }
  }

  /**
   * Ensure a value is in npub format.
   * If it's already an npub, return as-is. If it's hex, convert to npub.
   */
  ensureNpub(value: string): string {
    if (value.startsWith('npub1')) return value;
    const converted = this.hexToNpub(value);
    return converted ?? value; // fall back to original if conversion fails
  }
}
