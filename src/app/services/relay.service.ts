import { Injectable, signal, effect } from '@angular/core';
import { SimplePool, Filter, Event, Relay } from 'nostr-tools';
import NDK, { NDKEvent, NDKKind, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { Subject } from 'rxjs';

export interface ProfileUpdate {
  pubkey: string;
  profile: NDKUserProfile;
  event: NDKEvent;
}

export interface ProjectUpdate {
  founderKey: string;
  founderRecoveryKey: string;
  projectIdentifier: string;
  nostrPubKey: string;
  startDate: number;
  penaltyDays: number;
  expiryDate: number;
  targetAmount: number;
  stages: [{ amountToRelease: number; releaseDate: number }];
  projectSeeders: { threshold: number; secretHashes: string[] }[];
}

// Update ProjectEvent interface to use NDKUserProfile
interface ProjectEvent extends Event {
  details?: {
    nostrPubKey: string;
    projectIdentifier: string;
    // ...other details fields
  };
  metadata?: NDKUserProfile;
}

@Injectable({
  providedIn: 'root',
})
export class RelayService {
  private pool = new SimplePool();
  private ndk: NDK | null = null;
  private isConnected = false;
  public relayUrls = ['wss://purplepag.es', 'wss://relay.primal.net', 'wss://nos.lol', 'wss://relay.angor.io', 'wss://relay2.angor.io'];

  public projects = signal<ProjectEvent[]>([]);
  public loading = signal<boolean>(false);
  public profileUpdates = new Subject<NDKEvent>();
  public contentUpdates = new Subject<NDKEvent>();
  public projectUpdates = new Subject<NDKEvent>();

  constructor() {
    this.initializeRelays();
  }

  public async ensureConnected(): Promise<NDK> {
    if (this.ndk && this.isConnected) {
      return this.ndk;
    }

    if (!this.ndk) {
      this.ndk = new NDK({
        explicitRelayUrls: this.relayUrls,
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

  async fetchListData(ids: string[]): Promise<void> {
    try {
      const ndk = await this.ensureConnected();

      const filter = {
        kinds: [30078],
        ids: ids,
      };

      const sub = ndk.subscribe(filter);
      const timeout = setTimeout(() => {
        // sub.close();
      }, 5000);

      sub.on('event', (event: NDKEvent) => {
        try {
          const projectDetails = JSON.parse(event.content);
          this.fetchProfile([projectDetails.nostrPubKey]);
          // this.fetchContent([projectDetails.nostrPubKey]);
          this.projectUpdates.next(event);
        } catch (error) {
          console.error('Failed to parse profile:', error);
        }
      });

      // Wait for each batch to complete
      await new Promise<void>((resolve) => {
        sub.on('eose', () => {
          clearTimeout(timeout);
          // sub.close();
          resolve();
        });
      });
    } catch (error) {
      console.error('Error fetching profiles:', error);
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
        limit: 1,
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
    this.pool.close(this.relayUrls);
  }
}
