import { Component, inject, Renderer2, HostListener, OnDestroy, Inject, OnInit } from '@angular/core';
import { RouterOutlet, ChildrenOutletContexts, Router, NavigationEnd } from '@angular/router'; 
import { HeaderComponent } from './components/header.component';
import { FooterComponent } from './components/footer.component';
import { DOCUMENT } from '@angular/common';
import { ThemeService } from './services/theme.service';
import { NetworkService } from './services/network.service';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { trigger, transition, style, query, animate, group } from '@angular/animations';

const routeTransitionAnimations = trigger('routeAnimations', [
  transition('* <=> *', [
    style({ position: 'relative' }),
    query(':enter, :leave', [
      style({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        opacity: 1,
      })
    ], { optional: true }),
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(20px)' }) 
    ], { optional: true }),
    group([
      query(':leave', [
        animate('400ms ease-in-out', style({ opacity: 0, transform: 'translateY(-10px)' })) 
      ], { optional: true }),
      query(':enter', [
        animate('400ms ease-in-out', style({ opacity: 1, transform: 'translateY(0)' })) 
      ], { optional: true })
    ])
  ])
]);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  template: `
    <div class="flex flex-col min-h-screen bg-surface-ground text-text">
      <app-header></app-header>
      <main class="flex-grow relative" [@routeAnimations]="getRouteAnimationData()"> 
        <router-outlet></router-outlet>
      </main>
      <app-footer></app-footer>
    </div>
  `,
  animations: [routeTransitionAnimations]
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'angor-hub';
  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);
  private themeService = inject(ThemeService);
  private networkService = inject(NetworkService);
  private router = inject(Router);
  private contexts = inject(ChildrenOutletContexts);
  private scrollTimeout: any = null;
  private routerSubscription: Subscription | null = null;

  constructor() { }

  ngOnInit() {
    // Subscribe to router events to detect URL parameter changes
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.checkNetworkParam();
    });

    // Check on initial load
    this.checkNetworkParam();
  }

  /**
   * Check for network parameter in URL and update network if needed
   */
  private checkNetworkParam(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const networkParam = urlParams.get('network');
    
    if (networkParam === 'main' || networkParam === 'test') {
      const currentNetwork = this.networkService.getNetwork();
      if (networkParam !== currentNetwork) {
        this.networkService.setNetworkFromUrlParam(networkParam);
        // Update services that depend on network change
        this.updateDependentServices();
      }
    }
  }

  /**
   * Update services that need to react to network change
   */
  private updateDependentServices(): void {
    // This is where we would update any services that depend on the network
    // For example, we might need to update the IndexerService
    // This avoids page reloads when changing network from URL parameters
  }

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.data?.['animation'];
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.renderer.addClass(this.document.body, 'scrolling');
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = setTimeout(() => {
      this.renderer.removeClass(this.document.body, 'scrolling');
      this.scrollTimeout = null;
    }, 1500);
  }

  ngOnDestroy() {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.renderer.removeClass(this.document.body, 'scrolling');
    
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }
}
