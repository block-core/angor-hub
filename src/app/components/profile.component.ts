import { Component, inject, input, effect, signal } from '@angular/core';
import { RelayService } from '../services/relay.service';
import { nip19 } from 'nostr-tools';
import { NDKUserProfile } from '@nostr-dev-kit/ndk';

@Component({
  selector: 'app-profile',
  standalone: true,
  template: `
    @if(profile()) { 
      @if(profile()!['picture']) {
        <img [src]="profile()!['picture']" alt="avatar" width="32" height="32" />
      }
      @if (profile()!.displayName) {
        <div>
          <a [href]="link()">{{ profile()!.displayName }}</a>
        </div>
      } @else {
        <div>
          <a [href]="link()">{{ profile()!.name }}</a>
        </div>
      }
    } @else {
      <div>
        <span class="material-icons">person</span>
        <a [href]="link()">{{ npub() }}</a>
      </div>
    }
  `,
  styles: `
    :host {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        border-radius: 4px;
        font-family: monospace;
    }

    .member-npub {
      font-size: 0.9rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }`,
})
export class ProfileComponent {
  relay = inject(RelayService);
  npub = input<string>();
  link = input.required<string>();
  pubkey = input<string>();
  #pubkey: any = '';
  profile = signal<NDKUserProfile | null>(null);

  constructor() {
    effect(() => {
      const publicKey = this.pubkey();
      this.#pubkey = publicKey;

      if (publicKey) {
        this.handleNpubChange(this.#pubkey);
      }
    });


    effect(() => {
      const currentNpub: any = this.npub();
      
      if (!currentNpub) {
        return;
      }

      const result = nip19.decode(currentNpub);

      if (result.data) {
        this.#pubkey  = result.data as string;
        this.handleNpubChange(this.#pubkey);
      }
    });

    this.relay.profileUpdates.subscribe((event) => {
      // Add your profile update handling logic here
      if (event.pubkey == this.#pubkey) {
        console.log('Profile update for current user:', event);
        this.profile.set(JSON.parse(event.content));
      }
    });
  }

  private async handleNpubChange(npub: string) {
    console.log('npub changed:', npub);
    // Add your npub change handling logic here

    await this.relay.fetchProfile([npub]);
  }
}
