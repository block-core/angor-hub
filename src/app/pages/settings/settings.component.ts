import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TitleService } from '../../services/title.service';
import { NetworkService } from '../../services/network.service';
import { ThemeService } from '../../services/theme.service';
import { RelayService } from '../../services/relay.service';
import { IndexerService, IndexerConfig, IndexerEntry } from '../../services/indexer.service';
import { HubConfigService, HubMode } from '../../services/hub-config.service';
import { environment } from '../../../environment';

type SettingsTabId = 'appearance' | 'network' | 'relays' | 'indexers' | 'hub' | 'about';

interface SettingsTab {
  id: SettingsTabId;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  private title = inject(TitleService);
  public networkService = inject(NetworkService);
  public themeService = inject(ThemeService);
  public relayService = inject(RelayService);
  public indexerService = inject(IndexerService);
  public hubConfigService = inject(HubConfigService);

  appVersion = environment.appVersion || '1.0.0';

  activeTab = signal<SettingsTabId>('appearance');

  settingsTabs: SettingsTab[] = [
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
    { id: 'network', label: 'Network', icon: 'public' },
    { id: 'relays', label: 'Relays', icon: 'settings_input_antenna' },
    { id: 'indexers', label: 'Indexers', icon: 'storage' },
    { id: 'hub', label: 'Hub', icon: 'hub' },
    { id: 'about', label: 'About', icon: 'info' }
  ];

  readonly themeOptions = [
    { id: 'light', label: 'Light', icon: 'light_mode' },
    { id: 'dark', label: 'Dark', icon: 'dark_mode' },
    { id: 'system', label: 'System', icon: 'desktop_windows' }
  ] as const;
  readonly networkOptions = [
    { id: 'main', label: 'Mainnet', icon: 'currency_bitcoin', description: 'Live Bitcoin network with real-value transactions.' },
    { id: 'test', label: 'Testnet', icon: 'science', description: 'Testing network using test Bitcoin with no monetary value.' }
  ] as const;

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  setIndexerInput(event: Event, isMainnet: boolean): void {
    (isMainnet ? this.newMainnetIndexerUrl : this.newTestnetIndexerUrl).set(this.inputValue(event));
  }

  // Hub configuration (read-only display)

  currentTheme = computed(() => {
    return this.themeService.currentTheme();
  });
  
  currentNetwork = computed(() => {
    return this.networkService.isMain() ? 'main' : 'test';
  });
  
  relayUrls = signal<string[]>([]);
  newRelayUrl = signal<string>('');
  relaySaveMessage = signal<string>('');
  isSavingRelays = signal(false);
  relaySaveError = signal(false);
  
  
  indexerConfig = signal<IndexerConfig>(this.indexerService.getIndexerConfig());
  newMainnetIndexerUrl = signal<string>('');
  newTestnetIndexerUrl = signal<string>('');
  indexerSaveMessage = signal<string>('');
  indexerTestingUrl = signal<string | null>(null);
  indexerTestResult = signal<boolean | null>(null);
  
  constructor() {
    this.updateRelayUrls();
    
    this.indexerConfig.set(this.indexerService.getIndexerConfig());
  }
  
  ngOnInit(): void {
    this.title.setTitle('Settings');
  }
  
  setActiveTab(tabId: SettingsTabId): void {
    this.activeTab.set(tabId);
    
    
    if (tabId === 'indexers') {
      this.indexerSaveMessage.set('');
      this.indexerTestResult.set(null);
      this.indexerTestingUrl.set(null); 
    } else if (tabId === 'relays') {
      this.relaySaveMessage.set('');
    }
  }
  
  setTheme(theme: 'light' | 'dark' | 'system'): void {
    this.themeService.setTheme(theme);
  }
  
  setNetwork(network: 'main' | 'test'): void {
    if (network === 'main') {
      this.networkService.setNetwork('main', true); // Set updateUrl=true
    } else {
      this.networkService.setNetwork('test', true); // Set updateUrl=true
    }
  }
  
  private updateRelayUrls(): void {
    this.relayUrls.set(this.relayService.getRelayUrls());
  }
  
  private async applyRelays(urls: string[]): Promise<void> {
    if (this.isSavingRelays()) return;
    this.isSavingRelays.set(true);
    this.relaySaveMessage.set('');
    this.relaySaveError.set(false);
    try {
      this.relayUrls.set(urls);
      this.relayService.setRelayUrls(urls);
      this.relayService.saveRelaysToStorage();
      await this.relayService.reconnectToRelays();
      this.relaySaveMessage.set('Relay settings saved and connections refreshed.');
    } catch {
      this.relaySaveError.set(true);
      this.relaySaveMessage.set('Could not reconnect to the relays. Check the addresses and try Save & reconnect again.');
    } finally {
      this.isSavingRelays.set(false);
    }
  }

  async addRelay(): Promise<void> {
    const url = this.newRelayUrl().trim();
    if (this.isSavingRelays() || !this.isValidUrl(url)) return;
    if (this.relayUrls().includes(url)) {
      this.relaySaveError.set(true);
      this.relaySaveMessage.set('This relay URL already exists.');
      return;
    }
    this.newRelayUrl.set('');
    await this.applyRelays([...this.relayUrls(), url]);
  }

  async removeRelay(relay: string): Promise<void> {
    await this.applyRelays(this.relayUrls().filter(url => url !== relay));
  }

  async resetToDefaultRelays(): Promise<void> {
    await this.applyRelays(this.relayService.getDefaultRelays());
  }

  async saveAndReloadRelays(): Promise<void> {
    await this.applyRelays(this.relayUrls());
  }

  isValidUrl(url: string): boolean {
    return this.hasUrlProtocol(url, ['wss:']);
  }

  private hasUrlProtocol(value: string, protocols: string[]): boolean {
    try {
      const url = new URL(value.trim());
      return !!url.hostname && protocols.includes(url.protocol);
    } catch {
      return false;
    }
  }

  getMainnetIndexers(): IndexerEntry[] {
    return this.indexerConfig().mainnet;
  }
  
  getTestnetIndexers(): IndexerEntry[] {
    return this.indexerConfig().testnet;
  }
  
  addIndexer(isMainnet: boolean): void {
    const urlToAdd = isMainnet ? this.newMainnetIndexerUrl().trim() : this.newTestnetIndexerUrl().trim();
    
    if (urlToAdd && this.isValidIndexerUrl(urlToAdd)) {
      if (this.indexerService.addIndexer(urlToAdd, isMainnet)) {
        this.indexerConfig.set(this.indexerService.getIndexerConfig());
        
        
        if (isMainnet) {
          this.newMainnetIndexerUrl.set('');
        } else {
          this.newTestnetIndexerUrl.set('');
        }
        
        this.indexerSaveMessage.set('');
      } else {
        this.indexerSaveMessage.set('This indexer URL already exists');
      }
    }
  }
  
  removeIndexer(url: string, isMainnet: boolean): void {
    this.indexerService.removeIndexer(url, isMainnet);
    this.indexerConfig.set(this.indexerService.getIndexerConfig());
    this.indexerSaveMessage.set('');
  }
  
  setPrimaryIndexer(url: string, isMainnet: boolean): void {
    this.indexerService.setPrimaryIndexer(url, isMainnet);
    this.indexerConfig.set(this.indexerService.getIndexerConfig());
    this.indexerSaveMessage.set('');
  }
  
  resetToDefaultIndexers(): void {
    this.indexerService.resetToDefaultIndexers();
    this.indexerConfig.set(this.indexerService.getIndexerConfig());
    this.indexerSaveMessage.set('Reset to default indexers');
  }
  
  async saveAndApplyIndexers(): Promise<void> {
    this.indexerService.saveIndexerConfig();
    this.indexerSaveMessage.set('Indexer settings saved and applied');
    
    setTimeout(() => {
      this.indexerSaveMessage.set('');
    }, 3000);
  }
  
  async testIndexerConnection(url: string): Promise<void> {
    this.indexerTestingUrl.set(url);
    this.indexerTestResult.set(null);
    
    const result = await this.indexerService.testIndexerConnection(url);
    this.indexerTestResult.set(result);
    
    setTimeout(() => {
      this.indexerTestResult.set(null);
      this.indexerTestingUrl.set(null);
    }, 3000);
  }
  
  isValidIndexerUrl(url: string): boolean {
    return this.hasUrlProtocol(url, ['https:', 'http:']);
  }

  getHubMode(): HubMode {
    return this.hubConfigService.hubMode();
  }

  getAdminPubkeys(): string[] {
    return this.hubConfigService.getAdminPubkeys();
  }

  cacheClearMessage = signal<string>('');

  clearCache(): void {
    // Clear project-related caches
    localStorage.removeItem('angor_projects_cache_main');
    localStorage.removeItem('angor_projects_cache_test');
    localStorage.removeItem('angor_project_validation_cache');
    localStorage.removeItem('angor_opreturn_cache');

    // Reset in-memory state
    this.indexerService.resetProjects();

    this.cacheClearMessage.set('Cache cleared successfully');
    setTimeout(() => this.cacheClearMessage.set(''), 3000);
  }
}
