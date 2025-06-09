import { Component, OnInit, inject, signal, effect, WritableSignal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; 
import { RouterLink } from '@angular/router';
import { NetworkService } from '../../services/network.service';
import { BitcoinInfoService } from '../../services/bitcoin-info.service';
import { BlogService, BlogPost } from '../../services/blog.service';
import { TitleService } from '../../services/title.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe], 
  templateUrl: './home.component.html',
  providers: [DatePipe] 
})
export class HomeComponent implements OnInit {
  networkService = inject(NetworkService);
  bitcoinInfo = inject(BitcoinInfoService);
  blogService = inject(BlogService);
  titleService = inject(TitleService);
  themeService = inject(ThemeService);
 
  datePipe = inject(DatePipe); 

  blogPosts: WritableSignal<BlogPost[]> = signal([]);
  
  
  currentDate = new Date(); 

  constructor() {
  }

  async ngOnInit() {
    this.titleService.setTitle('Angor Hub - Decentralized Bitcoin Fundraising');
    this.loadBlogPosts();
  }

  async loadBlogPosts() {
    try {
      
      const posts = await this.blogService.getLatestPosts(); 
      this.blogPosts.set(posts);
    } catch (error) {
      console.error('Error loading blog posts:', error);
      this.blogPosts.set([]); 
    }
  }
}
