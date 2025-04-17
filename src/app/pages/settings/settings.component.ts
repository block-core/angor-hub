import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../services/theme.service';
import { NetworkService } from '../../services/network.service';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import { RelayService } from '../../services/relay.service';
import { animate, style, transition, trigger } from '@angular/animations';
import { TitleService } from '../../services/title.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, BreadcrumbComponent, FormsModule],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(5px)' }))
      ])
    ])
  ],
  template: `
    <section class="hero settings-hero">
      <app-breadcrumb
        [items]="[
          { label: 'Home', url: '/' },
          { label: 'Settings', url: '/settings' }
        ]"
      ></app-breadcrumb>

      <div class="hero-wrapper">
        <div class="hero-content">
          <h1>Settings</h1>
          <p class="hero-description">Customize your Angor Hub experience</p>
        </div>
      </div>
    </section>

    <div class="settings-container">
      <div class="settings-sidebar">
        <div 
          class="sidebar-item" 
          [class.active]="activeTab() === 'appearance'" 
          (click)="setActiveTab('appearance')"
        >
          <span class="material-icons">palette</span>
          <span>Appearance</span>
        </div>
        <div 
          class="sidebar-item" 
          [class.active]="activeTab() === 'network'" 
          (click)="setActiveTab('network')"
        >
          <span class="material-icons">public</span>
          <span>Network</span>
        </div>
        <div 
          class="sidebar-item" 
          [class.active]="activeTab() === 'relays'" 
          (click)="setActiveTab('relays')"
        >
          <span class="material-icons">settings_input_antenna</span>
          <span>Nostr Relays</span>
        </div>
        <div 
          class="sidebar-item" 
          [class.active]="activeTab() === 'about'" 
          (click)="setActiveTab('about')"
        >
          <span class="material-icons">info</span>
          <span>About</span>
        </div>
      </div>
      
      <div class="settings-content" [@fadeInOut]>
        <!-- Appearance Tab -->
        @if (activeTab() === 'appearance') {
          <div class="settings-card">
            <h2>
              <span class="material-icons">palette</span>
              Appearance
            </h2>
            
            <div class="setting-group">
              <label class="setting-label">Theme</label>
              <p class="setting-description">Choose your preferred theme mode</p>
              
              <div class="theme-options">
                <button 
                  class="theme-option" 
                  [class.active]="currentTheme() === 'light'"
                  (click)="setTheme('light')"
                >
                  <div class="theme-preview light">
                    <span class="material-icons">light_mode</span>
                  </div>
                  <span class="theme-name">Light</span>
                </button>
                
                <button 
                  class="theme-option" 
                  [class.active]="currentTheme() === 'dark'"
                  (click)="setTheme('dark')"
                >
                  <div class="theme-preview dark">
                    <span class="material-icons">dark_mode</span>
                  </div>
                  <span class="theme-name">Dark</span>
                </button>
                
                <button 
                  class="theme-option" 
                  [class.active]="currentTheme() === 'system'"
                  (click)="setTheme('system')"
                >
                  <div class="theme-preview system">
                    <span class="material-icons">devices</span>
                  </div>
                  <span class="theme-name">System</span>
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Network Tab -->
        @if (activeTab() === 'network') {
          <div class="settings-card">
            <h2>
              <span class="material-icons">public</span>
              Network
            </h2>
            
            <div class="setting-group">
              <label class="setting-label">Bitcoin Network</label>
              <p class="setting-description">Select which Bitcoin network to use</p>
              
              <div class="network-options">
                <button 
                  class="network-option" 
                  [class.active]="currentNetwork() === 'main'"
                  (click)="setNetwork('main')"
                  [attr.aria-pressed]="currentNetwork() === 'main'"
                >
                  <div class="network-icon mainnet">
                    <span class="material-icons">currency_bitcoin</span>
                  </div>
                  <div class="network-info">
                    <span class="network-name">Mainnet</span>
                    <span class="network-desc">Live Bitcoin network with real value</span>
                  </div>
                  @if (currentNetwork() === 'main') {
                    <span class="material-icons check-icon">check_circle</span>
                  }
                </button>
                
                <button 
                  class="network-option" 
                  [class.active]="currentNetwork() === 'test'"
                  (click)="setNetwork('test')"
                  [attr.aria-pressed]="currentNetwork() === 'test'"
                >
                  <div class="network-icon testnet">
                    <span class="material-icons">science</span>
                  </div>
                  <div class="network-info">
                    <span class="network-name">Testnet</span>
                    <span class="network-desc">Testing network with no real value</span>
                  </div>
                  @if (currentNetwork() === 'test') {
                    <span class="material-icons check-icon">check_circle</span>
                  }
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Relays Tab -->
        @if (activeTab() === 'relays') {
          <div class="settings-card">
            <h2>
              <span class="material-icons">settings_input_antenna</span>
              Nostr Relays
            </h2>
            
            <div class="setting-group">
              <label class="setting-label">Manage Relays</label>
              <p class="setting-description">Configure which Nostr relays to connect to</p>
              
              <div class="relay-header">
                <span class="relay-count">{{ relayUrls().length }} relays connected</span>
                <button class="relay-reset-btn" (click)="resetToDefaultRelays()">
                  <span class="material-icons">restart_alt</span>
                  Reset to defaults
                </button>
              </div>
              
              <div class="relay-list">
                @if (relayUrls().length === 0) {
                  <div class="empty-state">
                    <span class="material-icons">signal_wifi_off</span>
                    <p>No relays configured. Add a relay or reset to defaults.</p>
                  </div>
                }
                
                @for (relay of relayUrls(); track relay) {
                  <div class="relay-item" [@fadeInOut]>
                    <div class="relay-details">
                      <span class="material-icons relay-icon">wifi</span>
                      <span class="relay-url">{{ relay }}</span>
                    </div>
                    <button class="relay-remove" (click)="removeRelay(relay)" title="Remove relay">
                      <span class="material-icons">close</span>
                    </button>
                  </div>
                }
              </div>
              
              <div class="relay-add-container">
                <div class="input-group">
                  <div class="relay-input-wrapper">
                    <span class="material-icons input-icon">add_link</span>
                    <input 
                      type="text" 
                      [(ngModel)]="newRelayUrl" 
                      placeholder="wss://relay.example.com"
                      class="relay-input"
                      [class.invalid]="newRelayUrl && !isValidUrl(newRelayUrl)"
                      (keyup.enter)="addRelay()"
                    />
                  </div>
                  <button 
                    class="relay-add-btn" 
                    [disabled]="!newRelayUrl || !isValidUrl(newRelayUrl)"
                    (click)="addRelay()"
                  >
                    <span class="material-icons">add_circle</span>
                    <span>Add</span>
                  </button>
                </div>
              </div>
              
              @if (newRelayUrl && !isValidUrl(newRelayUrl)) {
                <div class="error-message" [@fadeInOut]>
                  <span class="material-icons">error</span>
                  Must be a valid WebSocket URL (wss://)
                </div>
              }
              
              <div class="relay-save-container">
                <button 
                  class="relay-save-btn" 
                  [disabled]="relayUrls().length === 0"
                  (click)="saveAndReloadRelays()"
                >
                  <span class="material-icons">save</span>
                  Save & Reload Relays
                </button>
                
                @if (relaySaveMessage()) {
                  <div class="save-message" [@fadeInOut]>
                    {{ relaySaveMessage() }}
                  </div>
                }
              </div>
            </div>
          </div>
        }
        
        <!-- About Tab -->
        @if (activeTab() === 'about') {
          <div class="settings-card">
            <h2>
              <span class="material-icons">info</span>
              About Angor Hub
            </h2>
            
            <div class="about-content">
              <div class="logo-container">
                <img src="/images/logo-text.svg" alt="Angor Logo" class="about-logo" />
              </div>
              
              <div class="version-info">
                <p class="version">Version {{ appVersion }}</p>
                <p class="build-date">Built on {{ buildDate }}</p>
              </div>
              
              <div class="about-description">
                <p>Angor Hub is an explorer for Bitcoin fundraising projects built on the Angor protocol. It provides a way to discover and track Bitcoin funding opportunities.</p>
              </div>
              
              <div class="links-section">
                <h3>Resources</h3>
                <div class="resource-links">
                  <a href="https://angor.io" target="_blank" rel="noopener" class="resource-link">
                    <span class="material-icons">home</span>
                    <span>Official Website</span>
                  </a>
                  <a href="https://docs.angor.io" target="_blank" rel="noopener" class="resource-link">
                    <span class="material-icons">description</span>
                    <span>Documentation</span>
                  </a>
                  <a href="https://github.com/block-core/angor" target="_blank" rel="noopener" class="resource-link">
                    <span class="material-icons">code</span>
                    <span>Source Code</span>
                  </a>
                  <a href="https://blog.angor.io" target="_blank" rel="noopener" class="resource-link">
                    <span class="material-icons">article</span>
                    <span>Blog</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  private themeService = inject(ThemeService);
  private networkService = inject(NetworkService);
  private relayService = inject(RelayService);
  private titleService = inject(TitleService);
  
  currentTheme = signal<string>('light');
  currentNetwork = signal<string>('test');
  relayUrls = signal<string[]>([]);
  newRelayUrl = '';
  relaySaveMessage = signal<string>('');
  activeTab = signal<string>('appearance');
  isAddingRelay = signal<boolean>(false);
  
  appVersion = '1.0.0';
  buildDate = '2024-08-01';
  
  ngOnInit(): void {
    this.titleService.setTitle('Settings');
    
    // Initialize the current theme and network
    this.themeService.theme$.subscribe(theme => {
      this.currentTheme.set(theme);
    });
    
    this.currentNetwork.set(this.networkService.getNetwork());
    this.relayUrls.set(this.relayService.getRelayUrls());
  }
  
  setActiveTab(tab: string): void {
    this.activeTab.set(tab);
  }
  
  setTheme(theme: 'light' | 'dark' | 'system'): void {
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.themeService.setTheme(prefersDark ? 'dark' : 'light');
    } else {
      this.themeService.setTheme(theme);
    }
  }
  
  setNetwork(network: 'main' | 'test'): void {
    if (network === this.currentNetwork()) return;
    
    this.networkService.setNetwork(network);
    this.currentNetwork.set(network);
  }

  removeRelay(url: string): void {
    this.relayUrls.update(urls => urls.filter(relayUrl => relayUrl !== url));
  }

  addRelay(): void {
    if (!this.isValidUrl(this.newRelayUrl)) return;
    
    // Don't add if already exists
    if (this.relayUrls().includes(this.newRelayUrl)) {
      this.relaySaveMessage.set('This relay is already in the list');
      setTimeout(() => this.relaySaveMessage.set(''), 3000);
      return;
    }

    this.relayUrls.update(urls => [...urls, this.newRelayUrl]);
    this.newRelayUrl = '';
  }

  async saveAndReloadRelays(): Promise<void> {
    // Save to relay service
    this.relayService.setRelayUrls(this.relayUrls());
    this.relayService.saveRelaysToStorage();
    
    // Show saving message
    this.relaySaveMessage.set('Saving and reconnecting...');

    // Reload after a brief delay to show the message
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }

  isValidUrl(url: string): boolean {
    try {
      const urlPattern = /^wss:\/\/.+/;
      return url.trim() !== '' && urlPattern.test(url);
    } catch {
      return false;
    }
  }

  resetToDefaultRelays(): void {
    const defaultRelays = this.relayService.getDefaultRelays();
    this.relayUrls.set(defaultRelays);
    this.relaySaveMessage.set('Relay list reset to defaults. Click "Save & Reload" to apply changes.');
    setTimeout(() => this.relaySaveMessage.set(''), 5000);
  }
}
