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

  members?: string[]; // Array of member public keys
  members_created_at: number | undefined;

  media?: any[]; // Array of media objects
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
  // Add more transaction properties as needed
}

export interface Block {
  hash: string;
  height: number;
  // Add more block properties as needed
}

export interface NetworkStats {
  connections: number;
  blockHeight: number;
  // Add more stats properties as needed
}

@Injectable({
  providedIn: 'root',
})
export class IndexerService {
  private readonly LIMIT = 6;
  private indexerUrl = 'https://tbtc.indexer.angor.io/';
  private offset = -1000; // Change back to simple number
  private totalItems = 0;
  private totalProjectsFetched = false;
  private relay = inject(RelayService);
  private readonly pageSize = 100;
  private denyService = inject(DenyService);

  public loading = signal<boolean>(false);
  public projects = signal<IndexedProject[]>([]);
  public error = signal<string | null>(null);
  private network = inject(NetworkService);
  
  // Add signals for indexer configuration
  public indexers = signal<IndexerConfig>({
    mainnet: [{ url: 'https://explorer.angor.io/', isPrimary: true }],
    testnet: [{ url: 'https://tbtc.indexer.angor.io/', isPrimary: true }]
  });

  constructor() {
    // Subscribe to both profile and project updates
    this.relay.profileUpdates.subscribe((update) => {
      this.updateProjectMetadata(update);
    });

    this.relay.projectUpdates.subscribe((update) => {
      this.updateProjectDetails(update);
    });

    // Load saved indexers from localStorage
    this.loadIndexerConfig();
    
    // Set the active indexer URL based on the current network
    this.updateActiveIndexer();
  }
  
  private loadIndexerConfig(): void {
    const savedConfig = localStorage.getItem('angor-indexers');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig) as IndexerConfig;
        this.indexers.set(config);
      } catch (error) {
        console.error('Failed to parse saved indexer config', error);
        // Keep default config if parsing fails
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
      mainnet: [{ url: 'https://explorer.angor.io/', isPrimary: true }],
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
    
    // Reset projects when indexer changes
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
    // Normalize URL format (ensure ending with slash)
    let normalizedUrl = url;
    if (!normalizedUrl.endsWith('/')) {
      normalizedUrl += '/';
    }
    
    // Check if indexer already exists
    const networkKey = isMainnet ? 'mainnet' : 'testnet';
    const exists = this.indexers()[networkKey].some(indexer => indexer.url === normalizedUrl);
    
    if (exists) {
      return false;
    }
    
    // Add new indexer
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
      // Remove the indexer
      const filteredIndexers = config[networkKey].filter(indexer => indexer.url !== url);
      
      // If we removed the primary indexer, make the first remaining one primary
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
    try {
      const response = await fetch(`${url}api/stats/heartbeat`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
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
          // Only update if the new event is newer than existing metadata
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
          // Only update if the new event is newer than existing details
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

      // If the next offset is negative, substract that from the limit.
      if (this.offset !== -1000 && this.offset < 0) {
        limit = this.LIMIT + this.offset;
        console.log('LIMIT SUBSTRACTED:', limit);
        this.offset = 0;
        this.totalProjectsFetched = true;
      }

      // When there is no new page to fetch, we should not make a request.
      if (limit == 0) {
        this.loading.set(false);
        return;
      }

      const params = new URLSearchParams();
      params.append('limit', limit.toString());

      if (this.offset > -1000) {
        params.append('offset', this.offset.toString());
      }

      const url = `${
        this.indexerUrl
      }api/query/Angor/projects?${params.toString()}`;
      // console.log('Fetching:', url);

      const { data: response, headers } = await this.fetchJson<
        IndexedProject[]
      >(url);

      if (Array.isArray(response) && response.length > 0) {
        // Filter out denied projects
        const filteredResponse: IndexedProject[] = [];
  
        for (const item of response) {
          const isDenied = await this.denyService.isEventDenied(item.projectIdentifier);
          if (!isDenied) {
            filteredResponse.push(item);
          }
        }
      
        if (this.offset === -1000) {
          this.totalItems = parseInt(headers.get('pagination-total') || '0');
          this.offset = Math.max(0, this.totalItems - limit - limit);
        } else {
          const nextOffset = this.offset - this.LIMIT;
          this.offset = nextOffset;
        }

        // Merge new projects with existing ones, avoiding duplicates
        this.projects.update((existing) => {
          const merged = [...existing];

          filteredResponse.forEach((newProject) => {
            const existingIndex = merged.findIndex(
              (p) => p.projectIdentifier === newProject.projectIdentifier
            );
            if (existingIndex === -1) {
              merged.push(newProject);
            }
          });

          return merged;
        });

        const eventIds = filteredResponse.map((project) => project.nostrEventId);
        // const eventIds = filteredResponse.map((project) => project.nostrEventId);

        if (eventIds.length > 0) {
          this.relay.fetchListData(eventIds);
        }
      } else {
        this.totalProjectsFetched = true;
      }
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to fetch projects'
      );
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  // async getProjects() {
  //   try {
  //     await this.denyService.loadDenyList();

  //     // Initial request to get total count
  //     const response = await fetch(
  //       `${this.indexerUrl}api/query/Angor/projects`
  //     );
  //     const total = parseInt(
  //       response.headers.get('pagination-total') || '0',
  //       this.LIMIT
  //     );

  //     let currentOffset = 0;
  //     const allProjects: IndexedProject[] = [];

  //     // Continue fetching while there are more items
  //     while (currentOffset < total) {
  //       const batch = await this.fetchProjectsBatch(
  //         currentOffset,
  //         this.pageSize
  //       );
  //       if (!batch || batch.length === 0) break;

  //       // Filter out denied projects
  //       const filteredBatch = batch.filter(
  //         project => !this.denyService.isEventDenied(project.nostrEventId)
  //       );

  //       allProjects.push(...filteredBatch);
  //       currentOffset += this.pageSize;
  //     }

  //     this.projects.set(allProjects);
  //     return allProjects;
  //   } catch (error) {
  //     console.error('Error fetching projects:', error);
  //     throw error;
  //   }
  // }

  private async fetchProjectsBatch(offset: number, limit: number) {
    console.log('fetchProjectsBatch');
    // If the offset is lower than limit, it means we have reached the last page.
    // At this time, we MUST make sure to not get more than the offset as limit, or
    // there will be duplicate entries.
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
    try {
      this.loading.set(true);
      const project = await this.fetchJson<IndexedProject>(
        `${this.indexerUrl}api/query/Angor/projects/${id}`
      );
      if (project) {
        // TODO: VERIFY IF THIS ACTUALLY WORKS, it relies on FOUNDERKEY which is not nostr pub key.
        // Fetch profile in an array of one
        this.relay.fetchProfile([project.data.founderKey]);
      }

      return project.data;
    } catch (err) {
      this.error.set(
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
      // console.log('Fetching project stats:', url);

      const stats = (await this.fetchJson<ProjectStats>(url)).data;

      // Convert amounts from satoshis to BTC
      stats.amountInvested = stats.amountInvested;
      stats.amountSpentSoFarByFounder = stats.amountSpentSoFarByFounder;
      stats.amountInPenalties = stats.amountInPenalties;

      return stats;
    } catch (err) {
      this.error.set(
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
      this.error.set(
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
      this.error.set(
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
      this.error.set(
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
      this.error.set(
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
      this.error.set(
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
      this.error.set(
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
      this.error.set(
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
      this.error.set(
        err instanceof Error ? err.message : 'Failed to fetch transaction hex'
      );
      return null;
    }
  }

  async getBlocks(offset?: number, limit = 10): Promise<Block[]> {
    try {
      const url = `${this.indexerUrl}api/query/block?${
        offset !== undefined ? `offset=${offset}&` : ''
      }limit=${limit}`;
      return (await this.fetchJson<Block[]>(url)).data;
    } catch (err) {
      this.error.set(
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
      this.error.set(
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
      this.error.set(
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
      this.error.set(
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
    this.offset = 0;
    this.totalProjectsFetched = false;
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
