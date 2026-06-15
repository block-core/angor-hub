import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TitleService } from '../../services/title.service';
import { MetaService } from '../../services/meta.service';

interface PlatformLink {
  name: string;
  url: string;
}

@Component({
  selector: 'app-download',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './download.component.html',
  styles: [`
    .download-section {
      position: relative;
      min-height: calc(100vh - 64px);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background-color: var(--surface-ground);
    }

    .download-background {
      position: absolute;
      inset: 0;
      background-image: url('/assets/images/hero-bg-pattern.svg');
      background-repeat: repeat;
      background-size: 164px 164px;
      opacity: 0.05;
    }

    .download-content {
      position: relative;
      z-index: 10;
      text-align: center;
      padding: 2rem;
      max-width: 600px;
      width: 100%;
    }

    .download-logo {
      width: 96px;
      height: 96px;
      margin: 0 auto 2rem;
      filter: drop-shadow(0 10px 30px rgba(75, 124, 90, 0.3));
    }

    .download-headline {
      font-size: clamp(2.5rem, 5vw, 3.5rem);
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 2rem;
      color: var(--text);
    }

    .download-headline .emphasis {
      color: var(--accent);
      font-style: italic;
    }

    .security-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.5rem;
      border-radius: 0.75rem;
      background-color: rgba(75, 124, 90, 0.15);
      border: 1px solid rgba(75, 124, 90, 0.3);
      color: var(--accent);
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 2rem;
    }

    .security-icon {
      font-size: 1.25rem;
    }

    .alt-platforms {
      margin-bottom: 3rem;
    }

    .alt-label {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
    }

    .alt-links {
      display: flex;
      gap: 1rem;
      justify-content: center;
    }

    .alt-link {
      color: var(--text);
      font-size: 0.875rem;
      text-decoration: underline;
      transition: color 0.2s;
    }

    .alt-link:hover {
      color: var(--accent);
    }

    .mobile-section {
      border-top: 1px solid var(--border);
      padding-top: 2rem;
    }

    .mobile-heading {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 1rem;
    }

    .mobile-links {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    @media (max-width: 768px) {
      .download-logo {
        width: 72px;
        height: 72px;
        margin-bottom: 1.5rem;
      }

      .download-headline {
        font-size: 2rem;
        margin-bottom: 1.5rem;
      }

      .mobile-links {
        flex-direction: column;
        align-items: center;
      }
    }
  `]
})
export class DownloadComponent implements OnInit {
  private titleService = inject(TitleService);
  private metaService = inject(MetaService);
  private platformId = inject(PLATFORM_ID);

  private allPlatforms: PlatformLink[] = [
    { name: 'Windows', url: 'https://github.com/block-core/angor/releases' },
    { name: 'macOS', url: 'https://github.com/block-core/angor/releases' },
    { name: 'Linux', url: 'https://github.com/block-core/angor/releases' },
  ];

  detectedPlatform = signal<string>('Windows');

  primaryDownloadUrl = computed(() => {
    const platform = this.allPlatforms.find(p => p.name === this.detectedPlatform());
    return platform?.url ?? 'https://github.com/block-core/angor/releases';
  });

  alternativePlatforms = computed(() =>
    this.allPlatforms.filter(p => p.name !== this.detectedPlatform())
  );

  ngOnInit(): void {
    this.titleService.setTitle('Download Angor');
    this.metaService.updateMetaTags({
      title: 'Download Angor',
      description: 'Download the Angor app for the best security. Available for Windows, macOS, Linux, and Android.',
      image: 'https://angor.io/assets/angor-hub-social.png',
      url: 'https://angor.io/app'
    });

    if (isPlatformBrowser(this.platformId)) {
      this.detectedPlatform.set(this.detectOS());
    }
  }

  private detectOS(): string {
    const ua = navigator.userAgent.toLowerCase();
    const platform = navigator.platform?.toLowerCase() ?? '';

    if (ua.includes('win') || platform.includes('win')) return 'Windows';
    if (ua.includes('mac') || platform.includes('mac')) return 'macOS';
    if (ua.includes('linux') || platform.includes('linux')) return 'Linux';
    return 'Windows';
  }
}
