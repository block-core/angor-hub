import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TitleService } from '../../services/title.service';
import { MetaService } from '../../services/meta.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styles: [`
    .hero-section {
      position: relative;
      min-height: calc(100vh - 64px);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background-color: var(--surface-ground);
    }
    
    .hero-background {
      position: absolute;
      inset: 0;
      background-image: url('/assets/images/hero-bg-pattern.svg');
      background-repeat: repeat;
      background-size: 164px 164px;
      opacity: 0.05;
    }
    
    .hero-content {
      position: relative;
      z-index: 10;
      text-align: center;
      padding: 1rem 2rem 2rem;
      max-width: 900px;
    }
    
    .hero-logo {
      width: 120px;
      height: auto;
      margin: 0 auto 2.5rem;
      filter: drop-shadow(0 10px 30px rgba(75, 124, 90, 0.3));
    }
    
    .hero-headline {
      font-size: clamp(2.5rem, 5vw, 4rem);
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 3rem;
      color: var(--text);
    }
    
    .hero-headline .emphasis {
      color: var(--accent);
      font-style: italic;
    }
    
    .hero-cta {
      display: flex;
      gap: 1.5rem;
      justify-content: center;
      flex-wrap: wrap;
    }
    
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 2rem;
      border-radius: 0.75rem;
      font-size: 1.125rem;
      font-weight: 600;
      background-color: var(--surface-card);
      color: var(--text);
      border: 2px solid var(--border);
      transition: all 0.3s ease;
      text-decoration: none;
    }
    
    .btn-secondary:hover {
      background-color: var(--surface-hover);
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    }
    
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 2rem;
      border-radius: 0.75rem;
      font-size: 1.125rem;
      font-weight: 600;
      background-color: var(--accent);
      color: white;
      transition: all 0.3s ease;
      text-decoration: none;
    }
    
    .btn-primary:hover {
      background-color: #3d6448;
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(75, 124, 90, 0.3);
    }
    
    @media (max-width: 768px) {
      .hero-logo {
        width: 90px;
        margin-bottom: 1.5rem;
      }
      
      .hero-headline {
        font-size: 2rem;
        margin-bottom: 2rem;
      }
      
      .hero-cta {
        flex-direction: column;
        gap: 1rem;
      }
      
      .btn-primary, .btn-secondary {
        width: 100%;
        max-width: 300px;
      }
    }
  `]
})
export class HomeComponent implements OnInit {
  private titleService = inject(TitleService);
  private metaService = inject(MetaService);

  async ngOnInit() {
    this.titleService.setTitle('Angor - Decentralized Bitcoin Fundraising');
    this.metaService.updateMetaTags({
      title: 'Angor - The Only Bitcoin Protocol For Funding Projects',
      description: 'Decentralized crowdfunding on Bitcoin.',
      image: 'https://hub.angor.io/assets/angor-hub-social.png',
      url: 'https://hub.angor.io'
    });
  }
}
