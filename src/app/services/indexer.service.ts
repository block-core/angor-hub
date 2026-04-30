import { Injectable, signal, inject, computed } from '@angular/core';
import { ProjectUpdate, RelayService } from './relay.service';
import { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { NetworkService } from './network.service';
import { DenyService } from './deny.service';
import { FeaturedService } from './featured.service';
import { HubConfigService } from './hub-config.service';
import { ExternalIdentity } from '../models/models';
import { NostrProjectVerificationService } from './nostr-project-verification.service';
import { bech32, bech32m } from '@scure/base';

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
  /** Whether the project has been validated against the indexer (on-chain). */
  verified?: boolean;
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

// Minimal types for the mempool.space-compatible API responses
// (mirrors MempoolSpaceIndexerApi.cs models)
interface MempoolVout {
  value: number;
  scriptpubkey: string;
  scriptpubkey_address: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
}

interface MempoolTxStatus {
  confirmed: boolean;
  block_height: number;
  block_hash: string;
  block_time: number;
}

interface MempoolTx {
  txid: string;
  vin: { txid: string; vout: number; witness?: string[]; inner_witnessscript_asm?: string }[];
  vout: MempoolVout[];
  status: MempoolTxStatus;
}

interface MempoolAddressStats {
  funded_txo_sum: number;
  spent_txo_sum: number;
  tx_count: number;
}

interface MempoolAddressResponse {
  address: string;
  chain_stats: MempoolAddressStats;
  mempool_stats: MempoolAddressStats;
}

@Injectable({
  providedIn: 'root',
})
export class IndexerService {
  private readonly LIMIT = 8;
  private indexerUrl = 'https://signet.angor.online/';

  // Mempool.space pagination — the API returns at most 25 transactions per page.
  private readonly MEMPOOL_PAGE_SIZE = 25;
  // Safety cap on address transaction pagination (25 × 20 = 500 txs max).
  private readonly MEMPOOL_MAX_PAGES = 20;

  // Nostr-first cursor-based pagination (using `until` timestamp)
  private oldestEventTimestamp: number | undefined;
  private totalProjectsFetched = false;
  private fetchPromise: Promise<void> | null = null;

  // In-memory cache for mempool address transactions (avoids duplicate fetches
  // between validation and stats loading). Keyed by Bitcoin address.
  private mempoolTxCache = new Map<string, { txs: MempoolTx[]; timestamp: number }>();
  private readonly MEMPOOL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // localStorage key for persisting validated projects across page reloads
  private readonly PROJECTS_CACHE_KEY = 'angor_projects_cache';

  private relay = inject(RelayService);
  private denyService = inject(DenyService);
  private featuredService = inject(FeaturedService);
  private hubConfig = inject(HubConfigService);
  private verification = inject(NostrProjectVerificationService);

  public loading = signal<boolean>(false);
  /** Number of projects currently being validated (for skeleton display). */
  public validatingCount = signal<number>(0);
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

  /**
   * Returns the network-scoped localStorage key for the projects cache.
   */
  private getProjectsCacheKey(): string {
    const net = this.network.isMain() ? 'main' : 'test';
    return `${this.PROJECTS_CACHE_KEY}_${net}`;
  }

  /**
   * Loads validated projects from localStorage for instant display on page refresh.
   * Only loads projects that are verified (have on-chain validation data).
   */
  loadCachedProjects(): boolean {
    try {
      const raw = localStorage.getItem(this.getProjectsCacheKey());
      if (!raw) return false;
      const cached: IndexedProject[] = JSON.parse(raw);
      if (!Array.isArray(cached) || cached.length === 0) return false;

      // Only restore verified projects
      const verified = cached.filter(p => p.verified);
      if (verified.length === 0) return false;

      this._allProjects.set(verified);
      console.log(`[Angor Debug] Loaded ${verified.length} cached projects from localStorage`);
      return true;
    } catch {
      localStorage.removeItem(this.getProjectsCacheKey());
      return false;
    }
  }

  /**
   * Persists the current validated projects to localStorage.
   * Called after validation completes or profiles update.
   */
  private saveProjectsToCache(): void {
    try {
      const projects = this._allProjects().filter(p => p.verified);
      if (projects.length === 0) return;

      // Strip stats (they change frequently) and keep essential data small
      const toCache = projects.map(p => ({
        ...p,
        stats: undefined,
      }));
      localStorage.setItem(this.getProjectsCacheKey(), JSON.stringify(toCache));
    } catch {
      // localStorage full — silently fail
    }
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
    // Use mempool.space-compatible endpoints to test connectivity
    const endpoints = ['api/v1/blocks/tip/height', 'api/v1/fees/recommended'];

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
      const err = new Error(`HTTP error! status: ${response.status}`);
      (err as any).status = response.status;
      throw err;
    }
    return {
      data: await response.json(),
      headers: response.headers,
    };
  }

  /**
   * Returns true if the error represents an HTTP 404 Not Found response.
   */
  private isNotFoundError(err: unknown): boolean {
    return err instanceof Error && (err as any).status === 404;
  }

  // ---------------------------------------------------------------------------
  // Mempool.space-compatible API helpers
  // These replace the dead /api/query/Angor/... endpoints with standard
  // /api/v1/... endpoints that the Blockcore indexers expose.
  // Mirrors the logic in MempoolIndexerAngorApi.cs + MempoolIndexerMappers.cs.
  // ---------------------------------------------------------------------------

  /**
   * Converts an Angor project identifier (bech32 "angor" HRP) to a standard
   * Bitcoin witness address (bech32/bech32m with "bc"/"tb" HRP) for use with
   * the mempool.space-compatible API.
   *
   * Mirrors C# DerivationOperations.ConvertAngorKeyToBitcoinAddress.
   */
  private convertAngorKeyToBitcoinAddress(projectId: string): string {
    let decoded: { prefix: string; words: number[] };
    let isBech32m = false;
    try {
      decoded = bech32m.decode(projectId as `angor1${string}`);
      isBech32m = true;
    } catch {
      decoded = bech32.decode(projectId as `angor1${string}`);
    }
    const witnessVersion = decoded.words[0];
    const dataWords = decoded.words.slice(1);
    const hrp = this.network.isMain() ? 'bc' : 'tb';
    return witnessVersion === 0 || !isBech32m
      ? bech32.encode(hrp, [witnessVersion, ...dataWords])
      : bech32m.encode(hrp, [witnessVersion, ...dataWords]);
  }

  /**
   * Parses a Bitcoin script hex string into its pushdata operations.
   * Returns an array where each element is the bytes of a pushdata op;
   * OP_RETURN itself is represented as an empty Uint8Array.
   */
  private parseScriptOps(hex: string): Uint8Array[] {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    const ops: Uint8Array[] = [];
    let i = 0;
    while (i < bytes.length) {
      const opcode = bytes[i++];
      if (opcode === 0x6a) { ops.push(new Uint8Array(0)); continue; } // OP_RETURN
      if (opcode >= 0x01 && opcode <= 0x4b) { ops.push(bytes.slice(i, i + opcode)); i += opcode; continue; }
      if (opcode === 0x4c) { const len = bytes[i++]; ops.push(bytes.slice(i, i + len)); i += len; continue; }
      ops.push(new Uint8Array(0));
    }
    return ops;
  }

  /**
   * Parses the OP_RETURN of a project-funding transaction.
   * Format: OP_RETURN <founder_pubkey 33B> <key_type 2B> <nostr_event_id 32B>
   */
  private parseOpReturnFounderInfo(scriptpubkeyHex: string): { founderKey: string; nostrEventId: string } | null {
    try {
      const ops = this.parseScriptOps(scriptpubkeyHex);
      if (ops.length < 4) return null;
      if (!ops[1] || ops[1].length !== 33) return null;
      const toHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
      return {
        founderKey: toHex(ops[1]),
        nostrEventId: ops[3]?.length === 32 ? toHex(ops[3]) : '',
      };
    } catch {
      return null;
    }
  }

  /**
   * Parses the OP_RETURN of an investor transaction.
   * Format: OP_RETURN <investor_pubkey 33B> [<secret_hash 32B>]
   * Returns the investor public key hex, or null if not an investment tx.
   */
  private parseOpReturnInvestorInfo(scriptpubkeyHex: string): string | null {
    try {
      const ops = this.parseScriptOps(scriptpubkeyHex);
      if (ops.length < 2) return null;
      if (!ops[1] || ops[1].length !== 33) return null;
      return Array.from(ops[1]).map(x => x.toString(16).padStart(2, '0')).join('');
    } catch {
      return null;
    }
  }

  /**
   * Fetches all transactions for a Bitcoin address from the mempool.space-
   * compatible API, paginating with ?after_txid= as needed.
   */
  private async fetchMempoolAddressTxs(address: string): Promise<MempoolTx[]> {
    // Check in-memory cache first
    const cached = this.mempoolTxCache.get(address);
    if (cached && (Date.now() - cached.timestamp) < this.MEMPOOL_CACHE_TTL_MS) {
      return cached.txs;
    }

    const all: MempoolTx[] = [];
    let lastTxId: string | undefined;

    for (let page = 0; page < this.MEMPOOL_MAX_PAGES; page++) {
      let url = `${this.indexerUrl}api/v1/address/${address}/txs`;
      if (lastTxId) url += `?after_txid=${lastTxId}`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 404) break;
          throw new Error(`HTTP ${response.status}`);
        }
        const txs: MempoolTx[] = await response.json();
        if (!txs || txs.length === 0) break;
        all.push(...txs);
        if (txs.length < this.MEMPOOL_PAGE_SIZE) break;
        lastTxId = txs[txs.length - 1].txid;
      } catch (err) {
        console.warn('[Angor Debug] fetchMempoolAddressTxs error:', err);
        break;
      }
    }

    // Cache the result for reuse by stats loading
    if (all.length > 0) {
      this.mempoolTxCache.set(address, { txs: all, timestamp: Date.now() });
    }
    return all;
  }

  /**
   * Looks up a project's on-chain data from the mempool API.
   * Fetches transactions at the project's Bitcoin address, finds the funding
   * transaction, and extracts founderKey, nostrEventId, trxId, and block height.
   *
   * Mirrors MempoolIndexerAngorApi.GetProjectByIdAsync (ReadFromAngorApi=false).
   */
  private async fetchProjectFromMempool(projectId: string): Promise<{
    founderKey: string;
    nostrEventId: string;
    trxId: string;
    createdOnBlock: number;
  } | null> {
    try {
      const address = this.convertAngorKeyToBitcoinAddress(projectId);
      const txs = await this.fetchMempoolAddressTxs(address);
      if (!txs.length) return null;

      // Sort oldest-first — the funding transaction is the first at this address
      const sorted = [...txs].sort((a, b) => {
        const aH = a.status.confirmed ? a.status.block_height : Number.MAX_SAFE_INTEGER;
        const bH = b.status.confirmed ? b.status.block_height : Number.MAX_SAFE_INTEGER;
        return aH - bH;
      });

      for (const tx of sorted) {
        if (tx.vout.length < 2) continue;
        const opReturn = tx.vout[1];
        if (opReturn.scriptpubkey_type !== 'op_return' && opReturn.scriptpubkey_type !== 'nulldata') continue;
        const parsed = this.parseOpReturnFounderInfo(opReturn.scriptpubkey);
        if (parsed) {
          return {
            founderKey: parsed.founderKey,
            nostrEventId: parsed.nostrEventId,
            trxId: tx.txid,
            createdOnBlock: tx.status.confirmed ? tx.status.block_height : 0,
          };
        }
      }
      return null;
    } catch (err) {
      console.warn(`[Angor Debug] fetchProjectFromMempool ${projectId}: error`, err);
      return null;
    }
  }

  /**
   * Fetches a raw transaction hex string from the mempool.space-compatible API.
   * The /hex endpoint returns a plain text hex string.
   */
  private async fetchTxHex(txId: string): Promise<string | null> {
    try {
      const url = `${this.indexerUrl}api/v1/tx/${txId}/hex`;
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

    // Persist updated metadata to cache for instant display on refresh
    this.saveProjectsToCache();
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
   * Fetches projects using an optimistic Nostr-first discovery approach.
   *
   * Flow:
   *   1. Query Nostr relays for the latest kind 3030 events.
   *   2. Parse each event — immediately add projects to the view so the
   *      user sees content right away (with metadata/images loading).
   *   3. Kick off profile fetches from Nostr in parallel with validation.
   *   4. Validate each project against the indexer (cache or API) in the
   *      background. Remove any projects that fail validation.
   *
   * This "show first, validate in background" approach gives near-instant
   * rendering while still ensuring only on-chain-verified projects remain.
   *
   * Pagination uses Nostr's `until` parameter (timestamp cursor) instead
   * of offset-based pagination against the indexer.
   */
  async fetchProjects(reset = false): Promise<void> {
    if (reset) {
      this.oldestEventTimestamp = undefined;
      this.totalProjectsFetched = false;
      this._allProjects.set([]);
      this.fetchPromise = null;
    }

    // If a fetch is already in flight, wait for it instead of silently returning
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = this._doFetchProjects();
    try {
      await this.fetchPromise;
    } finally {
      this.fetchPromise = null;
    }
  }

  private async _doFetchProjects(): Promise<void> {
    // Maximum number of consecutive empty batches before giving up.
    // Prevents infinite loops when relays return only non-project events.
    const MAX_EMPTY_BATCHES = 5;

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
      const isMainnet = this.network.isMain();
      console.log(`[Angor Debug] _doFetchProjects: network=${isMainnet ? 'main' : 'test'}, indexerUrl=${this.indexerUrl}`);

      let emptyBatchCount = 0;

      // Loop to handle batches where all events are filtered out (parse errors, duplicates, etc.).
      // Without this loop, a batch of only non-project events would leave the page empty.
      while (emptyBatchCount < MAX_EMPTY_BATCHES) {
        // Step 1: Discover projects from Nostr relays
        let nostrEvents = await this.relay.fetchNostrProjects(
          this.LIMIT,
          this.oldestEventTimestamp
        );

        // If no events and we have relays configured, it might be a connection issue
        if (nostrEvents.length === 0) {
          const relayUrls = this.relay.getRelayUrls();

          if (relayUrls.length > 0) {
            console.log('No projects received, attempting to reconnect to relays...');
            try {
              await this.relay.reconnectToRelays();
              nostrEvents = await this.relay.fetchNostrProjects(
                this.LIMIT,
                this.oldestEventTimestamp
              );
            } catch (reconnectError) {
              console.error('Failed to reconnect to relays:', reconnectError);
              this.totalProjectsFetched = true;
              return;
            }
          }
        }

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

        // Step 2: Parse events, filter by network, and deduplicate against already-loaded projects
        const existingIds = new Set(this._allProjects().map(p => p.projectIdentifier));
        const candidateEvents: { event: NDKEvent; details: ProjectUpdate }[] = [];
        let skipNoId = 0, skipDupe = 0, skipNetwork = 0, skipParse = 0;

        for (const event of nostrEvents) {
          try {
            const details: ProjectUpdate = JSON.parse(event.content);
            if (!details.projectIdentifier) { skipNoId++; continue; }
            if (existingIds.has(details.projectIdentifier)) { skipDupe++; continue; }

            // Filter by network when networkName is explicitly set.
            // If networkName is missing/empty (legacy projects), allow through on both networks
            // — the indexer validation step will catch mismatches anyway.
            // When present: on mainnet skip non-'Main', on testnet skip 'Main'.
            const networkName = details.networkName;
            if (networkName) {
              if (isMainnet && networkName !== 'Main') { skipNetwork++; continue; }
              if (!isMainnet && networkName === 'Main') { skipNetwork++; continue; }
            }

            candidateEvents.push({ event, details });
          } catch (parseErr) {
            skipParse++;
            console.log(`[Angor Debug] Parse error for event ${event.id?.slice(0, 8)}:`, typeof event.content, event.content?.slice(0, 80));
            continue;
          }
        }

        console.log(`[Angor Debug] Event filtering: ${nostrEvents.length} events → ${candidateEvents.length} candidates (skipped: ${skipNoId} no-id, ${skipDupe} duplicate, ${skipNetwork} network, ${skipParse} parse-error)`);

        if (candidateEvents.length === 0) {
          // All events in this batch were filtered out (parse errors, duplicates, wrong network).
          // If we haven't reached the end, continue to the next batch.
          if (!this.totalProjectsFetched) {
            emptyBatchCount++;
            continue;
          }
          return;
        }

        // Step 3: Apply hub mode filtering.
        const filteredCandidates = candidateEvents.filter(({ details }) => {
          const nostrPubKey = details.nostrPubKey;
          if (nostrPubKey && !this.hubConfig.shouldShowProject(nostrPubKey)) {
            return false;
          }
          return true;
        });

        const hubModeRejected = candidateEvents.length - filteredCandidates.length;
        console.log(`[Angor Debug] Hub mode filter: ${candidateEvents.length} candidates → ${filteredCandidates.length} (hubMode=${this.hubConfig.hubMode()}, ${hubModeRejected} rejected)`);

        if (filteredCandidates.length === 0) {
          if (!this.totalProjectsFetched) {
            emptyBatchCount++;
            continue;
          }
          return;
        }

        // Step 4: Separate cached-valid projects (show instantly) from uncached (validate first).
        const instantProjects: IndexedProject[] = [];
        const toValidate: { event: NDKEvent; details: ProjectUpdate }[] = [];

        for (const candidate of filteredCandidates) {
          const { event, details } = candidate;
          const cached = this.verification.getCachedValidation(details.projectIdentifier);
          if (cached && cached.nostrEventId?.toLowerCase() === event.id?.toLowerCase()) {
            // Already validated on-chain — show immediately
            instantProjects.push({
              founderKey: cached.founderKey,
              nostrEventId: cached.nostrEventId,
              projectIdentifier: details.projectIdentifier,
              createdOnBlock: cached.createdOnBlock,
              trxId: cached.trxId,
              details,
              details_created_at: event.created_at,
              verified: true,
              metadata: undefined,
              metadata_created_at: undefined,
              stats: undefined,
              content: undefined,
              content_created_at: undefined,
              members: undefined,
              members_created_at: undefined,
              media: undefined,
              media_created_at: undefined,
              externalIdentities: undefined,
              externalIdentities_created_at: undefined,
            });
          } else {
            toValidate.push(candidate);
          }
        }

        // Show cached projects immediately
        if (instantProjects.length > 0) {
          this._allProjects.update((existing) => {
            const merged = [...existing];
            const ids = new Set(existing.map(p => p.projectIdentifier));
            for (const project of instantProjects) {
              if (!ids.has(project.projectIdentifier)) {
                merged.push(project);
                ids.add(project.projectIdentifier);
              }
            }
            return merged;
          });
          console.log(`[Angor Debug] Instant (cached) add: ${instantProjects.length} projects, total now ${this._allProjects().length}`);

          // Fetch profiles for instant projects
          const nostrPubKeys = instantProjects
            .map(p => p.details?.nostrPubKey)
            .filter((k): k is string => !!k);
          if (nostrPubKeys.length > 0) {
            this.relay.fetchProfile(nostrPubKeys);
          }
        }

        // Step 5: Validate uncached projects in background — only add them after validation passes.
        // Show skeleton placeholders while validating.
        if (toValidate.length > 0) {
          this.validatingCount.update(c => c + toValidate.length);
          this.validateAndAddProjects(toValidate);
        }

        // Found candidates — exit the loop
        return;
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

  /**
   * Validates uncached projects against the blockchain and adds valid ones to the view.
   * Projects that fail validation are simply not added (no more disappearing).
   * Runs in the background after cached projects are already shown.
   */
  private async validateAndAddProjects(
    candidates: { event: NDKEvent; details: ProjectUpdate }[]
  ): Promise<void> {
    console.log(`[Angor Debug] validateAndAddProjects: validating ${candidates.length} projects via mempool API`);

    const results = await Promise.all(
      candidates.map(async ({ event, details }) => {
        const projectId = details.projectIdentifier;

        const onChain = await this.fetchProjectFromMempool(projectId);
        if (!onChain) {
          console.log(`[Angor Debug] Validate ${projectId}: not-found-in-mempool`);
          return null;
        }

        if (onChain.nostrEventId.toLowerCase() !== event.id?.toLowerCase()) {
          console.log(`[Angor Debug] Validate ${projectId}: event-mismatch`);
          return null;
        }

        // Cache for future loads
        this.verification.cacheValidation(projectId, {
          founderKey: onChain.founderKey,
          nostrEventId: onChain.nostrEventId,
          trxId: onChain.trxId,
          createdOnBlock: onChain.createdOnBlock,
        });

        console.log(`[Angor Debug] Validate ${projectId}: valid`);
        return {
          event,
          details,
          onChain,
        };
      })
    );

    // Add valid projects to the view
    const validProjects: IndexedProject[] = [];
    for (const result of results) {
      if (!result) continue;
      validProjects.push({
        founderKey: result.onChain.founderKey,
        nostrEventId: result.onChain.nostrEventId,
        projectIdentifier: result.details.projectIdentifier,
        createdOnBlock: result.onChain.createdOnBlock,
        trxId: result.onChain.trxId,
        details: result.details,
        details_created_at: result.event.created_at,
        verified: true,
        metadata: undefined,
        metadata_created_at: undefined,
        stats: undefined,
        content: undefined,
        content_created_at: undefined,
        members: undefined,
        members_created_at: undefined,
        media: undefined,
        media_created_at: undefined,
        externalIdentities: undefined,
        externalIdentities_created_at: undefined,
      });
    }

    if (validProjects.length > 0) {
      this._allProjects.update((existing) => {
        const merged = [...existing];
        const ids = new Set(existing.map(p => p.projectIdentifier));
        for (const project of validProjects) {
          if (!ids.has(project.projectIdentifier)) {
            merged.push(project);
            ids.add(project.projectIdentifier);
          }
        }
        return merged;
      });

      // Fetch profiles for newly validated projects
      const nostrPubKeys = validProjects
        .map(p => p.details?.nostrPubKey)
        .filter((k): k is string => !!k);
      if (nostrPubKeys.length > 0) {
        this.relay.fetchProfile(nostrPubKeys);
      }
    }

    // Decrease validating count
    this.validatingCount.update(c => Math.max(0, c - candidates.length));
    console.log(`[Angor Debug] Validation complete: ${validProjects.length}/${candidates.length} valid, total projects now ${this._allProjects().length}`);

    // Persist validated projects for instant display on next page load
    this.saveProjectsToCache();
  }

  getProject(id: string): IndexedProject | undefined {
    return this.projects().find((p) => p.projectIdentifier === id);
  }

  /**
   * Fetches a single project by its identifier from the blockchain.
   *
   * Uses the mempool.space-compatible API to find the project's funding
   * transaction at the project's Bitcoin address, then builds an IndexedProject
   * with the on-chain data. The Nostr details (name, description etc.) are
   * fetched separately by the calling component via the relay service.
   *
   * Mirrors MempoolIndexerAngorApi.GetProjectByIdAsync (ReadFromAngorApi=false).
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

      const onChain = await this.fetchProjectFromMempool(id);
      if (!onChain) return null;

      return {
        founderKey: onChain.founderKey,
        nostrEventId: onChain.nostrEventId,
        projectIdentifier: id,
        createdOnBlock: onChain.createdOnBlock,
        trxId: onChain.trxId,
        verified: true,
        details: undefined,
        details_created_at: undefined,
        metadata: undefined,
        metadata_created_at: undefined,
        stats: undefined,
        content: undefined,
        content_created_at: undefined,
        members: undefined,
        members_created_at: undefined,
        media: undefined,
        media_created_at: undefined,
        externalIdentities: undefined,
        externalIdentities_created_at: undefined,
      };
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Computes basic project statistics from on-chain transaction data.
   *
   * Fetches all transactions at the project's Bitcoin address, finds the
   * funding transaction, then counts unique investors and sums the invested
   * amounts (taproot outputs from index 2 onwards in each investment tx).
   *
   * Note: amountSpentSoFarByFounder and penalty fields require outspend
   * analysis — use InvestorService.getProjectOnChainStats() for full stats.
   *
   * Mirrors MempoolIndexerAngorApi.GetProjectStatsAsync (ReadFromAngorApi=false).
   */
  async fetchProjectStats(id: string): Promise<ProjectStats | null> {
    try {
      this.loading.set(true);
      const address = this.convertAngorKeyToBitcoinAddress(id);
      const txs = await this.fetchMempoolAddressTxs(address);
      if (!txs.length) return null;

      const sorted = [...txs].sort((a, b) => {
        const aH = a.status.confirmed ? a.status.block_height : Number.MAX_SAFE_INTEGER;
        const bH = b.status.confirmed ? b.status.block_height : Number.MAX_SAFE_INTEGER;
        return aH - bH;
      });

      // Find the funding transaction
      let fundingTxId: string | null = null;
      for (const tx of sorted) {
        if (tx.vout.length < 2) continue;
        const type = tx.vout[1].scriptpubkey_type;
        if (type !== 'op_return' && type !== 'nulldata') continue;
        if (this.parseOpReturnFounderInfo(tx.vout[1].scriptpubkey)) {
          fundingTxId = tx.txid;
          break;
        }
      }
      if (!fundingTxId) return null;

      // Count unique investors and sum invested amounts
      const uniqueInvestors = new Set<string>();
      let totalAmountInvested = 0;

      for (const tx of sorted) {
        if (tx.txid === fundingTxId) continue;
        if (tx.vout.length < 2) continue;
        const type = tx.vout[1].scriptpubkey_type;
        if (type !== 'op_return' && type !== 'nulldata') continue;
        const investorKey = this.parseOpReturnInvestorInfo(tx.vout[1].scriptpubkey);
        if (!investorKey) continue;

        uniqueInvestors.add(investorKey);
        // Sum taproot outputs (skip index 0 = Angor fee, index 1 = OP_RETURN)
        for (let i = 2; i < tx.vout.length; i++) {
          if (tx.vout[i].scriptpubkey_type === 'v1_p2tr') {
            totalAmountInvested += tx.vout[i].value;
          }
        }
      }

      return {
        investorCount: uniqueInvestors.size,
        amountInvested: totalAmountInvested,
        // Penalty/founder-spend data requires outspend analysis;
        // use InvestorService.getProjectOnChainStats() for full detail-page stats.
        amountSpentSoFarByFounder: 0,
        amountInPenalties: 0,
        countInPenalties: 0,
      };
    } catch (err) {
      if (this.isNotFoundError(err)) return null;
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : `Failed to fetch stats for project ${id}`
      );
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Extracts investment records from on-chain transaction data.
   *
   * Mirrors MempoolIndexerAngorApi.GetInvestmentsAsync (ReadFromAngorApi=false).
   */
  async fetchProjectInvestments(
    projectId: string,
    offset = 0,
    limit = 10
  ): Promise<ProjectInvestment[]> {
    try {
      const address = this.convertAngorKeyToBitcoinAddress(projectId);
      const txs = await this.fetchMempoolAddressTxs(address);
      if (!txs.length) return [];

      const sorted = [...txs].sort((a, b) => {
        const aH = a.status.confirmed ? a.status.block_height : Number.MAX_SAFE_INTEGER;
        const bH = b.status.confirmed ? b.status.block_height : Number.MAX_SAFE_INTEGER;
        return aH - bH;
      });

      // Find the funding transaction ID
      let fundingTxId: string | null = null;
      for (const tx of sorted) {
        if (tx.vout.length < 2) continue;
        const type = tx.vout[1].scriptpubkey_type;
        if (type !== 'op_return' && type !== 'nulldata') continue;
        if (this.parseOpReturnFounderInfo(tx.vout[1].scriptpubkey)) {
          fundingTxId = tx.txid;
          break;
        }
      }
      if (!fundingTxId) return [];

      const investments: ProjectInvestment[] = [];
      for (const tx of sorted) {
        if (tx.txid === fundingTxId) continue;
        if (tx.vout.length < 2) continue;
        const type = tx.vout[1].scriptpubkey_type;
        if (type !== 'op_return' && type !== 'nulldata') continue;
        const investorKey = this.parseOpReturnInvestorInfo(tx.vout[1].scriptpubkey);
        if (!investorKey) continue;

        let amount = 0;
        for (let i = 2; i < tx.vout.length; i++) {
          if (tx.vout[i].scriptpubkey_type === 'v1_p2tr') amount += tx.vout[i].value;
        }

        investments.push({
          investorKey,
          amount,
          trxId: tx.txid,
          blockHeight: tx.status.confirmed ? tx.status.block_height : 0,
        });
      }

      return investments.slice(offset, offset + limit);
    } catch (err) {
      if (this.isNotFoundError(err)) return [];
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : `Failed to fetch investments for project ${projectId}`
      );
      return [];
    }
  }

  /**
   * Fetches a specific investor's investment details for a project.
   *
   * Mirrors MempoolIndexerAngorApi.GetInvestmentAsync (ReadFromAngorApi=false).
   */
  async fetchInvestorDetails(
    projectId: string,
    investorKey: string
  ): Promise<ProjectInvestment | null> {
    try {
      const investments = await this.fetchProjectInvestments(projectId);
      return investments.find(
        inv => inv.investorKey.toLowerCase() === investorKey.toLowerCase()
      ) ?? null;
    } catch (err) {
      if (this.isNotFoundError(err)) return null;
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch investor details'
      );
      return null;
    }
  }

  async getSupply(): Promise<Supply | null> {
    // The /api/insight/supply endpoint is Blockcore-specific and may not be
    // available on all mempool-compatible indexers. Return null gracefully.
    return null;
  }

  async getCirculatingSupply(): Promise<number> {
    return 0;
  }

  /**
   * Fetches the balance for a Bitcoin address from the mempool.space-compatible API.
   * Adapts the mempool response format to the AddressBalance interface.
   */
  async getAddressBalance(address: string): Promise<AddressBalance | null> {
    try {
      const url = `${this.indexerUrl}api/v1/address/${address}`;
      const { data } = await this.fetchJson<MempoolAddressResponse>(url);
      return {
        address: data.address,
        balance: data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum,
        unconfirmedBalance: data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum,
      };
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch address balance'
      );
      return null;
    }
  }

  /**
   * Fetches recent transactions for a Bitcoin address from the mempool.space API.
   * Note: mempool.space does not support offset-based pagination; this returns
   * the most recent transactions sliced to the requested range.
   */
  async getAddressTransactions(
    address: string,
    offset = 0,
    limit = 10
  ): Promise<Transaction[]> {
    try {
      const url = `${this.indexerUrl}api/v1/address/${address}/txs`;
      const { data } = await this.fetchJson<{ txid: string }[]>(url);
      return (Array.isArray(data) ? data : [])
        .slice(offset, offset + limit)
        .map(tx => ({ id: tx.txid }));
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch address transactions'
      );
      return [];
    }
  }

  /** Fetches basic transaction info by ID from the mempool.space-compatible API. */
  async getTransaction(txId: string): Promise<Transaction | null> {
    try {
      const url = `${this.indexerUrl}api/v1/tx/${txId}`;
      const { data } = await this.fetchJson<{ txid: string }>(url);
      return data ? { id: data.txid } : null;
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

  /**
   * Fetches recent blocks from the mempool.space-compatible API.
   * The optional startHeight maps to /api/v1/blocks/{startHeight}.
   */
  async getBlocks(startHeight?: number, limit = 10): Promise<Block[]> {
    try {
      const url = startHeight !== undefined
        ? `${this.indexerUrl}api/v1/blocks/${startHeight}`
        : `${this.indexerUrl}api/v1/blocks`;
      const { data } = await this.fetchJson<{ id: string; height: number }[]>(url);
      return (Array.isArray(data) ? data : [])
        .slice(0, limit)
        .map(b => ({ hash: b.id, height: b.height }));
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch blocks'
      );
      return [];
    }
  }

  /** Fetches a block by its hash from the mempool.space-compatible API. */
  async getBlockByHash(hash: string): Promise<Block | null> {
    try {
      const url = `${this.indexerUrl}api/v1/block/${hash}`;
      const { data } = await this.fetchJson<{ id: string; height: number }>(url);
      return data ? { hash: data.id, height: data.height } : null;
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch block'
      );
      return null;
    }
  }

  /**
   * Fetches a block by height from the mempool.space-compatible API.
   * /api/v1/block-height/{height} returns the block hash as a plain string.
   */
  async getBlockByHeight(height: number): Promise<Block | null> {
    try {
      const url = `${this.indexerUrl}api/v1/block-height/${height}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      // Strip surrounding JSON quotes if the API returns a quoted string (e.g. `"abcd1234..."`)
      const hash = (await response.text()).trim().replace(/^"|"$/g, '');
      return { hash, height };
    } catch (err) {
      await this.setErrorWithRetry(
        err instanceof Error ? err.message : 'Failed to fetch block by height'
      );
      return null;
    }
  }

  /**
   * Returns basic network stats using the mempool.space tip height endpoint.
   */
  async getNetworkStats(): Promise<NetworkStats | null> {
    try {
      const url = `${this.indexerUrl}api/v1/blocks/tip/height`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const blockHeight = Number(await response.text());
      return { connections: 0, blockHeight };
    } catch {
      return null;
    }
  }

  async getHeartbeat(): Promise<boolean> {
    try {
      const url = `${this.indexerUrl}api/v1/blocks/tip/height`;
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
    this.fetchPromise = null;
    this.loading.set(false);
    this.validatingCount.set(0);
    this._allProjects.set([]);
    this.mempoolTxCache.clear();
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
