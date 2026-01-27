import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class TitleService {
  private readonly baseTitle = 'Angor';
  
  constructor(private title: Title) {}

  /**
   * Set the page title
   * @param newTitle - The title to set (will be appended to base title)
   */
  setTitle(newTitle?: string): void {
    if (newTitle) {
      this.title.setTitle(`${newTitle} - ${this.baseTitle}`);
    } else {
      this.title.setTitle(this.baseTitle);
    }
  }

  /**
   * Get the current page title
   */
  getTitle(): string {
    return this.title.getTitle();
  }
}
