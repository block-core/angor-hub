import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TitleService } from '../../services/title.service';
import { MetaService } from '../../services/meta.service';
import { ThemeService } from '../../services/theme.service';

type Platform = 'Windows' | 'macOS' | 'Linux' | 'Android' | 'iOS';

interface DownloadTarget {
  platform: Platform;
  label: string;
  url: string;
  icon: string;
}

const GITHUB_RELEASES_URL = 'https://github.com/block-core/angor/releases';
const ZAPSTORE_URL = 'https://zapstore.dev';

const PLATFORM_ICONS: Record<Platform, string> = {
  Windows: 'fa-brands fa-windows',
  macOS: 'fa-brands fa-apple',
  Linux: 'fa-brands fa-linux',
  Android: 'fa-brands fa-android',
  iOS: 'fa-brands fa-apple',
};

@Component({
  selector: 'app-download',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './download.component.html',
  styles: [`
    /* Fill the space main leaves between the fixed header and the footer,
       mirroring the home/launch pages. */
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
    }

    .download-section {
      position: relative;
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      overflow-y: auto;
      padding: 2rem;
      /* transparent so the app-shell pattern overlay shows through */
    }

    /* Vertically centers while staying scrollable when the viewport is
       short (auto margins collapse to 0 on overflow instead of clipping). */
    .download-content {
      margin-top: auto;
      margin-bottom: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      width: 100%;
      max-width: 600px;
    }

    .download-logo {
      width: 96px;
      height: 96px;
      margin: 0 auto 2rem;
      filter: none !important;
      image-rendering: auto;
    }

    .download-headline {
      font-size: 42px;
      text-align: center;
      margin-bottom: 2rem;
      color: var(--text);
    }

    /* Staggered intro — fade + rise (same approach as the home hero) */
    .dl-anim {
      animation: dlIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .dl-anim-1 { animation-delay: 0.05s; }
    .dl-anim-2 { animation-delay: 0.2s; }
    .dl-anim-3 { animation-delay: 0.35s; }
    .dl-anim-4 { animation-delay: 0.5s; }
    .dl-anim-5 { animation-delay: 0.65s; }

    @keyframes dlIn {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .dl-anim { animation: none; opacity: 1; }
    }

    /* ===== Security advisory ===== */
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
      margin-bottom: 2.5rem;
    }

    .security-icon {
      font-size: 1.25rem;
    }

    /* ===== CTA stack — primary platform download + persistent GitHub ===== */
    .cta-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      width: 100%;
      margin-bottom: 2.5rem;
    }

    .cta-stack .btn-base {
      width: 100%;
      max-width: 320px;
    }

    .cta-icon {
      font-size: 1.125rem;
      line-height: 1;
    }

    /* iOS — no native build; friendly notice instead of a dead button */
    .ios-notice {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.5rem;
      border-radius: 0.75rem;
      background-color: var(--surface-card);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      font-size: 0.875rem;
      font-weight: 500;
      max-width: 320px;
    }

    .ios-notice .material-icons {
      font-size: 1.25rem;
      color: var(--accent);
      flex-shrink: 0;
    }

    /* ===== Other platforms ===== */
    .alt-platforms {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .alt-label {
      color: var(--text-secondary);
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .alt-links {
      display: flex;
      gap: 1.5rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    .alt-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text);
      font-size: 0.875rem;
      font-weight: 500;
      text-decoration: none;
      transition: color 0.2s;
    }

    .alt-link i {
      font-size: 1rem;
      color: var(--text-secondary);
      transition: color 0.2s;
    }

    .alt-link:hover,
    .alt-link:hover i {
      color: var(--accent);
    }

    @media (max-width: 768px) {
      .download-section {
        padding: 1rem;
      }
      .download-logo {
        width: 72px;
        height: 72px;
        margin-bottom: 1.5rem;
      }
      .download-headline {
        font-size: 28px;
        margin-bottom: 1.5rem;
      }
      .security-badge {
        margin-bottom: 2rem;
      }
      .cta-stack {
        margin-bottom: 2rem;
      }
      .cta-stack .btn-base {
        max-width: 100%;
      }
    }
  `]
})
export class DownloadComponent implements OnInit {
  private titleService = inject(TitleService);
  private metaService = inject(MetaService);
  private platformId = inject(PLATFORM_ID);
  protected themeService = inject(ThemeService);

  protected readonly githubReleasesUrl = GITHUB_RELEASES_URL;

  detectedPlatform = signal<Platform>('Windows');

  /* Android installs come from Zapstore; desktop builds from GitHub
     releases. iOS has no build — the template shows a notice instead. */
  primaryTarget = computed<DownloadTarget | null>(() => {
    const platform = this.detectedPlatform();
    if (platform === 'iOS') return null;
    if (platform === 'Android') {
      return {
        platform,
        label: 'Get it on Zapstore',
        url: ZAPSTORE_URL,
        icon: 'fa-solid fa-bolt',
      };
    }
    return {
      platform,
      label: `Download for ${platform}`,
      url: GITHUB_RELEASES_URL,
      icon: PLATFORM_ICONS[platform],
    };
  });

  /* Every other installable platform (no iOS build to offer). */
  alternativePlatforms = computed<DownloadTarget[]>(() => {
    const detected = this.detectedPlatform();
    const all: Platform[] = ['Windows', 'macOS', 'Linux', 'Android'];
    return all
      .filter(p => p !== detected)
      .map(platform => ({
        platform,
        label: platform,
        url: platform === 'Android' ? ZAPSTORE_URL : GITHUB_RELEASES_URL,
        icon: PLATFORM_ICONS[platform],
      }));
  });

  ngOnInit(): void {
    this.titleService.setTitle('Download Angor');
    this.metaService.updateMetaTags({
      title: 'Download Angor',
      description: 'Download the Angor app for the best security. Available for Windows, macOS, Linux, and Android.',
      image: 'https://angor.io/assets/angor-hub-social.png',
      url: 'https://angor.io/app'
    });

    if (isPlatformBrowser(this.platformId)) {
      this.detectedPlatform.set(this.detectPlatform());
    }
  }

  private detectPlatform(): Platform {
    const ua = navigator.userAgent.toLowerCase();
    /* iPadOS 13+ masquerades as macOS but is touch-capable */
    const isIPadOS = /mac/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;

    if (/android/.test(ua)) return 'Android';
    if (/ipad|iphone|ipod/.test(ua) || isIPadOS) return 'iOS';
    if (/win/.test(ua)) return 'Windows';
    if (/mac/.test(ua)) return 'macOS';
    if (/linux|x11/.test(ua)) return 'Linux';
    return 'Windows';
  }
}
