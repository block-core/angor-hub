import { Component, inject, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnInit, HostListener, effect, signal, computed, Signal } from '@angular/core';
import { RelayService } from '../../services/relay.service';
import { IndexedProject, IndexerService } from '../../services/indexer.service';
import { NetworkService } from '../../services/network.service';
import { BitcoinUtilsService } from '../../services/bitcoin.service';
import { UtilsService } from '../../services/utils.service';
import { TitleService } from '../../services/title.service';
import { DenyService } from '../../services/deny.service';
import { RouterLink } from '@angular/router';
import { ExploreStateService } from '../../services/explore-state.service';
import { Router, NavigationEnd } from '@angular/router';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Location } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AgoPipe } from '../../pipes/ago.pipe';
import { formatDate } from '@angular/common'; // Import formatDate
import { TitleCasePipe } from '@angular/common'; // Import TitleCasePipe if used in template

// Define type for sort options
type SortType = 'default' | 'funding' | 'endDate' | 'investors';
type FilterType = 'all' | 'active' | 'upcoming' | 'completed';

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [RouterLink, BreadcrumbComponent, CommonModule, AgoPipe, TitleCasePipe], // Add TitleCasePipe
  templateUrl: './explore.component.html',
})
export class ExploreComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scrollTrigger') scrollTrigger!: ElementRef;
  @ViewChild('filterBtn') filterBtn!: ElementRef;
  @ViewChild('sortBtn') sortBtn!: ElementRef;

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
  private document = inject(DOCUMENT);

  public indexer = inject(IndexerService);
  public networkService = inject(NetworkService);
  public bitcoin = inject(BitcoinUtilsService);
  private utils = inject(UtilsService);
  private title = inject(TitleService);
  private denyService = inject(DenyService);

  // Adding signals for search, filter, and sort functionality
  searchTerm = signal<string>('');
  activeFilter = signal<FilterType>('all');
  activeSort = signal<SortType>('default');
  
  // Add a signal to track failed image loads
  failedBannerImages = signal<Set<string>>(new Set<string>());
  failedProfileImages = signal<Set<string>>(new Set<string>());

  // Computed signal for filtered and sorted projects
  filteredProjects: Signal<any[]> = computed(() => {
    const projects = this.indexer.projects();
    const search = this.searchTerm().toLowerCase().trim();
    const filter = this.activeFilter();
    const sort = this.activeSort();
    
    // First apply filtering
    let filtered = projects.filter(project => {
      // Apply search filter
      if (search) {
        const name = (project.metadata?.['name'] || '').toLowerCase();
        const about = (project.metadata?.['about'] || '').toLowerCase();
        const identifier = project.projectIdentifier.toLowerCase();
        
        if (!name.includes(search) && 
            !about.includes(search) && 
            !identifier.includes(search)) {
          return false;
        }
      }
      
      // Apply status filter
      if (filter === 'all') {
        return true;
      } else if (filter === 'active') {
        return !this.isProjectNotStarted(project.details?.startDate) && 
               !this.isProjectEnded(project.details?.expiryDate);
      } else if (filter === 'upcoming') {
        return this.isProjectNotStarted(project.details?.startDate);
      } else if (filter === 'completed') {
        return this.isProjectEnded(project.details?.expiryDate);
      }
      
      return true;
    });
    
    // Then apply sorting
    if (sort === 'funding') {
      filtered = [...filtered].sort((a, b) => {
        const percentA = this.getFundingPercentage(a);
        const percentB = this.getFundingPercentage(b);
        return percentB - percentA; // Sort by funding percentage (descending)
      });
    } else if (sort === 'endDate') {
      filtered = [...filtered].sort((a, b) => {
        const dateA = a.details?.expiryDate || 0;
        const dateB = b.details?.expiryDate || 0;
        return dateA - dateB; // Sort by end date (ascending)
      });
    } else if (sort === 'investors') {
      filtered = [...filtered].sort((a, b) => {
        const countA = a.stats?.investorCount || 0;
        const countB = b.stats?.investorCount || 0;
        return countB - countA; // Sort by investor count (descending)
      });
    }
    
    return filtered;
  });

  // UI state for dropdowns
  showFilterDropdown = false;
  showSortDropdown = false;
  showMobileFilters = false;

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

    // Add effect to log when filter/sort changes
    effect(() => {
      console.log(`Filter/Sort changed - Filter: ${this.activeFilter()}, Sort: ${this.activeSort()}, Search: ${this.searchTerm()}`);
      console.log(`Filtered projects count: ${this.filteredProjects().length}`);
    });
  }

  // Add formatDate method
  formatDate(unixTimestamp: number | undefined): string {
    if (!unixTimestamp) {
      return 'N/A';
    }
    // Multiply by 1000 to convert seconds to milliseconds
    return formatDate(unixTimestamp * 1000, 'mediumDate', 'en-US');
  }

  favorites: string[] = [];
  async loadMoreProjects() {
    await this.indexer.loadMore();
  }

  trackByProjectIdentifier(index: number, project: any): string {
    return project.projectIdentifier;
  }
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

  @HostListener('window:resize')
  onResize() {}

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

    // Remove any event listeners
    this.document.removeEventListener('click', this.closeFilterDropdown);
    this.document.removeEventListener('click', this.closeSortDropdown);
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

    let invested = project.stats.amountInvested;
    let target = project.details.targetAmount;

    const percentage = (invested / target) * 100;
    
    // Always return at least 0.1% if there's any investment (for visibility)
    if (percentage > 0 && percentage < 0.1) {
      return 0.1;
    }

    // Return with one decimal place
    return Math.min(Math.round(percentage * 10) / 10, 999.9);
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
    // Success is defined as reaching the target amount.
    const amountInvested = project.stats?.amountInvested ?? 0;
    const targetAmount = project.details?.targetAmount ?? 0;
    
    // Avoid division by zero or considering success if target is 0
    if (targetAmount === 0) return false; 
    
    return amountInvested >= targetAmount;
  }

  /**
   * Calculates the remaining time until the expiry date and returns a human-readable string.
   * Returns 'Ending soon' if the date is invalid or very close.
   */
  getRemainingTimeText(expiryDate: number | undefined): string {
    if (!expiryDate) return 'Ending soon';
    
    const now = Date.now();
    const expiryMillis = expiryDate * 1000;
    const diffMillis = expiryMillis - now;

    if (diffMillis <= 0) {
      return 'Ended'; // Should ideally be handled by isProjectEnded, but good fallback
    }

    const diffSeconds = Math.floor(diffMillis / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30); // Approximate months

    if (diffDays < 1) {
      if (diffHours > 1) {
        return `Ends in ${diffHours} hours`;
      } else if (diffHours === 1) {
        return `Ends in 1 hour`;
      } else if (diffMinutes > 1) {
         return `Ends in ${diffMinutes} minutes`;
      } else {
        return 'Ending soon';
      }
    } else if (diffDays === 1) {
      return '1 day remaining';
    } else if (diffDays < 7) {
      return `${diffDays} days remaining`;
    } else if (diffWeeks === 1) {
      return 'About a week remaining';
    } else if (diffWeeks < 4) {
      return `About ${diffWeeks} weeks remaining`;
    } else if (diffMonths === 1) {
      return 'About a month remaining';
    } else if (diffMonths < 12) {
      return `About ${diffMonths} months remaining`;
    } else {
      const diffYears = Math.floor(diffMonths / 12);
      return diffYears === 1 ? 'About a year remaining' : `About ${diffYears} years remaining`;
    }
  }
  
  getProjectStatus(project: any): { status: string; color: string; icon: string; class: string } {
    const startDate = project.details?.startDate;
    const expiryDate = project.details?.expiryDate;
    
    if (!startDate) {
      // If no start date, treat as upcoming or unknown
      return { status: 'Upcoming', color: 'text-blue-500', icon: 'schedule', class: 'upcoming' };
    }
    
    if (this.isProjectNotStarted(startDate)) {
      return { status: 'Upcoming', color: 'text-blue-500', icon: 'schedule', class: 'upcoming' };
    }
    
    // Check for success first, as it can happen before the end date
    if (this.isProjectSuccessfullyFunded(project)) {
      return { status: 'Funded', color: 'text-green-500', icon: 'check_circle', class: 'funded' };
    }
    
    // If not yet successful, check if it has ended
    if (this.isProjectEnded(expiryDate)) {
      // If ended and not successful, it failed
      return { status: 'Failed', color: 'text-red-500', icon: 'cancel', class: 'failed' };
    }
    
    // If started, not ended, and not yet successful, it's active
    return { status: 'Active', color: 'text-yellow-500', icon: 'trending_up', class: 'active' };
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
        this.observeProjects();
        console.log('Load more completed, new project count:', this.indexer.projects().length);
      } finally {
        this.isLoadingMore = false;

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

  setFilter(filter: FilterType): void {
    this.activeFilter.set(filter);
    this.showFilterDropdown = false;
  }

  setSort(sort: SortType): void {
    this.activeSort.set(sort);
    this.showSortDropdown = false;
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.activeFilter.set('all');
    this.activeSort.set('default');
    this.showFilterDropdown = false;
    this.showSortDropdown = false;
    this.showMobileFilters = false;
  }

  toggleFilterDropdown(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Close sort dropdown if open
    this.showSortDropdown = false;
    
    // Toggle filter dropdown
    this.showFilterDropdown = !this.showFilterDropdown;
    
    if (this.showFilterDropdown) {
      // Add click outside listener to close
      setTimeout(() => {
        this.document.addEventListener('click', this.closeFilterDropdown);
      }, 10);
    } else {
      // Remove the listener when closing
      this.document.removeEventListener('click', this.closeFilterDropdown);
    }
  }

  toggleSortDropdown(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Close filter dropdown if open
    this.showFilterDropdown = false;
    
    // Toggle sort dropdown
    this.showSortDropdown = !this.showSortDropdown;
    
    if (this.showSortDropdown) {
      // Add click outside listener to close
      setTimeout(() => {
        this.document.addEventListener('click', this.closeSortDropdown);
      }, 10);
    } else {
      // Remove the listener when closing
      this.document.removeEventListener('click', this.closeSortDropdown);
    }
  }

  // Add methods to close dropdowns when clicking outside
  closeFilterDropdown = () => {
    this.showFilterDropdown = false;
    this.document.removeEventListener('click', this.closeFilterDropdown);
  };

  closeSortDropdown = () => {
    this.showSortDropdown = false;
    this.document.removeEventListener('click', this.closeSortDropdown);
  };

  toggleMobileFilters(): void {
    this.showMobileFilters = !this.showMobileFilters;
  }

  onClickOutside(dropdownType: 'filter' | 'sort'): void {
    if (dropdownType === 'filter') {
      this.showFilterDropdown = false;
    } else {
      this.showSortDropdown = false;
    }
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  // Generate a random color based on project identifier using Angor brand colors
  getRandomColor(seed: string): string {
    let hash = 0;
    if (!seed) return '#cbdde1'; // Default color if seed is undefined

    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Angor Brand Colors
    const colors = [
      '#022229', // Very Dark Teal
      '#086c81', // Dark Cyan
      '#b8c9cd'  // Slightly darker Light Steel Green
    ];
    
    // Use the hash to pick a color from the array
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  // Get an initial letter for placeholder
  getInitial(name: string | undefined | null): string {
    if (!name || name.trim() === '') {
      return '#';
    }
    return name.trim()[0].toUpperCase();
  }

  // Get background style for banner with fallback color
  getBannerStyle(project: IndexedProject): string {
    return this.getRandomColor(project.projectIdentifier);
  }

  // Handle banner image load error
  handleBannerError(projectId: string): void {
    const failedImages = this.failedBannerImages();
    failedImages.add(projectId);
    this.failedBannerImages.set(new Set(failedImages));
  }
  
  // Handle profile image load error
  handleProfileError(projectId: string): void {
    const failedImages = this.failedProfileImages();
    failedImages.add(projectId);
    this.failedProfileImages.set(new Set(failedImages));
  }
  
  // Check if banner image failed
  hasBannerFailed(projectId: string): boolean {
    return this.failedBannerImages().has(projectId);
  }
  
  // Check if profile image failed
  hasProfileFailed(projectId: string): boolean {
    return this.failedProfileImages().has(projectId);
  }

  // Use this to determine if we should show banner image or fallback
  shouldShowBannerImage(project: any): boolean {
    return !!project.metadata?.['banner'] && !this.hasBannerFailed(project.projectIdentifier);
  }
  
  // Use this to determine if we should show profile image or fallback
  shouldShowProfileImage(project: any): boolean {
    return !!project.metadata?.['picture'] && !this.hasProfileFailed(project.projectIdentifier);
  }
}
