import { Component, OnInit, inject, Inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header.component';
import { FooterComponent } from './components/footer.component';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  template: `
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
  `],
})
export class AppComponent implements OnInit {
  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
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
