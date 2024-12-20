import {
  Component,
  inject,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  OnInit,
  HostListener,
  effect,
} from '@angular/core';
import { RelayService } from '../../services/relay.service';
import { IndexerService } from '../../services/indexer.service';
import { RouterLink } from '@angular/router';
import { ExploreStateService } from '../../services/explore-state.service';
import { Router, NavigationEnd } from '@angular/router';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AgoPipe } from '../../pipes/ato.pipe';

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [RouterLink, BreadcrumbComponent, CommonModule, AgoPipe],
  styles: [
    `
      .truncate {
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        display: inline-block;
      }
      .loading-profile {
        font-style: italic;
        color: #666;
        margin-left: 0.5em;
      }
      .about {
        margin-top: 0.5em;
        font-style: italic;
      }
      .project-details {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      .project-details p {
        margin: 0.25rem 0;
        font-size: 0.9rem;
        color: var(--text-secondary);
      }
      .project-card {
        position: relative;
        overflow: hidden;
        border-radius: 12px;
        background: var(--surface-card);
        padding: 0; /* Remove padding from card */
      }
      .project-banner {
        width: 100%;
        height: 120px;
        background-size: cover;
        background-position: center;
        background-color: rgba(0, 0, 0, 0.1);
        border-radius: 12px 12px 0 0;
        margin: -1px; /* Compensate for any gap */
        padding: 1px; /* Ensure full coverage */
      }

      .project-content {
        padding: 1.5rem; /* Increase padding in content area to compensate */
        position: relative;
        margin-top: 0; /* Remove negative margin */
        padding-top: 4rem; /* Increased from 3rem to give more space below avatar */
        padding-left: 1.5rem; /* Changed from 6rem to use full width */
        min-height: 100px; /* Ensure enough height for the avatar */
      }
      .project-content h3 {
        margin-top: 0; /* Remove default margin */
        position: relative; /* Ensure it stays above avatar */
        z-index: 1; /* Ensure text stays above avatar */
      }
      .project-avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background-size: cover;
        background-position: center;
        background-color: var(--surface-ground);
        position: absolute;
        top: -40px; /* Move up to overlap banner */
        left: 50%; /* Center the avatar */
        transform: translateX(-50%); /* Center the avatar */
        border: 4px solid var(--background); /* Use theme background color */
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Optional: adds depth */
      }
      .project-info {
        margin-top: 1rem;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }
      .info-item {
        text-align: center;
      }
      .info-label {
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-bottom: 0.25rem;
      }
      .info-value {
        font-size: 1rem;
        font-weight: 900;
      }
      .funding-progress {
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border);
      }
      .progress-bar {
        width: 100%;
        height: 8px;
        background: rgba(0, 0, 0, 0.1);
        border-radius: 4px;
        overflow: hidden;
        margin: 0.5rem 0;
      }
      .progress-fill {
        height: 100%;
        background: var(--accent);
        transition: width 0.3s ease;
      }
      .progress-stats {
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
        color: var(--text-secondary);
        margin-bottom: 0.5rem;
      }
      .investment-stats {
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
        color: var(--text-secondary);
        margin-top: 0.5rem;
      }
      .invested-amount {
        font-weight: 600;
        color: var(--accent-dark);
      }
      .funding-percentage {
        font-weight: 600;
        color: var(--accent);
      }
    `,
  ], // Remove fade-out animation styles
  template: `
    <!-- <app-breadcrumb
      [items]="[
        { label: 'Home', url: '/' },
        { label: 'Explore', url: '' }
      ]"
    ></app-breadcrumb> -->

    <section class="hero">

    <app-breadcrumb
      [items]="[
        { label: 'Home', url: '/' },
        { label: 'Explore', url: '' }
      ]"
    ></app-breadcrumb>

      <div class="hero-wrapper">
        <div class="hero-content">
          <strong>Explore Projects</strong>
          <h1 class="hero-subtitle">What's your next investment?</h1>
          <p class="hero-description">
            Check out our projects and find your next investment opportunity.
          </p>
        </div>
      </div>
    </section>

    <div class="container">
      @if (indexer.loading() && !indexer.projects().length) {
      <div class="loading-spinner">
        <div class="spinner"></div>
      </div>
      } @else if (indexer.projects().length === 0) {
      <p class="text-center">No projects found.</p>
      } @else {
      <section class="projects">
        @for (project of indexer.projects(); track project.projectIdentifier;
        let i = $index) {
        <a
          [routerLink]="['/project', project.projectIdentifier]"
          class="project-card"
          [attr.data-index]="i"
        >
          <div
            class="project-banner"
            [style.background-image]="
              project.metadata?.['banner'] ?? ''
                ? 'url(' + (project.metadata?.['banner'] ?? '') + ')'
                : 'none'
            "
          ></div>

          <div class="project-content">
            <div
              class="project-avatar"
              [style.background-image]="
                project.metadata?.['picture'] ?? ''
                  ? 'url(' + (project.metadata?.['picture'] ?? '') + ')'
                  : 'none'
              "
            ></div>

            <h3>
              @if ((project.metadata?.['name'] ?? '') !== '') {
              {{ project.metadata?.['name'] }}
              } @else {
              {{ project.projectIdentifier }}
              }
            </h3>

            <!-- <p>
              Founder: @if ((project.metadata?.['name'] ?? '') !== '') {
              {{ project.metadata?.['name'] ?? '' }}
              } @else {
              <span class="truncate">{{ project.founderKey }}</span>
              <small class="loading-profile">Loading profile...</small>
              }
            </p> -->

            @if ((project.metadata?.['about'] ?? '') !== '') {
            <p class="about">{{ project.metadata?.['about'] ?? '' }}</p>
            } 
            @else {
            <p class="about"></p>
            }
            
            @if (project.details) {
            <div class="project-info">
              <!-- <div class="info-item">
                <div class="info-label">Target Amount</div>
                <div class="info-value">
                  {{ project.details.targetAmount }} BTC
                </div>
              </div> -->
              <div class="info-item">
                <div class="info-label">Starts in</div>
                <div class="info-value">
                  {{ project.details.startDate | ago }}
                </div>
              </div>
              <!-- <div class="info-item">
                <div class="info-label">Penalty Days</div>
                <div class="info-value">{{ project.details.penaltyDays }}</div>
              </div> -->
              <!-- <div class="info-item">
                <div class="info-label">Expiry Date</div>
                <div class="info-value">
                  {{ project.details.expiryDate * 1000 | date : 'mediumDate' }}
                </div>
              </div> -->

              <div class="info-item">
                <div class="info-label">Investors</div>
                <div class="info-value">
                  {{ project.stats?.investorCount }}
                </div>
              </div>

            </div>
            <div class="funding-progress">
              <div class="progress-stats">
                <span
                  >{{
                    project.stats?.amountInvested
                      ? project.stats!.amountInvested / 100000000
                      : '0'
                  }} / {{ project.details.targetAmount}}
                  BTC raised</span
                >
                <span class="funding-percentage"
                  >{{ getFundingPercentage(project) }}%</span
                >
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  [style.width]="getFundingPercentage(project) + '%'"
                ></div>
              </div>
            </div>
            }
          </div>
        </a>
        }
      </section>

      @if (!indexer.isComplete()) { @if (indexer.loading()) {
      <div class="loading-spinner">
        <div class="spinner"></div>
      </div>
      } @else {
      <div class="load-more">
        <button class="primary-button" (click)="loadMore()">
          Load More Projects
        </button>
      </div>
      }

      <!-- Move trigger after the button -->
      <div #scrollTrigger class="scroll-trigger"></div>
      } }
    </div>
  `,
})
export class ExploreComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scrollTrigger') scrollTrigger!: ElementRef;
  private observer: IntersectionObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private loadingTimeout: any = null;
  private exploreState = inject(ExploreStateService);
  private router = inject(Router);
  private relay = inject(RelayService);
  private location = inject(Location);
  private navigationSubscription: any;
  private routerSubscription: any;
  private isBackNavigation = false;
  private projectObserver: IntersectionObserver | null = null;
  private isLoadingMore = false;
  private loadMoreQueued = false;

  indexer = inject(IndexerService);

  constructor() {
    // Optional: Subscribe to project updates if you need to trigger any UI updates
    effect(() => {
      const projects = this.indexer.projects();
      // Handle any side effects when projects update
      // console.log('Projects updated:', projects.length);
    });

    // Listen for profile updates
    this.relay.profileUpdates.subscribe((update) => {
      const id = update.pubkey;

      // Find the project from this.indexer.projects() that has the ID.
      const project = this.indexer
        .projects()
        .find((p) => p.details?.nostrPubKey === id);

      if (project) {
        project.metadata = update.profile;
      }

      // Update the matching project with new profile data
      this.indexer.projects.update((projects) =>
        projects.map((project) =>
          project.founderKey === update.pubkey
            ? { ...project, metadata: update.profile }
            : project
        )
      );
    });

    // Listen for profile updates
    this.relay.projectUpdates.subscribe((update) => {
      const id = update.projectIdentifier;

      // Find the project from this.indexer.projects() that has the ID.
      const project = this.indexer
        .projects()
        .find((p) => p.projectIdentifier === id);

      if (project) {
        project.details = update;
      }




      // if (project) {
      //   // Update project with latest data
      //   this.indexer.projects.update(projects =>
      //     projects.map(p => p.projectIdentifier === id ? { ...p, metadata: update } : p)
      //   );
      // }

      // console.log('Project update:', update);
      // Update the matching project with new profile data
      // this.indexer.projects.update((projects) =>
      //   projects.map((project) => {
      //     console.log(project);
      //   })
      // );
    });

    // Replace popstate handling with Router events
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.exploreState.hasState) {
          if (this.isBackNavigation) {
            // Browser back/forward navigation
            requestAnimationFrame(() => {
              window.scrollTo({
                top: this.exploreState.lastScrollPosition,
                behavior: 'instant',
              });
            });
          } else {
            // Regular navigation (e.g. clicking Explore link)
            setTimeout(() => {
              window.scrollTo({
                top: this.exploreState.lastScrollPosition,
                behavior: 'instant',
              });
            }, 100);
          }
          this.isBackNavigation = false;
        }
      });

    // Listen for popstate events to detect browser back/forward
    window.addEventListener('popstate', () => {
      this.isBackNavigation = true;
    });
  }

  async ngOnInit() {
    this.watchForScrollTrigger();
    this.setupProjectObserver();

    if (this.exploreState.hasState && this.indexer.projects().length > 0) {
      this.indexer.restoreOffset(this.exploreState.offset);
      this.observeProjects(); // Add this to observe initial projects
    } else {
      this.exploreState.clearState();
      await this.indexer.fetchProjects();
      this.observeProjects(); // Add this to observe initial projects
    }
  }

  @HostListener('window:scroll', ['$event'])
  onScroll() {
    // Debounce scroll events to avoid excessive updates
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }

    this.loadingTimeout = setTimeout(() => {
      // Use documentElement.scrollTop for more accurate position
      const scrollPosition = Math.max(
        window.pageYOffset,
        document.documentElement.scrollTop,
        document.body.scrollTop
      );

      this.exploreState.saveState(
        scrollPosition,
        this.indexer.getCurrentOffset()
      );
    }, 50);
  }

  ngAfterViewInit() {
    // Watch for DOM changes to detect when scroll trigger is added
    this.watchForScrollTrigger();
    this.observeProjects();
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    // Optionally clear state when navigating away
    // this.exploreState.clearState();

    // Don't clear state on normal navigation
    // but do clear if we have no projects
    if (this.indexer.projects().length === 0) {
      this.exploreState.clearState();
    }
    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
    }
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    window.removeEventListener('popstate', () => {});
    if (this.projectObserver) {
      this.projectObserver.disconnect();
    }
    this.isLoadingMore = false;
    this.loadMoreQueued = false;
  }

  private watchForScrollTrigger() {
    this.mutationObserver = new MutationObserver(() => {
      const triggerElement = document.querySelector('.scroll-trigger');
      if (triggerElement) {
        this.mutationObserver?.disconnect();
        this.setupIntersectionObserver();
      }
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private setupIntersectionObserver() {
    if (!this.scrollTrigger) {
      console.warn('ViewChild scroll trigger not initialized');
      return;
    }

    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1,
    };

    // Cleanup existing observer if any
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        // console.log('Intersection entry:', {
        //   isIntersecting: entry.isIntersecting,
        //   intersectionRatio: entry.intersectionRatio,
        //   boundingClientRect: entry.boundingClientRect,
        //   isLoading: this.indexer.loading(),
        //   isComplete: this.indexer.isComplete(),
        // });

        if (entry.isIntersecting) {
          if (this.indexer.loading()) {
            console.log('Skipping load - already loading');
            return;
          }
          if (this.indexer.isComplete()) {
            console.log('Skipping load - all projects loaded');
            return;
          }
          console.log('Triggering load more from intersection');
          this.loadMore();
        }
      });
    }, options);

    this.observer.observe(this.scrollTrigger.nativeElement);
  }

  private setupProjectObserver() {
    this.projectObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const projectId = entry.target.getAttribute('data-index');
            if (projectId !== null) {
              const project = this.indexer.projects()[parseInt(projectId)];
              if (project && !project.stats) {
                this.loadProjectStats(project);
              }
            }
          }
        });
      },
      { threshold: 0.1 }
    );
  }

  private observeProjects() {
    // Wait for Angular to finish rendering
    setTimeout(() => {
      document.querySelectorAll('.project-card').forEach((card) => {
        if (!this.projectObserver) return;
        // Only observe cards that haven't been observed yet
        if (!card.getAttribute('data-observed')) {
          this.projectObserver.observe(card);
          card.setAttribute('data-observed', 'true');
        }
      });
    }, 100); // Give Angular time to render
  }

  private async loadProjectStats(project: any) {
    try {
      project.stats = await this.indexer.fetchProjectStats(
        project.projectIdentifier
      );
    } catch (error) {
      console.error('Error loading project stats:', error);
    }
  }

  getFundingPercentage(project: any): number {
    if (!project.stats?.amountInvested || !project.details?.targetAmount) {
      return 0;
    }

    let invested = project.stats.amountInvested;
    let target = project.details.targetAmount * 100000000;
    const percentage = (invested / target) * 100;

    return Math.min(Math.round(percentage * 10) / 10, 999.9); // Cap at 999.9% and round to 1 decimal
  }

  async loadMore() {
    // console.log('LoadMore called:', {
    //   isLoading: this.indexer.loading(),
    //   isComplete: this.indexer.isComplete(),
    //   currentProjectCount: this.indexer.projects().length,
    //   isLoadingMore: this.isLoadingMore,
    //   loadMoreQueued: this.loadMoreQueued
    // });

    // If already loading, queue up one more request
    if (this.isLoadingMore) {
      this.loadMoreQueued = true;
      console.log('Load more queued');
      return;
    }

    if (!this.indexer.loading() && !this.indexer.isComplete()) {
      try {
        this.isLoadingMore = true;
        console.log('Executing load more');
        await this.indexer.loadMore();
        // Observe new projects after they're loaded
        this.observeProjects();
        console.log('Load more completed, new project count:', this.indexer.projects().length);
      } finally {
        this.isLoadingMore = false;
        
        // If there's a queued request, process it
        if (this.loadMoreQueued) {
          this.loadMoreQueued = false;
          console.log('Processing queued load more request');
          await this.loadMore();
        }
      }
    }
  }
}
