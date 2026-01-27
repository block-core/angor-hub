import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../environment';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="bg-surface-ground text-header-text text-center py-6 px-4 mt-auto shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      <div class="container mx-auto">
        <div class="text-xs opacity-70">
          <div class="flex justify-center items-center gap-1">
            <span class="material-icons text-xs">info</span>
            Angor v{{ version }}
          </div>
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  version = environment.appVersion;
}
