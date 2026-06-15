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
    /* Hero layout — ported from prototype Landing.vue */
    .hero-section {
      position: relative;
      min-height: calc(100vh - 64px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 4rem 2rem;
      /* transparent so the app-shell pattern overlay shows through */
    }

    .hero-logo {
      width: 96px;
      height: 96px;
      margin: 0 auto 2rem;
      filter: none !important;
      image-rendering: auto;
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
