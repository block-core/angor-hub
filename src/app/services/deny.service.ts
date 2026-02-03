import { Injectable, signal, inject } from '@angular/core';
import { NostrListService } from './nostr-list.service';
import { HubConfigService } from './hub-config.service';

@Injectable({
  providedIn: 'root',
})
export class DenyService {
  private denyListUrl = 'https://lists.blockcore.net/deny/angor.json';
  private denyList = signal<string[]>([]);
  private loaded = signal<boolean>(false);
  private loadingPromise: Promise<void> | null = null;

  private hubConfig = inject(HubConfigService);

  constructor(private nostrListService: NostrListService) {}

  async loadDenyList(): Promise<void> {
    if (this.loaded() || this.loadingPromise) {
      return this.loadingPromise || Promise.resolve();
    }

    this.loadingPromise = (async () => {
      try {
        const allDeniedProjects = new Set<string>();

        // Load from GitHub URL (legacy support)
        try {
          const response = await fetch(this.denyListUrl, { cache: 'no-store' });
          if (response.ok) {
            const list = await response.json();
            if (Array.isArray(list)) {
              list.forEach(id => allDeniedProjects.add(id));
              console.log('GitHub deny list loaded:', list.length, 'entries');
            }
          }
        } catch (error) {
          console.warn('Failed to load GitHub deny list:', error);
          // Continue with Nostr lists even if GitHub fails
        }

        // Load from Nostr lists using admin pubkeys from HubConfigService
        const adminPubkeys = this.hubConfig.getAdminPubkeys();
        if (adminPubkeys.length > 0) {
          try {
            console.log('[DenyService] Loading from Nostr with admin pubkeys:', adminPubkeys);
            const nostrDenied = await this.nostrListService.getAllDeniedProjects(adminPubkeys);
            nostrDenied.forEach(id => allDeniedProjects.add(id));
            console.log('[DenyService] Nostr deny lists loaded:', nostrDenied.length, 'entries:', nostrDenied);
          } catch (error) {
            console.error('[DenyService] Failed to load Nostr deny lists:', error);
            // Continue even if Nostr fails
          }
        } else {
          console.warn('[DenyService] No admin pubkeys configured, skipping Nostr lists');
        }

        // Combine both sources
        const combinedList = Array.from(allDeniedProjects);
        this.denyList.set(combinedList);
        this.loaded.set(true);

        // Update HubConfigService with the deny list for quick lookups
        this.hubConfig.updateDeniedProjects(combinedList);

        console.log('Total deny list loaded:', combinedList.length, 'entries');

      } catch (error) {
        console.error('Error loading deny list:', error);
        this.denyList.set([]);
      } finally {
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  /**
   * Get configured admin pubkeys from HubConfigService
   */
  getAdminPubkeys(): string[] {
    return this.hubConfig.getAdminPubkeys();
  }

  /**
   * Force reload deny list from all sources
   */
  async reloadDenyList(): Promise<void> {
    this.loaded.set(false);
    this.loadingPromise = null;
    await this.loadDenyList();
  }

  async isEventDenied(projectIdentifier: string): Promise<boolean> {
    await this.loadDenyList(); // Ensure list is loaded
    
    const list = this.denyList();
    
    // Debug logging
    console.log(`[DenyService] Checking if project is denied: "${projectIdentifier}"`);
    console.log(`[DenyService] Current deny list (${list.length} items):`, list);
    
    // Check exact match first
    if (list.includes(projectIdentifier)) {
      console.warn(`✗ Project ${projectIdentifier} is DENIED (exact match).`);
      return true;
    }
    
    // Check if any item in deny list is contained in or contains the projectIdentifier
    // This handles cases where different formats are used (event ID vs project identifier)
    const normalizedIdentifier = projectIdentifier.toLowerCase().trim();
    for (const deniedItem of list) {
      const normalizedDenied = deniedItem.toLowerCase().trim();
      
      // Check if either contains the other (for partial matches)
      if (normalizedIdentifier.includes(normalizedDenied) || 
          normalizedDenied.includes(normalizedIdentifier)) {
        console.warn(`✗ Project ${projectIdentifier} is DENIED (matched with ${deniedItem}).`);
        return true;
      }
    }
    
    console.log(`✓ Project ${projectIdentifier} is allowed.`);
    return false;
  }
}
