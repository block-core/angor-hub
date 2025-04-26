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
  imports: [RouterLink, CommonModule, DatePipe],
  templateUrl: './home.component.html', 
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
