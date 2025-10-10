import { Injectable, signal, inject, effect } from '@angular/core';
import { ProfileUpdate, ProjectUpdate, RelayService } from './relay.service';
import { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { NetworkService } from './network.service';
import { DenyService } from './deny.service';
import { ExternalIdentity } from '../models/models';

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
  private offset = -1000;
  private totalItems = 0;
  private totalProjectsFetched = false;
  private relay = inject(RelayService);
  private readonly pageSize = 100;
  private denyService = inject(DenyService);

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

    this.relay.projectUpdates.subscribe((update) => {
      this.updateProjectDetails(update);
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
          // Connection restored, do not show error
          console.log(`Indexer connection restored after ${i + 1} attempt(s)`);
          return;
        }
      } catch (retryError) {
        console.debug(`Retry ${i + 1} failed:`, retryError);
      }
      
      // Wait before next retry (except for the last attempt)
      if (i < retryCount - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // All retries failed, show error
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

  private updateProjectDetails(details: any) {
    this.projects.update((projects) =>
      projects.map((project) => {
        if (project.projectIdentifier === details.projectIdentifier) {

          if (
            !project.details_created_at ||
            details.created_at > project.details_created_at
          ) {
            return {
              ...project,
              details,
              details_created_at: details.created_at,
            };
          }
        }
        return project;
      })
    );
  }

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
        console.log('LIMIT SUBSTRACTED:', limit);
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
        const filteredResponse: IndexedProject[] = [];
        for (const item of response) {
          const isDenied = await this.denyService.isEventDenied(item.projectIdentifier);
          if (!isDenied) {
            filteredResponse.push(item);
          }
        }

        if (filteredResponse.length === 0 && response.length > 0) {
          console.log(`All ${response.length} fetched projects were denied.`);
        }

        if (isFirstLoad) {
          this.totalItems = parseInt(headers.get('pagination-total') || '0');
          
          this.offset = Math.max(0, this.totalItems - limit);
        } else {
          this.offset = Math.max(0, this.offset - this.LIMIT);
        }

        if (this.offset === 0 && !isFirstLoad) {
          this.totalProjectsFetched = true;
          console.log('Reached beginning of projects list');
        }

        if (filteredResponse.length > 0) {
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

          const eventIds = filteredResponse.map((project) => project.nostrEventId);

          if (eventIds.length > 0) {
            this.relay.fetchListData(eventIds);
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

  private async fetchProjectsBatch(offset: number, limit: number) {
    console.log('fetchProjectsBatch');



    if (offset < limit) {
      console.log('LIMIT HIGHER THAN OFFSET!!', offset, limit);
      limit = offset;
    }

    const url = `${this.indexerUrl}api/query/Angor/projects?offset=${offset}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }

  getProject(id: string): IndexedProject | undefined {
    return this.projects().find((p) => p.projectIdentifier === id);
  }

  async fetchProject(id: string): Promise<IndexedProject | null> {

    await this.denyService.loadDenyList();
    if (await this.denyService.isEventDenied(id)) {
      this.error.set(`Project ${id} is not available.`);
      return null;
    }

    try {
      this.loading.set(true);
      const project = await this.fetchJson<IndexedProject>(
        `${this.indexerUrl}api/query/Angor/projects/${id}`
      );
      if (project && project.data) {

        if (await this.denyService.isEventDenied(project.data.projectIdentifier)) {
          this.error.set(`Project ${id} is not available.`);
          return null;
        }
      }

      return project.data;
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
    try {
      const url = `${this.indexerUrl}api/query/transaction/${txId}/hex`;
      const response = (await this.fetchJson<string>(url)).data;
      return response !== undefined ? response : null;
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch transaction hex'
      );
      return null;
    }
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
