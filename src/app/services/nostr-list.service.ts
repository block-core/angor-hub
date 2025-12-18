import { Injectable, effect, signal } from '@angular/core';
import NDK, { NDKEvent, NDKKind, NDKUser, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
import { RelayService } from './relay.service';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { NostrAuthService } from './nostr-auth.service';

export interface NostrDenyList {
  pubkey: string;
  eventId: string;
  deniedProjects: string[];
  lastUpdated: number;
}

@Injectable({
  providedIn: 'root',
})
export class NostrListService {
  private ndk: NDK | null = null;
  private adminPubkey = signal<string | null>(null);
  private denyList = signal<string[]>([]);
  private loaded = signal<boolean>(false);
  private loadingPromise: Promise<void> | null = null;
  private simplePool = new SimplePool();
  
  // NIP-51 List kinds
  private readonly MUTE_LIST_KIND = 10000; // Mute list (NIP-51) - Used for deny/block list (private)
  private readonly PIN_LIST_KIND = 10001; // Pin list (NIP-51) - Used for whitelist/featured projects (public)
  
  constructor(
    private relayService: RelayService,
    private nostrAuth: NostrAuthService
  ) {
    // Keep admin pubkey in sync with the global auth state (e.g. Admin page login)
    effect(() => {
      const user = this.nostrAuth.currentUser();
      const pubkey = user?.pubkey ?? null;
      if (this.adminPubkey() !== pubkey) {
        this.adminPubkey.set(pubkey);
        // Reset cached list when switching users
        this.denyList.set([]);
        this.loaded.set(false);
        this.loadingPromise = null;
      }
    });
  }

  private requireAdminPubkey(): string {
    const current = this.adminPubkey();
    if (current) return current;

    // Fallback: the effect may not have run yet.
    const fromAuth = this.nostrAuth.getPubkey();
    if (fromAuth) {
      this.adminPubkey.set(fromAuth);
      return fromAuth;
    }

    throw new Error('No admin user logged in. Please login first.');
  }

  /**
   * Login with Nostr extension (NIP-07)
   */
  async loginWithNostr(): Promise<string | null> {
    try {
      if (!(window as any).nostr) {
        throw new Error('Nostr extension not found. Please install a Nostr extension like Alby or nos2x.');
      }

      const pubkey = await (window as any).nostr.getPublicKey();
      this.adminPubkey.set(pubkey);
      console.log('Logged in with pubkey:', pubkey);
      return pubkey;
    } catch (error) {
      console.error('Failed to login with Nostr:', error);
      throw error;
    }
  }

  /**
   * Logout current admin user
   */
  logout(): void {
    this.adminPubkey.set(null);
    this.denyList.set([]);
    this.loaded.set(false);
  }

  /**
   * Get current admin pubkey
   */
  getAdminPubkey(): string | null {
    return this.adminPubkey();
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn(): boolean {
    return this.adminPubkey() !== null;
  }

  /**
   * Load deny list from Nostr for the current admin user
   */
  async loadNostrDenyList(): Promise<void> {
    const adminPubkey = this.requireAdminPubkey();

    // Force reload every time to ensure fresh data
    this.loaded.set(false);
    this.loadingPromise = null;

    this.loadingPromise = (async () => {
      try {
        console.log('[NostrListService] Loading deny list for pubkey:', adminPubkey);
        const ndk = await this.relayService.ensureConnected();

        const filter = {
          kinds: [this.MUTE_LIST_KIND],
          authors: [adminPubkey],
          limit: 10, // Get multiple events to find the latest one
        };

        console.log('[NostrListService] Fetching events with filter:', filter);
        // Disable NDK cache to get fresh events from relays
        const events = await ndk.fetchEvents(filter, { closeOnEose: true, cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY });
        console.log('[NostrListService] Found', events.size, 'events');
        
        if (events.size > 0) {
          // Sort events by created_at descending (newest first)
          const sortedEvents = Array.from(events).sort((a, b) => b.created_at! - a.created_at!);
          const event = sortedEvents[0];
          console.log('[NostrListService] Using newest event from', new Date(event.created_at! * 1000).toISOString());
          console.log('[NostrListService] Event found:', event.id);
          const deniedProjects = this.extractDeniedProjects(event);
          this.denyList.set(deniedProjects);
          this.loaded.set(true);
          console.log('[NostrListService] ✓ Deny list loaded:', deniedProjects.length, 'entries:', deniedProjects);
        } else {
          console.warn('[NostrListService] ⚠ No deny list found for this admin user. You may need to add projects first.');
          this.denyList.set([]);
          this.loaded.set(true);
        }
      } catch (error) {
        console.error('[NostrListService] Error loading Nostr deny list:', error);
        this.denyList.set([]);
        this.loaded.set(true); // Set loaded even on error to prevent infinite retry
      } finally {
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  /**
   * Extract project IDs from Nostr event(s)
   * Works for both deny lists (mute) and whitelists (pin) using NIP-51 'e' tags
   */
  private extractDeniedProjects(eventOrEvents: NDKEvent | NDKEvent[]): string[] {
    const projectSet = new Set<string>();
    const events = Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents];
    
    events.forEach(event => {
      // NDK wraps events and may not expose tags directly
      // Use rawEvent() to get the actual Nostr event with tags
      const rawEvent = event.rawEvent ? event.rawEvent() : event;
      
      // Extract project IDs from tags
      // Support 'a' tags (addressable/arbitrary IDs), 'e' tags (event IDs), and legacy 'project' tags
      const tags = rawEvent.tags || [];
      
      tags.forEach((tag: any) => {
        if (Array.isArray(tag) && (tag[0] === 'a' || tag[0] === 'e' || tag[0] === 'project') && tag[1]) {
          projectSet.add(tag[1]);
        }
      });
    });
    
    return Array.from(projectSet);
  }

  /**
   * Add a project to the deny list
   */
  async addToDenyList(projectIdentifier: string): Promise<void> {
    this.requireAdminPubkey();

    await this.loadNostrDenyList();

    if (this.denyList().includes(projectIdentifier)) {
      console.log('Project already in deny list');
      return;
    }

    const updatedList = [...this.denyList(), projectIdentifier];
    await this.publishDenyList(updatedList);
  }

  /**
   * Remove a project from the deny list
   */
  async removeFromDenyList(projectIdentifier: string): Promise<void> {
    this.requireAdminPubkey();

    await this.loadNostrDenyList();

    const updatedList = this.denyList().filter(id => id !== projectIdentifier);
    await this.publishDenyList(updatedList);
  }

  /**
   * Batch add multiple projects to deny list
   */
  async batchAddToDenyList(projectIdentifiers: string[]): Promise<void> {
    this.requireAdminPubkey();

    await this.loadNostrDenyList();

    const currentList = this.denyList();
    const newProjects = projectIdentifiers.filter(id => !currentList.includes(id));
    
    if (newProjects.length === 0) {
      console.log('All projects already in deny list');
      return;
    }

    const updatedList = [...currentList, ...newProjects];
    await this.publishDenyList(updatedList);
  }

  /**
   * Batch remove multiple projects from deny list
   */
  async batchRemoveFromDenyList(projectIdentifiers: string[]): Promise<void> {
    this.requireAdminPubkey();

    await this.loadNostrDenyList();

    const updatedList = this.denyList().filter(id => !projectIdentifiers.includes(id));
    await this.publishDenyList(updatedList);
  }

  /**
   * Publish deny list to Nostr relays with retry mechanism and timeout
   */
  private async publishDenyList(deniedProjects: string[]): Promise<void> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // ms - increased delay
    const PUBLISH_TIMEOUT = 15000; // 15 seconds - increased timeout
    
    try {
      const ndk = await this.relayService.ensureConnected();
      const relayUrls = this.relayService.getRelayUrls();

      if (relayUrls.length === 0) {
        throw new Error('No relays configured. Please add relays in settings.');
      }

      // Get admin pubkey for event
      const pubkey = this.requireAdminPubkey();

      // Create event following NIP-51 structure
      // Using 'a' tag for addressable/arbitrary identifiers (project IDs)
      const eventTemplate = {
        kind: this.MUTE_LIST_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: deniedProjects.map(id => ['a', id, '', 'Blocked project']),
        content: '', // Empty content for privacy, all data in tags
        pubkey: pubkey, // Add pubkey to event
      };

      // Sign using the active signer from auth flow
      console.log('Signing deny list event with Nostr signer...');
      const signedEvent = await this.nostrAuth.signEvent(eventTemplate);
      console.log('✓ Event signed successfully:', signedEvent.id);

      // Create NDK event
      const ndkEvent = new NDKEvent(ndk, signedEvent);
      
      let totalPublished = 0;
      let lastError: Error | null = null;

      // Try publishing with retries
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`Publishing attempt ${attempt}/${MAX_RETRIES} to ${relayUrls.length} relays...`);
          
          // Try NDK first
          const publishPromise = new Promise<number>(async (resolve, reject) => {
            try {
              // Publish returns a Set of relays that accepted the event
              const relaySet = await ndkEvent.publish();
              
              // NDK publish() returns Set<NDKRelay>
              const count = relaySet ? relaySet.size : 0;
              console.log(`NDK: ${count} relays accepted the event`);
              
              // Give relays a bit more time to confirm
              await new Promise(r => setTimeout(r, 500));
              
              resolve(count);
            } catch (err) {
              reject(err);
            }
          });

          // Publish with timeout
          try {
            totalPublished = await Promise.race([
              publishPromise,
              new Promise<number>((_, reject) => 
                setTimeout(() => reject(new Error('Publish timeout')), PUBLISH_TIMEOUT)
              )
            ]);
          } catch (ndkError: any) {
            // If NDK fails, try SimplePool as fallback
            console.warn('NDK publish failed, trying SimplePool fallback:', ndkError.message);
            totalPublished = await this.publishWithSimplePool(signedEvent);
          }

          console.log(`Published to ${totalPublished}/${relayUrls.length} relays`);

          // Accept if we got at least 1 relay (be lenient since relays can be flaky)
          if (totalPublished >= 1) {
            console.log(`✓ Successfully published to ${totalPublished} relay(s)`);
            break; // Success!
          }

          // Not enough relays, but don't throw yet if we have more retries
          if (attempt < MAX_RETRIES) {
            console.warn(`Only ${totalPublished} relays received the event, retrying in ${RETRY_DELAY}ms...`);
            // Reconnect to ensure fresh connections
            try {
              await this.relayService.reconnectToRelays();
            } catch (reconnectErr) {
              console.warn('Reconnect failed, continuing anyway:', reconnectErr);
            }
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          }
        } catch (err: any) {
          lastError = err;
          console.error(`Attempt ${attempt} failed:`, err.message);
          
          if (attempt < MAX_RETRIES) {
            console.log(`Retrying in ${RETRY_DELAY}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          }
        }
      }

      // Final check - be more lenient
      if (totalPublished === 0) {
        throw new Error(
          lastError?.message || 
          'Failed to publish to any relay after multiple attempts. Relays may be temporarily unavailable.'
        );
      }

      // Update local state immediately
      this.denyList.set(deniedProjects);
      this.loaded.set(true);
      
      // Wait a bit for event to propagate on relays
      console.log('Waiting for event propagation...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Warn if not many relays received it
      if (totalPublished < Math.ceil(relayUrls.length / 2)) {
        console.warn(
          `⚠ Event published to only ${totalPublished}/${relayUrls.length} relays. ` +
          'Some relays may be temporarily unavailable, but the operation was successful.'
        );
      } else {
        console.log(`✓ Deny list published successfully to ${totalPublished}/${relayUrls.length} relay(s)`);
      }

      // Verify publication from relays (don't fail if this doesn't work)
      try {
        console.log('Verifying publication from relays...');
        await this.verifyPublication(ndkEvent.id);
        console.log('✓ Event verified on relays');
      } catch (verifyErr) {
        console.warn('Could not verify publication immediately, but event was sent:', verifyErr);
        // Event was published, verification is just a sanity check
      }
      
    } catch (error: any) {
      console.error('Error publishing deny list:', error);
      
      // Provide user-friendly error messages
      if (error.message?.includes('timeout')) {
        throw new Error('Publishing timed out. Relays may be slow. Please try again.');
      } else if (error.message?.includes('relay') || error.message?.includes('unavailable')) {
        throw error; // Already has a good message
      } else if (error.message?.includes('extension')) {
        throw new Error('Failed to sign event. Please check your Nostr extension.');
      } else {
        throw new Error(`Failed to publish: ${error.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * Verify that an event was successfully published and can be retrieved
   */
  private async verifyPublication(eventId: string): Promise<void> {
    const ndk = await this.relayService.ensureConnected();
    
    const filter = {
      ids: [eventId],
    };

    // Try to fetch the event back
    const event = await Promise.race([
      ndk.fetchEvent(filter),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Verification timeout')), 5000)
      )
    ]);

    if (event) {
      console.log('✓ Event verified - successfully retrieved from relays');
    } else {
      console.warn('⚠ Event not found during verification (may still be propagating)');
    }
  }

  /**
   * Fallback publishing using SimplePool (more reliable for some relays)
   */
  private async publishWithSimplePool(signedEvent: NostrEvent): Promise<number> {
    const relayUrls = this.relayService.getRelayUrls();
    
    console.log('Using SimplePool fallback to publish to relays...');
    
    const publishPromises = relayUrls.map(async (relayUrl) => {
      try {
        await Promise.race([
          this.simplePool.publish([relayUrl], signedEvent as any),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Relay timeout')), 5000))
        ]);
        console.log(`✓ Published to ${relayUrl}`);
        return true;
      } catch (err) {
        console.warn(`✗ Failed to publish to ${relayUrl}:`, err);
        return false;
      }
    });

    const results = await Promise.allSettled(publishPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    
    console.log(`SimplePool: Published to ${successCount}/${relayUrls.length} relays`);
    return successCount;
  }

  /**
   * Get current deny list
   */
  async getDenyList(): Promise<string[]> {
    if (!this.adminPubkey()) {
      const fromAuth = this.nostrAuth.getPubkey();
      if (fromAuth) {
        this.adminPubkey.set(fromAuth);
      } else {
        console.warn('[NostrListService] No admin logged in, returning empty list');
        return [];
      }
    }
    await this.loadNostrDenyList();
    const list = this.denyList();
    console.log('[NostrListService] getDenyList returning:', list);
    return list;
  }

  /**
   * Check if a project is denied
   */
  async isProjectDenied(projectIdentifier: string): Promise<boolean> {
    await this.loadNostrDenyList();
    return this.denyList().includes(projectIdentifier);
  }

  /**
   * Search all Nostr deny lists (from multiple admin users)
   */
  async searchAllDenyLists(adminPubkeys: string[]): Promise<Map<string, string[]>> {
    try {
      const ndk = await this.relayService.ensureConnected();

      const filter = {
        kinds: [this.MUTE_LIST_KIND],
        authors: adminPubkeys,
      };

      const events = await ndk.fetchEvents(filter);
      const denyListMap = new Map<string, string[]>();

      for (const event of events) {
        const deniedProjects = this.extractDeniedProjects(event);
        denyListMap.set(event.pubkey, deniedProjects);
      }

      return denyListMap;
    } catch (error) {
      console.error('Error searching deny lists:', error);
      throw error;
    }
  }

  /**
   * Get all denied projects from multiple admin users
   */
  async getAllDeniedProjects(adminPubkeys: string[]): Promise<string[]> {
    const denyListMap = await this.searchAllDenyLists(adminPubkeys);
    const allDenied = new Set<string>();

    for (const deniedProjects of denyListMap.values()) {
      deniedProjects.forEach(id => allDenied.add(id));
    }

    return Array.from(allDenied);
  }

  // ==================== WHITELIST / FEATURED PROJECTS (NIP-51 Pin List - Kind 10001) ====================

  private whiteList = signal<string[]>([]);
  private whiteListLoaded = signal<boolean>(false);
  private whiteListLoadingPromise: Promise<void> | null = null;

  /**
   * Load whitelist (featured/pinned projects) from Nostr for the current admin user
   * Uses NIP-51 Pin List (kind 10001) - Public list
   */
  async loadNostrWhiteList(): Promise<void> {
    const adminPubkey = this.requireAdminPubkey();

    // Force reload every time to ensure fresh data
    this.whiteListLoaded.set(false);
    this.whiteListLoadingPromise = null;

    this.whiteListLoadingPromise = (async () => {
      try {
        console.log('[NostrListService] Loading whitelist for pubkey:', adminPubkey);
        const ndk = await this.relayService.ensureConnected();

        const filter = {
          kinds: [this.PIN_LIST_KIND],
          authors: [adminPubkey],
          limit: 10, // Get multiple events to find the latest one
        };

        console.log('[NostrListService] Fetching whitelist events with filter:', filter);
        // Disable NDK cache to get fresh events from relays
        const events = await ndk.fetchEvents(filter, { closeOnEose: true, cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY });
        console.log('[NostrListService] Found', events.size, 'whitelist events');
        
        if (events.size > 0) {
          // Sort events by created_at descending (newest first)
          const sortedEvents = Array.from(events).sort((a: NDKEvent, b: NDKEvent) => b.created_at! - a.created_at!);
          const event = sortedEvents[0];
          console.log('[NostrListService] Using newest whitelist event from', new Date(event.created_at! * 1000).toISOString());
          console.log('[NostrListService] Whitelist event found:', event.id);
          const featuredProjects = this.extractDeniedProjects(event); // Same extraction logic
          this.whiteList.set(featuredProjects);
          this.whiteListLoaded.set(true);
          console.log('[NostrListService] ✓ Whitelist loaded:', featuredProjects.length, 'entries:', featuredProjects);
        } else {
          console.warn('[NostrListService] ⚠ No whitelist found for this admin user.');
          this.whiteList.set([]);
          this.whiteListLoaded.set(true);
        }
      } catch (error) {
        console.error('[NostrListService] Error loading Nostr whitelist:', error);
        this.whiteList.set([]);
        this.whiteListLoaded.set(true);
      } finally {
        this.whiteListLoadingPromise = null;
      }
    })();

    return this.whiteListLoadingPromise;
  }

  /**
   * Add a project to the whitelist (featured/pinned projects)
   */
  async addToWhiteList(projectIdentifier: string): Promise<void> {
    this.requireAdminPubkey();

    await this.loadNostrWhiteList();

    if (this.whiteList().includes(projectIdentifier)) {
      console.log('Project already in whitelist');
      return;
    }

    const updatedList = [...this.whiteList(), projectIdentifier];
    await this.publishWhiteList(updatedList);
  }

  /**
   * Remove a project from the whitelist
   */
  async removeFromWhiteList(projectIdentifier: string): Promise<void> {
    this.requireAdminPubkey();

    await this.loadNostrWhiteList();

    const updatedList = this.whiteList().filter(id => id !== projectIdentifier);
    await this.publishWhiteList(updatedList);
  }

  /**
   * Batch add multiple projects to whitelist
   */
  async batchAddToWhiteList(projectIdentifiers: string[]): Promise<void> {
    this.requireAdminPubkey();

    await this.loadNostrWhiteList();

    const currentList = this.whiteList();
    const newProjects = projectIdentifiers.filter(id => !currentList.includes(id));
    
    if (newProjects.length === 0) {
      console.log('All projects already in whitelist');
      return;
    }

    const updatedList = [...currentList, ...newProjects];
    await this.publishWhiteList(updatedList);
  }

  /**
   * Batch remove multiple projects from whitelist
   */
  async batchRemoveFromWhiteList(projectIdentifiers: string[]): Promise<void> {
    this.requireAdminPubkey();

    await this.loadNostrWhiteList();

    const updatedList = this.whiteList().filter(id => !projectIdentifiers.includes(id));
    await this.publishWhiteList(updatedList);
  }

  /**
   * Publish whitelist to Nostr relays
   * Uses NIP-51 Pin List (kind 10001) - Public, visible to all users
   */
  private async publishWhiteList(featuredProjects: string[]): Promise<void> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;
    const PUBLISH_TIMEOUT = 15000;
    
    try {
      const ndk = await this.relayService.ensureConnected();
      const relayUrls = this.relayService.getRelayUrls();

      if (relayUrls.length === 0) {
        throw new Error('No relays configured. Please add relays in settings.');
      }

      // Get admin pubkey for event
      const pubkey = this.requireAdminPubkey();

      // Create event following NIP-51 Pin List structure
      const eventTemplate = {
        kind: this.PIN_LIST_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: featuredProjects.map(id => ['a', id, '', 'Featured project']),
        content: '', // Empty content, all data in tags
        pubkey: pubkey, // Add pubkey to event
      };

      console.log('Signing whitelist event with Nostr signer...');
      const signedEvent = await this.nostrAuth.signEvent(eventTemplate);
      console.log('✓ Whitelist event signed successfully:', signedEvent.id);

      const ndkEvent = new NDKEvent(ndk, signedEvent);
      
      let totalPublished = 0;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`Publishing whitelist attempt ${attempt}/${MAX_RETRIES} to ${relayUrls.length} relays...`);
          
          const publishPromise = new Promise<number>(async (resolve, reject) => {
            try {
              const relaySet = await ndkEvent.publish();
              const count = relaySet ? relaySet.size : 0;
              console.log(`NDK: ${count} relays accepted the whitelist event`);
              await new Promise(r => setTimeout(r, 500));
              resolve(count);
            } catch (err) {
              reject(err);
            }
          });

          try {
            totalPublished = await Promise.race([
              publishPromise,
              new Promise<number>((_, reject) => 
                setTimeout(() => reject(new Error('Publish timeout')), PUBLISH_TIMEOUT)
              )
            ]);
          } catch (ndkError: any) {
            console.warn('NDK publish failed for whitelist, trying SimplePool fallback:', ndkError.message);
            totalPublished = await this.publishWithSimplePool(signedEvent);
          }

          console.log(`Published whitelist to ${totalPublished}/${relayUrls.length} relays`);

          if (totalPublished >= 1) {
            console.log(`✓ Successfully published whitelist to ${totalPublished} relay(s)`);
            break;
          }

          if (attempt < MAX_RETRIES) {
            console.warn(`Only ${totalPublished} relays received the whitelist event, retrying in ${RETRY_DELAY}ms...`);
            try {
              await this.relayService.reconnectToRelays();
            } catch (reconnectErr) {
              console.warn('Reconnect failed, continuing anyway:', reconnectErr);
            }
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          }
        } catch (err: any) {
          lastError = err;
          console.error(`Whitelist publish attempt ${attempt} failed:`, err.message);
          
          if (attempt < MAX_RETRIES) {
            console.log(`Retrying in ${RETRY_DELAY}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          }
        }
      }

      if (totalPublished === 0) {
        throw new Error(
          lastError?.message || 
          'Failed to publish whitelist to any relay after multiple attempts.'
        );
      }

      // Update local state immediately
      this.whiteList.set(featuredProjects);
      this.whiteListLoaded.set(true);

      // Wait a bit for event to propagate on relays
      console.log('Waiting for whitelist event propagation...');
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (totalPublished < relayUrls.length / 2) {
        console.warn(`⚠ Whitelist published to only ${totalPublished}/${relayUrls.length} relays`);
      } else {
        console.log(`✓ Whitelist published successfully to ${totalPublished}/${relayUrls.length} relay(s)`);
      }

    } catch (error: any) {
      console.error('Error publishing whitelist:', error);
      throw error;
    }
  }

  /**
   * Get current whitelist
   */
  async getWhiteList(): Promise<string[]> {
    if (!this.adminPubkey()) {
      const fromAuth = this.nostrAuth.getPubkey();
      if (fromAuth) {
        this.adminPubkey.set(fromAuth);
      } else {
        console.warn('[NostrListService] No admin logged in, returning empty whitelist');
        return [];
      }
    }
    await this.loadNostrWhiteList();
    const list = this.whiteList();
    console.log('[NostrListService] getWhiteList returning:', list);
    return list;
  }

  /**
   * Check if a project is in the whitelist
   */
  async isProjectWhiteListed(projectIdentifier: string): Promise<boolean> {
    await this.loadNostrWhiteList();
    return this.whiteList().includes(projectIdentifier);
  }

  /**
   * Search all Nostr whitelists (from multiple admin users)
   */
  async searchAllWhiteLists(adminPubkeys: string[]): Promise<Map<string, string[]>> {
    try {
      const ndk = await this.relayService.ensureConnected();

      const filter = {
        kinds: [this.PIN_LIST_KIND],
        authors: adminPubkeys,
      };

      const events = await ndk.fetchEvents(filter);
      const whiteListMap = new Map<string, string[]>();

      for (const event of events) {
        const featuredProjects = this.extractDeniedProjects(event);
        whiteListMap.set(event.pubkey, featuredProjects);
      }

      return whiteListMap;
    } catch (error) {
      console.error('Error searching whitelists:', error);
      throw error;
    }
  }

  /**
   * Get all featured/whitelisted projects from multiple admin users
   */
  async getAllFeaturedProjects(adminPubkeys: string[]): Promise<string[]> {
    const whiteListMap = await this.searchAllWhiteLists(adminPubkeys);
    const allFeatured = new Set<string>();

    for (const featuredProjects of whiteListMap.values()) {
      featuredProjects.forEach(id => allFeatured.add(id));
    }

    return Array.from(allFeatured);
  }
}
