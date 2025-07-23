import { Component, computed, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { nip19 } from 'nostr-tools';
import { ProfileComponent } from './profile.component';

interface ContentSegment {
  type: 'text' | 'npub' | 'hashtag' | 'link';
  value: string;
}

@Component({
  selector: 'app-about-content',
  standalone: true,
  imports: [CommonModule, ProfileComponent],
  template: `
    <div class="space-y-2 w-full">
      @for (segment of parsedContent(); track $index) {
        @switch (segment.type) {
          @case ('text') {
            <span class="text-sm sm:text-base leading-relaxed text-text block">{{ segment.value }}</span>
          }
          @case ('npub') {
            <!-- Use minimal profile display -->
            <app-profile class="inline-block my-1" [pubkey]="segment.value" [displayMode]="'minimal'"></app-profile>
          }
          @case ('hashtag') {
            <!-- Link hashtag to Primal search -->
            <a [href]="'https://primal.net/search/%23' + segment.value.substring(1)" 
               target="_blank" 
               rel="noopener noreferrer nofollow" 
               class="inline-block px-2 py-1 bg-accent/10 text-accent rounded-md text-sm font-medium hover:bg-accent/20 transition-colors mx-1">{{ segment.value }}</a>
          }
          @case ('link') {
            <a [href]="segment.value" 
               target="_blank" 
               rel="noopener noreferrer nofollow" 
               class="text-accent hover:text-accent-light underline decoration-accent/50 hover:decoration-accent break-all text-sm sm:text-base">{{ segment.value }}</a>
          }
        }
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutContentComponent {
  readonly content = input.required<string | undefined | null>();

  readonly parsedContent = computed(() => {
    const text = this.content();
    if (!text) return [];

    // Trim and clean up the content
    const cleanedText = text.trim().replace(/\s+/g, ' ');
    if (!cleanedText) return [];

    const segments: ContentSegment[] = [];
    // Regex to find npub, hashtags (# followed by word characters or hyphens), and links.
    const regex = /(npub[a-zA-Z0-9]{59})|(#[\p{L}\p{N}\-_]+)|(https?:\/\/[^\s]+)/gu;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(cleanedText)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        const textSegment = cleanedText.substring(lastIndex, match.index).trim();
        if (textSegment) {
          segments.push({ type: 'text', value: textSegment });
        }
      }

      // Add the matched segment
      if (match[1]) { // npub
        try {
          nip19.decode(match[1]); // Validate npub
          segments.push({ type: 'npub', value: match[1] });
        } catch {
          // If invalid npub, treat as text
          segments.push({ type: 'text', value: match[1] });
        }
      } else if (match[2]) { // hashtag
        segments.push({ type: 'hashtag', value: match[2] });
      } else if (match[3]) { // link
        segments.push({ type: 'link', value: match[3] });
      }

      lastIndex = regex.lastIndex;
    }

    // Add any remaining text after the last match
    if (lastIndex < cleanedText.length) {
      const remainingText = cleanedText.substring(lastIndex).trim();
      if (remainingText) {
        segments.push({ type: 'text', value: remainingText });
      }
    }

    return segments;
  });
}