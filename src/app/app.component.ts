import { Component, inject, PLATFORM_ID, Inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header.component';
import { CommonModule } from '@angular/common';
import { FooterComponent } from './components/footer.component';
import { DOCUMENT, isPlatformBrowser } from '@angular/common'; // Import DOCUMENT and isPlatformBrowser

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, CommonModule, FooterComponent],
  template: `
     <a href="#main-content" class="skip-to-content">Skip to content</a>
     <div id="app-loading">
      <div class="spinner"></div>
      <p>Loading Angor Hub...</p>
    </div>
    <div class="app-wrapper">
      <app-header></app-header>
      <main id="main-content">
        <router-outlet></router-outlet>
      </main>
      <app-footer></app-footer>
    </div>
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
  `],
})
export class AppComponent {
  title = 'Angor Hub';

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Apply initial theme - Note: This runs after initial render, potential FOUC
    if (isPlatformBrowser(this.platformId)) {
      try {
        const savedTheme = localStorage.getItem('angor-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme ? savedTheme : (prefersDark ? 'dark' : 'light');
        this.document.documentElement.setAttribute('data-theme', theme);
      } catch (e) {
        console.error('Failed to apply initial theme in AppComponent:', e);
        // Fallback to light theme if error occurs
        this.document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  }
}
