import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import { BlogService, BlogPost } from '../../services/blog.service';
import { CommonModule, DatePipe } from '@angular/common';
import { TitleService } from '../../services/title.service';
import { NetworkService } from '../../services/network.service';
import { BitcoinInfoService } from '../../services/bitcoin-info.service';

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

          <!-- Optional: Simplified Price Badge - Removed as it might be redundant with stats bar -->
          <!--
          <div class="bitcoin-price-badge">
            <span class="material-icons">currency_bitcoin</span>
            <div class="price-content">
              <span class="price-value">{{ '$' + bitcoinInfo.bitcoinPrice() }}</span>
              <span class="price-change" [class.change-positive]="bitcoinInfo.priceChangePercent()[0] !== '-'"
                   [class.change-negative]="bitcoinInfo.priceChangePercent()[0] === '-'">
                <span class="material-icons">
                  {{ bitcoinInfo.priceChangePercent()[0] !== '-' ? 'arrow_upward' : 'arrow_downward' }}
                </span>
                {{ bitcoinInfo.priceChangePercent() }}%
              </span>
            </div>
          </div>
          -->

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
            <div class="stat-item icon-stat-item">
              <span class="material-icons bitcoin-icon">currency_bitcoin</span>
            </div>
            <div class="stat-divider icon-price-divider"></div>
            <div class="stat-item price-stat-item">
              @if (bitcoinInfo.bitcoinPrice() !== '0.00') {
                <div class="stat-value" [class]="{
                  'price-up': bitcoinInfo.priceDirection() === 'up',
                  'price-down': bitcoinInfo.priceDirection() === 'down'
                }">
                  <span>{{ '$' + bitcoinInfo.bitcoinPrice() }}</span>
                </div>
              } @else {
                <div class="stat-value loading"><div class="shimmer"></div></div>
              }
              <div class="stat-label">
                Price (USD)
                @if (bitcoinInfo.priceChangePercent() !== '0.00') {
                  @let change = bitcoinInfo.priceChangePercent();
                  <span [class]="{
                    'change-positive': change[0] !== '-', 
                    'change-negative': change[0] === '-'
                  }">
                    ({{ change[0] !== '-' ? '+' : '' }}{{ change }}% 24h)
                  </span>
                }
              </div>
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

    <!-- Redesigned How It Works Section - Horizontal Layout -->
    <section class="how-it-works-v3">
      <div class="container">
        <h2 class="section-title">How Angor Works</h2>
        <p class="section-subtitle">A streamlined, secure process for decentralized fundraising on Bitcoin.</p>

        <div class="steps-grid">
          <!-- Step 1 -->
          <div class="step-card-v3">
            <div class="step-header">
              <div class="step-icon-v3">
                <span class="material-icons">rocket_launch</span>
              </div>
              <span class="step-number-v3">1</span>
            </div>
            <div class="step-content-v3">
              <h3>Project Creation</h3>
              <p>Founders define their vision, funding targets, and clear milestones directly on the platform.</p>
            </div>
          </div>

          <!-- Step 2 -->
          <div class="step-card-v3">
             <div class="step-header">
               <div class="step-icon-v3">
                 <span class="material-icons">payments</span>
               </div>
               <span class="step-number-v3">2</span>
             </div>
            <div class="step-content-v3">
              <h3>Investor Contribution</h3>
              <p>Supporters securely contribute Bitcoin, knowing funds are managed transparently by smart contracts.</p>
            </div>
          </div>

          <!-- Step 3 -->
          <div class="step-card-v3">
             <div class="step-header">
               <div class="step-icon-v3">
                 <span class="material-icons">verified</span>
               </div>
               <span class="step-number-v3">3</span>
             </div>
            <div class="step-content-v3">
              <h3>Milestone-Based Release</h3>
              <p>Funds unlock automatically as projects achieve predefined milestones, ensuring accountability.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
    <!-- End Redesigned How It Works Section -->

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
            @let firstPost = blogPosts()[0];
            <a [href]="firstPost.link" class="blog-post featured no-underline" target="_blank">
              <div class="post-image" [style.background-image]="'url(' + (firstPost.image || '/assets/images/default-blog.jpg') + ')'">
                <div class="post-badge">Featured</div>
              </div>
              <div class="post-content">
                <h3>{{firstPost.title}}</h3>
                <p class="post-date">{{firstPost.pubDate | date:'mediumDate'}}</p>
                <p class="post-excerpt">{{firstPost.description}}</p>
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
          <div class="loading-placeholder">
             <!-- Add shimmer or spinner styles if needed -->
             <p>Loading blog posts...</p>
          </div>
        }
      </div>
    </section>

    <!-- Redesigned CTA Section V2 -->
    <section class="cta-section-v2">
      <div class="cta-background-graphic"></div>
      <div class="container cta-container">
        <div class="cta-text">
          <h2>Ready to Shape the Future of Bitcoin?</h2>
          <p>Whether you're looking to invest in the next big Bitcoin project or launch your own groundbreaking idea, Angor Hub is your platform.</p>
        </div>
        <div class="cta-actions-v2">
          <a routerLink="/explore" class="cta-button-v2 primary">
            <span class="material-icons">search</span>
            Explore Projects
          </a>
          <a href="https://angor.io/launch" target="_blank" class="cta-button-v2 secondary">
             <span class="material-icons">rocket_launch</span>
            Launch Your Project
          </a>
        </div>
      </div>
    </section>
    <!-- End Redesigned CTA Section V2 -->
  `,
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private blogService = inject(BlogService);
  public title = inject(TitleService);
  public networkService = inject(NetworkService);
  public bitcoinInfo = inject(BitcoinInfoService);

  blogPosts = signal<BlogPost[]>([]);

  constructor() {
    // No effect needed here as template bindings handle updates
  }

  async ngOnInit(): Promise<void> {
    this.title.setTitle(''); // Set page title for home

    try {
      // Fetch blog posts asynchronously
      const posts = await this.blogService.getLatestPosts();
      this.blogPosts.set(posts);
    } catch (error) {
      console.error('Failed to fetch blog posts:', error);
      this.blogPosts.set([]); // Set to empty array on error
    }

    // Bitcoin info fetching is handled within the BitcoinInfoService
  }
}
