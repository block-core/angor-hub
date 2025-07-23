import { Component, input, output, inject, signal, effect, computed } from '@angular/core';
import { Router } from '@angular/router';
import { IndexerService, IndexerEntry } from '../services/indexer.service';
import { NetworkService } from '../services/network.service';

@Component({
  selector: 'app-indexer-error',
  standalone: true,
  template: `
    @if (visible()) {
      <!-- Overlay with backdrop blur -->
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
        <!-- Modal Container - Responsive with max height -->
  <div class="relative w-full max-w-md sm:max-w-lg max-h-[90vh] bg-surface-card border custom-modal-border rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 zoom-in-95 duration-300 flex flex-col">
          
          <!-- Fixed Header -->
          <div class="flex-shrink-0 flex flex-col items-center text-center p-6 pb-4 border-b custom-modal-border">
            <!-- Error Icon -->
            <div class="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-3">
              <svg class="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>

            <!-- Title -->
            <h3 class="text-lg sm:text-xl font-bold text-text mb-2">
              Indexer Connection Problem
            </h3>

            <!-- Description -->
            <p class="text-text-secondary text-sm leading-relaxed">
              Select another indexer below or go to Settings to manage indexers.
            </p>
          </div>

          <!-- Scrollable Content -->
          <div class="flex-1 overflow-y-auto min-h-0">
            <!-- Indexer Selection -->
            <div class="p-4 sm:p-6">
              <label class="block text-sm font-medium text-text mb-3">
                Available {{ isMainnet() ? 'Mainnet' : 'Testnet' }} Indexers
              </label>
              
              <div class="space-y-2 max-h-48 overflow-y-auto">
                @for (indexer of availableIndexers(); track indexer.url) {
                  <div class="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-surface-hover transition-colors duration-200">
                    <!-- Radio Selection -->
                    <div class="flex items-center flex-1 cursor-pointer min-w-0" (click)="selectIndexer(indexer.url)">
                      <div class="flex items-center mr-3 flex-shrink-0">
                        <input 
                          type="radio" 
                          [id]="'indexer-' + indexer.url" 
                          [checked]="indexer.isPrimary"
                          class="w-4 h-4 text-accent bg-surface-ground border-border focus:ring-accent focus:ring-2"
                          readonly
                        >
                      </div>
                      
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-text truncate">
                          {{ getIndexerDisplayName(indexer.url) }}
                        </div>
                        <div class="text-xs text-text-secondary truncate">
                          {{ indexer.url }}
                        </div>
                      </div>
                    </div>

                    <!-- Status Indicator -->
                    <div class="flex items-center ml-2 flex-shrink-0">
                      @if (indexerStatuses()[indexer.url] === 'testing') {
                        <div class="flex items-center gap-1 sm:gap-2">
                          <div class="w-3 h-3 sm:w-4 sm:h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                          <span class="text-xs text-text-secondary hidden sm:inline">Testing...</span>
                        </div>
                      } @else if (indexerStatuses()[indexer.url] === 'online') {
                        <div class="flex items-center gap-1 sm:gap-2">
                          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span class="text-xs text-green-600 hidden sm:inline">Online</span>
                        </div>
                      } @else if (indexerStatuses()[indexer.url] === 'offline') {
                        <div class="flex items-center gap-1 sm:gap-2">
                          <div class="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span class="text-xs text-red-600 hidden sm:inline">Offline</span>
                        </div>
                      } @else {
                        <div class="flex items-center gap-1 sm:gap-2">
                          <div class="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span class="text-xs text-text-secondary hidden sm:inline">Unknown</span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>

              @if (availableIndexers().length === 0) {
                <div class="text-center py-4 text-text-secondary text-sm">
                  No indexers configured for {{ isMainnet() ? 'mainnet' : 'testnet' }}
                </div>
              }
            </div>

            <!-- Technical Details -->
            @if (errorDetails()) {
              <div class="px-4 sm:px-6 pb-4">
                <details class="group">
                  <summary class="flex items-center gap-2 text-xs text-text-secondary cursor-pointer hover:text-accent transition-colors duration-200 select-none">
                    <svg class="w-4 h-4 transition-transform duration-200 group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                    Technical Details
                  </summary>
                  <div class="mt-2 p-3 bg-surface-ground border border-border rounded-lg max-h-32 overflow-y-auto">
                    <code class="text-xs text-red-400 font-mono break-all">{{ errorDetails() }}</code>
                  </div>
                </details>
              </div>
            }
          </div>

          <!-- Fixed Footer with Action Buttons -->
          <div class="flex-shrink-0 flex flex-col gap-3 p-4 sm:p-6 pt-4 border-t custom-modal-border">
            <!-- Primary Action: Go to Settings -->
            <button 
              type="button"
              class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-accent hover:bg-accent-light text-white font-medium rounded-xl transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-surface-card text-sm"
              (click)="goToSettings()"
            >
              <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Go to Settings
            </button>

            <!-- Secondary Actions -->
            <div class="grid grid-cols-2 gap-3">
              <!-- Retry Button -->
              <button 
                type="button"
                class="flex items-center justify-center gap-2 px-4 py-3 bg-surface-ground hover:bg-surface-hover text-text font-medium border border-border rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-2 focus:ring-offset-surface-card text-sm"
                (click)="retry()"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span class="hidden sm:inline">Retry</span>
              </button>

              <!-- Close Button -->
              <button 
                type="button"
                class="flex items-center justify-center gap-2 px-4 py-3 bg-surface-ground hover:bg-surface-hover text-text font-medium border border-border rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-2 focus:ring-offset-surface-card text-sm"
                (click)="dismiss()"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span class="hidden sm:inline">Close</span>
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

  private router = inject(Router);
  private indexerService = inject(IndexerService);
  private networkService = inject(NetworkService);

  // Signals for indexer management
  indexerStatuses = signal<Record<string, 'testing' | 'online' | 'offline' | 'unknown'>>({});
  
  // Computed values
  isMainnet = computed(() => this.networkService.isMain());
  
  availableIndexers = computed(() => {
    const config = this.indexerService.getIndexerConfig();
    return this.isMainnet() ? config.mainnet : config.testnet;
  });

  constructor() {
    // Test all indexers when component initializes
    effect(() => {
      if (this.visible()) {
        this.testAllIndexers();
      }
    });
  }

  private async testAllIndexers(): Promise<void> {
    const indexers = this.availableIndexers();
    const statuses: Record<string, 'testing' | 'online' | 'offline' | 'unknown'> = {};
    
    // Set all to testing initially
    indexers.forEach(indexer => {
      statuses[indexer.url] = 'testing';
    });
    this.indexerStatuses.set(statuses);

    // Test each indexer
    for (const indexer of indexers) {
      try {
        const isOnline = await this.indexerService.testIndexerConnection(indexer.url);
        this.indexerStatuses.update(current => ({
          ...current,
          [indexer.url]: isOnline ? 'online' : 'offline'
        }));
      } catch (error) {
        this.indexerStatuses.update(current => ({
          ...current,
          [indexer.url]: 'offline'
        }));
      }
    }
  }

  selectIndexer(url: string): void {
    const isMainnet = this.isMainnet();
    this.indexerService.setPrimaryIndexer(url, isMainnet);
    
    // Retry with the new indexer
    this.retry();
  }

  getIndexerDisplayName(url: string): string {
    try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname;
      
      // Remove common prefixes
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }
      
      // Capitalize first letter
      return hostname.charAt(0).toUpperCase() + hostname.slice(1);
    } catch {
      return url;
    }
  }

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
