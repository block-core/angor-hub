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

@Injectable({
  providedIn: 'root',
})
export class IndexerService {
  private readonly LIMIT = 8;
  private indexerUrl = 'https://signet.angor.online/';

  // Nostr-first cursor-based pagination (using `until` timestamp)
  private oldestEventTimestamp: number | undefined;
  private totalProjectsFetched = false;
  private fetchPromise: Promise<void> | null = null;

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
   * Fetches projects using an optimistic Nostr-first discovery approach.
   *
   * Flow:
   *   1. Query Nostr relays for the latest kind 3030/30078 events.
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

        // Step 3: Optimistically add projects to the view immediately.
        // Apply hub mode filtering before showing.
        const optimisticProjects: IndexedProject[] = [];

        for (const { event, details } of candidateEvents) {
          const nostrPubKey = details.nostrPubKey;
          if (nostrPubKey && !this.hubConfig.shouldShowProject(nostrPubKey)) {
            continue;
          }

          optimisticProjects.push({
            founderKey: '',
            nostrEventId: event.id,
            projectIdentifier: details.projectIdentifier,
            createdOnBlock: 0,
            trxId: '',
            details,
            details_created_at: event.created_at,
            verified: false,
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

        const hubModeRejected = candidateEvents.length - optimisticProjects.length;
        console.log(`[Angor Debug] Hub mode filter: ${candidateEvents.length} candidates → ${optimisticProjects.length} optimistic (hubMode=${this.hubConfig.hubMode()}, ${hubModeRejected} rejected)`);

        if (optimisticProjects.length > 0) {
          // Add to the view right away — the user sees cards immediately
          this._allProjects.update((existing) => {
            const merged = [...existing];
            const ids = new Set(existing.map(p => p.projectIdentifier));

            for (const project of optimisticProjects) {
              if (!ids.has(project.projectIdentifier)) {
                merged.push(project);
                ids.add(project.projectIdentifier);
              }
            }

            return merged;
          });

          console.log(`[Angor Debug] Optimistic add complete: _allProjects total now ${this._allProjects().length}`);

          // Fetch profiles from Nostr immediately (for images/names)
          const nostrPubKeys = optimisticProjects
            .map(p => p.details?.nostrPubKey)
            .filter((k): k is string => !!k);

          if (nostrPubKeys.length > 0) {
            this.relay.fetchProfile(nostrPubKeys);
          }
        }

        // Step 4: Validate each project against the indexer in the background.
        // Invalid projects are removed from the view.
        this.validateProjectsInBackground(candidateEvents, optimisticProjects);

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
   * Validates optimistically-displayed projects against the indexer.
   * Runs in the background after projects are already shown to the user.
   * Removes projects that fail validation and enriches valid ones with
   * on-chain data (founderKey, trxId, createdOnBlock).
   */
  private async validateProjectsInBackground(
    candidateEvents: { event: NDKEvent; details: ProjectUpdate }[],
    optimisticProjects: IndexedProject[]
  ): Promise<void> {
    const optimisticIds = new Set(optimisticProjects.map(p => p.projectIdentifier));
    console.log(`[Angor Debug] validateProjectsInBackground: validating ${optimisticIds.size} projects against ${this.indexerUrl}`);

    const results = await Promise.all(
      candidateEvents
        .filter(({ details }) => optimisticIds.has(details.projectIdentifier))
        .map(async ({ event, details }) => {
          const projectId = details.projectIdentifier;

          try {
            // Check validation cache first (on-chain data is immutable)
            const cached = this.verification.getCachedValidation(projectId);
            if (cached) {
              if (cached.nostrEventId?.toLowerCase() !== event.id?.toLowerCase()) {
                console.log(`[Angor Debug] Validate ${projectId}: cached-mismatch`);
                return { projectId, valid: false };
              }
              console.log(`[Angor Debug] Validate ${projectId}: cached-valid`);
              return {
                projectId,
                valid: true,
                founderKey: cached.founderKey,
                nostrEventId: cached.nostrEventId,
                trxId: cached.trxId,
                createdOnBlock: cached.createdOnBlock,
              };
            }

            // No cache — call the indexer
            const url = `${this.indexerUrl}api/query/Angor/projects/${projectId}`;
            const { data: indexerProject } = await this.fetchJson<IndexedProject>(url);

            if (!indexerProject) {
              console.log(`[Angor Debug] Validate ${projectId}: no-data`);
              return { projectId, valid: false };
            }

            // Cross-check the OP_RETURN-embedded event ID
            if (indexerProject.nostrEventId?.toLowerCase() !== event.id?.toLowerCase()) {
              console.log(`[Angor Debug] Validate ${projectId}: event-mismatch (nostr="${event.id}" vs indexer="${indexerProject.nostrEventId}")`);
              return { projectId, valid: false };
            }

            // Cache for future loads
            this.verification.cacheValidation(projectId, {
              founderKey: indexerProject.founderKey,
              nostrEventId: indexerProject.nostrEventId,
              trxId: indexerProject.trxId,
              createdOnBlock: indexerProject.createdOnBlock,
            });

            console.log(`[Angor Debug] Validate ${projectId}: valid`);

            return {
              projectId,
              valid: true,
              founderKey: indexerProject.founderKey,
              nostrEventId: indexerProject.nostrEventId,
              trxId: indexerProject.trxId,
              createdOnBlock: indexerProject.createdOnBlock,
            };
          } catch (err) {
            // 404 = project doesn't exist on this network's indexer → invalid
            // Other errors (network failure, 500, etc.) → also mark invalid
            // to avoid leaving unverified projects on screen
            if (this.isNotFoundError(err)) {
              console.log(`[Angor Debug] Validate ${projectId}: 404-not-found`);
            } else {
              console.warn(`[Angor Debug] Validate ${projectId}: error`, err);
            }
            return { projectId, valid: false };
          }
        })
    );

    // Collect IDs to remove and data to enrich
    const toRemove = new Set<string>();
    const toEnrich = new Map<string, {
      founderKey: string;
      nostrEventId: string;
      trxId: string;
      createdOnBlock: number;
    }>();

    for (const val of results) {
      if (!val.valid) {
        toRemove.add(val.projectId);
      } else if (val.founderKey) {
        toEnrich.set(val.projectId, {
          founderKey: val.founderKey,
          nostrEventId: val.nostrEventId!,
          trxId: val.trxId!,
          createdOnBlock: val.createdOnBlock!,
        });
      }
    }

    // Apply removals and enrichments in a single signal update
    const beforeCount = this._allProjects().length;
    if (toRemove.size > 0 || toEnrich.size > 0) {
      this._allProjects.update((projects) =>
        projects
          .filter(p => !toRemove.has(p.projectIdentifier))
          .map(p => {
            const enrichment = toEnrich.get(p.projectIdentifier);
            if (enrichment) {
              return {
                ...p,
                founderKey: enrichment.founderKey,
                nostrEventId: enrichment.nostrEventId,
                trxId: enrichment.trxId,
                createdOnBlock: enrichment.createdOnBlock,
                verified: true,
              };
            }
            return p;
          })
      );
    }
    console.log(`[Angor Debug] Validation complete: ${toRemove.size} removed, ${toEnrich.size} enriched, _allProjects ${beforeCount} → ${this._allProjects().length}`);
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
      // 404 means the project doesn't exist on this indexer — not a connectivity issue
      if (this.isNotFoundError(err)) {
        return null;
      }
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
      // 404 means the project doesn't exist on this indexer — not a connectivity issue
      if (this.isNotFoundError(err)) {
        return null;
      }
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
      if (this.isNotFoundError(err)) {
        return [];
      }
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
      if (this.isNotFoundError(err)) {
        return null;
      }
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
    this.fetchPromise = null;
    this.loading.set(false);
    this._allProjects.set([]);
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
