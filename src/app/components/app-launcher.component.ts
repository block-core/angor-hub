import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-launcher',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="relative">
      <a routerLink="/" class="cursor-pointer group bg-transparent border-0 p-0 flex items-center gap-2 no-underline" title="Angor Home">
        <img src="/images/app-icon-dark-mode.png" alt="Angor" class="h-8 w-auto transition-all duration-300 group-hover:scale-105 group-hover:brightness-125">
        <span class="text-header-text font-semibold text-lg transition-all duration-300 group-hover:text-accent">Angor</span>
      </a>
    </div>
  `,
})
export class AppLauncherComponent {
}
