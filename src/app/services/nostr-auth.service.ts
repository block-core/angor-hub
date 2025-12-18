import { Injectable, signal, effect } from '@angular/core';
import { init as initNostrLogin, launch as launchNostrLoginDialog, logout as nostrLogout } from 'nostr-login';

export interface NostrUser {
  pubkey: string;
  npub?: string;
}

@Injectable({
  providedIn: 'root',
})
export class NostrAuthService {
  private static readonly STORAGE_KEY = 'angor-hub-nostr-user';
  private user = signal<NostrUser | null>(null);
  private isInitialized = false;

  public currentUser = this.user.asReadonly();

  constructor() {
    // Restore session early so UI (e.g. Admin page) doesn't treat refresh as a logout
    this.restoreUserFromStorage();

    // Initialize nostr-login
    this.initializeNostrLogin();
    
    // Listen for auth events
    this.setupAuthListener();

    // Persist auth state changes
    this.setupPersistenceEffect();

    // Best-effort verification/rehydration (won't prompt the user)
    void this.verifyStoredUserAgainstProvider();
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  private restoreUserFromStorage(): void {
    if (!this.isBrowser()) return;

    const raw = localStorage.getItem(NostrAuthService.STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<NostrUser> | null;
      if (!parsed || typeof parsed.pubkey !== 'string' || !parsed.pubkey.trim()) {
        localStorage.removeItem(NostrAuthService.STORAGE_KEY);
        return;
      }

      const npub = typeof parsed.npub === 'string' ? parsed.npub : undefined;
      this.user.set({ pubkey: parsed.pubkey, npub });
    } catch {
      localStorage.removeItem(NostrAuthService.STORAGE_KEY);
    }
  }

  private setupPersistenceEffect(): void {
    if (!this.isBrowser()) return;

    effect(() => {
      const u = this.user();
      if (u) {
        localStorage.setItem(NostrAuthService.STORAGE_KEY, JSON.stringify(u));
      } else {
        localStorage.removeItem(NostrAuthService.STORAGE_KEY);
      }
    });
  }

  private async verifyStoredUserAgainstProvider(): Promise<void> {
    if (!this.isBrowser()) return;

    const existing = this.user();
    if (!existing) return;

    if (!window.nostr?.getPublicKey) return;

    try {
      const pubkey = await window.nostr.getPublicKey();
      if (pubkey && pubkey !== existing.pubkey) {
        // Keep the UI consistent with the active signer.
        this.user.set({ pubkey, npub: existing.npub });
      }
    } catch {
      // If the extension is locked/unavailable, keep the stored session.
    }
  }

  private initializeNostrLogin(): void {
    if (this.isInitialized) {
      return;
    }

    // Only initialize in browser environment
    if (!this.isBrowser()) {
      return;
    }

    try {
      initNostrLogin({
        theme: 'default',
        methods: ['connect', 'extension', 'local'],
        noBanner: true,
        darkMode: true,
        onAuth: async (npub: string, options: any) => {          
          // Get pubkey from window.nostr
          if (window.nostr?.getPublicKey) {
            try {
              const pubkey = await window.nostr.getPublicKey();
              this.user.set({ pubkey, npub });
            } catch (error) {
              console.error('[NostrAuth] Failed to get pubkey:', error);
            }
          }
        },
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('[NostrAuth] ✗ Failed to initialize nostr-login:', error);
    }
  }

  private setupAuthListener(): void {
    if (!this.isBrowser()) {
      return;
    }

    document.addEventListener('nlAuth', async (e: any) => {      
      if (e.detail.type === 'login' || e.detail.type === 'signup') {
        // Get pubkey from window.nostr
        if (window.nostr?.getPublicKey) {
          try {
            const pubkey = await window.nostr.getPublicKey();
            const npub = e.detail.npub || '';
            this.user.set({ pubkey, npub });
          } catch (error) {
            console.error('[NostrAuth] Failed to get pubkey after login:', error);
          }
        }
      } else if (e.detail.type === 'logout') {
        this.user.set(null);
      }
    });
  }

  public async login(startScreen?: string): Promise<void> {
    try {
      await launchNostrLoginDialog(startScreen as any);
    } catch (error) {
      console.error('[NostrAuth] Failed to launch login dialog:', error);
      throw error;
    }
  }

  public async logout(): Promise<void> {
    try {
      await nostrLogout();
      this.user.set(null);
    } catch (error) {
      console.error('[NostrAuth] Failed to logout:', error);
      throw error;
    }
  }

  public isLoggedIn(): boolean {
    return this.user() !== null;
  }

  public getPubkey(): string | null {
    return this.user()?.pubkey || null;
  }

  public getNpub(): string | null {
    return this.user()?.npub || null;
  }

  public async signEvent(event: any): Promise<any> {
    if (!window.nostr?.signEvent) {
      throw new Error('No nostr signer available');
    }

    try {
      return await window.nostr.signEvent(event);
    } catch (error) {
      console.error('[NostrAuth] Failed to sign event:', error);
      throw error;
    }
  }

  public async getPublicKey(): Promise<string> {
    if (!window.nostr?.getPublicKey) {
      throw new Error('No nostr provider available');
    }

    try {
      return await window.nostr.getPublicKey();
    } catch (error) {
      console.error('[NostrAuth] Failed to get public key:', error);
      throw error;
    }
  }
}
