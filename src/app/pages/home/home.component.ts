import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TitleService } from '../../services/title.service';
import { MetaService } from '../../services/meta.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styles: [`
    /* Fill the space main leaves between the fixed header and the footer,
       so the whole landing (incl. footer) fits the viewport without scroll. */
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
    }

    /* Hero layout — ported from prototype Landing.vue */
    .hero-section {
      position: relative;
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 2rem;
      /* transparent so the app-shell pattern overlay shows through */
    }

    .hero-logo {
      width: 96px;
      height: 96px;
      margin: 0 auto 2rem;
      filter: none !important;
      image-rendering: auto;
    }

    /* Staggered intro — fade + rise, replays whenever the page is entered */
    .hero-anim {
      /* Resting state is visible; the entrance fade is driven entirely by the
         keyframes with fill-mode "both" (backwards fill hides it during the
         delay). This avoids the element getting stuck at opacity:0 when the
         animation doesn't run on route re-entry (e.g. navigating back home). */
      animation: heroIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .hero-anim-1 { animation-delay: 0.05s; }
    .hero-anim-2 { animation-delay: 0.2s; }
    .hero-anim-3 { animation-delay: 0.35s; }

    @keyframes heroIn {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .hero-anim { animation: none; opacity: 1; }
    }

    .hero-headline {
      font-size: 56px;
      text-align: center;
      margin-bottom: 3rem;
      color: var(--text);
    }

    .hero-cta {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      width: 100%;
    }

    @media (min-width: 640px) {
      .hero-cta {
        flex-direction: row;
        width: auto;
      }
      .hero-cta .btn-base {
        min-width: 200px;
      }
    }

    @media (max-width: 768px) {
      .hero-section {
        padding: 1rem;
      }
      .hero-logo {
        width: 72px;
        height: 72px;
        margin-bottom: 1.5rem;
      }
      .hero-headline {
        font-size: 28px;
        margin-bottom: 2rem;
      }
      .hero-cta .btn-base {
        width: 100%;
        max-width: 100%;
      }
    }
  `]
})
export class HomeComponent implements OnInit {
  private titleService = inject(TitleService);
  private metaService = inject(MetaService);
  protected themeService = inject(ThemeService);

  async ngOnInit() {
    this.titleService.setTitle('Angor - Decentralized Bitcoin Fundraising');
    this.metaService.updateMetaTags({
      title: 'Angor - The Only Bitcoin Protocol For Funding Projects',
      description: 'Decentralized crowdfunding on Bitcoin.',
      image: 'https://angor.io/assets/angor-hub-social.png',
      url: 'https://angor.io'
    });
  }
}
