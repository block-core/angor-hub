import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { nip19 } from 'nostr-tools';

@Pipe({
  name: 'safeContent',
  standalone: true
})
export class SafeContentPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  // Regexes - Order matters: More specific patterns first
  // Match the entire segment using ^ and $
  private imageRegex = /^(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|avif))(\?[^\s]*)?$/i;
  private videoRegex = /^(https?:\/\/[^\s]+\.(mp4|webm|mov))(\?[^\s]*)?$/i;
  private audioRegex = /^(https?:\/\/[^\s]+\.(mp3|ogg|wav))(\?[^\s]*)?$/i;
  private nostrUriRegex = /^(nostr:(npub|nprofile|nevent|note|naddr)[a-zA-Z0-9]+)$/;
  private hashtagRegex = /^(#[\p{L}\p{N}\-_]+)$/u;
  private urlRegex = /^(https?:\/\/[^\s]+)$/; // Generic URL, check last

  // Function to escape HTML characters for safe insertion
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  transform(content: string | null | undefined): SafeHtml {
    if (!content) {
      return '';
    }

    // Split content by whitespace, keeping the delimiters
    const segments = content.split(/(\s+)/);

    const processedSegments = segments.map(segment => {
      if (!segment) return ''; // Skip empty segments

      let match;

      // 1. Images
      match = segment.match(this.imageRegex);
      if (match) {
        const imageUrl = match[1] + (match[3] || '');
        return `<img src="${this.escapeHtml(imageUrl)}" class="embedded-image max-w-full h-auto my-2 rounded" alt="Embedded image" loading="lazy">`;
      }

      // 2. Videos
      match = segment.match(this.videoRegex);
      if (match) {
        const videoUrl = match[1] + (match[3] || '');
        return `<video controls src="${this.escapeHtml(videoUrl)}" class="embedded-video max-w-full my-2 rounded" loading="lazy"></video>`;
      }

      // 3. Audio
      match = segment.match(this.audioRegex);
      if (match) {
        const audioUrl = match[1] + (match[3] || '');
        return `<audio controls src="${this.escapeHtml(audioUrl)}" class="embedded-audio my-2" loading="lazy"></audio>`;
      }

      // 4. Nostr URIs (nostr:...)
      match = segment.match(this.nostrUriRegex);
      if (match) {
        const nostrUri = match[1];
        const bech32 = nostrUri.substring(6); // Extract the part after "nostr:"
        try {
          nip19.decode(bech32); // Validate the bech32 identifier
          const type = nostrUri.split(':')[1].split(/[a-zA-Z0-9]+/)[0]; // Extract type
          switch (type) {
            case 'npub': {
              // Render app-profile for npub
              return `<app-profile class="inline" [npub]="${bech32}" [link]="'https://njump.me/' + ${bech32}" [displayMode]="'minimal'"></app-profile>`;
            }
            case 'nprofile': {
              // Render app-profile for nprofile
              return `<app-profile class="inline" [npub]="${bech32}" [link]="'https://njump.me/' + ${bech32}" [displayMode]="'minimal'"></app-profile>`;
            }
            default: {
              // Use nostr.at for redirection
              const jumpUrl = `https://nostr.at/${nostrUri}`;
              return `<a href="${this.escapeHtml(jumpUrl)}" target="_blank" rel="noopener noreferrer nofollow" class="text-accent hover:underline">${this.escapeHtml(nostrUri)}</a>`;
            }
          }
        } catch (e) {
          // Invalid nostr URI, treat as plain text
          return this.escapeHtml(segment);
        }
      }

      // 5. Hashtags (#...)
      match = segment.match(this.hashtagRegex);
      if (match) {
        const hashtag = match[1];
        const tag = hashtag.substring(1);
        // Link to Primal search
        const searchUrl = `https://primal.net/search/%23${encodeURIComponent(tag)}`;
        return `<a href="${this.escapeHtml(searchUrl)}" target="_blank" rel="noopener noreferrer nofollow" class="text-accent dark:text-white text-gray-700 font-medium hover:underline">${this.escapeHtml(hashtag)}</a>`;
      }

      // 6. Generic URLs (http/https) - Check last
      match = segment.match(this.urlRegex);
      if (match) {
        const url = match[1];
        // Basic check to avoid re-linking media/nostr URIs if logic failed above
        if (!url.match(this.imageRegex) && !url.match(this.videoRegex) && !url.match(this.audioRegex)) {
           return `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer nofollow" class="text-accent hover:underline break-all">${this.escapeHtml(url)}</a>`;
        }
        // If it looked like a URL but was already handled (e.g., image), treat as text
         return this.escapeHtml(segment);
      }

      // 7. Whitespace (handle newlines)
      if (segment.match(/^\s+$/)) {
        return segment.replace(/\n/g, '<br>');
      }

      // 8. Plain text
      return this.escapeHtml(segment);
    });

    const finalHtml = processedSegments.join('');

    // Sanitize the fully constructed HTML
    return this.sanitizer.bypassSecurityTrustHtml(finalHtml);
  }
}
