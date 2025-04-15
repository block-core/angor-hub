import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import { BlogService, BlogPost } from '../../services/blog.service';
import { DatePipe } from '@angular/common';
import { TitleService } from '../../services/title.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, BreadcrumbComponent, DatePipe],
  template: `

    <section class="hero">
    <app-breadcrumb [items]="[{ label: 'Home', url: '' }]"></app-breadcrumb>

      <div class="hero-wrapper">
        <div class="hero-content">
          <h1>Welcome to <span>Angor Hub</span></h1>
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
          <path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" stroke-linejoin="round" stroke-width="0.2" d="M3.5 12C3.5 7.30558 7.30558 3.5 12 3.5C16.6944 3.5 20.5 7.30558 20.5 12C20.5 16.6944 16.6944 20.5 12 20.5C7.30558 20.5 3.5 16.6944 3.5 12ZM12 1.5C6.20101 1.5 1.5 6.20101 1.5 12C1.5 17.799 6.20101 22.5 12 22.5C17.799 22.5 22.5 17.799 22.5 12C22.5 6.20101 17.799 1.5 12 1.5ZM11 6C11 5.44772 10.5523 5 10 5C9.44772 5 9 5.44772 9 6V7H8C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9V12V15C7.44772 15 7 15.4477 7 16C7 16.5523 7.44772 17 8 17H9V18C9 18.5523 9.44772 19 10 19C10.5523 19 11 18.5523 11 18V17H12V18C12 18.5523 12.4477 19 13 19C13.5523 19 14 18.5523 14 18V17H14.5C16.1569 17 17.5 15.6569 17.5 14C17.5 13.09 17.0949 12.2747 16.4551 11.7245C16.7984 11.2367 17 10.6419 17 10C17 8.34315 15.6569 7 14 7V6C14 5.44772 13.5523 5 13 5C12.4477 5 12 5.44772 12 6V7H11V6ZM13 15H10V13H12H14H14.5C15.0523 13 15.5 13.4477 15.5 14C15.5 14.5523 15.0523 15 14.5 15H13ZM13 9H10V11H12H14C14.5523 11 15 10.5523 15 10C15 9.44772 14.5523 9 14 9H13Z" />
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
  public title = inject(TitleService);
  blogPosts: BlogPost[] = [];

  async ngOnInit() {
    this.title.setTitle('');
    this.blogPosts = await this.blogService.getLatestPosts();
  }
}
