import { Component, inject, input, effect, signal } from '@angular/core';
import { RelayService } from '../services/relay.service';
import { nip19 } from 'nostr-tools';
import { NDKUserProfile } from '@nostr-dev-kit/ndk';

@Component({
  selector: 'app-profile',
  standalone: true,
  template: `
    <div class="profile-container">
      <div class="avatar-container">
        @if(profile() && profile()!['picture']) {
          <img 
            [src]="profile()!['picture']" 
            alt="User avatar" 
            class="profile-avatar"
            (error)="handleImageError($event)" 
          />
        } @else {
          <div class="profile-avatar-placeholder" [style.background-color]="getRandomColor()">
            {{ getInitial() }}
          </div>
        }
      </div>
      
      <div class="profile-info">
        @if (profile()) {
          <a [href]="link()" target="_blank" rel="noopener noreferrer" class="profile-name text-ellipsis" [title]="profile()!.displayName || profile()!.name || formatNpub()">
            {{ profile()!.displayName || profile()!.name || formatNpub() }}
          </a>
          @if (profile()!.about) {
            <p class="profile-about text-ellipsis" [title]="profile()!.about">{{ truncateAbout(profile()!.about) }}</p>
          }
        } @else {
          <a [href]="link()" target="_blank" rel="noopener noreferrer" class="profile-name text-ellipsis" [title]="formatNpub()">
            {{ formatNpub() }}
          </a>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      font-family: 'Inter', sans-serif;
      max-width: 100%;
    }

    .profile-container {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem;
      border-radius: 8px;
      transition: background-color 0.2s ease;
      max-width: 100%;
      overflow: hidden;
    }

    .profile-container:hover {
      background-color: rgba(0, 0, 0, 0.03);
    }

    .avatar-container {
      position: relative;
      flex-shrink: 0;
    }

    .profile-avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      object-fit: cover;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      border: 2px solid white;
      transition: transform 0.2s ease;
    }

    .profile-avatar:hover {
      transform: scale(1.05);
    }

    .profile-avatar-placeholder {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      color: white;
      font-size: 1.1rem;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      border: 2px solid white;
    }

    .profile-info {
      display: flex;
      flex-direction: column;
      min-width: 0; /* Important for text truncation */
      flex: 1;
      max-width: calc(100% - 60px);
    }

    .text-ellipsis {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
      max-width: 100%;
    }

    .profile-name {
      font-weight: 600;
      color: var(--accent, #3498db);
      text-decoration: none;
      line-height: 1.2;
      font-size: 0.95rem;
    }

    .profile-name:hover {
      text-decoration: underline;
    }

    .profile-about {
      margin: 0.15rem 0 0;
      font-size: 0.8rem;
      color: var(--text-secondary, #666);
      line-height: 1.2;
    }
  `,
})
export class ProfileComponent {
  relay = inject(RelayService);
  npub = input<string>();
  link = input.required<string>();
  pubkey = input<string>();
  #pubkey: any = '';
  profile = signal<NDKUserProfile | null>(null);
  imageError = signal<boolean>(false);

  constructor() {
    effect(() => {
      const publicKey = this.pubkey();
      if (publicKey) {
        this.#pubkey = publicKey;
        this.handleNpubChange(this.#pubkey);
      }
    });

    effect(() => {
      const currentNpub: any = this.npub();
      if (!currentNpub) return;

      try {
        const result = nip19.decode(currentNpub);
        if (result.data) {
          this.#pubkey = result.data as string;
          this.handleNpubChange(this.#pubkey);
        }
      } catch (err) {
        console.error('Error decoding npub:', err);
      }
    });

    this.relay.profileUpdates.subscribe((event) => {
      if (event.pubkey == this.#pubkey) {
        this.profile.set(JSON.parse(event.content));
        this.imageError.set(false); // Reset error state when profile updates
      }
    });
  }

  private async handleNpubChange(npub: string) {
    await this.relay.fetchProfile([npub]);
  }

  handleImageError(event: Event) {
    this.imageError.set(true);
  }

  formatNpub(): string {
    const id = this.npub() || this.pubkey() || this.#pubkey;
    if (!id) return 'Unknown';
    
    if (id.length > 16) {
      return `${id.substring(0, 8)}...${id.substring(id.length - 8)}`;
    }
    
    return id;
  }

  getRandomColor(): string {
    const id = this.npub() || this.pubkey() || this.#pubkey || '';
    let hash = 0;
    
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      '#3498db', '#e74c3c', '#2ecc71', '#f39c12', 
      '#9b59b6', '#1abc9c', '#d35400', '#34495e'
    ];
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  getInitial(): string {
    const profile = this.profile();
    if (profile && profile.name && profile.name.length > 0) {
      return profile.name.charAt(0).toUpperCase();
    }
    
    const id = this.npub() || this.pubkey() || this.#pubkey;
    if (id && id.length > 2) return id.charAt(2).toUpperCase();
    
    return '?';
  }

  truncateAbout(about: string | undefined | null): string {
    if (!about) return '';
    return about.length > 60 ? about.slice(0, 60) + '...' : about;
  }
}
