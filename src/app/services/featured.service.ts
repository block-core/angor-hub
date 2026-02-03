import { Injectable, signal, inject } from '@angular/core';
import { NostrListService } from './nostr-list.service';
import { HubConfigService } from './hub-config.service';

@Injectable({
  providedIn: 'root',
})
export class FeaturedService {
  private featuredProjectIdsSig = signal<string[]>([]);
  private loadedSig = signal<boolean>(false);
  private loadingSig = signal<boolean>(false);
  private errorSig = signal<string | null>(null);

  private hubConfig = inject(HubConfigService);

  readonly featuredProjectIds = this.featuredProjectIdsSig.asReadonly();
  readonly loaded = this.loadedSig.asReadonly();
  readonly loading = this.loadingSig.asReadonly();
  readonly error = this.errorSig.asReadonly();

  async loadFeaturedProjects(force = false): Promise<string[]> {
    if (!force && this.loadedSig()) {
      return this.featuredProjectIdsSig();
    }

    const adminPubkeys = this.hubConfig.getAdminPubkeys();
    if (!adminPubkeys?.length) {
      this.featuredProjectIdsSig.set([]);
      this.loadedSig.set(true);
      return [];
    }

    this.loadingSig.set(true);
    this.errorSig.set(null);

    try {
      console.log('[FeaturedService] Loading whitelist from admin pubkeys:', adminPubkeys);
      const whiteListMap = await this.nostrListService.searchAllWhiteLists(adminPubkeys);
      const ids = new Set<string>();
      for (const list of whiteListMap.values()) {
        for (const id of list) ids.add(id);
      }

      const result = Array.from(ids);
      this.featuredProjectIdsSig.set(result);
      this.loadedSig.set(true);

      // Update HubConfigService with the whitelist for quick lookups
      this.hubConfig.updateWhitelistedProjects(result);
      console.log('[FeaturedService] Whitelist loaded:', result.length, 'projects');

      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load featured projects';
      this.errorSig.set(msg);
      this.featuredProjectIdsSig.set([]);
      this.loadedSig.set(true);
      return [];
    } finally {
      this.loadingSig.set(false);
    }
  }

  constructor(private nostrListService: NostrListService) {}
}
