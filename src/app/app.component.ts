import { Component, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from './services/theme.service';
import { environment } from '../environment';
import { NetworkService } from './services/network.service';
import { AppLauncherComponent } from './components/app-launcher.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, CommonModule, AppLauncherComponent],
  template: `
    <header>
      <nav>
        <app-launcher></app-launcher>
        <!-- <a routerLink="/" class="logo-link">
          <img src="images/logo-text.svg" alt="Angor Hub Logo" class="logo">
        </a> -->
        <div class="nav-links">
          <div class="custom-dropdown" [class.open]="isDropdownOpen" [attr.data-network]="networkService.getNetwork()">
            <div class="custom-dropdown-toggle" (click)="toggleDropdown()">
              <i class="fa-brands fa-bitcoin"></i>
              <span>{{ networkService.getNetwork() === 'mainnet' ? 'Mainnet' : 'Angor Testnet' }}</span>
              <i class="fa-solid fa-chevron-down"></i>
            </div>
            <div class="custom-dropdown-menu">
              <div class="custom-dropdown-item" (click)="selectNetwork('mainnet')" data-network="mainnet">
                <i class="fa-brands fa-bitcoin"></i>
                <span>Mainnet</span>
              </div>
              <div class="custom-dropdown-item" (click)="selectNetwork('testnet')" data-network="testnet">
                <i class="fa-brands fa-bitcoin"></i>
                <span>Angor Testnet</span>
              </div>
            </div>
          </div>
          <button (click)="toggleTheme()" class="theme-toggle">
            {{ (themeService.theme$ | async) === 'light' ? '☀️' : '🌙' }}
          </button>
        </div>
      </nav>
    </header>

    <main>
      <router-outlet />
    </main>

    <footer class="modern-footer">
      <div class="footer-bottom">
        <div>
          <img src="images/logo.svg" alt="Angor Logo" class="footer-logo">
          <p class="footer-slogan">Angor is a decentralized crowdfunding platform built on Bitcoin</p>
        </div>

        <p>&copy; 2024 Angor Hub. All rights reserved. Version {{ version }}.
           <a href="https://angor.io/terms/">Terms of Use</a>.
        <a href="https://angor.io/privacy/">Privacy Policy</a>.</p>
      </div>
    </footer>
  `,
  styles: [`
    .theme-toggle {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.2rem;
      padding: 0.5rem;
    }

    .modern-footer {
      background: var(--header-bg);
      color: var(--header-text);
      padding: 3rem 1rem 3rem;
      margin-top: 4rem;
    }

    .footer-bottom {
      padding-top: 1rem;
      text-align: center;
      opacity: 0.8;
      font-size: 0.9rem;
    }

    .footer-logo {
      height: 40px;
      width: auto;
      margin-bottom: 1rem;
    }

    .footer-slogan {
      opacity: 0.8;
      max-width: 400px;
      margin: 0 auto;
      line-height: 1.5;
    }

    .network-selector {
      margin-right: 1rem;
      padding: 0.5rem;
      font-size: 1rem;
      appearance: none;
      background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
      background-repeat: no-repeat;
      background-position: right 0.7rem top 50%;
      background-size: 0.65rem auto;
      padding-right: 2rem;
    }

    [data-theme="dark"] .network-selector {
      background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
    }

    .network-selector option {
      font-family: "Font Awesome 6 Brands", sans-serif;
    }

    .custom-dropdown {
      position: relative;
      margin-right: 1rem;
    }

    .fa-chevron-down {
      font-size: 0.8rem;
      margin-left: 0.5rem;
      opacity: 0.7;
      transition: transform 0.2s ease;
    }

    .custom-dropdown.open .fa-chevron-down {
      transform: rotate(180deg);
    }

    @media (max-width: 768px) {
      .custom-dropdown-toggle span {
        display: none;
      }
      
      .custom-dropdown-toggle {
        padding: 0.5rem;
      }
    }

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
  `]
})
export class AppComponent {
  title = 'angor-hub';

  version = environment.appVersion

  isDropdownOpen = false;
  isAppMenuOpen = false;

  constructor(public themeService: ThemeService, public networkService: NetworkService) {

  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  selectNetwork(network: string) {
    this.networkService.setNetwork(network);
    this.isDropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const dropdown = (event.target as HTMLElement).closest('.custom-dropdown');
    if (!dropdown) {
      this.isDropdownOpen = false;
    }
  }
}
