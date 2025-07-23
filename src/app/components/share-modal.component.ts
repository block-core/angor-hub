import { Component, Input, Output, EventEmitter, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkService } from '../services/network.service';

export interface ShareData {
    title: string;
    description: string;
    url: string;
    imageUrl?: string;
    projectId?: string;
}

@Component({
    selector: 'app-share-modal',
    standalone: true,
    imports: [CommonModule],
    template: `
    @if (isOpen()) {
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" (click)="close()">
        <div class="bg-surface-card rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 ease-out" (click)="$event.stopPropagation()">
          <!-- Modal Header -->
          <div class="flex items-center justify-between p-6 border-b border-border">          
          <h3 class="text-xl font-bold text-text flex items-center gap-2">
            <span class="material-icons text-accent">share</span>
            Share {{ shareData?.title ? 'Project' : 'Content' }}
          </h3>
            <button 
              (click)="close()"
              class="rounded-full transition-colors duration-200">
              <span class="material-icons text-text-secondary">close</span>
            </button>
          </div>

          <!-- Modal Content -->
          <div class="p-6">        
              <!-- Content Info -->
          <div class="flex items-center gap-3 mb-6 p-3 bg-surface-hover rounded-lg">            @if (shareData?.imageUrl) {
              <img [src]="shareData?.imageUrl" 
                class="w-12 h-12 rounded-full object-cover" 
                alt="Content image" />
            } @else {
              <div class="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold bg-gradient-to-br from-blue-500 to-purple-600">
                <span class="material-icons">{{ getDefaultIcon() }}</span>
              </div>
            }
            <div class="flex-1 min-w-0">
              <h4 class="font-semibold text-text truncate">{{ shareData?.title || 'Content' }}</h4>
              <p class="text-sm text-text-secondary truncate">{{ getDisplayDescription() }}</p>
            </div>          
        </div>

            <!-- Copy Link -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-text mb-2">Share Link</label>
              <div class="flex gap-2">
                <input 
                  type="text" 
                  [value]="getNetworkUrl()" 
                  readonly
                  class="flex-1 px-3 py-2 bg-surface-ground border border-border rounded-lg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  #linkInput>
                <button 
                  (click)="copyToClipboard()"
                  [class.bg-green-500]="copySuccess()"
                  [class.hover:bg-green-600]="copySuccess()"
                  [class.bg-accent]="!copySuccess()"
                  [class.hover:bg-accent-dark]="!copySuccess()"
                  class="px-4 py-2 text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2 min-w-[100px]">
                  <span class="material-icons text-sm">
                    {{ copySuccess() ? 'check' : 'content_copy' }}
                  </span>
                  {{ copySuccess() ? 'Copied!' : 'Copy' }}
                </button>
              </div>
            </div>

            <!-- Social Media Share Buttons -->
            <div class="space-y-3">
              <h4 class="text-sm font-medium text-text mb-3">Share on Social Media</h4>
              
              <div class="grid grid-cols-2 gap-3">
                <!-- Twitter/X -->
                <button 
                  (click)="shareOnTwitter()"
                  class="flex items-center gap-3 p-3 bg-[#1DA1F2] hover:bg-[#0d8bd9] text-white rounded-lg transition-colors duration-200">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  <span class="font-medium">Twitter</span>
                </button>

                <!-- Facebook -->
                <button 
                  (click)="shareOnFacebook()"
                  class="flex items-center gap-3 p-3 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-lg transition-colors duration-200">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span class="font-medium">Facebook</span>
                </button>

                <!-- LinkedIn -->
                <button 
                  (click)="shareOnLinkedIn()"
                  class="flex items-center gap-3 p-3 bg-[#0A66C2] hover:bg-[#004182] text-white rounded-lg transition-colors duration-200">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  <span class="font-medium">LinkedIn</span>
                </button>

                <!-- Telegram -->
                <button 
                  (click)="shareOnTelegram()"
                  class="flex items-center gap-3 p-3 bg-[#0088cc] hover:bg-[#0077b3] text-white rounded-lg transition-colors duration-200">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  <span class="font-medium">Telegram</span>
                </button>

                <!-- WhatsApp -->
                <button 
                  (click)="shareOnWhatsApp()"
                  class="flex items-center gap-3 p-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg transition-colors duration-200">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                  </svg>
                  <span class="font-medium">WhatsApp</span>
                </button>

                <!-- Reddit -->
                <button 
                  (click)="shareOnReddit()"
                  class="flex items-center gap-3 p-3 bg-[#FF4500] hover:bg-[#e63e00] text-white rounded-lg transition-colors duration-200">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                  </svg>
                  <span class="font-medium">Reddit</span>
                </button>
              </div>

              <!-- Email Share -->
              <button 
                (click)="shareViaEmail()"
                class="w-full flex items-center justify-center gap-3 p-3 bg-surface-ground hover:bg-surface-hover border border-border text-text rounded-lg transition-colors duration-200">
                <span class="material-icons">email</span>
                <span class="font-medium">Share via Email</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class ShareModalComponent {
    @Input() shareData: ShareData | null = null;
    @Input() isOpen = signal<boolean>(false);
    @Output() closeModal = new EventEmitter<void>();

    public networkService = inject(NetworkService);

    copySuccess = signal<boolean>(false);

    close(): void {
        this.isOpen.set(false);
        this.closeModal.emit();
        this.copySuccess.set(false);
    }
    getDefaultIcon(): string {
        const data = this.shareData;
        if (data?.projectId) return 'folder';
        return 'share';
    }
    getDisplayDescription(): string {
        const data = this.shareData;
        if (!data?.description) return 'Check this out on Angor Hub';

        return data.description.length > 100
            ? data.description.substring(0, 100) + '...'
            : data.description;
    } getNetworkUrl(): string {
        const data = this.shareData;
        if (!data?.url) return '';

        const baseUrl = window.location.origin;
        const networkParam = this.networkService.isMain() ? 'main' : 'test';

        // Add network parameter to all URLs
        if (data.projectId) {
            return `${baseUrl}/project/${data.projectId}?network=${networkParam}`;
        }

        // Check if URL already has query parameters
        const separator = data.url.includes('?') ? '&' : '?';
        return data.url + `${separator}network=${networkParam}`;
    }

    async copyToClipboard(): Promise<void> {
        try {
            await navigator.clipboard.writeText(this.getNetworkUrl());
            this.copySuccess.set(true);
            setTimeout(() => this.copySuccess.set(false), 2000);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = this.getNetworkUrl();
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.copySuccess.set(true);
            setTimeout(() => this.copySuccess.set(false), 2000);
        }
    }
    shareOnTwitter(): void {
        const data = this.shareData;
        const url = this.getNetworkUrl();
        const text = `Check out "${data?.title || 'this content'}" on @AngorHub - ${this.getDisplayDescription()}`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        window.open(twitterUrl, '_blank', 'width=550,height=420');
    }

    shareOnFacebook(): void {
        const url = this.getNetworkUrl();
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        window.open(facebookUrl, '_blank', 'width=580,height=296');
    }
    shareOnLinkedIn(): void {
        const data = this.shareData;
        const url = this.getNetworkUrl();
        const title = data?.title || 'Content on Angor Hub';
        const summary = this.getDisplayDescription();
        const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(summary)}`;
        window.open(linkedInUrl, '_blank', 'width=520,height=570');
    }
    shareOnTelegram(): void {
        const data = this.shareData;
        const url = this.getNetworkUrl();
        const text = `Check out "${data?.title || 'this content'}" on Angor Hub: ${this.getDisplayDescription()}`;
        const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        window.open(telegramUrl, '_blank');
    }
    shareOnWhatsApp(): void {
        const data = this.shareData;
        const url = this.getNetworkUrl();
        const text = `Check out *"${data?.title || 'this content'}"* on Angor Hub: ${this.getDisplayDescription()} ${url}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(whatsappUrl, '_blank');
    }

    shareOnReddit(): void {
        const data = this.shareData;
        const url = this.getNetworkUrl();
        const title = `${data?.title || 'Content'} on Angor Hub `;
        const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
        window.open(redditUrl, '_blank');
    }

    shareViaEmail(): void {
        const data = this.shareData;
        const url = this.getNetworkUrl();
        const subject = `Check out "${data?.title || 'this content'}" on Angor Hub`;
        const body = `Hi,

I wanted to share this interesting ${data?.projectId ? 'project' : 'content'} with you:

${data?.title || 'Content'}
${this.getDisplayDescription()}

You can view it here: ${url}

Angor is a P2P funding protocol built on Bitcoin and Nostr.

Best regards`;

        const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = emailUrl;
    }
}
