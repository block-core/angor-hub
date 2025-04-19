import { Component, OnInit, inject, signal, Inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet, Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { HeaderComponent } from './components/header.component';
import { FooterComponent } from './components/footer.component';
import { CommonModule } from '@angular/common';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, CommonModule],
  template: `
    @if (loading()) {
      <div class="loading-overlay">
        <div class="spinner"></div>
      </div>
    }
    <app-header></app-header>
    <main>
      <router-outlet></router-outlet>
    </main>
    <app-footer></app-footer>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .app-wrapper {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    }

    main {
      flex-grow: 1; 
    }

    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--background);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    }
  `],
})
export class AppComponent implements OnInit {
  private router = inject(Router);

  loading = signal(false);

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.loading.set(true);
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        setTimeout(() => this.loading.set(false), 100); 
      }
    });

    if (isPlatformBrowser(this.platformId)) {
      try {
        const savedTheme = localStorage.getItem('angor-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme ? savedTheme : (prefersDark ? 'dark' : 'light');
        this.document.documentElement.setAttribute('data-theme', theme);
      } catch (e) {
        console.error('Failed to apply initial theme in AppComponent:', e);
        this.document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  }

  ngOnInit(): void {}
}
