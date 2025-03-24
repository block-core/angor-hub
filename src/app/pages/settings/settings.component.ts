import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../services/theme.service';
import { NetworkService } from '../../services/network.service';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import { RelayService } from '../../services/relay.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, BreadcrumbComponent, FormsModule],
  template: `

<section class="hero">
<app-breadcrumb
        [items]="[
          { label: 'Home', url: '/' },
          { label: 'Settings', url: '/settings' }
        ]"
      ></app-breadcrumb>

      <div class="hero-wrapper">
        <div class="hero-content">
          <h1>Settings</h1>
        </div>
      </div>
    </section>

    <div class="settings-container">
      <div class="settings-card">
        <div class="settings-section">
          <h2>Appearance</h2>
          <div class="setting-item">
            <label for="theme-selector">Theme</label>
            <div class="theme-options">
              <button 
                class="theme-option" 
                [class.active]="currentTheme() === 'light'"
                (click)="setTheme('light')">
                <i class="fa-solid fa-sun"></i>
                <span>Light</span>
              </button>
              <button 
                class="theme-option" 
                [class.active]="currentTheme() === 'dark'"
                (click)="setTheme('dark')">
                <i class="fa-solid fa-moon"></i>
                <span>Dark</span>
              </button>
            </div>
          </div>
        </div>
        
        <div class="settings-section">
          <h2>Network</h2>
          <div class="setting-item">
            <label for="network-selector">Default Network</label>
            <div class="network-options">
              <button 
                class="network-option" 
                [class.active]="currentNetwork() === 'mainnet'"
                (click)="setNetwork('mainnet')">
                <i class="fa-brands fa-bitcoin"></i>
                <span>Mainnet</span>
              </button>
              <button 
                class="network-option" 
                [class.active]="currentNetwork() === 'testnet'"
                (click)="setNetwork('testnet')">
                <i class="fa-brands fa-bitcoin"></i>
                <span>Angor Testnet</span>
              </button>
            </div>
          </div>
        </div>
        
        <div class="settings-section">
          <h2>Nostr Relays</h2>
          <div class="setting-item">
            <label>Manage Relays</label>
            <div class="relay-list">
              @for (relay of relayUrls(); track relay) {
                <div class="relay-item">
                  <span>{{ relay }}</span>
                  <button class="relay-remove" (click)="removeRelay(relay)" title="Remove relay">
                    <i class="fa-solid fa-times"></i>
                  </button>
                </div>
              }
            </div>
            
            <div class="relay-add-container">
              <input 
                type="text" 
                [(ngModel)]="newRelayUrl" 
                placeholder="wss://relay.example.com"
                class="relay-input"
              />
              <button class="relay-add-btn" (click)="addRelay()" [disabled]="!isValidUrl(newRelayUrl)">
                <i class="fa-solid fa-plus"></i>
                Add
              </button>
            </div>
            
            <div class="relay-actions">
              <button class="relay-save-btn" (click)="saveAndReloadRelays()">
                <i class="fa-solid fa-save"></i>
                Save & Reload
              </button>
              @if (relaySaveMessage()) {
                <div class="relay-save-message">{{ relaySaveMessage() }}</div>
              }
            </div>
          </div>
        </div>
        
        <div class="settings-footer">
          <p>Changes are saved automatically except for relay settings</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-container {
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    
    .settings-card {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05);
    }
    
    h1 {
      font-size: 2rem;
      margin-bottom: 2rem;
      color: var(--text);
    }
    
    .settings-section {
      margin-bottom: 2rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--border);
    }
    
    .settings-section:last-of-type {
      border-bottom: none;
    }
    
    h2 {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
      color: var(--text);
    }
    
    .setting-item {
      display: flex;
      flex-direction: column;
      margin-bottom: 1.5rem;
    }
    
    label {
      font-size: 1rem;
      margin-bottom: 0.75rem;
      color: var(--text);
    }
    
    .theme-options, .network-options {
      display: flex;
      gap: 1rem;
    }
    
    .theme-option, .network-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      cursor: pointer;
      transition: all 0.2s ease;
      color: var(--text);
    }
    
    .theme-option:hover, .network-option:hover {
      background: var(--hover-bg);
    }
    
    .theme-option.active, .network-option.active {
      background: var(--accent);
      color: var(--background);
      border-color: var(--accent);
    }
    
    .settings-footer {
      margin-top: 1rem;
      font-size: 0.9rem;
      color: var(--text-secondary);
      text-align: center;
    }

    /* Relay styles */
    .relay-list {
      margin-bottom: 1rem;
      max-height: 200px;
      overflow-y: auto;
    }
    
    .relay-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0.75rem;
      background: var(--input-bg);
      border-radius: 6px;
      margin-bottom: 0.5rem;
    }
    
    .relay-remove {
      background: transparent;
      border: none;
      color: var(--danger);
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 4px;
    }
    
    .relay-remove:hover {
      background: rgba(255, 0, 0, 0.1);
    }
    
    .relay-add-container {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    
    .relay-input {
      flex: 1;
      padding: 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--input-bg);
      color: var(--text);
    }
    
    .relay-add-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .relay-add-btn:hover:not([disabled]) {
      background: var(--hover-bg);
    }
    
    .relay-add-btn[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .relay-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .relay-save-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      background: var(--accent);
      border: none;
      color: white;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .relay-save-btn:hover {
      background: var(--accent-dark);
    }
    
    .relay-save-message {
      text-align: center;
      color: var(--success);
      margin-top: 0.5rem;
      padding: 0.5rem;
      border-radius: 4px;
      background: rgba(0, 255, 0, 0.05);
    }
  `]
})
export class SettingsComponent {
  private themeService = inject(ThemeService);
  private networkService = inject(NetworkService);
  private relayService = inject(RelayService);
  
  currentTheme = signal<string>('');
  currentNetwork = signal<string>('');
  relayUrls = signal<string[]>([]);
  newRelayUrl = '';
  relaySaveMessage = signal<string>('');
  
  constructor() {
    // Initialize the current theme and network
    this.themeService.theme$.subscribe(theme => {
      this.currentTheme.set(theme);
    });
    
    this.currentNetwork.set(this.networkService.getNetwork());
    this.relayUrls.set(this.relayService.getRelayUrls());
  }
  
  setTheme(theme: 'light' | 'dark'): void {
    this.themeService.setTheme(theme);
  }
  
  setNetwork(network: string): void {
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

    window.location.reload();
  }

  isValidUrl(url: string): boolean {
    try {
      const urlPattern = /^wss:\/\/.+/;
      return url.trim() !== '' && urlPattern.test(url);
    } catch {
      return false;
    }
  }
}
