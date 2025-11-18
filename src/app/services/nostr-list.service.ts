import { Injectable, signal } from '@angular/core';
import NDK, { NDKEvent, NDKKind, NDKUser } from '@nostr-dev-kit/ndk';
import { RelayService } from './relay.service';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';

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
  private readonly MUTE_LIST_KIND = 10000; // Mute list (NIP-51)
  private readonly BLOCK_LIST_KIND = 10001; // Block list (custom for this app)
  
  constructor(private relayService: RelayService) {}

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
    if (!this.adminPubkey()) {
      throw new Error('No admin user logged in');
    }

    // Force reload every time to ensure fresh data
    this.loaded.set(false);
    this.loadingPromise = null;

    this.loadingPromise = (async () => {
      try {
        console.log('[NostrListService] Loading deny list for pubkey:', this.adminPubkey());
        const ndk = await this.relayService.ensureConnected();

        const filter = {
          kinds: [this.BLOCK_LIST_KIND],
          authors: [this.adminPubkey()!],
          limit: 1,
        };

        console.log('[NostrListService] Fetching events with filter:', filter);
        const events = await ndk.fetchEvents(filter);
        console.log('[NostrListService] Found', events.size, 'events');
        
        if (events.size > 0) {
          const event = Array.from(events)[0];
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
   * Extract denied project IDs from Nostr event(s)
   */
  private extractDeniedProjects(eventOrEvents: NDKEvent | NDKEvent[]): string[] {
    const deniedSet = new Set<string>();
    const events = Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents];
    
    events.forEach(event => {
      // Extract project IDs from 'project' tags (custom tag for project identifiers)
      event.tags.forEach(tag => {
        if (tag[0] === 'project' && tag[1]) {
          deniedSet.add(tag[1]);
        }
      });
    });
    
    return Array.from(deniedSet);
  }

  /**
   * Add a project to the deny list
   */
  async addToDenyList(projectIdentifier: string): Promise<void> {
    if (!this.adminPubkey()) {
      throw new Error('No admin user logged in. Please login first.');
    }

    if (!(window as any).nostr) {
      throw new Error('Nostr extension not found. Please install Alby or nos2x.');
    }

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
    if (!this.adminPubkey()) {
      throw new Error('No admin user logged in. Please login first.');
    }

    if (!(window as any).nostr) {
      throw new Error('Nostr extension not found. Please install Alby or nos2x.');
    }

    await this.loadNostrDenyList();

    const updatedList = this.denyList().filter(id => id !== projectIdentifier);
    await this.publishDenyList(updatedList);
  }

  /**
   * Batch add multiple projects to deny list
   */
  async batchAddToDenyList(projectIdentifiers: string[]): Promise<void> {
    if (!this.adminPubkey()) {
      throw new Error('No admin user logged in. Please login first.');
    }

    if (!(window as any).nostr) {
      throw new Error('Nostr extension not found. Please install Alby or nos2x.');
    }

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
    if (!this.adminPubkey()) {
      throw new Error('No admin user logged in. Please login first.');
    }

    if (!(window as any).nostr) {
      throw new Error('Nostr extension not found. Please install Alby or nos2x.');
    }

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

      // Create event following NIP-51 structure
      // Using 'project' tag instead of 'e' tag since project IDs are not hex event IDs
      const eventTemplate = {
        kind: this.BLOCK_LIST_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: deniedProjects.map(id => ['project', id, '', 'Blocked project']),
        content: '', // Empty content for privacy, all data in tags
      };

      // Sign with Nostr extension
      console.log('Signing event with Nostr extension...');
      const signedEvent = await (window as any).nostr.signEvent(eventTemplate);
      console.log('Event signed successfully:', signedEvent.id);

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

      // Update local state
      this.denyList.set(deniedProjects);
      
      // Reset loaded state to force fresh fetch next time
      this.loaded.set(false);
      
      // Warn if not many relays received it
      if (totalPublished < Math.ceil(relayUrls.length / 2)) {
        console.warn(
          `⚠ Event published to only ${totalPublished}/${relayUrls.length} relays. ` +
          'Some relays may be temporarily unavailable, but the operation was successful.'
        );
      } else {
        console.log(`✓ Deny list published successfully to ${totalPublished}/${relayUrls.length} relay(s)`);
      }

      // Verify publication (don't fail if this doesn't work)
      try {
        console.log('Verifying publication...');
        await this.verifyPublication(ndkEvent.id);
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
      console.warn('[NostrListService] No admin logged in, returning empty list');
      return [];
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
        kinds: [this.BLOCK_LIST_KIND],
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
}
