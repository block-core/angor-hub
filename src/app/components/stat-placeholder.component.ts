import { Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-placeholder',
  standalone: true,
  template: `
    @if (failed()) {
      <span class="text-text-secondary text-sm" aria-label="Investment values unavailable">—</span>
    } @else {
      <span role="status" class="inline-block h-[0.8em] w-12 rounded bg-text-secondary/20 motion-safe:animate-pulse align-middle">
        <span class="sr-only">Loading investment values</span>
      </span>
    }
  `,
})
export class StatPlaceholderComponent {
  failed = input(false);
}
