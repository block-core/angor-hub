import { Injectable, signal, inject, computed } from '@angular/core';
import { ProjectUpdate, RelayService } from './relay.service';
import { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { NetworkService } from './network.service';
import { DenyService } from './deny.service';
import { FeaturedService } from './featured.service';
import { HubConfigService } from './hub-config.service';
import { ExternalIdentity } from '../models/models';
import { NostrProjectVerificationService } from './nostr-project-verification.service';

export interface IndexerConfig {
  mainnet: IndexerEntry[];
  testnet: IndexerEntry[];
}

export interface IndexerEntry {
  url: string;
  isPrimary: boolean;
}

export interface IndexedProject {
  founderKey: string;
  nostrEventId: string;
  projectIdentifier: string;
  createdOnBlock: number;
  trxId: string;
  profile?: {
    name?: string;
    picture?: string;
    about?: string;
  };
  details?: ProjectUpdate;
  details_created_at: number | undefined;
  metadata?: NDKUserProfile;
  metadata_created_at: number | undefined;
  stats?: ProjectStats;
  content?: string;
  content_created_at: number | undefined;

  members?: string[];
  members_created_at: number | undefined;

  media?: any[];
  media_created_at: number | undefined;

  externalIdentities?: ExternalIdentity[];
  externalIdentities_created_at: number | undefined;
}

export interface ProjectStats {
  investorCount: number;
  amountInvested: number;
  amountSpentSoFarByFounder: number;
  amountInPenalties: number;
  countInPenalties: number;
}

export interface Supply {
  circulating: number;
  total: number;
  max: number;
  rewards: number;
  height: number;
}

export interface ProjectInvestment {
  investorKey: string;
  amount: number;
  trxId: string;
  blockHeight: number;
}

export interface AddressBalance {
  address: string;
  balance: number;
  unconfirmedBalance?: number;
}

export interface Transaction {
  id: string;
  hex?: string;
}

export interface Block {
  hash: string;
  height: number;
}

export interface NetworkStats {
  connections: number;
  blockHeight: number;
}

@Injectable({
  providedIn: 'root',
})
export class IndexerService {
  private readonly LIMIT = 8;
  private indexerUrl = 'https://signet.angor.online/';

  // Nostr-first cursor-based pagination (using `until` timestamp)
  private oldestEventTimestamp: number | undefined;
  private totalProjectsFetched = false;

  private relay = inject(RelayService);
  private denyService = inject(DenyService);
  private featuredService = inject(FeaturedService);
  private hubConfig = inject(HubConfigService);
  private verification = inject(NostrProjectVerificationService);

  public loading = signal<boolean>(false);
  private _allProjects = signal<IndexedProject[]>([]);
  public projects = computed(() => {
    const all = this._allProjects();
    return all.filter(p => {
      const nostrPubKey = p.details?.nostrPubKey;
      // If details haven't loaded yet, show the project (will re-evaluate when details arrive)
      if (!nostrPubKey) return true;
      return this.hubConfig.shouldShowProject(nostrPubKey);
    });
  });
  public error = signal<string | null>(null);
  private network = inject(NetworkService);

  public indexers = signal<IndexerConfig>({
    mainnet: [
      { url: 'https://explorer.angor.io/', isPrimary: false },
      { url: 'https://fulcrum.angor.online/', isPrimary: true },
      { url: 'https://electrs.angor.online/', isPrimary: false }
    ],
    testnet: [
      { url: 'https://signet.angor.online/', isPrimary: true }
    ]
  });

  constructor() {

    this.relay.profileUpdates.subscribe((update) => {
      this.updateProjectMetadata(update);
    });

    // Update project details when a verified Nostr event is emitted.
    this.relay.projectUpdates.subscribe((event) => {
      this.updateProjectDetails(event);
    });

    this.loadIndexerConfig();
    this.updateActiveIndexer();
    this.denyService.loadDenyList();
  }

  private loadIndexerConfig(): void {
    const savedConfig = localStorage.getItem('angor-indexers');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig) as IndexerConfig;
        this.indexers.set(config);
      } catch (error) {
        console.error('Failed to parse saved indexer config', error);
      }
    }
  }

  saveIndexerConfig(): void {
    localStorage.setItem('angor-indexers', JSON.stringify(this.indexers()));
    this.updateActiveIndexer();
  }

  getIndexerConfig(): IndexerConfig {
    return this.indexers();
  }

  getDefaultIndexerConfig(): IndexerConfig {
    return {
      mainnet: [
        { url: 'https://explorer.angor.io/', isPrimary: false },
        { url: 'https://fulcrum.angor.online/', isPrimary: true },
        { url: 'https://electrs.angor.online/', isPrimary: false }
      ],
      testnet: [{ url: 'https://signet.angor.online/', isPrimary: true }]
    };
  }

  resetToDefaultIndexers(): void {
    this.indexers.set(this.getDefaultIndexerConfig());
    this.saveIndexerConfig();
  }

  setIndexerConfig(config: IndexerConfig): void {
    this.indexers.set(config);
    this.saveIndexerConfig();
  }

  getPrimaryIndexerUrl(isMainnet: boolean): string {
    const config = this.indexers();
    const networkIndexers = isMainnet ? config.mainnet : config.testnet;
    const primary = networkIndexers.find(indexer => indexer.isPrimary);
    return primary ? primary.url : networkIndexers[0]?.url ||
      (isMainnet ? 'https://explorer.angor.io/' : 'https://signet.angor.online/');
  }

  updateActiveIndexer(): void {
    const isMain = this.network.isMain();
    this.indexerUrl = this.getPrimaryIndexerUrl(isMain);
    this.resetProjects();
  }

  setPrimaryIndexer(url: string, isMainnet: boolean): void {
    this.indexers.update(config => {
      const networkKey = isMainnet ? 'mainnet' : 'testnet';
      return {
        ...config,
        [networkKey]: config[networkKey].map(indexer => ({
          ...indexer,
          isPrimary: indexer.url === url
        }))
      };
    });
    this.saveIndexerConfig();
  }

  addIndexer(url: string, isMainnet: boolean): boolean {
    let normalizedUrl = url;
    if (!normalizedUrl.endsWith('/')) {
      normalizedUrl += '/';
    }

    const networkKey = isMainnet ? 'mainnet' : 'testnet';
    const exists = this.indexers()[networkKey].some(indexer => indexer.url === normalizedUrl);

    if (exists) {
      return false;
    }

    this.indexers.update(config => {
      const networkIndexers = config[networkKey];
      const isPrimary = networkIndexers.length === 0;

      return {
        ...config,
        [networkKey]: [...networkIndexers, { url: normalizedUrl, isPrimary }]
      };
    });

    this.saveIndexerConfig();
    return true;
  }

  removeIndexer(url: string, isMainnet: boolean): void {
    const networkKey = isMainnet ? 'mainnet' : 'testnet';

    this.indexers.update(config => {
      const filteredIndexers = config[networkKey].filter(indexer => indexer.url !== url);

      if (filteredIndexers.length > 0 && !filteredIndexers.some(i => i.isPrimary)) {
        filteredIndexers[0].isPrimary = true;
      }

      return {
        ...config,
        [networkKey]: filteredIndexers
      };
    });

    this.saveIndexerConfig();
  }

  async testIndexerConnection(url: string): Promise<boolean> {
    const endpoints = ['api/stats/heartbeat', 'api/mempool'];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${url}${endpoint}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          return true;
        }
      }
      catch (error) {
        if (error instanceof Error) {
          console.debug(`Connection test failed for ${endpoint}:`, error.message);
        }
        return false;
      }
    }

    return false;
  }

  async setErrorWithRetry(errorMsg: string, retryCount = 1, delayMs = 1000): Promise<void> {
    const isMainnet = this.network.isMain();
    const config = this.getIndexerConfig();
    const indexers = isMainnet ? config.mainnet : config.testnet;
    const primary = indexers.find(i => i.isPrimary) || indexers[0];

    if (!primary) {
      this.error.set(errorMsg);
      return;
    }

    for (let i = 0; i < retryCount; i++) {
      try {
        const isOnline = await this.testIndexerConnection(primary.url);
        if (isOnline) {
          console.log(`Indexer connection restored after ${i + 1} attempt(s)`);
          return;
        }
      } catch (retryError) {
        console.debug(`Retry ${i + 1} failed:`, retryError);
      }

      if (i < retryCount - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.warn(`Indexer connection failed after ${retryCount} attempts, showing error modal`);
    this.error.set(errorMsg);
  }

  private async fetchJson<T>(
    url: string
  ): Promise<{ data: T; headers: Headers }> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return {
      data: await response.json(),
      headers: response.headers,
    };
  }

  /**
   * Fetches a raw transaction hex string.
   * The /hex endpoint may return a plain text hex string (not JSON).
   */
  private async fetchTxHex(txId: string): Promise<string | null> {
    try {
      const url = `${this.indexerUrl}api/query/transaction/${txId}/hex`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const text = (await response.text()).trim();
      if (!text) return null;
      // Handle both plain hex and a JSON-encoded string
      if (text.startsWith('"')) {
        return JSON.parse(text) as string;
      }
      return text;
    } catch {
      return null;
    }
  }

  private updateProjectMetadata(event: NDKEvent) {
    const pubkey = event.pubkey;
    const metadata = JSON.parse(event.content) as NDKUserProfile;

    this._allProjects.update((projects) =>
      projects.map((project) => {
        // Match by the project's Nostr pubkey (from details) since
        // event.pubkey is a 64-char Nostr hex key, not the 66-char
        // Bitcoin founderKey.
        if (project.details?.nostrPubKey === pubkey) {
          if (
            !project.metadata_created_at ||
            event.created_at! > project.metadata_created_at
          ) {
            return {
              ...project,
              metadata,
              metadata_created_at: event.created_at,
            };
          }
        }
        return project;
      })
    );
  }

  /**
   * Updates a project's details when a kind 3030 event arrives from Nostr.
   * Parses the event content to extract the ProjectUpdate details.
   */
  private updateProjectDetails(event: NDKEvent) {
    try {
      const details: ProjectUpdate = JSON.parse(event.content);
      this._allProjects.update((projects) =>
        projects.map((project) => {
          if (project.projectIdentifier === details.projectIdentifier) {
            if (
              !project.details_created_at ||
              event.created_at! > project.details_created_at
            ) {
              return {
                ...project,
                details,
                details_created_at: event.created_at,
              };
            }
          }
          return project;
        })
      );
    } catch (error) {
      console.error('Failed to parse project details from event:', error);
    }
  }

  /**
   * Fetches projects using a Nostr-first discovery approach.
   *
   * Flow (matches the Angor desktop app):
   *   1. Query Nostr relays for the latest kind 3030/30078 events.
   *   2. Parse each event to extract projectIdentifier and nostrPubKey.
   *   3. For each project, call the indexer to confirm it exists on-chain
   *      and cross-check the Nostr event ID (the indexer stores the
   *      OP_RETURN-embedded event ID from the founding transaction).
   *   4. Only projects that pass validation are kept.
   *   5. Profiles are fetched from Nostr for the validated projects.
   *
   * Pagination uses Nostr's `until` parameter (timestamp cursor) instead
   * of offset-based pagination against the indexer.
   */
  async fetchProjects(reset = false): Promise<void> {
    if (reset) {
      this.oldestEventTimestamp = undefined;
      this.totalProjectsFetched = false;
      this._allProjects.set([]);
    }

    if (this.loading()) {
      return;
    }

    try {
      // Load both deny list and whitelist for hub mode filtering
      await Promise.all([
        this.denyService.loadDenyList(),
        this.featuredService.loadFeaturedProjects()
      ]);

      // Mark lists as loaded in hub config
      this.hubConfig.setListsLoaded(true);

      this.loading.set(true);
      this.error.set(null);

      // Step 1: Discover projects from Nostr relays
      const nostrEvents = await this.relay.fetchNostrProjects(
        this.LIMIT,
        this.oldestEventTimestamp
      );

      if (nostrEvents.length === 0) {
        this.totalProjectsFetched = true;
        return;
      }

      // Update the pagination cursor to the oldest event's timestamp
      // so the next call fetches older events.
      const oldestEvent = nostrEvents.reduce(
        (min, ev) => (ev.created_at! < min.created_at! ? ev : min),
        nostrEvents[0]
      );
      this.oldestEventTimestamp = oldestEvent.created_at!;

      // If we got fewer events than requested, we've reached the end
      if (nostrEvents.length < this.LIMIT) {
        this.totalProjectsFetched = true;
      }

      // Step 2: Parse events and deduplicate against already-loaded projects
      const existingIds = new Set(this._allProjects().map(p => p.projectIdentifier));
      const candidateEvents: { event: NDKEvent; details: ProjectUpdate }[] = [];

      for (const event of nostrEvents) {
        try {
          const details: ProjectUpdate = JSON.parse(event.content);
          if (!details.projectIdentifier) continue;
          if (existingIds.has(details.projectIdentifier)) continue;
          candidateEvents.push({ event, details });
        } catch {
          // Skip events with unparseable content
          continue;
        }
      }

      if (candidateEvents.length === 0) {
        return;
      }

      // Step 3: Validate each project on-chain via the indexer (in parallel)
      const validatedProjects = await Promise.all(
        candidateEvents.map(async ({ event, details }) => {
          try {
            const url = `${this.indexerUrl}api/query/Angor/projects/${details.projectIdentifier}`;
            const { data: indexerProject } = await this.fetchJson<IndexedProject>(url);

            if (!indexerProject) return null;

            // Cross-check: the indexer's nostrEventId (derived from the
            // OP_RETURN in the founding Bitcoin transaction) must match
            // the Nostr event ID we discovered.
            if (indexerProject.nostrEventId?.toLowerCase() !== event.id?.toLowerCase()) {
              console.warn(
                `[Angor] Event ID mismatch for ${details.projectIdentifier}: ` +
                `nostr="${event.id}" vs indexer="${indexerProject.nostrEventId}" — skipping`
              );
              return null;
            }

            // Hub mode filtering
            const nostrPubKey = details.nostrPubKey;
            if (nostrPubKey && !this.hubConfig.shouldShowProject(nostrPubKey)) {
              return null;
            }

            // Attach the Nostr-sourced details and event metadata
            indexerProject.nostrEventId = event.id;
            indexerProject.details = details;
            indexerProject.details_created_at = event.created_at;

            return indexerProject;
          } catch {
            // Project not found on-chain or indexer unreachable — skip
            return null;
          }
        })
      );

      const verified = validatedProjects.filter(
        (p): p is IndexedProject => p !== null
      );

      if (verified.length === 0) {
        return;
      }

      // Step 4: Add validated projects to the store
      this._allProjects.update((existing) => {
        const merged = [...existing];
        const ids = new Set(existing.map(p => p.projectIdentifier));

        for (const project of verified) {
          if (!ids.has(project.projectIdentifier)) {
            merged.push(project);
            ids.add(project.projectIdentifier);
          }
        }

        return merged;
      });

      // Step 5: Fetch profiles from Nostr for validated projects
      const nostrPubKeys = verified
        .map(p => p.details?.nostrPubKey)
        .filter((k): k is string => !!k);

      if (nostrPubKeys.length > 0) {
        this.relay.fetchProfile(nostrPubKeys);
      }
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch projects'
      );
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  getProject(id: string): IndexedProject | undefined {
    return this.projects().find((p) => p.projectIdentifier === id);
  }

  /**
   * Fetches a single project by its identifier.
   *
   * The OP_RETURN of the founding transaction is decoded to obtain the
   * blockchain-authoritative Nostr event ID, replacing whatever value the
   * indexer stored.
   */
  async fetchProject(id: string): Promise<IndexedProject | null> {
    // Ensure deny list and whitelist are loaded before filtering
    await Promise.all([
      this.denyService.loadDenyList(),
      this.featuredService.loadFeaturedProjects()
    ]);
    this.hubConfig.setListsLoaded(true);

    try {
      this.loading.set(true);
      const result = await this.fetchJson<IndexedProject>(
        `${this.indexerUrl}api/query/Angor/projects/${id}`
      );

      if (result && result.data) {
        // Filter by the project's Nostr pubkey (from details), not founderKey
        const nostrPubKey = result.data.details?.nostrPubKey;
        if (nostrPubKey && !this.hubConfig.shouldShowProject(nostrPubKey)) {
          this.error.set(`Project ${id} is not available.`);
          return null;
        }
      }

      const project = result.data;
      if (!project) return null;

      // Verify and correct the Nostr event ID via OP_RETURN
      if (project.trxId) {
        // Check cache first
        const cached = this.verification.getCachedEventId(project.trxId);
        if (cached) {
          project.nostrEventId = cached;
        } else {
          try {
            const txHex = await this.fetchTxHex(project.trxId);

            if (txHex) {
              const embeddedEventId = this.verification.extractOpReturnEventId(txHex);
              if (embeddedEventId) {
                if (embeddedEventId !== project.nostrEventId?.toLowerCase()) {
                  console.warn(
                    `[Angor] nostrEventId corrected for project ${id}: ` +
                    `indexer="${project.nostrEventId}" -> op_return="${embeddedEventId}"`
                  );
                }
                project.nostrEventId = embeddedEventId;
                this.verification.cacheEventId(project.trxId, embeddedEventId);
              } else {
                console.warn(
                  `[Angor] No OP_RETURN found in transaction ${project.trxId} for project ${id}`
                );
              }
            }
          } catch (err) {
            // Fall back to the indexer-supplied nostrEventId
            console.warn(`[Angor] Could not verify OP_RETURN for project ${id}:`, err);
          }
        }
      }

      return project;
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : `Failed to fetch project ${id}`
      );
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  async fetchProjectStats(id: string): Promise<ProjectStats | null> {
    try {
      this.loading.set(true);
      const url = `${this.indexerUrl}api/query/Angor/projects/${id}/stats`;

      const stats = (await this.fetchJson<ProjectStats>(url)).data;

      stats.amountInvested = Number(stats.amountInvested) || 0;
      stats.amountSpentSoFarByFounder = Number(stats.amountSpentSoFarByFounder) || 0;
      stats.amountInPenalties = Number(stats.amountInPenalties) || 0;

      return stats;
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error
          ? err.message
          : `Failed to fetch stats for project ${id}`
      );
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  async fetchProjectInvestments(
    projectId: string,
    offset = 0,
    limit = 10
  ): Promise<ProjectInvestment[]> {
    try {
      const url = `${this.indexerUrl}api/query/Angor/projects/${projectId}/investments?offset=${offset}&limit=${limit}`;
      return (await this.fetchJson<ProjectInvestment[]>(url)).data;
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error
          ? err.message
          : `Failed to fetch investments for project ${projectId}`
      );
      return [];
    }
  }

  async fetchInvestorDetails(
    projectId: string,
    investorKey: string
  ): Promise<ProjectInvestment | null> {
    try {
      const url = `${this.indexerUrl}api/query/Angor/projects/${projectId}/investments/${investorKey}`;
      return (await this.fetchJson<ProjectInvestment>(url)).data;
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch investor details'
      );
      return null;
    }
  }

  async getSupply(): Promise<Supply | null> {
    try {
      const url = `${this.indexerUrl}api/insight/supply`;
      return (await this.fetchJson<Supply>(url)).data;
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch supply'
      );
      return null;
    }
  }

  async getCirculatingSupply(): Promise<number> {
    try {
      const url = `${this.indexerUrl}api/insight/supply/circulating`;
      return (await this.fetchJson<number>(url)).data;
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error
          ? err.message
          : 'Failed to fetch circulating supply'
      );
      return 0;
    }
  }

  async getAddressBalance(address: string): Promise<AddressBalance | null> {
    try {
      const url = `${this.indexerUrl}api/query/address/${address}`;
      return (await this.fetchJson<AddressBalance>(url)).data;
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch address balance'
      );
      return null;
    }
  }

  async getAddressTransactions(
    address: string,
    offset = 0,
    limit = 10
  ): Promise<Transaction[]> {
    try {
      const url = `${this.indexerUrl}api/query/address/${address}/transactions?offset=${offset}&limit=${limit}`;
      return (await this.fetchJson<Transaction[]>(url)).data;
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error
          ? err.message
          : 'Failed to fetch address transactions'
      );
      return [];
    }
  }

  async getTransaction(txId: string): Promise<Transaction | null> {
    try {
      const url = `${this.indexerUrl}api/query/transaction/${txId}`;
      return (await this.fetchJson<Transaction>(url)).data;
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch transaction'
      );
      return null;
    }
  }

  async getTransactionHex(txId: string): Promise<string | null> {
    return this.fetchTxHex(txId);
  }

  async getBlocks(offset?: number, limit = 10): Promise<Block[]> {
    try {
      const url = `${this.indexerUrl}api/query/block?${offset !== undefined ? `offset=${offset}&` : ''
        }limit=${limit}`;
      return (await this.fetchJson<Block[]>(url)).data;
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch blocks'
      );
      return [];
    }
  }

  async getBlockByHash(hash: string): Promise<Block | null> {
    try {
      const url = `${this.indexerUrl}api/query/block/${hash}`;
      return (await this.fetchJson<Block>(url)).data;
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch block'
      );
      return null;
    }
  }

  async getBlockByHeight(height: number): Promise<Block | null> {
    try {
      const url = `${this.indexerUrl}api/query/block/index/${height}`;
      return (await this.fetchJson<Block>(url)).data;
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch block by height'
      );
      return null;
    }
  }

  async getNetworkStats(): Promise<NetworkStats | null> {
    try {
      const url = `${this.indexerUrl}api/stats`;
      const response = (await this.fetchJson<NetworkStats>(url)).data;
      return response !== undefined ? response : null;
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch network stats'
      );
      return null;
    }
  }

  async getHeartbeat(): Promise<boolean> {
    try {
      const url = `${this.indexerUrl}api/stats/heartbeat`;
      await fetch(url);
      return true;
    } catch {
      return false;
    }
  }

  async loadMore(): Promise<void> {
    if (!this.totalProjectsFetched) {
      await this.fetchProjects();
    }
  }

  resetProjects(): void {
    this.oldestEventTimestamp = undefined;
    this.totalProjectsFetched = false;
    this._allProjects.set([]);
    this.fetchProjects(true);
  }

  isComplete(): boolean {
    return this.totalProjectsFetched;
  }

  restoreOffset(offset: number) {
    // For Nostr-first, offset is actually the `until` timestamp cursor
    this.oldestEventTimestamp = offset || undefined;
  }

  getCurrentOffset(): number {
    // Returns the current pagination cursor (oldest event timestamp)
    return this.oldestEventTimestamp ?? 0;
  }

  getTotalItems(): number {
    // With Nostr-first discovery, we don't know the total count upfront
    return this._allProjects().length;
  }
}
