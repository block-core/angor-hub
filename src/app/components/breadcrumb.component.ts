import { Component, Input } from '@angular/core';
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
    <nav aria-label="breadcrumb" class="w-full overflow-hidden whitespace-nowrap text-sm text-text-secondary">
      <ol class="inline-flex flex-nowrap items-center p-3 rounded-lg bg-surface-card/50 backdrop-blur-sm border border-border">
        @for (item of items; let first = $first; let last = $last; track item.url) {
          @if (!first) {
            <li class="inline-flex items-center px-1.5">
              <span class="material-icons text-base leading-none">chevron_right</span>
            </li>
          }
          <li class="inline-flex items-center flex-shrink min-w-0" [class.flex-1]="last">
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
  @Input() items: BreadcrumbItem[] = [];
}
