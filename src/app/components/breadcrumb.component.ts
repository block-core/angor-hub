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
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        @for (item of items; track item.url; let last = $last) {
          <li class="breadcrumb-item">
            @if (!last) {
              <a [routerLink]="item.url" [title]="item.label">{{ item.label }}</a>
            } @else {
              <span [title]="item.label">{{ item.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: [
    `
      nav {
        width: 100%;
        overflow: hidden;
        white-space: nowrap;
      }
      .breadcrumb {
        display: inline-flex;
        flex-wrap: nowrap;
        align-items: center;
        margin: 0;
        padding: 0.75rem 1rem;
        width: 100%;
      }
      .breadcrumb-item {
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
        min-width: 0;
      }
      .breadcrumb-item:last-child {
        flex: 1;
        min-width: 0;
      }
      .breadcrumb-item:last-child span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .breadcrumb-item a,
      .breadcrumb-item span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .breadcrumb-item + .breadcrumb-item::before {
        content: '/';
        padding: 0 0.5rem;
        flex-shrink: 0;
      }
    `,
  ],
})
export class BreadcrumbComponent {
  @Input() items: BreadcrumbItem[] = [];
}
