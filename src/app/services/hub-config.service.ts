import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../environment';

export type HubMode = 'whitelist' | 'blacklist';

export interface HubConfig {
  hubMode: HubMode;
  adminPubkeys: string[];
  hubDiscovery: {
    enabled: boolean;
    subjectFilter: string;
    eventLimit: number;
  };
}

const STORAGE_KEY = 'angor-hub-config';

@Injectable({
  providedIn: 'root',
})
export class HubConfigService {
  // Reactive signals for hub configuration
  private _hubMode = signal<HubMode>(environment.hubMode || 'blacklist');
  private _adminPubkeys = signal<string[]>([...environment.adminPubkeys]);
  private _hubDiscoveryEnabled = signal<boolean>(environment.hubDiscovery?.enabled || false);
  private _hubDiscoverySubjectFilter = signal<string>(environment.hubDiscovery?.subjectFilter || 'hub');
  private _hubDiscoveryEventLimit = signal<number>(environment.hubDiscovery?.eventLimit || 10000);

  // Whitelist cache for performance
  private _whitelistedProjects = signal<Set<string>>(new Set());
  private _deniedProjects = signal<Set<string>>(new Set());
  private _listsLoaded = signal<boolean>(false);

  // Public readonly signals
  readonly hubMode = this._hubMode.asReadonly();
  readonly adminPubkeys = this._adminPubkeys.asReadonly();
  readonly hubDiscoveryEnabled = this._hubDiscoveryEnabled.asReadonly();
  readonly hubDiscoverySubjectFilter = this._hubDiscoverySubjectFilter.asReadonly();
  readonly hubDiscoveryEventLimit = this._hubDiscoveryEventLimit.asReadonly();
  readonly listsLoaded = this._listsLoaded.asReadonly();

  // Computed properties
  readonly isWhitelistMode = computed(() => this._hubMode() === 'whitelist');
  readonly isBlacklistMode = computed(() => this._hubMode() === 'blacklist');

  constructor() {
    this.loadConfig();
  }

  /**
   * Load hub configuration from localStorage
   * Falls back to environment defaults if not found
   */
  loadConfig(): void {
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEY);
      if (savedConfig) {
        const config: HubConfig = JSON.parse(savedConfig);

        if (config.hubMode) {
          this._hubMode.set(config.hubMode);
        }
        if (Array.isArray(config.adminPubkeys)) {
          this._adminPubkeys.set(config.adminPubkeys);
        }
        if (config.hubDiscovery) {
          if (typeof config.hubDiscovery.enabled === 'boolean') {
            this._hubDiscoveryEnabled.set(config.hubDiscovery.enabled);
          }
          if (config.hubDiscovery.subjectFilter) {
            this._hubDiscoverySubjectFilter.set(config.hubDiscovery.subjectFilter);
          }
          if (typeof config.hubDiscovery.eventLimit === 'number') {
            this._hubDiscoveryEventLimit.set(config.hubDiscovery.eventLimit);
          }
        }

        console.log('[HubConfigService] Loaded config from localStorage:', config);
      } else {
        console.log('[HubConfigService] No saved config, using environment defaults');
      }
    } catch (error) {
      console.error('[HubConfigService] Error loading config:', error);
    }
  }

  /**
   * Save current configuration to localStorage
   */
  saveConfig(): void {
    const config: HubConfig = {
      hubMode: this._hubMode(),
      adminPubkeys: this._adminPubkeys(),
      hubDiscovery: {
        enabled: this._hubDiscoveryEnabled(),
        subjectFilter: this._hubDiscoverySubjectFilter(),
        eventLimit: this._hubDiscoveryEventLimit(),
      },
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    console.log('[HubConfigService] Saved config to localStorage:', config);
  }

  /**
   * Get the current configuration object
   */
  getConfig(): HubConfig {
    return {
      hubMode: this._hubMode(),
      adminPubkeys: this._adminPubkeys(),
      hubDiscovery: {
        enabled: this._hubDiscoveryEnabled(),
        subjectFilter: this._hubDiscoverySubjectFilter(),
        eventLimit: this._hubDiscoveryEventLimit(),
      },
    };
  }

  /**
   * Set hub mode (whitelist or blacklist)
   */
  setHubMode(mode: HubMode): void {
    this._hubMode.set(mode);
    this.saveConfig();
    console.log('[HubConfigService] Hub mode set to:', mode);
  }

  /**
   * Get admin pubkeys
   */
  getAdminPubkeys(): string[] {
    return this._adminPubkeys();
  }

  /**
   * Check if a given pubkey is in the configured admin pubkeys list.
   */
  isAdmin(pubkey: string | null): boolean {
    if (!pubkey) return false;
    return this._adminPubkeys().includes(pubkey);
  }

  /**
   * Set admin pubkeys (replaces all)
   */
  setAdminPubkeys(pubkeys: string[]): void {
    this._adminPubkeys.set([...pubkeys]);
    this.saveConfig();
    // Reset loaded state to force reload with new pubkeys
    this._listsLoaded.set(false);
    console.log('[HubConfigService] Admin pubkeys updated:', pubkeys);
  }

  /**
   * Add a single admin pubkey
   */
  addAdminPubkey(pubkey: string): boolean {
    const trimmed = pubkey.trim();
    if (!trimmed) return false;

    const current = this._adminPubkeys();
    if (current.includes(trimmed)) {
      console.log('[HubConfigService] Pubkey already exists:', trimmed);
      return false;
    }

    this._adminPubkeys.set([...current, trimmed]);
    this.saveConfig();
    // Reset loaded state to force reload with new pubkeys
    this._listsLoaded.set(false);
    console.log('[HubConfigService] Added admin pubkey:', trimmed);
    return true;
  }

  /**
   * Remove an admin pubkey
   */
  removeAdminPubkey(pubkey: string): boolean {
    const current = this._adminPubkeys();
    const filtered = current.filter(p => p !== pubkey);

    if (filtered.length === current.length) {
      return false;
    }

    this._adminPubkeys.set(filtered);
    this.saveConfig();
    // Reset loaded state to force reload with new pubkeys
    this._listsLoaded.set(false);
    console.log('[HubConfigService] Removed admin pubkey:', pubkey);
    return true;
  }

  /**
   * Set hub discovery enabled state
   */
  setHubDiscoveryEnabled(enabled: boolean): void {
    this._hubDiscoveryEnabled.set(enabled);
    this.saveConfig();
  }

  /**
   * Set hub discovery subject filter
   */
  setHubDiscoverySubjectFilter(filter: string): void {
    this._hubDiscoverySubjectFilter.set(filter);
    this.saveConfig();
  }

  /**
   * Set hub discovery event limit
   */
  setHubDiscoveryEventLimit(limit: number): void {
    this._hubDiscoveryEventLimit.set(limit);
    this.saveConfig();
  }

  /**
   * Update the cached whitelist from external source
   * Called by FeaturedService when whitelist is loaded
   */
  updateWhitelistedProjects(projectIds: string[]): void {
    this._whitelistedProjects.set(new Set(projectIds));
    console.log('[HubConfigService] Whitelist cache updated:', projectIds.length, 'projects');
  }

  /**
   * Update the cached deny list from external source
   * Called by DenyService when deny list is loaded
   */
  updateDeniedProjects(projectIds: string[]): void {
    this._deniedProjects.set(new Set(projectIds));
    console.log('[HubConfigService] Deny list cache updated:', projectIds.length, 'projects');
  }

  /**
   * Mark lists as loaded
   */
  setListsLoaded(loaded: boolean): void {
    this._listsLoaded.set(loaded);
  }

  /**
   * Check if a project is in the whitelist
   */
  isProjectWhitelisted(projectId: string): boolean {
    return this._whitelistedProjects().has(projectId);
  }

  /**
   * Check if a project's founderKey is in the deny list.
   * The deny list (kind 30000) stores founderKey hex pubkeys.
   */
  isProjectDenied(founderKey: string): boolean {
    return this._deniedProjects().has(founderKey);
  }

  /**
   * Determine if a project should be displayed based on hub mode.
   * This is the main filtering method used by IndexerService.
   *
   * @param founderKey  Hex pubkey of the project founder (used for deny list lookup)
   * @param projectIdentifier  Unique Angor project ID (used for whitelist lookup)
   *
   * Blacklist mode: Show all projects EXCEPT those whose founderKey is in the deny list
   * Whitelist mode: Show ONLY projects whose projectIdentifier is in the whitelist
   */
  shouldShowProject(founderKey: string, projectIdentifier: string): boolean {
    // Deny list check is by founderKey (kind 30000 'p' tags)
    if (this._deniedProjects().has(founderKey)) {
      return false;
    }

    const mode = this._hubMode();
    if (mode === 'blacklist') {
      return true;
    }

    // Whitelist mode: check by projectIdentifier (kind 10001 'a'/'e' tags)
    return this._whitelistedProjects().has(projectIdentifier);
  }

  /**
   * Reset configuration to environment defaults
   */
  resetToDefaults(): void {
    this._hubMode.set(environment.hubMode || 'blacklist');
    this._adminPubkeys.set([...environment.adminPubkeys]);
    this._hubDiscoveryEnabled.set(environment.hubDiscovery?.enabled || false);
    this._hubDiscoverySubjectFilter.set(environment.hubDiscovery?.subjectFilter || 'hub');
    this._hubDiscoveryEventLimit.set(environment.hubDiscovery?.eventLimit || 10000);

    localStorage.removeItem(STORAGE_KEY);
    this._listsLoaded.set(false);

    console.log('[HubConfigService] Reset to defaults');
  }

  /**
   * Signal that config has changed and lists need to be reloaded.
   * Consumers (IndexerService) can watch this to trigger a project refresh.
   */
  private _configVersion = signal<number>(0);
  readonly configVersion = this._configVersion.asReadonly();


  notifyConfigChanged(): void {
    this._listsLoaded.set(false);
    this._whitelistedProjects.set(new Set());
    this._deniedProjects.set(new Set());
    this._configVersion.update(v => v + 1);
    console.log('[HubConfigService] Config changed, version:', this._configVersion());
  }

  isUsingDefaultAdminPubkeys(): boolean {
    const current = this._adminPubkeys();
    const defaults = environment.adminPubkeys;
    if (current.length !== defaults.length) return false;
    return defaults.every(pk => current.includes(pk));
  }

  /**
   * Format a pubkey for display (truncated)
   */
  formatPubkey(pubkey: string): string {
    if (!pubkey || pubkey.length < 16) return pubkey;
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
  }
}
