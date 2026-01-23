import { Component, OnInit, inject, signal, effect, HostListener, Renderer2, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppLauncherComponent } from './app-launcher.component';
import { NetworkService } from '../services/network.service';
import { animate, style, transition, trigger } from '@angular/animations';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, AppLauncherComponent],
  animations: [
    trigger('dropdownAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px) scale(0.95)' }),
        animate('150ms ease-out', style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('100ms ease-in', style({ opacity: 0, transform: 'translateY(-10px) scale(0.95)' }))
      ])
    ]),
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('mobileMenuAnimation', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('250ms cubic-bezier(0.4, 0, 0.2, 1)', style({ transform: 'translateX(100%)', opacity: 0 }))
      ])
    ])
  ],
  template: `
    <header
      class="sticky top-0 z-[1000] bg-header-bg/80 backdrop-blur-lg shadow-sm transition-transform duration-300 ease-in-out"
      [class.shadow-md]="isScrolled()"
      [class.-translate-y-full]="isScrollingDown()"
      [class.translate-y-0]="isScrollingUp() || !isScrolled()">
      <div class="container mx-auto px-4 flex items-center justify-between h-16">
        <!-- Left Side -->
        <div class="flex items-center gap-4">
          <app-launcher></app-launcher>

          <!-- Desktop Network Selector -->
          <div class="hidden lg:block relative">
            <button class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-header-text hover:bg-surface-hover transition-colors" (click)="toggleNetworkMenu($event)" aria-label="Switch network" [attr.aria-expanded]="isNetworkMenuOpen()">
              <div class="flex items-center gap-2" [class.text-bitcoin-mainnet]="networkService.isMain()" [class.text-bitcoin-testnet]="!networkService.isMain()">
                <span class="relative flex h-2.5 w-2.5">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" [ngClass]="networkService.isMain() ? 'bg-bitcoin-mainnet' : 'bg-bitcoin-testnet'"></span>
                  <span class="relative inline-flex rounded-full h-2.5 w-2.5" [ngClass]="networkService.isMain() ? 'bg-bitcoin-mainnet' : 'bg-bitcoin-testnet'"></span>
                </span>
                <span>{{ networkService.isMain() ? 'Mainnet' : 'Testnet' }}</span>
              </div>
              <span class="material-icons text-base transition-transform duration-200" [class.rotate-180]="isNetworkMenuOpen()">expand_more</span>
            </button>
            @if (isNetworkMenuOpen()) {
              <div class="absolute top-full left-0 mt-2 w-64 bg-surface-card rounded-lg shadow-xl border border-border z-[100]" @dropdownAnimation>
                <div class="p-3 space-y-2">
                  <button class="w-full flex items-center gap-3 p-3 rounded-md text-left hover:bg-surface-hover transition-colors" [class.bg-surface-hover]="networkService.isMain()" (click)="switchNetwork('main')">
                    <span class="relative flex h-3 w-3"><span class="relative inline-flex rounded-full h-3 w-3 bg-bitcoin-mainnet"></span></span>
                    <div class="flex-1">
                      <div class="font-medium text-sm">Mainnet</div>
                      <div class="text-xs text-text-secondary">Live Bitcoin network</div>
                    </div>
                    @if (networkService.isMain()) { <span class="material-icons text-accent text-lg">check_circle</span> }
                  </button>
                  <button class="w-full flex items-center gap-3 p-3 rounded-md text-left hover:bg-surface-hover transition-colors" [class.bg-surface-hover]="!networkService.isMain()" (click)="switchNetwork('test')">
                    <span class="relative flex h-3 w-3"><span class="relative inline-flex rounded-full h-3 w-3 bg-bitcoin-testnet"></span></span>
                    <div class="flex-1">
                      <div class="font-medium text-sm">Testnet</div>
                      <div class="text-xs text-text-secondary">Bitcoin test network</div>
                    </div>
                    @if (!networkService.isMain()) { <span class="material-icons text-accent text-lg">check_circle</span> }
                  </button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Right Side -->
        <div class="flex items-center gap-2">
          <!-- Desktop Navigation -->
          <nav class="hidden lg:flex items-center gap-1">
            <a routerLink="/explore" routerLinkActive="bg-surface-hover text-accent" class="px-4 py-2 rounded-lg text-sm font-medium text-header-text hover:bg-surface-hover transition-colors" (click)="closeAllMenus()">
              Projects
            </a>
            <a href="https://angor.io/app" target="_blank" rel="noopener noreferrer" class="px-4 py-2 rounded-lg text-sm font-medium text-header-text hover:bg-surface-hover transition-colors">
              App
            </a>
            <a href="https://profile.angor.io/angor-profile/" target="_blank" rel="noopener noreferrer" class="px-4 py-2 rounded-lg text-sm font-medium text-header-text hover:bg-surface-hover transition-colors">
              Profile
            </a>
            <a href="https://angor.io/docs" target="_blank" rel="noopener noreferrer" class="px-4 py-2 rounded-lg text-sm font-medium text-header-text hover:bg-surface-hover transition-colors">
              Docs
            </a>
          </nav>

          <!-- Settings Button (Desktop) -->
          <a routerLink="/settings" class="hidden lg:flex items-center justify-center w-10 h-10 rounded-full text-header-text hover:bg-surface-hover transition-colors" aria-label="Settings">
            <span class="material-icons text-xl">settings</span>
          </a>

          <!-- Theme Toggle (Desktop) -->
          <button class="hidden lg:flex items-center justify-center w-10 h-10 rounded-full text-header-text hover:bg-surface-hover transition-colors" (click)="toggleTheme()" aria-label="Toggle theme">
            <span class="material-icons text-xl transition-transform duration-500 ease-out" [ngClass]="{'rotate-[360deg]': !isDarkTheme(), 'rotate-0': isDarkTheme()}">{{ isDarkTheme() ? 'dark_mode' : 'light_mode' }}</span>
          </button>

          <!-- Mobile Menu Toggle -->
          <button class="lg:hidden flex items-center justify-center w-10 h-10 rounded-full text-header-text hover:bg-surface-hover transition-colors z-[1101]" (click)="toggleMobileMenu()" aria-label="Toggle mobile menu">
            <span class="material-icons text-2xl transition-transform duration-300 ease-in-out" [class.rotate-90]="isMenuOpen()">{{ isMenuOpen() ? 'close' : 'menu' }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Mobile Menu -->
    @if (isMenuOpen()) {
      <button type="button" class="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[1099] border-0 cursor-pointer" 
              @fadeInOut (click)="toggleMobileMenu()" title="Close mobile menu">
      </button>
      <div class="lg:hidden fixed top-0 right-0 bottom-0 w-full max-w-xs bg-header-bg shadow-xl z-[1100] flex flex-col" @mobileMenuAnimation>
        <div class="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
           <span class="font-semibold text-lg text-header-text">Menu</span>
           <!-- Close button is part of the toggle in the header now -->
        </div>
        <div class="flex-grow overflow-y-auto p-4">
          <!-- Mobile Navigation -->
          <nav class="mb-6 space-y-2">
            <a routerLink="/explore" routerLinkActive="bg-surface-hover text-accent" class="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-header-text hover:bg-surface-hover transition-colors" (click)="toggleMobileMenu()">
              Projects
            </a>
            <a href="https://angor.io/app" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-header-text hover:bg-surface-hover transition-colors" (click)="toggleMobileMenu()">
              App
            </a>
            <a href="https://profile.angor.io/angor-profile/" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-header-text hover:bg-surface-hover transition-colors" (click)="toggleMobileMenu()">
              Profile
            </a>
            <a href="https://angor.io/docs" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-header-text hover:bg-surface-hover transition-colors" (click)="toggleMobileMenu()">
              Docs
            </a>
          </nav>

          <div class="h-px bg-border my-4"></div>

          <!-- Mobile Network Selector -->
          <div class="mb-6">
            <h4 class="px-4 mb-2 text-xs font-semibold uppercase text-text-secondary tracking-wider">Network</h4>
            <div class="space-y-2 px-1">
              <button class="w-full flex items-center gap-3 p-3 rounded-md text-left hover:bg-surface-hover transition-colors" [class.bg-surface-hover]="networkService.isMain()" (click)="switchNetwork('main')">
                <span class="relative flex h-3 w-3"><span class="relative inline-flex rounded-full h-3 w-3 bg-bitcoin-mainnet"></span></span>
                <div class="flex-1">
                  <div class="font-medium text-sm">Mainnet</div>
                </div>
                @if (networkService.isMain()) { <span class="material-icons text-accent text-lg">check_circle</span> }
              </button>
              <button class="w-full flex items-center gap-3 p-3 rounded-md text-left hover:bg-surface-hover transition-colors" [class.bg-surface-hover]="!networkService.isMain()" (click)="switchNetwork('test')">
                <span class="relative flex h-3 w-3"><span class="relative inline-flex rounded-full h-3 w-3 bg-bitcoin-testnet"></span></span>
                <div class="flex-1">
                  <div class="font-medium text-sm">Testnet</div>
                </div>
                @if (!networkService.isMain()) { <span class="material-icons text-accent text-lg">check_circle</span> }
              </button>
            </div>
          </div>

          <div class="h-px bg-border my-4"></div>

          <!-- Mobile Settings -->
          <div class="mb-6">
            <h4 class="px-4 mb-2 text-xs font-semibold uppercase text-text-secondary tracking-wider">Settings</h4>
            <div class="px-1">
              <a routerLink="/settings" routerLinkActive="bg-surface-hover text-accent" class="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-header-text hover:bg-surface-hover transition-colors" (click)="toggleMobileMenu()">
                <span class="material-icons text-xl">settings</span>
                <span>Settings</span>
              </a>
            </div>
          </div>

          <div class="h-px bg-border my-4"></div>

          <!-- Mobile Theme Toggle -->
          <div>
             <h4 class="px-4 mb-2 text-xs font-semibold uppercase text-text-secondary tracking-wider">Theme</h4>
             <div class="px-1">
               <button class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-header-text hover:bg-surface-hover transition-colors" (click)="toggleTheme()">
                 <span class="material-icons text-xl">{{ isDarkTheme() ? 'dark_mode' : 'light_mode' }}</span>
                 <span>{{ isDarkTheme() ? 'Dark Mode' : 'Light Mode' }}</span>
               </button>
             </div>
          </div>
        </div>
      </div>
    }

    <!-- Desktop Network Menu -->
    @if (isNetworkMenuOpen()) {
      <button type="button" class="hidden lg:block fixed inset-0 z-[99] bg-transparent border-0 cursor-pointer" 
              (click)="closeAllMenus()" @fadeInOut title="Close network menu">
      </button>
      <div class="absolute top-full left-0 mt-2 w-64 bg-surface-card rounded-lg shadow-xl border border-border z-[100]" @dropdownAnimation>
        <div class="p-3 space-y-2">
          <button class="w-full flex items-center gap-3 p-3 rounded-md text-left hover:bg-surface-hover transition-colors" [class.bg-surface-hover]="networkService.isMain()" (click)="switchNetwork('main')">
            <span class="relative flex h-3 w-3"><span class="relative inline-flex rounded-full h-3 w-3 bg-bitcoin-mainnet"></span></span>
            <div class="flex-1">
              <div class="font-medium text-sm">Mainnet</div>
              <div class="text-xs text-text-secondary">Live Bitcoin network</div>
            </div>
            @if (networkService.isMain()) { <span class="material-icons text-accent text-lg">check_circle</span> }
          </button>
          <button class="w-full flex items-center gap-3 p-3 rounded-md text-left hover:bg-surface-hover transition-colors" [class.bg-surface-hover]="!networkService.isMain()" (click)="switchNetwork('test')">
            <span class="relative flex h-3 w-3"><span class="relative inline-flex rounded-full h-3 w-3 bg-bitcoin-testnet"></span></span>
            <div class="flex-1">
              <div class="font-medium text-sm">Testnet</div>
              <div class="text-xs text-text-secondary">Bitcoin test network</div>
            </div>
            @if (!networkService.isMain()) { <span class="material-icons text-accent text-lg">check_circle</span> }
          </button>
        </div>
      </div>
    }

    <!-- Desktop Network Menu Overlay -->
    @if (isNetworkMenuOpen()) {
      <button type="button" class="hidden lg:block fixed inset-0 z-[99] bg-transparent border-0 cursor-pointer" 
              (click)="closeAllMenus()" @fadeInOut title="Close network menu overlay">
      </button>
    }
  `,
})
export class HeaderComponent implements OnInit, OnDestroy {
  public networkService = inject(NetworkService);
  public themeService = inject(ThemeService);
  private renderer = inject(Renderer2);

  isMenuOpen = signal<boolean>(false);
  isDarkTheme = signal<boolean>(false);
  isScrolled = signal<boolean>(false);
  isScrollingUp = signal<boolean>(false);
  isScrollingDown = signal<boolean>(false);
  isNetworkMenuOpen = signal<boolean>(false);

  private lastScrollTop = 0;

  constructor() {
    effect(() => {
      if (this.isMenuOpen()) {
        this.renderer.addClass(document.body, 'mobile-menu-open');
      } else {
        this.renderer.removeClass(document.body, 'mobile-menu-open');
      }
    });

    effect(() => {
      this.isDarkTheme.set(this.themeService.currentTheme() === 'dark');
    });
  }

  ngOnInit(): void {
    this.checkScrollPosition();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleMobileMenu(): void {
    this.isMenuOpen.update(open => !open);
    this.isNetworkMenuOpen.set(false);
  }

  toggleNetworkMenu(event: Event): void {
    event.stopPropagation();
    this.isNetworkMenuOpen.update(open => !open);
    if (this.isNetworkMenuOpen()) {
       this.isMenuOpen.set(false);
    }
  }

  switchNetwork(network: 'main' | 'test'): void {
    if (network === 'main') {
      this.networkService.setNetwork('main', true); // Set updateUrl=true
    } else {
      this.networkService.setNetwork('test', true); // Set updateUrl=true
    }
    this.isNetworkMenuOpen.set(false);
  }

  closeAllMenus(): void {
    this.isMenuOpen.set(false);
    this.isNetworkMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (this.isNetworkMenuOpen() && !target.closest('.mobile-only')) {
      const isNetworkClick = target.closest('.network-selector, .network-menu');
      if (!isNetworkClick) {
        this.isNetworkMenuOpen.set(false);
      }
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.checkScrollPosition();
    this.isNetworkMenuOpen.set(false);
  }

  private checkScrollPosition(): void {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    this.isScrolled.set(scrollTop > 20);
    
    if (scrollTop > this.lastScrollTop && scrollTop > 100) {
      this.isScrollingDown.set(true);
      this.isScrollingUp.set(false);
    } else {
      this.isScrollingDown.set(false);
      this.isScrollingUp.set(scrollTop > 20);
    }
    
    this.lastScrollTop = scrollTop;
  }

  ngOnDestroy(): void {
     this.renderer.removeClass(document.body, 'mobile-menu-open');
  }
}
