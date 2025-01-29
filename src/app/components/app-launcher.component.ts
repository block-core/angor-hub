import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-launcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-launcher">
      <a class="logo-link" (click)="toggleAppMenu($event)">
        <img src="images/logo.svg" alt="Angor Menu" class="logo">
      </a>
      <div class="app-menu" [class.show]="isAppMenuOpen">
        <div class="app-menu-content">
          <a href="https://test.angor.io" class="app-item">
            <i class="fa-solid fa-rocket"></i>
            <div>
              <span class="app-name">Angor App</span>
              <span class="app-desc">Create and manage funding</span>
            </div>
          </a>
          <a href="https://blog.angor.io" class="app-item">
            <i class="fa-solid fa-newspaper"></i>
            <div>
              <span class="app-name">Angor Blog</span>
              <span class="app-desc">News and updates</span>
            </div>
          </a>
          <a href="https://hub.angor.io" class="app-item">
            <i class="fa-solid fa-compass"></i>
            <div>
              <span class="app-name">Angor Hub</span>
              <span class="app-desc">Discover projects to fund</span>
            </div>
          </a>
          <a href="https://profile.angor.io" class="app-item">
            <i class="fa-solid fa-user"></i>
            <div>
              <span class="app-name">Angor Profile</span>
              <span class="app-desc">Manage your project profile</span>
            </div>
          </a>
          <a href="https://angor.io" class="app-item">
            <i class="fa-solid fa-globe"></i>
            <div>
              <span class="app-name">Angor Web</span>
              <span class="app-desc">Learn about Angor Protocol</span>
            </div>
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .app-launcher {
      position: relative;
    }

    .app-menu {
      position: absolute;
      top: 100%;
      left: 0;
      background: rgba(var(--card-bg-rgb), 0.95);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      width: 320px;
      opacity: 0;
      visibility: hidden;
      transition: all 0.2s ease;
      z-index: 1000;
      margin-top: 0.5rem;
      backdrop-filter: blur(8px);
    }

    .app-menu.show {
      opacity: 1;
      visibility: visible;
    }

    .app-menu-content {
      padding: 0.5rem;
    }

    .app-item {
      display: flex;
      align-items: center;
      padding: 0.75rem;
      color: var(--text);
      text-decoration: none;
      border-radius: 6px;
      transition: background-color 0.2s ease;
    }

    .app-item:hover {
      background-color: var(--hover-bg);
    }

    .app-item i {
      font-size: 1.5rem;
      margin-right: 1rem;
      width: 24px;
      text-align: center;
      color: var(--accent);
    }

    .app-item div {
      display: flex;
      flex-direction: column;
    }

    .app-name {
      font-weight: 500;
      margin-bottom: 0.25rem;
    }

    .app-desc {
      font-size: 0.85rem;
      opacity: 0.7;
    }

    @media (min-width: 1024px) {
      .app-launcher:hover .app-menu {
        opacity: 1;
        visibility: visible;
      }
    }

    .logo {
      height: 32px;
      width: auto;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .logo-link:hover .logo {
      transform: scale(1.05);
      filter: brightness(1.2);
    }
  `]
})
export class AppLauncherComponent {
  isAppMenuOpen = false;

  toggleAppMenu(event: Event) {
    event.preventDefault();
    this.isAppMenuOpen = !this.isAppMenuOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const appLauncher = (event.target as HTMLElement).closest('.app-launcher');
    if (!appLauncher) {
      this.isAppMenuOpen = false;
    }
  }
}
