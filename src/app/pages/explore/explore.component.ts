import { Component, inject, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnInit, HostListener, effect } from '@angular/core';
import { RelayService } from '../../services/relay.service';
import { IndexerService } from '../../services/indexer.service';
import { RouterLink } from '@angular/router';
import { ExploreStateService } from '../../services/explore-state.service';
import { Router, NavigationEnd } from '@angular/router';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AgoPipe } from '../../pipes/ago.pipe';
import { NetworkService } from '../../services/network.service';
import { UtilsService } from '../../services/utils.service';
import { BitcoinUtilsService } from '../../services/bitcoin.service';
import { TitleService } from '../../services/title.service';

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [RouterLink, BreadcrumbComponent, CommonModule, AgoPipe],
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.scss',
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

  public indexer = inject(IndexerService);
  public networkService = inject(NetworkService);
  public utils = inject(UtilsService);
  public bitcoin = inject(BitcoinUtilsService);
  public title = inject(TitleService);

  constructor() {
    // Optional: Subscribe to project updates if you need to trigger any UI updates
    effect(() => {
      const projects = this.indexer.projects();
      // Handle any side effects when projects update
      // console.log('Projects updated:', projects.length);
    });

    // Listen for project updates with timestamp check
    this.relay.projectUpdates.subscribe((event) => {
      const update = JSON.parse(event.content);
      const id = update.projectIdentifier;
      const project = this.indexer.projects().find((p) => p.projectIdentifier === id);

      if (project) {
        // Only update if new data is newer or we don't have existing details
        if (!project.details || event.created_at! > project.details_created_at!) {
          project.details = update;
          project.details_created_at = event.created_at;
        }
      }
    });

    // Listen for profile updates with timestamp check
    this.relay.profileUpdates.subscribe((event) => {
      if (!event) {
        return;
      }

      const update = JSON.parse(event.content);
      const id = event.pubkey;

      const project = this.indexer.projects().find((p) => p.details?.nostrPubKey === id);

      if (project) {
        // Only update if new data is newer or we don't have existing metadata
        if (!project.metadata || event.created_at! > (project.metadata_created_at || 0)) {
          project.metadata = update;
          project.metadata_created_at = event.created_at;

          project.externalIdentities = this.utils.getExternalIdentities(event);
          project.externalIdentities_created_at = event.created_at;
        }
      }
    });

    // Replace popstate handling with Router events
    this.routerSubscription = this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
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

  favorites: string[] = [];

  async ngOnInit() {
    this.title.setTitle('Explore');

    this.favorites = JSON.parse(localStorage.getItem('angor-hub-favorites') || '[]');

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
      const scrollPosition = Math.max(window.pageYOffset, document.documentElement.scrollTop, document.body.scrollTop);

      this.exploreState.saveState(scrollPosition, this.indexer.getCurrentOffset());
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

  isFavorite(projectId: string) {
    return this.favorites.includes(projectId);
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
      project.stats = await this.indexer.fetchProjectStats(project.projectIdentifier);
    } catch (error) {
      console.error('Error loading project stats:', error);
    }
  }

  getFundingPercentage(project: any): number {
    if (!project.stats?.amountInvested || !project.details?.targetAmount) {
      return 0;
    }

    let invested = project.stats.amountInvested; //  / 100000000;
    let target = project.details.targetAmount; //  / 100000000;

    const percentage = (invested / target) * 100;

    return Math.min(Math.round(percentage * 10) / 10, 999.9); // Cap at 999.9% and round to 1 decimal
  }

  isProjectNotStarted(date: number | undefined): boolean {
    if (!date) return true;
    return Date.now() < date * 1000;
  }
  
  isProjectEnded(date: number | undefined): boolean {
    if (!date) return false;
    return Date.now() > date * 1000;
  }
  
  isProjectSuccessfullyFunded(project: any): boolean {
    if (!project.stats?.amountInvested || !project.details?.targetAmount) {
      return false;
    }
    
    return project.stats.amountInvested >= project.details.targetAmount;
  }
  
  getProjectStatus(project: any): { status: string; color: string; icon: string } {
    if (!project.details?.startDate) {
      return { status: 'Unknown', color: 'text-gray-500', icon: 'question-mark' };
    }
    
    if (this.isProjectNotStarted(project.details.startDate)) {
      return { status: 'Not Started', color: 'text-blue-500', icon: 'hourglass' };
    }
    
    if (this.isProjectEnded(project.details.startDate)) {
      if (this.isProjectSuccessfullyFunded(project)) {
        return { status: 'Funded', color: 'text-green-500', icon: 'check-circle' };
      } else {
        return { status: 'Failed', color: 'text-red-500', icon: 'x-circle' };
      }
    }
    
    return { status: 'In Progress', color: 'text-yellow-500', icon: 'arrow-right' };
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

  async retryLoadProjects() {
    await this.indexer.fetchProjects();
    this.observeProjects();
  }
}
