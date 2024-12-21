import { Injectable, signal, effect } from '@angular/core';
import { SimplePool, Filter, Event, Relay } from 'nostr-tools';
import NDK, { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { Subject } from 'rxjs';

export interface ProfileUpdate {
  pubkey: string;
  profile: NDKUserProfile;
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
  public relayUrls = [
    'wss://relay.primal.net',
    'wss://nos.lol',
    'wss://relay.angor.io',
    'wss://relay2.angor.io',
  ];

  private connectedRelays = signal<string[]>([]);
  public projects = signal<ProjectEvent[]>([]);
  public loading = signal<boolean>(false);
  public profileUpdates = new Subject<ProfileUpdate>();
  public projectUpdates = new Subject<ProjectUpdate>();

  constructor() {
    this.initializeRelays();

    effect(() => {
      // Automatically fetch projects when relays are connected
      if (this.connectedRelays().length > 0) {
        this.subscribeToProjects();
      }
    });
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

  private batchArray<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  async fetchData(ids: string[]): Promise<void> {
    try {
      const ndk = await this.ensureConnected();
      // Split pubkeys into batches of 10
      const batches = this.batchArray(ids, 1);

      for (const batch of batches) {
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
            this.projectUpdates.next(projectDetails);
          } catch (error) {
            console.error('Failed to parse profile:', error);
          }
        });

        // Wait for each batch to complete
        await new Promise((resolve) => {
          sub.on('eose', () => {
            clearTimeout(timeout);
            // sub.close();
            resolve(null);
          });
        });
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  }

  async fetchProfile(pubkeys: string[]): Promise<void> {
    try {
      const ndk = await this.ensureConnected();
      const batches = this.batchArray(pubkeys, 20);

      for (const batch of batches) {
        const filter = {
          kinds: [0],
          authors: batch,
          limit: 1,
        };

        const sub = ndk.subscribe(filter);

        const timeout = setTimeout(() => {
          // sub.close();
        }, 5000);

        sub.on('event', (event: NDKEvent) => {
          try {
            const profile = JSON.parse(event.content);
            this.profileUpdates.next({
              pubkey: event.pubkey,
              profile,
            });
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
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  }

  private subscribeToProjects() {
    // this.loading.set(true);
    // const filter: Filter = {
    //   kinds: [1],
    //   tags: [['t', 'project']],
    //   limit: 100,
    // };
    // let sub = this.pool.sub(this.relayUrls, [filter]);
    // sub.on('event', (event: Event) => {
    //   this.projects.update((projects) => [...projects, event]);
    // });
    // sub.on('eose', () => {
    //   this.loading.set(false);
    //   sub.unsub();
    // });
  }

  public disconnect() {
    if (this.ndk) {
      // this.ndk.close();
      this.isConnected = false;
    }
    this.pool.close(this.relayUrls);
  }
}
