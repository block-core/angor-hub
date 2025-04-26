import { Component, inject, Renderer2, HostListener, OnDestroy, Inject } from '@angular/core';
import { RouterOutlet, ChildrenOutletContexts } from '@angular/router'; 
import { HeaderComponent } from './components/header.component';
import { FooterComponent } from './components/footer.component';
import { DOCUMENT } from '@angular/common';
import { ThemeService } from './services/theme.service';
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
export class AppComponent implements OnDestroy {
  title = 'angor-hub';
  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);
  private themeService = inject(ThemeService);
  private contexts = inject(ChildrenOutletContexts);  
  private scrollTimeout: any = null;

  constructor() {
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
  }
}
