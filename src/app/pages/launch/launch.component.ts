import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TitleService } from '../../services/title.service';
import { MetaService } from '../../services/meta.service';
import { ThemeService } from '../../services/theme.service';

interface FundedProject {
  name: string;
  image: string;
  amount: string;
  sizeClass: string;
  variantClass: string;
}

@Component({
  selector: 'app-launch',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './launch.component.html',
  styles: [`
    /* Fill the space main leaves between the fixed header and the footer,
       mirroring the home/download pages. */
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
    }

    /* Page layout — ported from prototype Launch.vue */
    .launch-section {
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
    .launch-content {
      margin-top: auto;
      margin-bottom: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
    }

    .launch-logo {
      width: 96px;
      height: 96px;
      margin: 0 auto 2rem;
      filter: none !important;
      image-rendering: auto;
    }

    .launch-headline {
      font-size: 42px;
      text-align: center;
      margin-bottom: 3rem;
      color: var(--text);
    }

    /* Staggered intro — fade + rise (same approach as the home hero) */
    .launch-anim {
      animation: launchIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .launch-anim-1 { animation-delay: 0.05s; }
    .launch-anim-2 { animation-delay: 0.2s; }
    .launch-anim-3 { animation-delay: 1.1s; }
    .launch-anim-4 { animation-delay: 1.25s; }

    @keyframes launchIn {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: none; }
    }

    @keyframes tileIn {
      from { opacity: 0; transform: translateY(15px) scale(0.9); }
      to   { opacity: 1; transform: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .launch-anim, .tile-anim, .amount-anim { animation: none; opacity: 1; }
    }

    /* ===== Funded projects showcase ===== */
    .showcase {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 3rem;
    }

    .showcase-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-decoration: none;
      cursor: pointer;
      transition: transform 0.3s ease;
    }

    .showcase-link:hover {
      transform: translateY(-1px);
    }

    /* Glassmorphic app tile — gradient border via padded background */
    .tile {
      position: relative;
      border-radius: 22%;
      padding: 3px;
      background: linear-gradient(to bottom, #4a4a4a, #1a1a1a, #000000);
      box-shadow:
        0 20px 60px -15px rgba(0, 0, 0, 0.8),
        0 0 0 1px rgba(255, 255, 255, 0.1) inset,
        0 8px 32px rgba(255, 255, 255, 0.025),
        0 0 80px rgba(255, 255, 255, 0.0125);
      display: inline-block;
      transition: box-shadow 0.3s ease;
    }

    .showcase-link:hover .tile {
      box-shadow:
        0 6px 24px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
    }

    .tile::before {
      content: '';
      position: absolute;
      inset: 3px;
      border-radius: 20%;
      background: transparent;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: 0 -10px 30px -5px rgba(255, 255, 255, 0.05);
      z-index: 0;
    }

    .tile img {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 8px;
      display: block;
      border-radius: 20%;
      filter: none !important;
    }

    /* Tapered sizes — small outside, large center */
    .tile-smallest { width: 128px; height: 128px; }
    .tile-small    { width: 144px; height: 144px; }
    .tile-large    { width: 160px; height: 160px; }

    /* Per-app brand borders and glows */
    .tile-blindbit {
      background: #000000;
      box-shadow:
        0 20px 60px -15px rgba(0, 0, 0, 0.8),
        0 0 0 1px rgba(255, 255, 255, 0.1) inset,
        0 8px 32px rgba(255, 255, 255, 0.025),
        0 0 60px rgba(255, 255, 255, 0.02);
    }

    .tile-receipt {
      background: linear-gradient(to bottom, #FFD55A, #FCAA40, #FC4E26);
      box-shadow:
        0 20px 60px -15px rgba(252, 78, 38, 0.5),
        0 0 0 1px rgba(255, 213, 90, 0.3) inset,
        0 8px 32px rgba(255, 165, 60, 0.1),
        0 0 60px rgba(252, 78, 38, 0.075);
    }

    .tile-nostria {
      background: linear-gradient(to bottom, #ffffff, #f5f5f5, #e5e5e5);
      box-shadow:
        0 20px 60px -15px rgba(0, 0, 0, 0.3),
        0 0 0 1px rgba(0, 0, 0, 0.1) inset,
        0 8px 32px rgba(255, 255, 255, 0.05),
        0 0 60px rgba(200, 200, 255, 0.0375);
    }

    .tile-yakihonne {
      background: #7E1F7A;
      box-shadow:
        0 20px 60px -15px rgba(126, 31, 122, 0.5),
        0 0 0 1px rgba(126, 31, 122, 0.3) inset,
        0 8px 32px rgba(126, 31, 122, 0.1),
        0 0 60px rgba(126, 31, 122, 0.0875);
    }

    .tile-zapai {
      background: #71318B;
      box-shadow:
        0 20px 60px -15px rgba(113, 49, 139, 0.5),
        0 0 0 1px rgba(113, 49, 139, 0.3) inset,
        0 8px 32px rgba(113, 49, 139, 0.1),
        0 0 60px rgba(113, 49, 139, 0.0875);
    }

    .tile-anim { animation: tileIn 0.6s ease-out both; }

    .amount {
      margin-top: 0.75rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .amount-anim { animation: launchIn 0.6s ease-out both; }

    /* ===== Raised on Angor ===== */
    .raised-text {
      font-size: 20px;
      font-weight: 500;
      letter-spacing: 0.025em;
      text-align: center;
      color: var(--text-secondary);
      margin-bottom: 3rem;
    }

    .raised-amount {
      font-weight: 600;
      color: var(--text);
      margin-right: 0.5rem;
    }

    .raised-highlight {
      color: var(--accent);
      font-style: italic;
      font-weight: 600;
    }

    /* ===== CTA ===== */
    .launch-cta {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      width: 100%;
    }

    @media (min-width: 640px) {
      .launch-cta {
        width: auto;
      }
      .launch-cta .btn-base {
        min-width: 250px;
      }
    }

    @media (max-width: 768px) {
      .launch-section {
        padding: 1rem;
      }
      .launch-logo {
        width: 72px;
        height: 72px;
        margin-bottom: 1.5rem;
      }
      .launch-headline {
        font-size: 28px;
        margin-bottom: 2rem;
      }
      .showcase {
        margin-bottom: 2rem;
      }
      .tile-smallest { width: 48px; height: 48px; }
      .tile-small    { width: 54px; height: 54px; }
      .tile-large    { width: 60px; height: 60px; }
      .tile img { padding: 4px; }
      .amount {
        margin-top: 0.5rem;
        font-size: 0.75rem;
      }
      .raised-text {
        margin-bottom: 2rem;
      }
      .launch-cta .btn-base {
        width: 100%;
        max-width: 100%;
      }
    }
  `]
})
export class LaunchComponent implements OnInit {
  private titleService = inject(TitleService);
  private metaService = inject(MetaService);
  protected themeService = inject(ThemeService);

  /* Funded projects showcase — ported from prototype Launch.vue.
     Icons link to /explore until real /project/:id targets are wired in. */
  protected fundedProjects: FundedProject[] = [
    { name: 'BlindBit', image: '/images/funded/blind-bit.png', amount: '0.011 BTC', sizeClass: 'tile-smallest', variantClass: 'tile-blindbit' },
    { name: 'Receipt Cash', image: '/images/funded/receipt-cash.webp', amount: '0.01 BTC', sizeClass: 'tile-small', variantClass: 'tile-receipt' },
    { name: 'Nostria', image: '/images/funded/nostira.png', amount: '0.32 BTC', sizeClass: 'tile-large', variantClass: 'tile-nostria' },
    { name: 'Yakihonne', image: '/images/funded/yakihonne.png', amount: '0.05 BTC', sizeClass: 'tile-small', variantClass: 'tile-yakihonne' },
    { name: 'Zap AI', image: '/images/funded/zap-ai.png', amount: '0.025 BTC', sizeClass: 'tile-smallest', variantClass: 'tile-zapai' },
  ];

  ngOnInit(): void {
    this.titleService.setTitle('Launch Your Project on Angor');
    this.metaService.updateMetaTags({
      title: 'Launch Your Project on Angor',
      description: 'Raise funds for your project with Bitcoin. Decentralized, non-custodial crowdfunding on Angor.',
      image: 'https://angor.io/assets/angor-hub-social.png',
      url: 'https://angor.io/launch'
    });
  }
}
