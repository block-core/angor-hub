import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

interface BreadcrumbItem {
  label: string;
  url: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <nav aria-label="breadcrumb" class="w-full overflow-hidden whitespace-nowrap text-sm">
      <ol class="inline-flex flex-nowrap items-center p-3 rounded-lg bg-surface-card/50 dark:bg-surface-card/70 backdrop-blur-sm">
        @for (item of items(); let first = $first; let last = $last; track item.url) {
          @if (!first) {
            <li class="inline-flex items-center px-1.5 max-sm:hidden">
              <span class="material-icons text-base leading-none text-text-secondary">chevron_right</span>
            </li>
          }
          <li class="inline-flex items-center flex-shrink min-w-0" [class.flex-1]="last" [class.max-sm:hidden]="!last"> <!-- Hide non-last items on small screens -->
            @if (!last && item.url) {
              <a [routerLink]="item.url" [title]="item.label" class="text-text-secondary hover:text-accent transition-colors truncate">{{ item.label }}</a>
            } @else {
              <span [title]="item.label" class="text-text font-medium truncate">{{ item.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class BreadcrumbComponent {
  items = input.required<BreadcrumbItem[]>();
}
