import { Component, OnInit, inject, signal, effect, HostListener } from '@angular/core';
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
    ])
  ],
  template: `
    <header class="main-header" [class.scrolled]="isScrolled()" [class.scroll-up]="isScrollingUp()" [class.scroll-down]="isScrollingDown()">
      <div class="header-content">
        <!-- Left side - Logo and network indicator -->
        <div class="header-left">
          <app-launcher></app-launcher>
          
          <button class="network-selector" (click)="toggleNetworkMenu($event)" aria-label="Switch network" [attr.aria-expanded]="isNetworkMenuOpen()">
            <div class="network-indicator" [class.mainnet]="networkService.isMain()" [class.testnet]="!networkService.isMain()">
              <span class="network-dot"></span>
              <span class="network-name">{{ networkService.isMain() ? 'Mainnet' : 'Testnet' }}</span>
            </div>
            <span class="material-icons dropdown-arrow" [class.open]="isNetworkMenuOpen()">expand_more</span>
          </button>

          <!-- Network switching dropdown -->
          @if (isNetworkMenuOpen()) {
            <div class="network-menu" @dropdownAnimation>
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
        
        <!-- Center - Navigation links -->
        <nav class="main-nav" [class.active]="isMenuOpen()">
          <ul class="nav-list">
            <li class="nav-item">
              <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-link no-underline">Home</a>
            </li>
            <li class="nav-item">
              <a routerLink="/explore" routerLinkActive="active" class="nav-link no-underline">Explore</a>
            </li>
            <li class="nav-item">
              <a routerLink="/settings" routerLinkActive="active" class="nav-link no-underline">
                <span class="material-icons nav-icon">settings</span>
                <span>Settings</span>
              </a>
            </li>
          </ul>
        </nav>
        
        <!-- Right side - Theme toggle and action buttons -->
        <div class="header-right">
          <a href="https://test.angor.io" class="action-button no-underline">
            <span class="button-text">Create Project</span>
            <span class="material-icons">rocket_launch</span>
          </a>
          
          <button class="theme-toggle" (click)="toggleTheme()" aria-label="Toggle theme">
            <span class="material-icons">{{ isDarkTheme() ? 'light_mode' : 'dark_mode' }}</span>
          </button>
          
          <button class="mobile-menu-toggle" (click)="toggleMobileMenu()" aria-label="Toggle mobile menu">
            <span class="material-icons">{{ isMenuOpen() ? 'close' : 'menu' }}</span>
          </button>
        </div>
      </div>
    </header>
    
    @if (isMenuOpen() || isNetworkMenuOpen()) {
      <div class="overlay" (click)="closeAllMenus()" @fadeInOut></div>
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
    
    /* Network selector and indicator */
    .network-selector {
      display: flex;
      align-items: center;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0;
      position: relative;
    }
    
    .network-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.75rem;
      border-radius: 20px;
      background: rgba(40, 192, 37, 0.1);
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--bitcoin-testnet);
      border: 1px solid rgba(40, 192, 37, 0.2);
      transition: all 0.2s ease;
    }
    
    .network-indicator.mainnet {
      background: rgba(247, 147, 26, 0.1);
      color: var(--bitcoin-mainnet);
      border-color: rgba(247, 147, 26, 0.2);
    }
    
    .network-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--bitcoin-testnet);
      position: relative;
    }
    
    .network-indicator.mainnet .network-dot {
      background: var(--bitcoin-mainnet);
    }
    
    .network-dot:after {
      content: '';
      position: absolute;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--bitcoin-testnet);
      opacity: 0.3;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      animation: pulse 1.5s infinite;
    }
    
    .network-indicator.mainnet .network-dot:after {
      background: var(--bitcoin-mainnet);
    }
    
    .dropdown-arrow {
      font-size: 1.1rem;
      transition: transform 0.2s ease;
      margin-left: 0.25rem;
      color: var(--text-secondary);
    }
    
    .dropdown-arrow.open {
      transform: rotate(180deg);
    }
    
    .network-menu {
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
    
    .network-option {
      display: flex;
      align-items: center;
      padding: 0.75rem;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 0.2s ease;
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
    }
    
    .network-option-dot.mainnet {
      background: var(--bitcoin-mainnet);
      box-shadow: 0 0 0 2px rgba(247, 147, 26, 0.2);
    }
    
    .network-option-dot.testnet {
      background: var(--bitcoin-testnet);
      box-shadow: 0 0 0 2px rgba(40, 192, 37, 0.2);
    }
    
    .network-option-info {
      flex: 1;
    }
    
    .network-option-name {
      font-weight: 600;
      font-size: 0.95rem;
      margin-bottom: 0.25rem;
    }
    
    .network-option-desc {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }
    
    .check-icon {
      color: var(--accent);
      margin-left: 0.5rem;
      font-size: 1.1rem;
    }
    
    @keyframes pulse {
      0% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0.3;
      }
      70% {
        transform: translate(-50%, -50%) scale(2);
        opacity: 0;
      }
      100% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0;
      }
    }
    
    /* Main Navigation */
    .main-nav {
      position: relative;
      
      @media (max-width: 1024px) {
        position: fixed;
        top: 73px;
        left: 0;
        width: 280px;
        height: calc(100vh - 73px);
        background: var(--header-bg);
        box-shadow: 4px 0 16px rgba(0, 0, 0, 0.1);
        transform: translateX(-100%);
        transition: transform 0.3s ease;
        overflow-y: auto;
        z-index: 100;
      }
      
      &.active {
        transform: translateX(0);
      }
    }
    
    .nav-list {
      display: flex;
      list-style: none;
      margin: 0;
      padding: 0;
      gap: 0.25rem;
      
      @media (max-width: 1024px) {
        flex-direction: column;
        gap: 0;
        padding: 1rem 0;
      }
    }
    
    .nav-item {
      position: relative;
      
      @media (max-width: 1024px) {
        width: 100%;
      }
    }
    
    .nav-link {
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
      
      &:hover, &.active {
        background: rgba(8, 108, 129, 0.08);
        color: var(--accent);
      }
      
      @media (max-width: 1024px) {
        border-radius: 0;
        padding: 1rem 1.5rem;
        width: 100%;
        justify-content: space-between;
      }
    }
    
    /* Remove underlines from all links */
    .no-underline::after {
      display: none !important;
    }
    
    .dropdown-icon {
      margin-left: 0.5rem;
      font-size: 1.2rem;
      transition: transform 0.2s ease;
      
      &.expanded {
        transform: rotate(180deg);
      }
    }
    
    .dropdown-toggle {
      padding-right: 2rem;
      position: relative;
    }
    
    .dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      width: 240px;
      background: var(--surface-card);
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      padding: 0.75rem;
      z-index: 100;
      margin-top: 0.5rem;
      border: 1px solid var(--border);
      
      @media (max-width: 1024px) {
        position: static;
        width: 100%;
        box-shadow: none;
        margin: 0;
        border-radius: 0;
        border: none;
        background: rgba(8, 108, 129, 0.04);
      }
    }
    
    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      color: var(--text);
      text-decoration: none;
      transition: all 0.2s ease;
      
      .material-icons {
        font-size: 1.2rem;
        color: var(--accent);
      }
      
      &:hover {
        background: rgba(8, 108, 129, 0.08);
        color: var(--accent);
      }
    }
    
    /* Theme toggle and action button */
    .action-button {
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
      
      @media (max-width: 1024px) {
        display: none;
      }
    }
    
    .theme-toggle, .mobile-menu-toggle {
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
      display: none;
      
      @media (max-width: 1024px) {
        display: flex;
      }
    }
    
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 90;
      backdrop-filter: blur(4px);
      
      @media (max-width: 1024px) {
        display: block;
      }
    }
    
    .nav-icon {
      margin-right: 0.35rem;
      font-size: 1.2rem;
    }
    
    /* Responsive adjustments */
    @media (max-width: 1024px) {
      .header-content {
        padding: 0.75rem 1rem;
      }
      
      .network-menu {
        position: fixed;
        top: 73px;
        left: 0;
        width: 280px;
        margin-top: 0;
        border-top-left-radius: 0;
        border-top-right-radius: 0;
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
  
  isMenuOpen = signal<boolean>(false);
  isDarkTheme = signal<boolean>(false);
  expandedDropdown = signal<string | null>(null);
  isScrolled = signal<boolean>(false);
  isScrollingUp = signal<boolean>(false);
  isScrollingDown = signal<boolean>(false);
  isNetworkMenuOpen = signal<boolean>(false);
  
  private lastScrollTop = 0;
  
  ngOnInit(): void {
    // Initialize theme based on user preference or system
    const savedTheme = localStorage.getItem('angor-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      this.isDarkTheme.set(savedTheme === 'dark');
    } else {
      this.isDarkTheme.set(prefersDark);
    }
    
    this.applyTheme();
    
    // Listen for scroll events
    this.checkScrollPosition();
  }
  
  toggleTheme(): void {
    this.isDarkTheme.update(dark => !dark);
    this.applyTheme();
  }
  
  private applyTheme(): void {
    const theme = this.isDarkTheme() ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('angor-theme', theme);
  }
  
  toggleMobileMenu(): void {
    this.isMenuOpen.update(open => !open);
    if (this.isMenuOpen()) {
      document.body.style.overflow = 'hidden';
      this.isNetworkMenuOpen.set(false); // Close network menu when opening mobile menu
    } else {
      document.body.style.overflow = '';
    }
  }
  
  toggleNetworkMenu(event: Event): void {
    event.stopPropagation();
    this.isNetworkMenuOpen.update(open => !open);
    if (this.isNetworkMenuOpen()) {
      this.expandedDropdown.set(null); // Close other dropdowns
    }
  }
  
  switchNetwork(network: 'main' | 'test'): void {
    // Switch to selected network
    if (network === 'main') {
      this.networkService.switchToMain();
    } else {
      this.networkService.switchToTest();
    }
    this.isNetworkMenuOpen.set(false);
  }
  
  toggleDropdown(event: Event, dropdown: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.expandedDropdown.update(current => current === dropdown ? null : dropdown);
    if (this.expandedDropdown()) {
      this.isNetworkMenuOpen.set(false); // Close network menu when opening dropdown
    }
  }
  
  closeAllMenus(): void {
    this.isMenuOpen.set(false);
    this.isNetworkMenuOpen.set(false);
    this.expandedDropdown.set(null);
    document.body.style.overflow = '';
  }
  
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Close dropdown if clicked outside
    const target = event.target as HTMLElement;
    
    if (this.expandedDropdown()) {
      const isDropdownClick = target.closest('.has-dropdown');
      if (!isDropdownClick) {
        this.expandedDropdown.set(null);
      }
    }
    
    // Close network menu if clicked outside
    if (this.isNetworkMenuOpen()) {
      const isNetworkClick = target.closest('.network-selector, .network-menu');
      if (!isNetworkClick) {
        this.isNetworkMenuOpen.set(false);
      }
    }
  }
  
  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    this.checkScrollPosition();
  }
  
  private checkScrollPosition(): void {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Check if scrolled
    this.isScrolled.set(scrollTop > 20);
    
    // Check scroll direction
    if (scrollTop > this.lastScrollTop && scrollTop > 100) {
      this.isScrollingDown.set(true);
      this.isScrollingUp.set(false);
    } else {
      this.isScrollingDown.set(false);
      this.isScrollingUp.set(scrollTop > 20); // Only show elevation when scrolled
    }
    
    this.lastScrollTop = scrollTop;
    
    // Close dropdowns on scroll
    this.expandedDropdown.set(null);
    this.isNetworkMenuOpen.set(false);
  }
}
