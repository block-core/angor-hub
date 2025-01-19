import { Component, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from './services/theme.service';
import { environment } from '../environment';
import { NetworkService } from './services/network.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, CommonModule],
  template: `
    <header>
      <nav>
        <a routerLink="/" class="logo-link">
          <img src="images/logo-text.svg" alt="Angor Hub Logo" class="logo">
        </a>
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
      <div class="footer-content">
        <div class="footer-section brand-section">
          <img src="images/logo.svg" alt="Angor Logo" class="footer-logo">
          <p class="footer-slogan">Angor is a decentralized crowdfunding platform built on Bitcoin</p>
        </div>

        <div class="footer-sections-right">
          <div class="footer-section">
            <h3>About</h3>
            <ul>
              <li><a href="/terms">Terms of Use</a></li>
              <li><a href="/privacy">Privacy Policy</a></li>
            </ul>
          </div>

          <div class="footer-section">
            <h3>Features</h3>
            <ul>
              <li><a href="https://test.angor.io" target="_blank">Angor Testnet</a></li>
              <li><a href="https://angor.io" target="_blank">Angor Homepage</a></li>
              <li><a href="https://mempool.space" target="_blank">Block Explorer</a></li>
            </ul>
          </div>

          <div class="footer-section">
            <h3>Connect</h3>
            <div class="social-links">
              <a href="https://x.com/blockcoredev" target="_blank" aria-label="Follow us on X">
                <svg class="social-icon" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://github.com/block-core/angor-hub" target="_blank" aria-label="View on GitHub">
                <svg class="social-icon" viewBox="0 0 24 24">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                </svg>
              </a>
              <a href="https://hub.angor.io/profile/3ab7c2108524b7d1c1c585f09c1b7e194f5e7f225a5bb947f378e074d74e9dbf" target="_blank" aria-label="Follow on Nostr">
                <svg class="social-icon" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.374 0 12c0 6.627 5.374 12 12 12 6.627 0 12-5.373 12-12 0-6.626-5.373-12-12-12zm2.189 15.984c-1.032.447-2.076.672-3.142.672a8.52 8.52 0 0 1-3.005-.535 7.932 7.932 0 0 1-2.424-1.463 6.744 6.744 0 0 1-1.621-2.139A5.885 5.885 0 0 1 3.4 9.987c0-.83.153-1.628.459-2.396a6.264 6.264 0 0 1 1.29-2.007 6.206 6.206 0 0 1 1.956-1.377A5.887 5.887 0 0 1 9.52 3.64c.83 0 1.628.153 2.396.459a6.264 6.264 0 0 1 2.007 1.29 6.206 6.206 0 0 1 1.377 1.956c.337.755.506 1.553.506 2.396 0 .83-.153 1.628-.459 2.396a6.264 6.264 0 0 1-1.29 2.007 6.206 6.206 0 0 1-1.956 1.377 5.887 5.887 0 0 1-2.396.459z"/>
                </svg>
              </a>
              <!-- <a href="https://youtube.com/@angorprotocol" target="_blank" aria-label="Subscribe on YouTube">
                <svg class="social-icon" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a> -->
            </div>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2024 Angor Hub. All rights reserved. Version {{ version }}.</p>
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
      padding: 3rem 1rem 1rem;
      margin-top: 4rem;
    }

    .footer-content {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: minmax(300px, 1fr) 2fr;
      gap: 4rem;
      padding-bottom: 2rem;
    }

    .footer-section h3 {
      font-size: 1.1rem;
      margin-bottom: 1rem;
      font-weight: 600;
    }

    .footer-section ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .footer-section ul li {
      margin-bottom: 0.5rem;
    }

    .footer-section a {
      color: var(--header-text);
      text-decoration: none;
      opacity: 0.8;
      transition: opacity 0.2s ease;
    }

    .footer-section a:hover {
      opacity: 1;
      color: var(--accent);
    }

    .footer-section:last-child {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .social-links {
      display: flex;
      gap: 1.5rem;
      justify-content: center;
    }

    .social-icon {
      width: 24px;
      height: 24px;
      fill: currentColor;
      opacity: 0.8;
      transition: all 0.2s ease;
    }

    .social-icon:hover {
      opacity: 1;
      transform: translateY(-2px);
    }

    .footer-bottom {
      border-top: 1px solid var(--border);
      padding-top: 1rem;
      text-align: center;
      opacity: 0.8;
      font-size: 0.9rem;
    }

    @media (max-width: 768px) {
      .footer-content {
        grid-template-columns: 1fr;
        text-align: center;
      }

      .social-links {
        justify-content: center;
      }
    }

    .brand-section {
      grid-column: auto;
      text-align: left;
      margin: 1em;
    }

    .footer-sections-right {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
    }

    @media (max-width: 1024px) {
      .footer-content {
        grid-template-columns: 1fr;
        gap: 2rem;
      }

      .brand-section {
        text-align: center;
      }

      .footer-sections-right {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      }
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
  `]
})
export class AppComponent {
  title = 'angor-hub';

  version = environment.appVersion

  isDropdownOpen = false;

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
