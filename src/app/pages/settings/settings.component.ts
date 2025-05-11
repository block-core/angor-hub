import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TitleService } from '../../services/title.service';
import { NetworkService } from '../../services/network.service';
import { ThemeService } from '../../services/theme.service';
import { RelayService } from '../../services/relay.service';
import { IndexerService, IndexerConfig, IndexerEntry } from '../../services/indexer.service';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import { trigger, transition, style, animate } from '@angular/animations';
import { environment } from '../../../environment';

type SettingsTabId = 'appearance' | 'network' | 'relays' | 'indexers' | 'about';

interface SettingsTab {
  id: SettingsTabId;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, BreadcrumbComponent],
  templateUrl: './settings.component.html',
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class SettingsComponent implements OnInit {
  private title = inject(TitleService);
  public networkService = inject(NetworkService);
  public themeService = inject(ThemeService);
  public relayService = inject(RelayService);
  public indexerService = inject(IndexerService);
  
  appVersion = environment.appVersion || '1.0.0';

  activeTab = signal<SettingsTabId>('appearance');

  settingsTabs: SettingsTab[] = [
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
    { id: 'network', label: 'Network', icon: 'public' },
    { id: 'relays', label: 'Relays', icon: 'settings_input_antenna' },
    { id: 'indexers', label: 'Indexers', icon: 'storage' },
    { id: 'about', label: 'About', icon: 'info' }
  ];

  currentTheme = computed(() => {
    return this.themeService.currentTheme();
  });
  
  currentNetwork = computed(() => {
    return this.networkService.isMain() ? 'main' : 'test';
  });
  
  relayUrls = signal<string[]>([]);
  newRelayUrl = signal<string>('');
  relaySaveMessage = signal<string>('');
  
  
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
  
  addRelay(): void {
    const urlToAdd = this.newRelayUrl();
    if (urlToAdd && this.isValidUrl(urlToAdd)) {
      const urls = [...this.relayUrls()];
      if (!urls.includes(urlToAdd)) {
        urls.push(urlToAdd);
        this.relayUrls.set(urls);
        this.newRelayUrl.set('');
      }
    }
  }
  
  removeRelay(relay: string): void {
    const urls = this.relayUrls().filter(url => url !== relay);
    this.relayUrls.set(urls);
  }
  
  resetToDefaultRelays(): void {
    this.relayUrls.set(this.relayService.getDefaultRelays());
  }
  
  async saveAndReloadRelays(): Promise<void> {
    this.relayService.setRelayUrls(this.relayUrls());
    this.relaySaveMessage.set('Relays updated successfully!');
    
    setTimeout(() => {
      this.relaySaveMessage.set('');
    }, 3000);
    
    await this.relayService.reconnectToRelays();
  }
  
  isValidUrl(url: string): boolean {
    return url.startsWith('wss://') && url.length > 8;
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
    
    return (url.startsWith('http://') || url.startsWith('https://')) && url.length > (url.startsWith('https://') ? 8 : 7);
  }
}
