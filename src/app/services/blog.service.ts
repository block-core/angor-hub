import { Injectable } from '@angular/core';

export interface BlogPost {
  title: string;
  link: string;
  pubDate: Date;
  description: string;
  thumbnail?: string;
  image?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  private rssUrl = 'https://blog.angor.io/rss';
  private proxyUrl = 'https://api.allorigins.win/raw?url=';

  async getLatestPosts(): Promise<BlogPost[]> {
    const response = await fetch(`${this.proxyUrl}${encodeURIComponent(this.rssUrl)}`);
    const xml = await response.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const items = doc.querySelectorAll('item');
    
    return Array.from(items).slice(0, 4).map(item => {
      const description = item.querySelector('description')?.textContent || '';
      
      return {
        title: item.querySelector('title')?.textContent || '',
        link: item.querySelector('link')?.textContent || '',
        pubDate: new Date(item.querySelector('pubDate')?.textContent || ''),
        description: description.replace(/<[^>]*>/g, '').slice(0, 150) + '...',
        image: item.querySelector('image')?.textContent || ''
      };
    });
  }
}
