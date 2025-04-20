import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TitleService } from '../../services/title.service';
import { NetworkService } from '../../services/network.service';
import { ThemeService } from '../../services/theme.service';
import { RelayService } from '../../services/relay.service';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import { trigger, transition, style, animate } from '@angular/animations';
import { environment } from '../../../environment';

type SettingsTab = 'appearance' | 'network' | 'relays' | 'about';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, BreadcrumbComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
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
  
  appVersion = environment.appVersion || '1.0.0';
   
  activeTab = signal<SettingsTab>('appearance');
  
  currentTheme = computed(() => {
    return this.themeService.currentTheme();
  });
  
  currentNetwork = computed(() => {
    return this.networkService.isMain() ? 'main' : 'test';
  });
  
  relayUrls = signal<string[]>([]);
  newRelayUrl = signal<string>('');
  relaySaveMessage = signal<string>('');
  
  constructor() {
    this.updateRelayUrls();
  }
  
  ngOnInit(): void {
    this.title.setTitle('Settings');
  }
  
  setActiveTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
  }
  
  setTheme(theme: 'light' | 'dark' | 'system'): void {
    this.themeService.setTheme(theme);
  }
  
  setNetwork(network: 'main' | 'test'): void {
    if (network === 'main') {
      this.networkService.switchToMain();
    } else {
      this.networkService.switchToTest();
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
}
