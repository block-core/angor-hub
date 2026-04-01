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
  private readonly relayConnectTimeoutMs = 4000;
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

    const ndk = this.getOrCreateNdk();

    if (this.hasConnectedRelays(ndk)) {
      this.isConnected = true;
      return ndk;
    }

    try {
      await this.connectWithRetry(ndk);
      this.isConnected = true;
      return ndk;
    } catch (error) {
      console.error('Failed to connect to relays:', error);
      throw error;
    }
  }

  private getOrCreateNdk(): NDK {
    if (!this.ndk) {
      this.ndk = new NDK({
        explicitRelayUrls: this.relayUrls(),
        enableOutboxModel: false,
      });
    }

    return this.ndk;
  }

  private hasConnectedRelays(ndk: NDK): boolean {
    return ndk.pool.connectedRelays().length > 0;
  }

  private async connectWithRetry(ndk: NDK, maxRetries = 3, retryDelay = 1000): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const configuredRelays = this.relayUrls().map((url) => ndk.pool.getRelay(url, false));

      if (configuredRelays.length === 0) {
        throw new Error('No relays configured');
      }

      const results = await Promise.allSettled(
        configuredRelays.map((relay) => relay.connect(this.relayConnectTimeoutMs, false))
      );

      const connectedCount = ndk.pool.connectedRelays().length;
      const failedCount = results.filter((result) => result.status === 'rejected').length;

      if (connectedCount > 0) {
        if (failedCount > 0) {
          console.warn(`Connected to ${connectedCount}/${configuredRelays.length} relays; continuing without ${failedCount} unavailable relay(s)`);
        } else {
          console.log(`Connected to ${connectedCount} relays`);
        }
        return;
      }

      const rejectedResult = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );
      lastError = rejectedResult?.reason ?? new Error('No relays connected');
      console.warn(`Connection attempt ${attempt} failed:`, lastError);

      if (attempt < maxRetries) {
        await new Promise<void>((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to connect to any relay');
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
  async fetchNostrProjects(limit: number, until?: number, retryCount = 0): Promise<NDKEvent[]> {
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
        const timeout = setTimeout(() => {
          console.warn('fetchNostrProjects: timeout reached, resolving with partial results');
          resolve();
        }, 8000);

        sub.on('event', (event: NDKEvent) => {
          collected.push(event);
        });

        sub.on('eose', () => {
          clearTimeout(timeout);
          resolve();
        });

        sub.on('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      console.log(`[Angor] fetchNostrProjects: received ${collected.length} events`);
      return collected;
    } catch (error) {
      console.error('Error fetching Nostr projects (kind 3030):', error);
      if (retryCount >= 1) {
        return [];
      }

      try {
        await this.reconnectToRelays();
        return await this.fetchNostrProjects(limit, until, retryCount + 1);
      } catch (retryError) {
        console.error('Retry failed for fetchNostrProjects:', retryError);
        return [];
      }
    }
  }
}
