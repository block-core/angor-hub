import { Injectable, signal } from '@angular/core';
import NDK, { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import { Subject } from 'rxjs';

export interface ProjectUpdate {
  version?: number;
  projectType?: number; // 0 = Invest, 1 = Fund, 2 = Subscribe
  founderKey: string;
  founderRecoveryKey: string;
  projectIdentifier: string;
  nostrPubKey: string;
  networkName?: string; // e.g. 'Main', 'Angornet', 'Liquid'
  startDate: number;
  endDate: number;
  penaltyDays: number;
  expiryDate: number;
  targetAmount: number;
  stages: [{ amountToRelease: number; releaseDate: number }];
  projectSeeders: { threshold: number; secretHashes: string[] }[];
}

@Injectable({
  providedIn: 'root',
})
export class RelayService {
  private ndk: NDK | null = null;
  private isConnected = false;
  private connectionReady: Promise<void>;
  public relayUrls = signal<string[]>([]);
  private defaultRelays = ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol', 'wss://relay.angor.io', 'wss://relay2.angor.io'];

  public loading = signal<boolean>(false);
  public profileUpdates = new Subject<NDKEvent>();
  public contentUpdates = new Subject<NDKEvent>();
  public projectUpdates = new Subject<NDKEvent>();

  constructor() {
    this.loadRelaysFromStorage();
    this.connectionReady = this.initializeRelays();
  }

  private loadRelaysFromStorage(): void {
    const savedRelays = localStorage.getItem('angor-hub-relays');
    if (savedRelays) {
      this.relayUrls.set(JSON.parse(savedRelays));
    } else {
      this.relayUrls.set([...this.defaultRelays]);
    }
  }

  public getRelayUrls(): string[] {
    return this.relayUrls();
  }

  public setRelayUrls(urls: string[]): void {
    this.relayUrls.set(urls);
  }

  public saveRelaysToStorage(): void {
    localStorage.setItem('angor-hub-relays', JSON.stringify(this.relayUrls()));
  }

  public async reconnectToRelays(): Promise<void> {
    // Disconnect from current relays
    this.disconnect();

    // Reset NDK instance
    this.ndk = null;
    this.isConnected = false;

    // Reinitialize with new relay URLs
    this.connectionReady = this.initializeRelays();
    await this.connectionReady;
  }

  public async ensureConnected(): Promise<NDK> {
    // Wait for the initial connection attempt to finish first
    await this.connectionReady;

    if (this.ndk && this.isConnected) {
      return this.ndk;
    }

    if (!this.ndk) {
      this.ndk = new NDK({
        explicitRelayUrls: this.relayUrls(),
        enableOutboxModel: false,
      });
    }

    try {
      await this.ndk.connect();
      this.isConnected = true;
      return this.ndk;
    } catch (error) {
      console.error('Failed to connect to relays:', error);
      throw error;
    }
  }

  private async initializeRelays() {
    this.loading.set(true);

    try {
      await this.ensureConnected();
    } catch (error) {
      console.error('Failed to initialize relays:', error);
    } finally {
      this.loading.set(false);
    }
  }

  async fetchData(ids: string[]): Promise<void> {
    try {
      const ndk = await this.ensureConnected();

      const filter = {
        ids: ids,
      };

      const event = await ndk.fetchEvent(filter);

      if (event) {
        const projectDetails = JSON.parse(event.content);
        this.fetchProfile([projectDetails.nostrPubKey]);
        this.fetchContent([projectDetails.nostrPubKey]);
        this.projectUpdates.next(event);
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  }

  async fetchProfile(pubkeys: string[]): Promise<void> {
    try {
      const ndk = await this.ensureConnected();

      const filter = {
        kinds: [0],
        authors: pubkeys,
        limit: pubkeys.length,
      };

      const sub = ndk.subscribe(filter);

      const timeout = setTimeout(() => {
        // sub.close();
      }, 5000);

      sub.on('event', (event: NDKEvent) => {
        try {
          this.profileUpdates.next(event);
        } catch (error) {
          console.error('Failed to parse profile:', error);
        }
      });

      // Wait for batch completion
      await new Promise((resolve) => {
        sub.on('eose', () => {
          clearTimeout(timeout);
          resolve(null);
        });
      });
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  }

  async fetchContent(pubkeys: string[]): Promise<void> {
    try {
      const ndk = await this.ensureConnected();

      const filter1 = {
        kinds: [NDKKind.AppSpecificData],
        authors: pubkeys,
        '#d': ['angor:project'],
        limit: 1,
      };

      const filter2 = {
        kinds: [NDKKind.AppSpecificData],
        authors: pubkeys,
        '#d': ['angor:media'],
        limit: 1,
      };

      const filter3 = {
        kinds: [NDKKind.AppSpecificData],
        authors: pubkeys,
        '#d': ['angor:members'],
        limit: 1,
      };

      const filter = [filter1, filter2, filter3];

      const sub = ndk.subscribe(filter);

      const timeout = setTimeout(() => {
        // sub.close();
      }, 5000);

      sub.on('event', (event: NDKEvent) => {
        try {
          this.contentUpdates.next(event);
        } catch (error) {
          console.error('Failed to parse profile:', error);
        }
      });

      // Wait for batch completion
      await new Promise((resolve) => {
        sub.on('eose', () => {
          clearTimeout(timeout);
          resolve(null);
        });
      });
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  }

  public disconnect() {
    if (this.ndk) {
      // this.ndk.close();
      this.isConnected = false;
    }
  }

  // Add this new method to get default relays
  public getDefaultRelays(): string[] {
    return [...this.defaultRelays];
  }

  /**
   * Fetches kind 3030 (Angor project announcement) events directly from Nostr relays
   * without filtering by ID. Used for Nostr-first project discovery.
   *
   * Per NIP-3030, all Angor project announcements are published as kind 3030 events.
   * Kind 30078 (NIP-78 AppSpecificData) is intentionally excluded because it is a
   * general-purpose kind used by many unrelated Nostr applications, which would flood
   * project discovery batches with non-Angor events.
   *
   * @param limit 
   * @param until
   * @returns 
   */
  async fetchNostrProjects(limit: number, until?: number): Promise<NDKEvent[]> {
    try {
      const ndk = await this.ensureConnected();

      // Only fetch Angor project announcement events (kind 3030 per NIP-3030 spec).
      // Kind 30078 is a generic app-data kind shared by many apps and must NOT be
      // included here — it produces only noise for project discovery.
      const filter: { kinds: number[]; limit: number; until?: number } = {
        kinds: [3030],
        limit,
      };

      if (until !== undefined) {
        filter.until = until;
      }

      // Use subscribe + EOSE rather than fetchEvents
      const collected: NDKEvent[] = [];

      const sub = ndk.subscribe(filter);

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 8000);

        sub.on('event', (event: NDKEvent) => {
          collected.push(event);
        });

        sub.on('eose', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      console.log(`[Angor] fetchNostrProjects: received ${collected.length} events`);
      return collected;
    } catch (error) {
      console.error('Error fetching Nostr projects (kind 3030):', error);
      return [];
    }
  }
}
