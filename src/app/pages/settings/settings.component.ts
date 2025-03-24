import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../services/theme.service';
import { NetworkService } from '../../services/network.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-container">
      <div class="settings-card">
        <h1>Settings</h1>
        
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
        
        <div class="settings-footer">
          <p>Changes are saved automatically</p>
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
    }
    
    .theme-option:hover, .network-option:hover {
      background: var(--hover-bg);
    }
    
    .theme-option.active, .network-option.active {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }
    
    .settings-footer {
      margin-top: 1rem;
      font-size: 0.9rem;
      color: var(--text-secondary);
      text-align: center;
    }
  `]
})
export class SettingsComponent {
  private themeService = inject(ThemeService);
  private networkService = inject(NetworkService);
  
  currentTheme = signal<string>('');
  currentNetwork = signal<string>('');
  
  constructor() {
    // Initialize the current theme and network
    this.themeService.theme$.subscribe(theme => {
      this.currentTheme.set(theme);
    });
    
    this.currentNetwork.set(this.networkService.getNetwork());
  }
  
  setTheme(theme: 'light' | 'dark'): void {
    this.themeService.setTheme(theme);
  }
  
  setNetwork(network: string): void {
    this.networkService.setNetwork(network);
    this.currentNetwork.set(network);
  }
}
