import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import { BlogService, BlogPost } from '../../services/blog.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, BreadcrumbComponent, DatePipe],
  template: `

    <section class="hero">
    <app-breadcrumb [items]="[{ label: 'Home', url: '' }]"></app-breadcrumb>

      <div class="hero-wrapper">
        <div class="hero-content">
          <h1>Welcome to Angor Hub</h1>
          <p class="hero-description">
            Your central place for discovering and investing in Bitcoin projects. 
            Join a community of innovators and investors shaping the future of finance.
          </p>
          <a routerLink="/explore" class="cta-button">
            Explore All Projects
            <span class="arrow">→</span>
          </a>
        </div>
      </div>
    </section>

    <div class="features">
      <div class="feature-card">
        <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
        </svg>
        <h2>Discover Projects</h2>
        <p>Find innovative Bitcoin projects that align with your interests and investment goals.</p>
      </div>
      <div class="feature-card">
        <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2>Invest Securely</h2>
        <p>Invest in projects with confidence using our secure and transparent platform.</p>
      </div>
      <div class="feature-card">
        <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h2>Track Progress</h2>
        <p>Monitor your investments and stay updated on project developments.</p>
      </div>
    </div>

    <section class="blog-section">
      <div class="container">
        <h2 class="section-title">Latest from the Blog</h2>
        
        @if (blogPosts.length > 0) {
          <div class="blog-grid">
            <a [href]="blogPosts[0].link" class="blog-post featured" target="_blank">
              <div class="post-image" [style.background-image]="'url(' + (blogPosts[0].image || '/images/default-blog.jpg') + ')'">
              </div>
              <div class="post-content">
                <h3>{{blogPosts[0].title}}</h3>
                <p class="post-date">{{blogPosts[0].pubDate | date:'mediumDate'}}</p>
                <p class="post-excerpt">{{blogPosts[0].description}}</p>
              </div>
            </a>
            
            <div class="blog-posts-secondary">
              @for (post of blogPosts.slice(1); track post.link) {
                <a [href]="post.link" class="blog-post" target="_blank">
                  <div class="post-image" [style.background-image]="'url(' + (post.image || '/images/default-blog.jpg') + ')'">
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
            <a href="https://blog.angor.io" target="_blank" class="blog-button">
              Explore the Blog
              <span class="arrow">→</span>
            </a>
          </div>
        } @else {
          <div class="loading-spinner">
            <div class="spinner"></div>
          </div>
        }
      </div>
    </section>
  `,
  styles: [`


  `]
})
export class HomeComponent implements OnInit {
  private blogService = inject(BlogService);
  blogPosts: BlogPost[] = [];

  async ngOnInit() {
    this.blogPosts = await this.blogService.getLatestPosts();
  }
}
