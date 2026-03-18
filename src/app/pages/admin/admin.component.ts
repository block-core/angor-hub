import { Component, OnInit, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NostrListService } from '../../services/nostr-list.service';
import { RelayService } from '../../services/relay.service';
import { NostrAuthService } from '../../services/nostr-auth.service';
import { HubConfigService } from '../../services/hub-config.service';
import { nip19 } from 'nostr-tools';
import { environment } from '../../../environment';

interface ProjectItem {
  id: string;
  npub: string;
  addedAt: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin.component.html'
})
export class AdminComponent implements OnInit {
  isLoggedIn = signal<boolean>(false);
  adminPubkey = signal<string | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  publishingStatus = signal<string | null>(null);

  // Computed npub for display — converts hex pubkey from nostr-login to npub
  adminNpub = computed(() => {
    const hex = this.adminPubkey();
    if (!hex) return null;
    try {
      return nip19.npubEncode(hex);
    } catch {
      return hex; // fallback to hex if encoding fails
    }
  });

  // Authorization: true only if logged-in pubkey is in the hub's admin pubkeys
  isAuthorizedAdmin = signal<boolean>(false);

  // Deny list (private - kind 10000)
  deniedProjects = signal<ProjectItem[]>([]);
  newProjectId = signal<string>('');
  searchQuery = signal<string>('');

  // Whitelist / Featured projects (public - kind 10001)
  featuredProjects = signal<ProjectItem[]>([]);
  newFeaturedId = signal<string>('');
  featuredSearchQuery = signal<string>('');

  // Tab management — default to the relevant tab for the current hub mode
  activeTab = signal<'deny' | 'featured'>(
    environment.hubMode === 'whitelist' ? 'featured' : 'deny'
  );

  // Relay connection status
  relayStatus = signal<{ url: string; connected: boolean }[]>([]);
  showRelayStatus = signal<boolean>(false);

  filteredProjects = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.deniedProjects();

    return this.deniedProjects().filter(p =>
      p.id.toLowerCase().includes(query) || p.npub.toLowerCase().includes(query)
    );
  });

  filteredFeaturedProjects = computed(() => {
    const query = this.featuredSearchQuery().toLowerCase();
    if (!query) return this.featuredProjects();

    return this.featuredProjects().filter(p =>
      p.id.toLowerCase().includes(query) || p.npub.toLowerCase().includes(query)
    );
  });

  public hubConfig = inject(HubConfigService);

  constructor(
    private nostrListService: NostrListService,
    private relayService: RelayService,
    public nostrAuth: NostrAuthService
  ) {
    // Watch for auth changes
    effect(() => {
      const user = this.nostrAuth.currentUser();
      if (user) {
        console.log('[Admin] User authenticated via nostr-login:', user.pubkey);
        this.isLoggedIn.set(true);
        this.adminPubkey.set(user.pubkey);

        // Check if the logged-in user is an authorized admin
        const authorized = this.hubConfig.isAdmin(user.pubkey);
        this.isAuthorizedAdmin.set(authorized);

        if (authorized) {
          console.log('[Admin] User IS an authorized admin');
          this.loadDenyList();
          this.loadFeaturedList();
        } else {
          console.warn('[Admin] User is NOT an authorized admin. Read-only access.');
        }
      } else {
        console.log('[Admin] User logged out');
        this.isLoggedIn.set(false);
        this.adminPubkey.set(null);
        this.isAuthorizedAdmin.set(false);
        this.deniedProjects.set([]);
        this.featuredProjects.set([]);
      }
    });
  }

  async ngOnInit() {
    // Load relay status
    this.updateRelayStatus();

    // Check if user is already authenticated via nostr-login
    if (this.nostrAuth.isLoggedIn()) {
      const pubkey = this.nostrAuth.getPubkey();
      if (pubkey) {
        console.log('[Admin] Already logged in via nostr-login:', pubkey);
        this.isLoggedIn.set(true);
        this.adminPubkey.set(pubkey);

        const authorized = this.hubConfig.isAdmin(pubkey);
        this.isAuthorizedAdmin.set(authorized);

        if (authorized) {
          await this.loadDenyList();
          await this.loadFeaturedList();
        }
      }
    }
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
      console.log('[Admin] Launching nostr-login...');
      await this.nostrAuth.login('welcome');
      // The effect will handle the rest when user logs in
    } catch (err: any) {
      this.error.set(err.message || 'Failed to login');
      console.error('[Admin] Login error:', err);
      this.loading.set(false);
    }
  }

  async logout() {
    this.loading.set(true);
    this.error.set(null);
    
    try {
      await this.nostrAuth.logout();
      this.success.set('Successfully logged out');
      setTimeout(() => this.success.set(null), 3000);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to logout');
      console.error('[Admin] Logout error:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async loadDenyList() {
    this.loading.set(true);
    this.error.set(null);
    
    try {
      const list = await this.nostrListService.getDenyList();
      const projects: ProjectItem[] = list.map(id => ({
        id,
        npub: nip19.npubEncode(id),
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

  /**
   * Guard: returns true if the user is an authorized admin. Shows error otherwise.
   */
  private requireAuthorization(): boolean {
    if (!this.isAuthorizedAdmin()) {
      this.error.set('Unauthorized: Your pubkey is not in the configured admin pubkeys for this hub. Only admins can modify project lists.');
      return false;
    }
    return true;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s. Relays may be unreachable.`)), ms)
      ),
    ]);
  }

  /**
   * Resolve the entered value to a hex pubkey.
   * Accepts either a 64-char hex Nostr pubkey or an npub (bech32-encoded pubkey).
   */
  private resolveToHexPubkey(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Already hex (64-char lowercase hex)
    if (/^[0-9a-f]{64}$/.test(trimmed)) return trimmed;

    // Decode npub
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === 'npub') return decoded.data as string;
    } catch {
      // Not a valid npub
    }

    return null; // Unrecognised format
  }

  async addProject() {
    if (!this.requireAuthorization()) return;

    const nostrPubKey = this.resolveToHexPubkey(this.newProjectId());

    if (!nostrPubKey) {
      this.error.set('Please enter a valid project npub or hex pubkey');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.publishingStatus.set('Publishing to relays...');

    try {
      await this.withTimeout(
        this.nostrListService.addToDenyList(nostrPubKey),
        300000,
        'Publishing deny list'
      );
      this.publishingStatus.set('Waiting for event propagation...');

      await new Promise(resolve => setTimeout(resolve, 2000));

      this.publishingStatus.set('Reloading deny list...');
      await this.withTimeout(this.loadDenyList(), 300000, 'Reloading deny list');
      this.newProjectId.set('');
      this.publishingStatus.set(null);
      this.success.set('Project added and published successfully to Nostr relays');
      setTimeout(() => this.success.set(null), 4000);
    } catch (err: any) {
      this.publishingStatus.set(null);
      this.handlePublishError(err, 'Failed to add project');
    } finally {
      this.loading.set(false);
    }
  }

  async removeProject(projectId: string) {
    if (!this.requireAuthorization()) return;

    if (!confirm(`Are you sure you want to remove project ${projectId} from the list?`)) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.publishingStatus.set('Publishing changes to relays...');

    try {
      await this.withTimeout(
        this.nostrListService.removeFromDenyList(projectId),
        300000,
        'Publishing deny list'
      );
      this.publishingStatus.set('Waiting for event propagation...');

      await new Promise(resolve => setTimeout(resolve, 2000));

      this.publishingStatus.set('Reloading deny list...');
      await this.withTimeout(this.loadDenyList(), 300000, 'Reloading deny list');
      this.publishingStatus.set(null);
      this.success.set('Project removed and published successfully to Nostr relays');
      setTimeout(() => this.success.set(null), 4000);
    } catch (err: any) {
      this.publishingStatus.set(null);
      this.handlePublishError(err, 'Failed to remove project');
    } finally {
      this.loading.set(false);
    }
  }

  // ==================== WHITELIST / FEATURED PROJECTS ====================

  async loadFeaturedList() {
    this.loading.set(true);
    this.error.set(null);
    
    try {
      const list = await this.nostrListService.getWhiteList();
      const projects: ProjectItem[] = list.map(id => ({
        id,
        npub: nip19.npubEncode(id),
        addedAt: Date.now(),
      }));
      this.featuredProjects.set(projects);
      console.log('[Admin] Loaded featured list from Nostr:', list);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load featured list');
      console.error('Load featured list error:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async addFeaturedProject() {
    if (!this.requireAuthorization()) return;

    const nostrPubKey = this.resolveToHexPubkey(this.newFeaturedId());

    if (!nostrPubKey) {
      this.error.set('Please enter a valid project npub or hex pubkey');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.publishingStatus.set('Publishing to relays...');

    try {
      await this.withTimeout(
        this.nostrListService.addToWhiteList(nostrPubKey),
        300000,
        'Publishing whitelist'
      );
      this.publishingStatus.set('Waiting for event propagation...');

      await new Promise(resolve => setTimeout(resolve, 2000));

      this.publishingStatus.set('Reloading featured list...');
      await this.withTimeout(this.loadFeaturedList(), 300000, 'Reloading featured list');
      this.newFeaturedId.set('');
      this.publishingStatus.set(null);
      this.success.set('Project added to featured list and published successfully');
      setTimeout(() => this.success.set(null), 4000);
    } catch (err: any) {
      this.publishingStatus.set(null);
      this.handlePublishError(err, 'Failed to add featured project');
    } finally {
      this.loading.set(false);
    }
  }

  async removeFeaturedProject(projectId: string) {
    if (!this.requireAuthorization()) return;

    if (!confirm(`Are you sure you want to remove project ${projectId} from the featured list?`)) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.publishingStatus.set('Publishing changes to relays...');

    try {
      await this.withTimeout(
        this.nostrListService.removeFromWhiteList(projectId),
        300000,
        'Publishing whitelist'
      );
      this.publishingStatus.set('Waiting for event propagation...');

      await new Promise(resolve => setTimeout(resolve, 2000));

      this.publishingStatus.set('Reloading featured list...');
      await this.withTimeout(this.loadFeaturedList(), 300000, 'Reloading featured list');
      this.publishingStatus.set(null);
      this.success.set('Project removed from featured list and published successfully');
      setTimeout(() => this.success.set(null), 4000);
    } catch (err: any) {
      this.publishingStatus.set(null);
      this.handlePublishError(err, 'Failed to remove featured project');
    } finally {
      this.loading.set(false);
    }
  }

  private handlePublishError(err: any, fallback: string): void {
    const errorMsg = err.message || fallback;
    if (errorMsg.includes('relay') || errorMsg.includes('unavailable')) {
      this.error.set(`${errorMsg} Try clicking the "Test" button to refresh relay connections, or check Settings.`);
    } else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
      this.error.set(`${errorMsg} Your relays may be slow or unreachable. Try again or configure different relays in Settings.`);
    } else if (errorMsg.includes('extension')) {
      this.error.set(`${errorMsg} Make sure your Nostr extension (Alby/nos2x) is unlocked and working.`);
    } else {
      this.error.set(errorMsg);
    }
    console.error(fallback + ':', err);
  }

  switchTab(tab: 'deny' | 'featured') {
    this.activeTab.set(tab);
  }

  // ==================== UTILITY METHODS ====================

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
