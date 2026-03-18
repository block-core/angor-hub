import { Injectable, signal, inject } from '@angular/core';
import { NostrListService } from './nostr-list.service';
import { HubConfigService } from './hub-config.service';

@Injectable({
  providedIn: 'root',
})
export class DenyService {
  private denyList = signal<string[]>([]);
  private loaded = signal<boolean>(false);
  private loadingPromise: Promise<void> | null = null;

  private hubConfig = inject(HubConfigService);

  constructor(private nostrListService: NostrListService) {}

  /**
   * Load the blacklist on every hub load from the admin's Nostr relays.
   * The list is stored as a kind 30000 event (Follow Sets) with 'p' tags
   * containing the founderKey hex pubkeys of blocked projects.
   */
  async loadDenyList(): Promise<void> {
    if (this.loaded() || this.loadingPromise) {
      return this.loadingPromise || Promise.resolve();
    }

    this.loadingPromise = (async () => {
      try {
        const adminPubkeys = this.hubConfig.getAdminPubkeysHex();

        if (adminPubkeys.length === 0) {
          console.warn('[DenyService] No admin pubkeys configured, skipping deny list load');
          this.denyList.set([]);
          this.loaded.set(true);
          return;
        }

        console.log('[DenyService] Loading deny list (kind 30000) from Nostr for admin pubkeys:', adminPubkeys);
        const deniedPubkeys = await this.nostrListService.getAllDeniedProjects(adminPubkeys);
        console.log('[DenyService] Deny list loaded:', deniedPubkeys.length, 'entries');

        this.denyList.set(deniedPubkeys);
        this.loaded.set(true);

        // Sync to HubConfigService for unified filtering
        this.hubConfig.updateDeniedProjects(deniedPubkeys);
      } catch (error) {
        console.error('[DenyService] Error loading deny list:', error);
        this.denyList.set([]);
        this.loaded.set(true);
      } finally {
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  /**
   * Force reload deny list from Nostr.
   * Call this when admin pubkeys change or hub config is updated.
   */
  async reloadDenyList(): Promise<void> {
    this.loaded.set(false);
    this.loadingPromise = null;
    this.denyList.set([]);
    await this.loadDenyList();
  }

  /**
   * Get configured admin pubkeys (hex) from HubConfigService.
   */
  getAdminPubkeys(): string[] {
    return this.hubConfig.getAdminPubkeysHex();
  }

  /**
   * Check if a project's founderKey is on the deny list.
   */
  async isFounderKeyDenied(founderKey: string): Promise<boolean> {
    await this.loadDenyList();
    const denied = this.denyList().includes(founderKey);
    if (denied) {
      console.warn(`[DenyService] ✗ Project founderKey ${founderKey} is DENIED`);
    }
    return denied;
  }

  /**
   * @deprecated Use isFounderKeyDenied(founderKey) instead.
   */
  async isEventDenied(founderKey: string): Promise<boolean> {
    return this.isFounderKeyDenied(founderKey);
  }
}
