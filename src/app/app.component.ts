import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, CommonModule],
  template: `
    <!-- Accessibility skip link -->
    <a href="#main-content" class="skip-to-content">Skip to content</a>
    
    <app-header></app-header>
    
    <main id="main-content">
      <router-outlet></router-outlet>
    </main>

    <footer>
      <div class="footer-content">
        <div class="footer-column">
          <h3>About Angor</h3>
          <ul>
            <li><a href="https://angor.io">Overview</a></li>
            <li><a href="https://angor.io/about">Our Mission</a></li>
            <li><a href="https://angor.io/team">Team</a></li>
          </ul>
        </div>
        
        <div class="footer-column">
          <h3>Resources</h3>
          <ul>
            <li><a href="https://docs.angor.io">Documentation</a></li>
            <li><a href="https://blog.angor.io">Blog</a></li>
            <li><a href="https://angor.io/faq">FAQs</a></li>
          </ul>
        </div>
        
        <div class="footer-column">
          <h3>Connect</h3>
          <ul>
            <li><a href="https://twitter.com/AngorBTC" target="_blank">Twitter</a></li>
            <li><a href="https://github.com/block-core/angor" target="_blank">GitHub</a></li>
            <li><a href="https://discord.gg/example" target="_blank">Discord</a></li>
          </ul>
        </div>
        
        <div class="footer-column">
          <h3>Legal</h3>
          <ul>
            <li><a href="https://angor.io/terms">Terms of Service</a></li>
            <li><a href="https://angor.io/privacy">Privacy Policy</a></li>
          </ul>
        </div>
      </div>
      
      <div class="copyright">
        &copy; {{ currentYear }} Angor. All rights reserved.
      </div>
    </footer>
  `,
  styles: []
})
export class AppComponent {
  currentYear = new Date().getFullYear();
}
