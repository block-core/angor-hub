import { Injectable, signal, inject } from '@angular/core';
import { ProjectUpdate, RelayService } from './relay.service';
import { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { NetworkService } from './network.service';
import { DenyService } from './deny.service';
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
  private indexerUrl = 'https://tbtc.indexer.angor.io/';

  // Offset-based pagination (same as original — restores reliable project listing)
  private offset = -1000;
  private totalItems = 0;
  private totalProjectsFetched = false;

  private relay = inject(RelayService);
  private denyService = inject(DenyService);
  private verification = inject(NostrProjectVerificationService);

  public loading = signal<boolean>(false);
  public projects = signal<IndexedProject[]>([]);
  public error = signal<string | null>(null);
  private network = inject(NetworkService);

  public indexers = signal<IndexerConfig>({
    mainnet: [
      { url: 'https://explorer.angor.io/', isPrimary: false },
      { url: 'https://fulcrum.angor.online/', isPrimary: true },
      { url: 'https://electrs.angor.online/', isPrimary: false }
    ],
    testnet: [
      { url: 'https://tbtc.indexer.angor.io/', isPrimary: false },
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
      testnet: [{ url: 'https://tbtc.indexer.angor.io/', isPrimary: true }]
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
      (isMainnet ? 'https://explorer.angor.io/' : 'https://tbtc.indexer.angor.io/');
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
   * The /hex endpoint may return a plain text hex string (not JSON)
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

    this.projects.update((projects) =>
      projects.map((project) => {
        if (project.founderKey === pubkey) {
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
   * Updates a project's details when a verified kind 3030 event arrives via
   */
  private updateProjectDetails(event: NDKEvent) {
    try {
      const details: ProjectUpdate = JSON.parse(event.content);
      this.projects.update((projects) =>
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
    } catch {
    }
  }

  /**
   * Fetches a paginated batch of projects.
   *
   * Nostr-first verification flow:
   *   Discover projects from the indexer (only the Bitcoin chain knows what
   *     projects exist on-chain; there is no practical way to enumerate them
   *     from Nostr without knowing the specific event IDs first).
   *  For each project, fetch the founding transaction hex and decode the
   *     OP_RETURN to obtain the blockchain-authoritative Nostr event ID.
   *   Replace the indexer's nostrEventId with the OP_RETURN value whenever
   *     it is successfully decoded — the indexer's value is never trusted blindly.
   *  Calling relay.fetchListData() with the verified event IDs so that the
   *     project content (profile, details) always comes from Nostr.
   *
   * Now a project whose indexer record carries a tampered nostrEventId will
   * have it silently corrected to the real on-chain value, and the Nostr fetch
   * will retrieve the genuine project event.  If OP_RETURN decoding fails for
   * any reason (network error, tx not yet indexed) the original nostrEventId is
   * used as a fallback so the page remains functional.
   */
  async fetchProjects(reset = false): Promise<void> {
    if (reset) {
      this.offset = -1000;
      this.totalProjectsFetched = false;
      this.totalItems = 0;
      this.projects.set([]);
    }

    if (this.loading()) {
      return;
    }

    try {
      await this.denyService.loadDenyList();

      this.loading.set(true);
      this.error.set(null);
      let limit = this.LIMIT;

      const isFirstLoad = this.offset === -1000;

      if (!isFirstLoad && this.offset < 0) {
        limit = this.LIMIT + this.offset;
        this.offset = 0;
        this.totalProjectsFetched = true;
      }

      if (limit <= 0) {
        this.loading.set(false);
        this.totalProjectsFetched = true;
        return;
      }

      const params = new URLSearchParams();
      params.append('limit', limit.toString());

      if (!isFirstLoad && this.offset >= 0) {
        params.append('offset', this.offset.toString());
      }

      const url = `${this.indexerUrl}api/query/Angor/projects?${params.toString()}`;
      const { data: response, headers } = await this.fetchJson<IndexedProject[]>(url);

      if (Array.isArray(response) && response.length > 0) {
        // Filter out denied projects
        const filteredResponse: IndexedProject[] = [];
        for (const item of response) {
          const isDenied = await this.denyService.isEventDenied(item.projectIdentifier);
          if (!isDenied) {
            filteredResponse.push(item);
          }
        }

        if (isFirstLoad) {
          this.totalItems = parseInt(headers.get('pagination-total') || '0');
          this.offset = Math.max(0, this.totalItems - limit);
        } else {
          this.offset = Math.max(0, this.offset - this.LIMIT);
        }

        if (this.offset === 0 && !isFirstLoad) {
          this.totalProjectsFetched = true;
        }

        if (filteredResponse.length > 0) {
          // Nostr-first verification 
          // For each project, attempt to decode the OP_RETURN from its founding
          // transaction and replace nostrEventId with the on-chain value.
          await Promise.all(
            filteredResponse.map(async (project) => {
              if (!project.trxId) return;

              const txHex = await this.fetchTxHex(project.trxId);
              if (!txHex) return;

              const embeddedId = this.verification.extractOpReturnEventId(txHex);
              if (!embeddedId) return;

              if (embeddedId !== project.nostrEventId?.toLowerCase()) {
                console.warn(
                  `[Angor] nostrEventId corrected for ${project.projectIdentifier}: ` +
                  `indexer="${project.nostrEventId}" → op_return="${embeddedId}"`
                );
              }

          
              project.nostrEventId = embeddedId;
            })
          );

          this.projects.update((existing) => {
            const merged = [...existing];
            const existingIds = new Set(existing.map(p => p.projectIdentifier));

            filteredResponse.forEach((newProject) => {
              if (!existingIds.has(newProject.projectIdentifier)) {
                merged.push(newProject);
                existingIds.add(newProject.projectIdentifier);
              }
            });

            return merged;
          });

          // Fetch Nostr events by the OP_RETURN-verified event IDs
          const verifiedEventIds = filteredResponse.map((project) => project.nostrEventId);
          if (verifiedEventIds.length > 0) {
            this.relay.fetchListData(verifiedEventIds);
          }
        }
      } else {
        this.totalProjectsFetched = true;
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
   * indexer stored.  The project component then fetches the Nostr event using
   * this verified ID, so the correct event is always displayed.
   */
  async fetchProject(id: string): Promise<IndexedProject | null> {
    await this.denyService.loadDenyList();
    if (await this.denyService.isEventDenied(id)) {
      this.error.set(`Project ${id} is not available.`);
      return null;
    }

    try {
      this.loading.set(true);
      const result = await this.fetchJson<IndexedProject>(
        `${this.indexerUrl}api/query/Angor/projects/${id}`
      );
      const project = result.data;

      if (!project) return null;

      if (await this.denyService.isEventDenied(project.projectIdentifier)) {
        this.error.set(`Project ${id} is not available.`);
        return null;
      }

      // Verify and correct the Nostr event ID via OP_RETURN
      if (project.trxId) {
        try {
          const txHex = await this.fetchTxHex(project.trxId);

          if (txHex) {
            const embeddedEventId = this.verification.extractOpReturnEventId(txHex);
            if (embeddedEventId) {
              if (embeddedEventId !== project.nostrEventId?.toLowerCase()) {
                console.warn(
                  `[Angor] nostrEventId corrected for project ${id}: ` +
                  `indexer="${project.nostrEventId}" → op_return="${embeddedEventId}"`
                );
              }
              project.nostrEventId = embeddedEventId;
            } else {
              console.warn(
                `[Angor] No OP_RETURN found in transaction ${project.trxId} for project ${id}`
              );
            }
          }
        } catch (err) {
          // fall back to the indexer-supplied nostrEventId
          console.warn(`[Angor] Could not verify OP_RETURN for project ${id}:`, err);
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
    this.offset = -1000;
    this.totalProjectsFetched = false;
    this.totalItems = 0;
    this.projects.set([]);
    this.fetchProjects(true);
  }

  isComplete(): boolean {
    return this.totalProjectsFetched;
  }

  restoreOffset(offset: number) {
    this.offset = offset;
  }

  getCurrentOffset(): number {
    return this.offset;
  }

  getTotalItems(): number {
    return this.totalItems;
  }
}
