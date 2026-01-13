import { Injectable, signal } from '@angular/core';
import { environment } from '../../environment';
import { NostrListService } from './nostr-list.service';

@Injectable({
  providedIn: 'root',
})
export class FeaturedService {
  private featuredProjectIdsSig = signal<string[]>([]);
  private loadedSig = signal<boolean>(false);
  private loadingSig = signal<boolean>(false);
  private errorSig = signal<string | null>(null);

  readonly featuredProjectIds = this.featuredProjectIdsSig.asReadonly();
  readonly loaded = this.loadedSig.asReadonly();
  readonly loading = this.loadingSig.asReadonly();
  readonly error = this.errorSig.asReadonly();

  async loadFeaturedProjects(force = false): Promise<string[]> {
    if (!force && this.loadedSig()) {
      return this.featuredProjectIdsSig();
    }

    if (!environment.adminPubkeys?.length) {
      this.featuredProjectIdsSig.set([]);
      this.loadedSig.set(true);
      return [];
    }

    this.loadingSig.set(true);
    this.errorSig.set(null);

    try {
      const whiteListMap = await this.nostrListService.searchAllWhiteLists(environment.adminPubkeys);
      const ids = new Set<string>();
      for (const list of whiteListMap.values()) {
        for (const id of list) ids.add(id);
      }

      const result = Array.from(ids);
      this.featuredProjectIdsSig.set(result);
      this.loadedSig.set(true);
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
