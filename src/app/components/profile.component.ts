import { Component, inject, input, effect, signal, untracked } from '@angular/core';
import { RelayService } from '../services/relay.service';
import { nip19 } from 'nostr-tools';
import { NDKUserProfile } from '@nostr-dev-kit/ndk';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (displayMode() === 'minimal') {
      <a [href]="'https://nostr.at/' + npub" target="_blank" rel="noopener noreferrer"
         class="font-medium text-accent dark:text-white text-gray-700"
         [title]="profile()?.displayName || profile()?.name || formatNpub()">
        &#64;{{ profile()?.displayName || profile()?.name || formatNpub() }}
      </a>
    } @else {
      <div class="flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 max-w-full overflow-hidden">
        <!-- Avatar -->
        <div class="flex-shrink-0 relative">
          @if(profile() && profile()!['picture'] && !imageError()) {
            <img
              [src]="profile()!['picture']"
              alt="User avatar"
              class="w-10 h-10 rounded-full object-cover shadow-sm border-2 border-white dark:border-gray-700 transition-transform hover:scale-105"
              (error)="handleImageError($event)"
            />
          } @else {
            <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white text-lg shadow-sm border-2 border-white dark:border-gray-700"
                 [style.background-color]="getRandomColor()">
              {{ getInitial() }}
            </div>
          }
        </div>

        <!-- Info -->
        <div class="flex flex-col min-w-0 flex-1">
          <a [href]="'https://nostr.at/' + npub" target="_blank" rel="noopener noreferrer"
             class="font-semibold text-accent hover:underline text-sm truncate"
             [title]="profile()?.displayName || profile()?.name || formatNpub()">
            {{ profile()?.displayName || profile()?.name || formatNpub() }}
          </a>
          @if (profile()?.nip05) {
            <p class="text-xs text-text-secondary truncate mt-0.5" [title]="profile()!.nip05">
            {{ formatNip05(profile()!.nip05) }}
            </p>
          }
        </div>
      </div>
    }
  `,
})
export class ProfileComponent {
  relay = inject(RelayService);
  // npub = input<string>();
  // link = input.required<string>();
  npub = '';
  pubkey = input<string>();
  displayMode = input<'full' | 'minimal'>('full');
  #pubkey: any = '';
  profile = signal<NDKUserProfile | null>(null);
  imageError = signal<boolean>(false);

  constructor() {
    effect(async () => {
      const publicKey = this.pubkey();

      if (!publicKey) {
        this.#pubkey = '';
        this.npub = '';
        this.profile.set(null);
        return;
      }

      if (publicKey.startsWith('npub')) {
        this.npub = publicKey;
        this.#pubkey = nip19.decode(publicKey).data as string;
      } else {
        this.#pubkey = publicKey;
        this.npub = nip19.npubEncode(publicKey);
      }

      await this.handleNpubChange(this.#pubkey);
    });

    // effect(() => {
    //   const currentNpub: any = this.npub();
    //   if (!currentNpub) return;

    //   try {
    //     const result = nip19.decode(currentNpub);
    //     if (result.data) {
    //       this.#pubkey = result.data as string;
    //       this.handleNpubChange(this.#pubkey);
    //     }
    //   } catch (err) {
    //     console.error('Error decoding npub:', err);
    //   }
    // });

    this.relay.profileUpdates.subscribe((event) => {
      if (event.pubkey == this.#pubkey) {
        this.profile.set(JSON.parse(event.content));
        this.imageError.set(false);
      }
    });
  }

  private async handleNpubChange(pubkey: string) {
    await this.relay.fetchProfile([pubkey]);
  }

  handleImageError(event: Event) {
    this.imageError.set(true);
    // Optionally set a fallback image or hide the img element
    // (event.target as HTMLImageElement).style.display = 'none';
  }

  formatNip05(nip05?: string): string {
    if (!nip05) return '';

    // If the NIP-05 starts with an underscore, remove it
    if (nip05.startsWith('_@')) {
      return nip05.substring(1); // Remove the underscore
    }

    return nip05;
  }

  formatNpub(): string {
    const id = this.npub || this.#pubkey;
    if (!id) return 'Unknown';

    if (id.length > 16) {
      return `${id.substring(0, 8)}...${id.substring(id.length - 8)}`;
    }

    return id;
  }

  getRandomColor(): string {
    const id = this.npub || this.#pubkey || '';
    let hash = 0;

    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Tailwind default colors for variety, or use your theme colors
    const colors = [
      '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981',
      '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
      '#d946ef', '#ec4899', '#f43f5e'
    ];

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  getInitial(): string {
    const profile = this.profile();
    const name = profile?.displayName || profile?.name;
    if (name && name.trim().length > 0) {
      return name.trim().charAt(0).toUpperCase();
    }

    const id = this.npub || this.#pubkey;
    // Use a character from the ID if name is unavailable
    if (id && id.length > 2) return id.charAt(2).toUpperCase();

    return '?';
  }
}
