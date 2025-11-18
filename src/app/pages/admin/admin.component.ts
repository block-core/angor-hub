import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NostrListService } from '../../services/nostr-list.service';
import { RelayService } from '../../services/relay.service';

interface ProjectItem {
  id: string;
  addedAt: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html'
})
export class AdminComponent implements OnInit {
  isLoggedIn = signal<boolean>(false);
  adminPubkey = signal<string | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  publishingStatus = signal<string | null>(null);
  
  deniedProjects = signal<ProjectItem[]>([]);
  newProjectId = signal<string>('');
  searchQuery = signal<string>('');
  
  // Relay connection status
  relayStatus = signal<{ url: string; connected: boolean }[]>([]);
  showRelayStatus = signal<boolean>(false);
  
  filteredProjects = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.deniedProjects();
    
    return this.deniedProjects().filter(p => 
      p.id.toLowerCase().includes(query)
    );
  });

  constructor(
    private nostrListService: NostrListService,
    private relayService: RelayService
  ) {}

  async ngOnInit() {
    // Check if already logged in
    const pubkey = this.nostrListService.getAdminPubkey();
    if (pubkey) {
      console.log('[Admin] Already logged in with pubkey:', pubkey);
      this.isLoggedIn.set(true);
      this.adminPubkey.set(pubkey);
      await this.loadDenyList();
    } else {
      console.log('[Admin] Not logged in');
    }
    
    // Load relay status
    this.updateRelayStatus();
  }

  async updateRelayStatus() {
    const relayUrls = this.relayService.getRelayUrls();
    this.relayStatus.set(relayUrls.map(url => ({ url, connected: true })));
  }

  toggleRelayStatus() {
    this.showRelayStatus.update(v => !v);
  }

  async testRelayConnections() {
    this.loading.set(true);
    this.error.set(null);
    this.publishingStatus.set('Testing relay connections...');
    
    try {
      await this.relayService.reconnectToRelays();
      await this.updateRelayStatus();
      
      // Also force reload the deny list after reconnecting
      if (this.isLoggedIn()) {
        console.log('[Admin] Reloading deny list after reconnect...');
        await this.loadDenyList();
      }
      
      this.publishingStatus.set(null);
      this.success.set('Relay connections refreshed successfully');
      setTimeout(() => this.success.set(null), 3000);
    } catch (err: any) {
      this.publishingStatus.set(null);
      this.error.set('Failed to reconnect to relays: ' + (err.message || 'Unknown error'));
    } finally {
      this.loading.set(false);
    }
  }

  async login() {
    this.loading.set(true);
    this.error.set(null);
    
    try {
      console.log('[Admin] Attempting login...');
      const pubkey = await this.nostrListService.loginWithNostr();
      if (pubkey) {
        console.log('[Admin] Login successful, pubkey:', pubkey);
        this.isLoggedIn.set(true);
        this.adminPubkey.set(pubkey);
        console.log('[Admin] Loading deny list...');
        await this.loadDenyList();
        this.success.set('Successfully logged in');
        setTimeout(() => this.success.set(null), 3000);
      }
    } catch (err: any) {
      this.error.set(err.message || 'Failed to login');
      console.error('[Admin] Login error:', err);
    } finally {
      this.loading.set(false);
    }
  }

  logout() {
    this.nostrListService.logout();
    this.isLoggedIn.set(false);
    this.adminPubkey.set(null);
    this.deniedProjects.set([]);
    this.success.set('Successfully logged out');
    setTimeout(() => this.success.set(null), 3000);
  }

  async loadDenyList() {
    this.loading.set(true);
    this.error.set(null);
    
    try {
      const list = await this.nostrListService.getDenyList();
      const projects: ProjectItem[] = list.map(id => ({
        id,
        addedAt: Date.now(), // We don't have exact timestamp, use current
      }));
      this.deniedProjects.set(projects);
      console.log('[Admin] Loaded deny list from Nostr:', list);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load deny list');
      console.error('Load deny list error:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async addProject() {
    const projectId = this.newProjectId().trim();
    
    if (!projectId) {
      this.error.set('Please enter a project ID');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.publishingStatus.set('Publishing to relays...');
    
    try {
      await this.nostrListService.addToDenyList(projectId);
      this.publishingStatus.set('Waiting for event propagation...');
      
      // Wait a bit for the event to propagate to relays
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.publishingStatus.set('Reloading deny list...');
      await this.loadDenyList();
      this.newProjectId.set('');
      this.publishingStatus.set(null);
      this.success.set('✓ Project added and published successfully to Nostr relays');
      setTimeout(() => this.success.set(null), 4000);
    } catch (err: any) {
      this.publishingStatus.set(null);
      const errorMsg = err.message || 'Failed to add project';
      
      // Provide helpful context for different error types
      if (errorMsg.includes('relay') || errorMsg.includes('unavailable')) {
        this.error.set(`${errorMsg} Try clicking the "Test" button to refresh relay connections, or check Settings.`);
      } else if (errorMsg.includes('timeout')) {
        this.error.set(`${errorMsg} Your relays may be slow. Try again or configure different relays in Settings.`);
      } else if (errorMsg.includes('extension')) {
        this.error.set(`${errorMsg} Make sure your Nostr extension (Alby/nos2x) is unlocked and working.`);
      } else {
        this.error.set(errorMsg);
      }
      console.error('Add project error:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async removeProject(projectId: string) {
    if (!confirm(`Are you sure you want to remove project ${projectId} from the list?`)) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.publishingStatus.set('Publishing changes to relays...');
    
    try {
      await this.nostrListService.removeFromDenyList(projectId);
      this.publishingStatus.set('Waiting for event propagation...');
      
      // Wait a bit for the event to propagate to relays
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.publishingStatus.set('Reloading deny list...');
      await this.loadDenyList();
      this.publishingStatus.set(null);
      this.success.set('✓ Project removed and published successfully to Nostr relays');
      setTimeout(() => this.success.set(null), 4000);
    } catch (err: any) {
      this.publishingStatus.set(null);
      const errorMsg = err.message || 'Failed to remove project';
      
      // Provide helpful context for different error types
      if (errorMsg.includes('relay') || errorMsg.includes('unavailable')) {
        this.error.set(`${errorMsg} Try clicking the "Test" button to refresh relay connections, or check Settings.`);
      } else if (errorMsg.includes('timeout')) {
        this.error.set(`${errorMsg} Your relays may be slow. Try again or configure different relays in Settings.`);
      } else if (errorMsg.includes('extension')) {
        this.error.set(`${errorMsg} Make sure your Nostr extension (Alby/nos2x) is unlocked and working.`);
      } else {
        this.error.set(errorMsg);
      }
      console.error('Remove project error:', err);
    } finally {
      this.loading.set(false);
    }
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.success.set('Copied to clipboard');
      setTimeout(() => this.success.set(null), 2000);
    });
  }

  formatPubkey(pubkey: string): string {
    if (!pubkey) return '';
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
