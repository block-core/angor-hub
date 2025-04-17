import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import { BlogService, BlogPost } from '../../services/blog.service';
import { CommonModule, DatePipe } from '@angular/common';
import { TitleService } from '../../services/title.service';
import { NetworkService } from '../../services/network.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, BreadcrumbComponent, CommonModule, DatePipe],
  template: `
    <section class="hero home-hero">
      <app-breadcrumb [items]="[{ label: 'Home', url: '' }]"></app-breadcrumb>

      <div class="hero-wrapper">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="material-icons">insights</span>
            <span>{{ networkService.isMain() ? 'Bitcoin Mainnet' : 'Bitcoin Testnet' }}</span>
          </div>
          
          <h1>Welcome to Angor Hub</h1>
          <p class="hero-description">
            Your central place for discovering and investing in Bitcoin projects.
            Join a community of innovators and investors shaping the future of finance.
          </p>
          
          <div class="hero-actions">
            <a routerLink="/explore" class="cta-button">
              Explore Projects
              <span class="material-icons">arrow_forward</span>
            </a>
            <a href="https://angor.io/launch" target="_blank" class="secondary-button">
              Launch Your Project
              <span class="material-icons">rocket_launch</span>
            </a>
          </div>
          
          <div class="stats-bar">
            <div class="stat-item">
              <div class="stat-value">{{ projectCount() }}</div>
              <div class="stat-label">Total Projects</div>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <div class="stat-value">{{ investorCount() }}</div>
              <div class="stat-label">Active Investors</div>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <div class="stat-value">{{ funding() }}</div>
              <div class="stat-label">{{ networkService.isMain() ? 'BTC' : 'tBTC' }} Funded</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="hero-graphic">
        <div class="graphic-circle circle-1"></div>
        <div class="graphic-circle circle-2"></div>
        <div class="graphic-circle circle-3"></div>
      </div>
    </section>

    <div class="how-it-works">
      <div class="container">
        <h2 class="section-title">How Angor Works</h2>
        <p class="section-subtitle">Angor is a decentralized fundraising platform built on Bitcoin</p>
        
        <div class="steps">
          <div class="step-card">
            <div class="step-number">1</div>
            <div class="step-icon">
              <span class="material-icons">rocket_launch</span>
            </div>
            <h3>Project Creation</h3>
            <p>Project creators define funding goals, milestone stages, and deadlines for their Bitcoin venture</p>
          </div>
          
          <div class="step-connector">
            <div class="connector-line"></div>
            <span class="material-icons">arrow_forward</span>
          </div>
          
          <div class="step-card">
            <div class="step-number">2</div>
            <div class="step-icon">
              <span class="material-icons">payments</span>
            </div>
            <h3>Investor Contribution</h3>
            <p>Investors contribute Bitcoin to projects they believe in through the secure platform</p>
          </div>
          
          <div class="step-connector">
            <div class="connector-line"></div>
            <span class="material-icons">arrow_forward</span>
          </div>
          
          <div class="step-card">
            <div class="step-number">3</div>
            <div class="step-icon">
              <span class="material-icons">verified</span>
            </div>
            <h3>Milestone Release</h3>
            <p>Funds are released to project creators as predefined milestones are achieved</p>
          </div>
        </div>
      </div>
    </div>

    <div class="features-section">
      <div class="container">
        <h2 class="section-title">Platform Benefits</h2>
        
        <div class="features">
          <div class="feature-card">
            <div class="feature-icon">
              <span class="material-icons">shield</span>
            </div>
            <h3>Secure Investment</h3>
            <p>Your Bitcoin is secured by the blockchain. No third parties hold your funds.</p>
          </div>
          
          <div class="feature-card">
            <div class="feature-icon">
              <span class="material-icons">account_balance</span>
            </div>
            <h3>Milestone-Based Funding</h3>
            <p>Projects receive funds only when they reach predetermined milestones.</p>
          </div>
          
          <div class="feature-card">
            <div class="feature-icon">
              <span class="material-icons">public</span>
            </div>
            <h3>Decentralized</h3>
            <p>Fully non-custodial platform with no central authority controlling funds.</p>
          </div>
          
          <div class="feature-card">
            <div class="feature-icon">
              <span class="material-icons">groups</span>
            </div>
            <h3>Community Driven</h3>
            <p>Join a growing community of Bitcoin innovators and supporters.</p>
          </div>
        </div>
      </div>
    </div>

    <section class="blog-section">
      <div class="container">
        <h2 class="section-title">Latest from the Blog</h2>

        @if (blogPosts().length > 0) {
          <div class="blog-grid">
            <a [href]="blogPosts()[0].link" class="blog-post featured no-underline" target="_blank">
              <div class="post-image" [style.background-image]="'url(' + (blogPosts()[0].image || '/assets/images/default-blog.jpg') + ')'">
                <div class="post-badge">Featured</div>
              </div>
              <div class="post-content">
                <h3>{{blogPosts()[0].title}}</h3>
                <p class="post-date">{{blogPosts()[0].pubDate | date:'mediumDate'}}</p>
                <p class="post-excerpt">{{blogPosts()[0].description}}</p>
              </div>
            </a>

            <div class="blog-posts-secondary">
              @for (post of blogPosts().slice(1, 4); track post.link) {
                <a [href]="post.link" class="blog-post no-underline" target="_blank">
                  <div class="post-image" [style.background-image]="'url(' + (post.image || '/assets/images/default-blog.jpg') + ')'">
                  </div>
                  <div class="post-content">
                    <h4>{{post.title}}</h4>
                    <p class="post-date">{{post.pubDate | date:'mediumDate'}}</p>
                  </div>
                </a>
              }
            </div>
          </div>
          <div class="blog-cta">
            <a href="https://blog.angor.io" target="_blank" class="blog-button no-underline">
              Explore the Blog
              <span class="material-icons">arrow_forward</span>
            </a>
          </div>
        } @else {
          <div class="loading-spinner">
            <div class="spinner"></div>
          </div>
        }
      </div>
    </section>
    
    <section class="cta-section">
      <div class="container">
        <div class="cta-wrapper">
          <div class="cta-content">
            <h2>Ready to Get Started?</h2>
            <p>Explore innovative Bitcoin projects or launch your own venture on Angor.</p>
          </div>
          <div class="cta-buttons">
            <a routerLink="/explore" class="cta-button">
              Browse Projects
              <span class="material-icons">search</span>
            </a>
            <a href="https://angor.io/docs" target="_blank" class="secondary-button">
              Read Documentation
              <span class="material-icons">menu_book</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private blogService = inject(BlogService);
  public title = inject(TitleService);
  public networkService = inject(NetworkService);
  
  blogPosts = signal<BlogPost[]>([]);
  projectCount = signal<string>('0');
  investorCount = signal<string>('0');
  funding = signal<string>('0');

  async ngOnInit() {
    this.title.setTitle('');
    
    try {
      const posts = await this.blogService.getLatestPosts();
      this.blogPosts.set(posts);
    } catch (error) {
      console.error('Failed to fetch blog posts:', error);
      this.blogPosts.set([]);
    }
    
    // Animate counters
    this.animateCounter(0, 145, (val) => this.projectCount.set(val.toString()), 2000);
    this.animateCounter(0, 623, (val) => this.investorCount.set(val.toString()), 2000);
    this.animateCounter(0, 18.45, (val) => this.funding.set(val.toFixed(2)), 2000);
  }
  
  private animateCounter(from: number, to: number, callback: (val: number) => void, duration: number): void {
    const steps = 60;
    const stepDuration = duration / steps;
    const increment = (to - from) / steps;
    let current = from;
    let step = 0;
    
    const timer = setInterval(() => {
      step++;
      current += increment;
      if (step >= steps) {
        clearInterval(timer);
        current = to;
      }
      callback(current);
    }, stepDuration);
  }
}
