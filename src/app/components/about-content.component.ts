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
    <div class="whitespace-pre-wrap break-words w-full">
      @for (segment of parsedContent(); track $index) {
        @switch (segment.type) {
          @case ('text') {
            <span class="text-sm sm:text-base leading-relaxed text-text-secondary">{{ segment.value }}</span>
          }
          @case ('npub') {
            <!-- Use minimal profile display -->
            <app-profile class="inline" [npub]="segment.value" [link]="'https://primal.net/p/' + segment.value" [displayMode]="'minimal'"></app-profile>
          }
          @case ('hashtag') {
            <!-- Link hashtag to Primal search -->
            <a [href]="'https://primal.net/search/%23' + segment.value.substring(1)" target="_blank" rel="noopener noreferrer nofollow" class="text-accent dark:text-white text-gray-700 font-medium">{{ segment.value }}</a>
          }
          @case ('link') {
            <a [href]="segment.value" target="_blank" rel="noopener noreferrer nofollow" class="text-accent hover:underline break-all">{{ segment.value }}</a>
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

    const segments: ContentSegment[] = [];
    // Regex to find npub, hashtags (# followed by word characters or hyphens), and links.
    const regex = /(npub[a-zA-Z0-9]{59})|(#[\p{L}\p{N}\-_]+)|(https?:\/\/[^\s]+)/gu;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        segments.push({ type: 'text', value: text.substring(lastIndex, match.index) });
      }

      // Add the matched segment
      if (match[1]) { // npub
        try {
          nip19.decode(match[1]); // Validate npub
          segments.push({ type: 'npub', value: match[1] });
        } catch (e) {
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
    if (lastIndex < text.length) {
      segments.push({ type: 'text', value: text.substring(lastIndex) });
    }

    return segments;
  });
}