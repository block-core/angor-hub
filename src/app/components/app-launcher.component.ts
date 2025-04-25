import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-launcher',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="relative" (click)="toggleAppMenu($event)">
      <a class="cursor-pointer group">
        <img src="images/logo-text.svg" alt="Angor Menu" class="h-8 w-auto transition-all duration-300 group-hover:scale-105 group-hover:brightness-125">
      </a>
      @if (isAppMenuOpen()) {
        <div
          class="absolute top-full left-0 mt-2 w-80 rounded-lg border border-border bg-surface-card/90 backdrop-blur-xl shadow-xl z-[1000] transition-all duration-200 ease-out origin-top-left" 
          [class.opacity-100]="isAppMenuOpen()"
          [class.visible]="isAppMenuOpen()"
          [class.opacity-0]="!isAppMenuOpen()"
          [class.invisible]="!isAppMenuOpen()"
          [class.scale-100]="isAppMenuOpen()"
          [class.scale-95]="!isAppMenuOpen()"
          (click)="$event.stopPropagation()"
        >
           <div class="p-2">
            <a href="https://test.angor.io" class="flex items-center gap-4 p-3 rounded-md text-text hover:bg-surface-hover transition-colors duration-200 group/item" target="_blank" rel="noopener noreferrer">
              <i class="fa-solid fa-rocket text-xl w-6 text-center text-text-secondary group-hover/item:text-accent transition-colors duration-200"></i>
              <div>
                <span class="font-medium block mb-0.5">Angor App</span>
                <span class="text-sm text-text-secondary block">Create and manage funding</span>
              </div>
            </a>
            <a href="https://blog.angor.io" class="flex items-center gap-4 p-3 rounded-md text-text hover:bg-surface-hover transition-colors duration-200 group/item" target="_blank" rel="noopener noreferrer">
              <i class="fa-solid fa-newspaper text-xl w-6 text-center text-text-secondary group-hover/item:text-accent transition-colors duration-200"></i>
              <div>
                <span class="font-medium block mb-0.5">Angor Blog</span>
                <span class="text-sm text-text-secondary block">News and updates</span>
              </div>
            </a>
            <a routerLink="/" class="flex items-center gap-4 p-3 rounded-md text-text hover:bg-surface-hover transition-colors duration-200 group/item" (click)="closeMenu()">
              <i class="fa-solid fa-compass text-xl w-6 text-center text-text-secondary group-hover/item:text-accent transition-colors duration-200"></i>
              <div>
                <span class="font-medium block mb-0.5">Angor Hub</span>
                <span class="text-sm text-text-secondary block">Discover projects to fund</span>
              </div>
            </a>
            <a href="https://profile.angor.io" class="flex items-center gap-4 p-3 rounded-md text-text hover:bg-surface-hover transition-colors duration-200 group/item" target="_blank" rel="noopener noreferrer">
              <i class="fa-solid fa-user text-xl w-6 text-center text-text-secondary group-hover/item:text-accent transition-colors duration-200"></i>
              <div>
                <span class="font-medium block mb-0.5">Angor Profile</span>
                <span class="text-sm text-text-secondary block">Manage your project profile</span>
              </div>
            </a>
            <a href="https://angor.io" class="flex items-center gap-4 p-3 rounded-md text-text hover:bg-surface-hover transition-colors duration-200 group/item" target="_blank" rel="noopener noreferrer">
              <i class="fa-solid fa-globe text-xl w-6 text-center text-text-secondary group-hover/item:text-accent transition-colors duration-200"></i>
              <div>
                <span class="font-medium block mb-0.5">Angor Web</span>
                <span class="text-sm text-text-secondary block">Learn about Angor Protocol</span>
              </div>
            </a>
            <a href="https://docs.angor.io" class="flex items-center gap-4 p-3 rounded-md text-text hover:bg-surface-hover transition-colors duration-200 group/item" target="_blank" rel="noopener noreferrer">
              <i class="fa-solid fa-book text-xl w-6 text-center text-text-secondary group-hover/item:text-accent transition-colors duration-200"></i>
              <div>
                <span class="font-medium block mb-0.5">Angor Docs</span>
                <span class="text-sm text-text-secondary block">Angor Documentation</span>
              </div>
            </a>
          </div>
        </div>
      }
    </div>
  `,
})
export class AppLauncherComponent {
  isAppMenuOpen = signal<boolean>(false);

  toggleAppMenu(event: Event) {
    event.preventDefault();
    this.isAppMenuOpen.update(value => !value);
  }

  closeMenu() {
    this.isAppMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Check if the click is outside the component host element
    const hostElement = (event.target as HTMLElement).closest('app-launcher');
    if (!hostElement) {
      this.isAppMenuOpen.set(false);
    }
  }
}
