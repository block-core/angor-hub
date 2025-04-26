import { Component, OnInit, inject, signal, effect, WritableSignal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; // Import DatePipe
import { RouterLink } from '@angular/router';
import { NetworkService } from '../../services/network.service';
import { BitcoinInfoService } from '../../services/bitcoin-info.service';
import { BlogService, BlogPost } from '../../services/blog.service';
import { TitleService } from '../../services/title.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe], // Add DatePipe to imports
  templateUrl: './home.component.html',
  providers: [DatePipe] // Provide DatePipe
})
export class HomeComponent implements OnInit {
  networkService = inject(NetworkService);
  bitcoinInfo = inject(BitcoinInfoService);
  blogService = inject(BlogService);
  titleService = inject(TitleService);
 
  datePipe = inject(DatePipe); 

  blogPosts: WritableSignal<BlogPost[]> = signal([]);
  // Remove totalProjects signal if not used
  // totalProjects = signal<number | null>(null);
  currentDate = new Date(); // Add property for current date

  constructor() {
  }

  async ngOnInit() {
    this.titleService.setTitle('Angor Hub - Decentralized Bitcoin Fundraising');
    this.loadBlogPosts();
  }

  async loadBlogPosts() {
    try {
      // Assuming fetchBlogPosts exists, otherwise use getLatestPosts
      const posts = await this.blogService.getLatestPosts(); // Use getLatestPosts if fetchBlogPosts doesn't exist
      this.blogPosts.set(posts);
    } catch (error) {
      console.error('Error loading blog posts:', error);
      this.blogPosts.set([]); // Set to empty array on error
    }
  }
}
