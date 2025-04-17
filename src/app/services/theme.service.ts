import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private themeSubject = new BehaviorSubject<string>(this.getInitialTheme());
  theme$ = this.themeSubject.asObservable();
  private mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    // Listen for changes to system theme preference
    this.mediaQuery.addEventListener('change', (e) => {
      if (this.themeSubject.value === 'system') {
        this.applyTheme('system');
      }
    });
  }

  private getInitialTheme(): string {
    const savedTheme = localStorage.getItem('angor-theme');
    
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
      this.applyTheme(savedTheme);
      return savedTheme;
    } else {
      // Default to system
      this.applyTheme('system');
      return 'system';
    }
  }

  setTheme(theme: string): void {
    localStorage.setItem('angor-theme', theme);
    this.themeSubject.next(theme);
    this.applyTheme(theme);
  }

  private applyTheme(theme: string): void {
    let actualTheme: string;
    
    if (theme === 'system') {
      // Use system preference
      actualTheme = this.mediaQuery.matches ? 'dark' : 'light';
    } else {
      actualTheme = theme;
    }
    
    // Apply theme
    document.documentElement.setAttribute('data-theme', actualTheme);
  }
}
