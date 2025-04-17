import { Component, OnInit, inject, signal, effect, HostListener, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppLauncherComponent } from './app-launcher.component';
import { NetworkService } from '../services/network.service';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, AppLauncherComponent],
  animations: [
    trigger('dropdownAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
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
    <header class="main-header" [class.scrolled]="isScrolled()" [class.scroll-up]="isScrollingUp()" [class.scroll-down]="isScrollingDown()">
      <div class="header-content">
        <div class="header-left">
          <app-launcher></app-launcher>
          
          <div class="desktop-only">
            <button class="network-selector" (click)="toggleNetworkMenu($event)" aria-label="Switch network" [attr.aria-expanded]="isNetworkMenuOpen()">
              <div class="network-indicator" [class.mainnet]="networkService.isMain()" [class.testnet]="!networkService.isMain()">
                <span class="network-dot"></span>
                <span class="network-name">{{ networkService.isMain() ? 'Mainnet' : 'Testnet' }}</span>
              </div>
              <span class="material-icons dropdown-arrow" [class.open]="isNetworkMenuOpen()">expand_more</span>
            </button>
            @if (isNetworkMenuOpen()) {
              <div class="network-menu desktop-network-menu" @dropdownAnimation>
                <div class="network-option" [class.active]="networkService.isMain()" (click)="switchNetwork('main')">
                  <div class="network-option-dot mainnet"></div>
                  <div class="network-option-info">
                    <div class="network-option-name">Mainnet</div>
                    <div class="network-option-desc">Live Bitcoin network</div>
                  </div>
                  @if (networkService.isMain()) {
                    <span class="material-icons check-icon">check_circle</span>
                  }
                </div>
                <div class="network-option" [class.active]="!networkService.isMain()" (click)="switchNetwork('test')">
                  <div class="network-option-dot testnet"></div>
                  <div class="network-option-info">
                    <div class="network-option-name">Testnet</div>
                    <div class="network-option-desc">Bitcoin test network</div>
                  </div>
                  @if (!networkService.isMain()) {
                    <span class="material-icons check-icon">check_circle</span>
                  }
                </div>
              </div>
            }
          </div>
        </div>
        
        <nav class="main-nav desktop-only">
          <ul class="nav-list">
            <li class="nav-item">
              <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-link no-underline" (click)="closeAllMenus()">
                <span class="material-icons nav-icon">home</span>
                <span>Home</span>
              </a>
            </li>
            <li class="nav-item">
              <a routerLink="/explore" routerLinkActive="active" class="nav-link no-underline" (click)="closeAllMenus()">
                <span class="material-icons nav-icon">explore</span>
                <span>Explore</span>
              </a>
            </li>
            <li class="nav-item">
              <a routerLink="/settings" routerLinkActive="active" class="nav-link no-underline" (click)="closeAllMenus()">
                <span class="material-icons nav-icon">settings</span>
                <span>Settings</span>
              </a>
            </li>
          </ul>
        </nav>
        
        <div class="header-right">
          <a href="https://test.angor.io" class="action-button no-underline desktop-only">
            <span class="button-text">Create Project</span>
            <span class="material-icons">rocket_launch</span>
          </a>
          
          <button class="theme-toggle desktop-only" (click)="toggleTheme()" aria-label="Toggle theme">
            <span class="material-icons">{{ isDarkTheme() ? 'light_mode' : 'dark_mode' }}</span>
          </button>
          
          <button class="mobile-menu-toggle mobile-only" (click)="toggleMobileMenu()" aria-label="Toggle mobile menu">
            <span class="material-icons">{{ isMenuOpen() ? 'close' : 'menu' }}</span>
          </button>
        </div>
      </div>
    </header>

    @if (isMenuOpen()) {
      <div class="mobile-menu-backdrop mobile-only" @fadeInOut (click)="toggleMobileMenu()"></div>
      
      <div class="mobile-menu-overlay mobile-only" @mobileMenuAnimation>
        <div class="mobile-menu-header">
           <span class="mobile-menu-title">Menu</span>
           <button class="close-mobile-menu" (click)="toggleMobileMenu()" aria-label="Close menu">
             <span class="material-icons">close</span>
           </button>
        </div>
        
        <div class="mobile-menu-content">
          <nav class="mobile-nav">
            <ul class="mobile-nav-list">
              <li class="mobile-nav-item">
                <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="mobile-nav-link no-underline" (click)="toggleMobileMenu()">
                  <span class="material-icons nav-icon">home</span>
                  <span>Home</span>
                </a>
              </li>
              <li class="mobile-nav-item">
                <a routerLink="/explore" routerLinkActive="active" class="mobile-nav-link no-underline" (click)="toggleMobileMenu()">
                  <span class="material-icons nav-icon">explore</span>
                  <span>Explore</span>
                </a>
              </li>
              <li class="mobile-nav-item">
                <a routerLink="/settings" routerLinkActive="active" class="mobile-nav-link no-underline" (click)="toggleMobileMenu()">
                  <span class="material-icons nav-icon">settings</span>
                  <span>Settings</span>
                </a>
              </li>
            </ul>
          </nav>

          <div class="mobile-menu-separator"></div>

          <div class="mobile-network-selector">
             <h4 class="mobile-menu-section-title">Network</h4>
             <div class="network-option" [class.active]="networkService.isMain()" (click)="switchNetwork('main')">
               <div class="network-option-dot mainnet"></div>
               <div class="network-option-info">
                 <div class="network-option-name">Mainnet</div>
                 <div class="network-option-desc">Live Bitcoin network</div>
               </div>
               @if (networkService.isMain()) {
                 <span class="material-icons check-icon">check_circle</span>
               }
             </div>
             <div class="network-option" [class.active]="!networkService.isMain()" (click)="switchNetwork('test')">
               <div class="network-option-dot testnet"></div>
               <div class="network-option-info">
                 <div class="network-option-name">Testnet</div>
                 <div class="network-option-desc">Bitcoin test network</div>
               </div>
               @if (!networkService.isMain()) {
                 <span class="material-icons check-icon">check_circle</span>
               }
             </div>
          </div>

          <div class="mobile-menu-separator"></div>

          <div class="mobile-theme-toggle">
            <h4 class="mobile-menu-section-title">Theme</h4>
            <button class="theme-toggle-button" (click)="toggleTheme()">
              <span class="material-icons">{{ isDarkTheme() ? 'light_mode' : 'dark_mode' }}</span>
              <span>{{ isDarkTheme() ? 'Switch to Light Mode' : 'Switch to Dark Mode' }}</span>
            </button>
          </div>

          <div class="mobile-menu-separator"></div>

          <a href="https://test.angor.io" class="mobile-action-button no-underline" (click)="toggleMobileMenu()">
            <span class="material-icons">rocket_launch</span>
            <span>Create Project</span>
          </a>
        </div>
      </div>
    }
    
    @if (isNetworkMenuOpen()) {
      <div class="overlay desktop-only" (click)="closeAllMenus()" @fadeInOut></div>
    }
  `,
  styles: [`
    :host {
      display: block;
      position: relative;
      z-index: 1000;
    }

    .main-header {
      background: var(--header-bg);
      padding: 0;
      position: sticky;
      top: 0;
      z-index: 1000;
      transition: transform 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }
    
    .main-header.scrolled {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }
    
    .main-header.scroll-down {
      transform: translateY(-100%);
    }
    
    .main-header.scroll-up {
      transform: translateY(0);
    }
    
    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.5rem;
      max-width: 1400px;
      margin: 0 auto;
      position: relative;
    }
    
    .header-left, .header-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    .mobile-only {
      display: none !important;
      @media (max-width: 1024px) {
        display: flex !important; 
      }
    }
    
    .desktop-only {
      display: flex !important; 
      align-items: center;
      gap: inherit;
      @media (max-width: 1024px) {
        display: none !important;
      }
    }
    
    nav.main-nav.desktop-only {
       position: relative; 
       top: auto;
       left: auto;
       width: auto;
       height: auto;
       background: transparent;
       box-shadow: none;
       transform: none;
       transition: none;
       overflow-y: visible;
       z-index: auto;
       
       @media (min-width: 1025px) {
         display: flex !important;
       }
    }

    .network-selector {
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      background: transparent;
      border: none;
      color: var(--header-text);
      font-size: 0.95rem;
      font-weight: 500;
      transition: all 0.2s ease;
      
      &:hover {
        background: rgba(8, 108, 129, 0.08);
      }
    }
    
    .network-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .network-indicator.mainnet {
      color: var(--bitcoin-mainnet);
    }
    
    .network-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--bitcoin-testnet);
      position: relative;
      flex-shrink: 0;
    }
    
    .network-indicator.mainnet .network-dot {
      background: var(--bitcoin-mainnet);
    }
    
    .network-dot::after {
      content: '';
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: inherit;
      top: 0;
      left: 0;
      z-index: -1;
      animation: wavePulse 2s infinite ease-out;
    }
    
    .dropdown-arrow {
      font-size: 1.2rem;
      transition: transform 0.2s ease;
    }
    
    .dropdown-arrow.open {
      transform: rotate(180deg);
    }
    
    .network-option {
      display: flex;
      align-items: center;
      padding: 0.75rem;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      margin-bottom: 0.5rem;
    }
    
    .network-menu .network-option:first-child,
    .mobile-network-selector .network-option:first-child {
      margin-bottom: 0.5rem;
    }
    
    .network-option:hover {
      background: rgba(8, 108, 129, 0.08);
    }
    
    .network-option.active {
      background: rgba(8, 108, 129, 0.1);
    }
    
    .network-option-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 0.75rem;
      flex-shrink: 0;
      position: relative;
    }
    
    .network-option-dot.mainnet {
      background: var(--bitcoin-mainnet);
      box-shadow: 0 0 0 2px rgba(247, 147, 26, 0.2);
    }
    
    .network-option-dot.testnet {
      background: var(--bitcoin-testnet);
      box-shadow: 0 0 0 2px rgba(40, 192, 37, 0.2);
    }
    
    .network-option-dot::after {
       content: '';
       position: absolute;
       width: 100%;
       height: 100%;
       border-radius: 50%;
       background: inherit;
       top: 0;
       left: 0;
       z-index: -1;
       animation: wavePulse 2s infinite ease-out;
       animation-delay: 0.2s;
    }
    
    .network-option-info {
      flex: 1; 
    }
    
    .check-icon {
      color: var(--accent);
      margin-left: auto; 
      font-size: 1.1rem;
      padding-left: 0.5rem; 
    }
    
    @keyframes wavePulse {
      0% {
        transform: scale(1);
        opacity: 0.6;
      }
      50% {
        transform: scale(2.5);
        opacity: 0;
      }
      100% {
        transform: scale(1);
        opacity: 0;
      }
    }

    .network-menu.desktop-network-menu {
      position: absolute;
      top: 100%;
      left: 0;
      width: 280px;
      background: var(--surface-card);
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      padding: 0.75rem;
      z-index: 100;
      margin-top: 0.5rem;
      border: 1px solid var(--border);
    }
    
    .main-nav.desktop-only .nav-list {
      display: flex;
      list-style: none;
      margin: 0;
      padding: 0;
      gap: 0.25rem;
    }
    
    .main-nav.desktop-only .nav-item {
      position: relative;
    }
    
    .main-nav.desktop-only .nav-link {
      display: flex;
      align-items: center;
      text-decoration: none;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-weight: 500;
      color: var(--header-text);
      transition: all 0.2s ease;
      position: relative;
      background: transparent;
      border: none;
      font-size: 1rem;
      cursor: pointer;
      gap: 0.5rem;
      
      &:hover, &.active {
        background: rgba(8, 108, 129, 0.08);
        color: var(--accent);
      }
    }
    
    .no-underline::after {
      display: none !important;
    }
    
    .nav-icon {
      font-size: 1.2rem;
      display: flex;
      align-items: center;
    }

    .mobile-menu-overlay {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      max-width: 350px;
      background: var(--header-bg);
      z-index: 1100;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .mobile-menu-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 1099;
      backdrop-filter: blur(3px);
    }

    .mobile-menu-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .mobile-menu-title {
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--header-text);
    }

    .close-mobile-menu {
      background: transparent;
      border: none;
      color: var(--header-text);
      padding: 0.5rem;
      margin: -0.5rem;
      cursor: pointer;
      
      .material-icons {
        font-size: 1.8rem;
      }
      
      &:hover {
        color: var(--accent);
      }
    }

    .mobile-menu-content {
      padding: 1.5rem;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .mobile-nav-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .mobile-nav-link {
      display: flex;
      align-items: center;
      padding: 0.8rem 1rem;
      border-radius: 8px;
      font-size: 1.1rem;
      font-weight: 500;
      color: var(--header-text);
      text-decoration: none;
      transition: all 0.2s ease;
      gap: 0.8rem;
      
      .nav-icon {
        font-size: 1.4rem;
      }
      
      &:hover, &.active {
        background: rgba(8, 108, 129, 0.08);
        color: var(--accent);
      }
    }

    .mobile-menu-separator {
      height: 1px;
      background: var(--border);
      margin: 0.5rem 0;
    }

    .mobile-menu-section-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .mobile-network-selector .network-option {
      padding: 0.8rem;
    }

    .mobile-theme-toggle .theme-toggle-button {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      background: transparent;
      border: none;
      color: var(--header-text);
      font-size: 1.1rem;
      font-weight: 500;
      padding: 0.8rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      width: 100%;
      text-align: left;
      transition: all 0.2s ease;
      
      .material-icons {
        font-size: 1.4rem;
      }
      
      &:hover {
        background: rgba(8, 108, 129, 0.08);
        color: var(--accent);
      }
    }

    .mobile-action-button {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.8rem 1rem;
      border-radius: 8px;
      font-size: 1.1rem;
      font-weight: 500;
      color: var(--header-text);
      text-decoration: none;
      transition: all 0.2s ease;
      background: var(--accent);
      color: white;
      justify-content: center;
      
      .material-icons {
        font-size: 1.4rem;
      }
      
      &:hover {
        background: var(--accent-light);
      }
    }

    .action-button.desktop-only {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--accent);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s ease;
      border: none;
      cursor: pointer;
      font-size: 0.95rem;
      box-shadow: 0 2px 8px rgba(8, 108, 129, 0.2);
      
      &:hover {
        background: var(--accent-light);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(8, 108, 129, 0.3);
      }
      
      .material-icons {
        font-size: 1.1rem;
      }
    }
    
    .theme-toggle.desktop-only {
      border: none;
      background: transparent;
      color: var(--header-text);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
      
      &:hover {
        background: rgba(8, 108, 129, 0.08);
      }
      
      &:active {
        transform: scale(0.95);
      }
      
      .material-icons {
        font-size: 1.4rem;
        transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      
      &:hover .material-icons {
        transform: rotate(30deg);
      }
    }
    
    .mobile-menu-toggle {
      border: none;
      background: transparent;
      color: var(--header-text);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
      z-index: 1101;
      
      &:hover {
        background: rgba(8, 108, 129, 0.08);
      }
      
      &:active {
        transform: scale(0.95);
      }
      
      .material-icons {
        font-size: 1.4rem;
        transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      
      &:hover .material-icons {
        transform: rotate(30deg);
      }
    }
    
    .overlay.desktop-only {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 90;
      backdrop-filter: blur(4px);
    }
    
    body.mobile-menu-open {
      overflow: hidden;
    }

    @media (max-width: 1024px) {
      .header-content {
        padding: 0.75rem 1rem;
      }
    }
    
    @media (max-width: 480px) {
      .network-name {
        display: none;
      }
      
      .network-indicator {
        padding: 0.35rem;
      }
      
      .dropdown-arrow {
        margin-left: 0.1rem;
      }
    }
  `]
})
export class HeaderComponent implements OnInit {
  public networkService = inject(NetworkService);
  private renderer = inject(Renderer2);

  isMenuOpen = signal<boolean>(false);
  isDarkTheme = signal<boolean>(document.documentElement.getAttribute('data-theme') === 'dark');
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
  }

  ngOnInit(): void {
    this.isDarkTheme.set(document.documentElement.getAttribute('data-theme') === 'dark');
    this.checkScrollPosition();
  }

  toggleTheme(): void {
    this.isDarkTheme.update(dark => !dark);
    this.applyTheme();
  }

  private applyTheme(): void {
    const theme = this.isDarkTheme() ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('angor-theme', theme);
    } catch (e) {
      console.error('Failed to save theme preference:', e);
    }
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
      this.networkService.switchToMain();
    } else {
      this.networkService.switchToTest();
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

  @HostListener('window:scroll', ['$event'])
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
