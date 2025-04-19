import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../environment';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer>
      <div class="footer-links">
         <a href="https://angor.io/terms" target="_blank">Terms of Service</a>
         <span class="link-divider">|</span>
         <a href="https://angor.io/privacy" target="_blank">Privacy Policy</a>
      </div>
      <div class="copyright">
        &copy; {{ currentYear }} Angor. All rights reserved.
        <div class="version">Angor Hub v{{ version }}</div>
      </div>
    </footer>
  `,
  styles: [`
    footer {
      background: var(--header-bg);
      color: var(--header-text);
      text-align: center;
      padding: 1.5rem 1.5rem;
      box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
      margin-top: auto;
    }

    .footer-links {
      max-width: 1200px;
      margin: 0 auto 1rem;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .footer-links a {
      color: var(--header-text);
      opacity: 0.8;
      transition: all 0.2s ease;
      font-size: 0.9rem;
    }

    .footer-links a:hover {
      opacity: 1;
      color: var(--accent);
    }

    .link-divider {
      color: var(--header-text);
      opacity: 0.5;
      font-size: 0.9rem;
    }

    .copyright {
      padding-top: 1rem;
      border-top: 1px solid var(--divider-color);
      font-size: 0.85rem;
      opacity: 0.7;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .version {
      margin-top: 0.5rem;
      font-size: 0.75rem;
      opacity: 0.7;
    }
  `]
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  version = environment.appVersion;
}
