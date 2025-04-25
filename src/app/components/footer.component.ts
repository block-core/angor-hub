import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../environment';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="bg-header-bg text-header-text text-center py-6 px-4 mt-auto shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      <div class="container mx-auto">
        <div class="flex justify-center items-center gap-3 mb-4 text-sm">
           <a href="https://angor.io/terms" target="_blank" rel="noopener noreferrer" class="opacity-80 hover:opacity-100 hover:text-accent transition-all">Terms of Service</a>
           <span class="opacity-50">|</span>
           <a href="https://angor.io/privacy" target="_blank" rel="noopener noreferrer" class="opacity-80 hover:opacity-100 hover:text-accent transition-all">Privacy Policy</a>
        </div>
        <div class="pt-4 border-t border-border text-xs opacity-70">
          &copy; {{ currentYear }} Angor. All rights reserved.
          <div class="mt-1 opacity-70">Angor Hub v{{ version }}</div>
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  version = environment.appVersion;
}
