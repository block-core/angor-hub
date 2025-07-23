import { Component, input, output } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-indexer-error',
  standalone: true,
  template: `
    @if (visible()) {
      <!-- Overlay with backdrop blur -->
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
        <!-- Modal Container -->
        <div class="relative w-full max-w-md bg-surface-card border border-border rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 zoom-in-95 duration-300">
          
          <!-- Header with Icon -->
          <div class="flex flex-col items-center text-center p-6 pb-4">
            <!-- Error Icon -->
            <div class="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
              <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>

            <!-- Title -->
            <h3 class="text-xl font-bold text-text mb-2">
              Indexer Connection Problem
            </h3>

            <!-- Description -->
            <p class="text-text-secondary text-sm leading-relaxed mb-4">
              The indexer you are using has encountered an issue and is unable to retrieve data.
            </p>
            <p class="text-text-secondary text-xs leading-relaxed">
              You can test the indexer or switch to another one in Settings / Indexers section.
            </p>
          </div>

          <!-- Technical Details -->
          @if (errorDetails()) {
            <div class="px-6 pb-4">
              <details class="group">
                <summary class="flex items-center gap-2 text-xs text-text-secondary cursor-pointer hover:text-accent transition-colors duration-200 select-none">
                  <svg class="w-4 h-4 transition-transform duration-200 group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                  Technical Details
                </summary>
                <div class="mt-2 p-3 bg-surface-ground border border-border rounded-lg">
                  <code class="text-xs text-red-400 font-mono break-all">{{ errorDetails() }}</code>
                </div>
              </details>
            </div>
          }

          <!-- Action Buttons -->
          <div class="flex flex-col gap-3 p-6 pt-2">
            <!-- Primary Action: Go to Settings -->
            <button 
              type="button"
              class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-accent hover:bg-accent-light text-white font-medium rounded-xl transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-surface-card"
              (click)="goToSettings()"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Go to Settings
            </button>

            <!-- Secondary Actions -->
            <div class="flex gap-3">
              <!-- Retry Button -->
              <button 
                type="button"
                class="flex items-center justify-center gap-2 flex-1 px-4 py-3 bg-surface-ground hover:bg-surface-hover text-text font-medium border border-border rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-2 focus:ring-offset-surface-card"
                (click)="retry()"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </button>

              <!-- Close Button -->
              <button 
                type="button"
                class="flex items-center justify-center gap-2 flex-1 px-4 py-3 bg-surface-ground hover:bg-surface-hover text-text font-medium border border-border rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-2 focus:ring-offset-surface-card"
                (click)="dismiss()"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close
              </button>
            </div>
          </div>

          <!-- Close X Button -->
          <button 
            type="button"
            class="absolute top-4 right-4 flex items-center justify-center w-8 h-8 text-text-secondary hover:text-text hover:bg-surface-hover rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30"
            (click)="dismiss()"
            aria-label="Close"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    }
  `
})
export class IndexerErrorComponent {
  visible = input<boolean>(false);
  errorDetails = input<string | null>(null);
  
  onRetry = output<void>();
  onDismiss = output<void>();

  constructor(private router: Router) {}

  goToSettings(): void {
    this.router.navigate(['/settings']);
    this.dismiss();
  }

  retry(): void {
    this.onRetry.emit();
  }

  dismiss(): void {
    this.onDismiss.emit();
  }
}
