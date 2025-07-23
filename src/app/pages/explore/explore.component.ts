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
import { IndexerErrorComponent } from '../../components/indexer-error.component';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Location } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AgoPipe } from '../../pipes/ago.pipe';
import { formatDate } from '@angular/common';
import { TitleCasePipe } from '@angular/common';


type SortType = 'default' | 'funding' | 'endDate' | 'investors';
type FilterType = 'all' | 'active' | 'upcoming' | 'completed';

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [RouterLink, BreadcrumbComponent, IndexerErrorComponent, CommonModule, AgoPipe, TitleCasePipe],
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

  
  searchTerm = signal<string>('');
  activeFilter = signal<FilterType>('all');
  activeSort = signal<SortType>('default');

  
  filterOptions: FilterType[] = ['all', 'active', 'upcoming', 'completed'];
  sortOptions: SortType[] = ['default', 'funding', 'endDate', 'investors'];

  
  failedBannerImages = signal<Set<string>>(new Set<string>());
  failedProfileImages = signal<Set<string>>(new Set<string>());

  
  filteredProjects: Signal<any[]> = computed(() => {
    const projects = this.indexer.projects();
    const search = this.searchTerm().toLowerCase().trim();
    const filter = this.activeFilter();
    const sort = this.activeSort();

    
    let filtered = projects.filter(project => {
      
      if (search) {
        const name = (project.metadata?.['name'] || '').toLowerCase();
        const about = (project.metadata?.['about'] || '').toLowerCase();
        const identifier = project.projectIdentifier.toLowerCase();
        if (!name.includes(search) && !about.includes(search) && !identifier.includes(search)) {
          return false;
        }
      }

      
      if (filter === 'all') {
        return true;
      } else if (filter === 'active') {
        return !this.isProjectNotStarted(project.details?.startDate) && !this.isProjectEnded(project.details?.expiryDate);
      } else if (filter === 'upcoming') {
        return this.isProjectNotStarted(project.details?.startDate);
      } else if (filter === 'completed') {
        return this.isProjectEnded(project.details?.expiryDate);
      }

      return true;
    });

    
    if (sort === 'funding') {
      filtered = [...filtered].sort((a, b) => {
        const percentA = this.getFundingPercentage(a);
        const percentB = this.getFundingPercentage(b);
        return percentB - percentA; 
      });
    } else if (sort === 'endDate') {
      filtered = [...filtered].sort((a, b) => {
        const dateA = a.details?.expiryDate || 0;
        const dateB = b.details?.expiryDate || 0;
        return dateA - dateB; 
      });
    } else if (sort === 'investors') {
      filtered = [...filtered].sort((a, b) => {
        const countA = a.stats?.investorCount || 0;
        const countB = b.stats?.investorCount || 0;
        return countB - countA; 
      });
    }

    return filtered;
  });

  
  showFilterDropdown = false;
  showSortDropdown = false;
  showMobileFilters = false;

  constructor() {
    effect(() => {
      const projects = this.indexer.projects();
      
    });

    
    this.relay.projectUpdates.subscribe((event) => {
      const update = JSON.parse(event.content);
      const id = update.projectIdentifier;
      const project = this.indexer.projects().find((p) => p.projectIdentifier === id);

      if (project) {
        if (!project.details || event.created_at! > project.details_created_at!) {
          project.details = update;
          project.details_created_at = event.created_at;
        }
      }
    });

    
    this.relay.profileUpdates.subscribe((event) => {
      if (!event) return;
      const update = JSON.parse(event.content);
      const id = event.pubkey;
      const project = this.indexer.projects().find((p) => p.details?.nostrPubKey === id);

      if (project) {
        if (!project.metadata || event.created_at! > (project.metadata_created_at || 0)) {
          project.metadata = update;
          project.metadata_created_at = event.created_at;
          project.externalIdentities = this.utils.getExternalIdentities(event);
          project.externalIdentities_created_at = event.created_at;
        }
      }
    });

    
    this.routerSubscription = this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      if (this.exploreState.hasState) {
        if (this.isBackNavigation) {
          requestAnimationFrame(() => {
            window.scrollTo({ top: this.exploreState.lastScrollPosition, behavior: 'instant' });
          });
        } else {
          setTimeout(() => {
            window.scrollTo({ top: this.exploreState.lastScrollPosition, behavior: 'instant' });
          }, 100);
        }
        this.isBackNavigation = false;
      }
    });

    window.addEventListener('popstate', () => {
      this.isBackNavigation = true;
    });

    effect(() => {
      console.log(`Filter/Sort changed - Filter: ${this.activeFilter()}, Sort: ${this.activeSort()}, Search: ${this.searchTerm()}`);
      console.log(`Filtered projects count: ${this.filteredProjects().length}`);
    });
  }

  formatDate(unixTimestamp: number | undefined): string {
    if (!unixTimestamp) return 'N/A';
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
      this.observeProjects();
    } else {
      this.exploreState.clearState();
      await this.indexer.fetchProjects();
      this.observeProjects();
    }
  }

  @HostListener('window:scroll', ['$event'])
  onScroll() {
    if (this.loadingTimeout) clearTimeout(this.loadingTimeout);
    this.loadingTimeout = setTimeout(() => {
      const scrollPosition = Math.max(window.pageYOffset, document.documentElement.scrollTop, document.body.scrollTop);
      this.exploreState.saveState(scrollPosition, this.indexer.getCurrentOffset());
    }, 50);
  }

  @HostListener('window:resize')
  onResize() {}

  ngAfterViewInit() {
    this.watchForScrollTrigger();
    this.observeProjects();
  }

  ngOnDestroy() {
    if (this.observer) this.observer.disconnect();
    if (this.mutationObserver) this.mutationObserver.disconnect();
    if (this.loadingTimeout) clearTimeout(this.loadingTimeout);
    if (this.indexer.projects().length === 0) this.exploreState.clearState();
    if (this.navigationSubscription) this.navigationSubscription.unsubscribe();
    if (this.routerSubscription) this.routerSubscription.unsubscribe();
    window.removeEventListener('popstate', () => {});
    if (this.projectObserver) this.projectObserver.disconnect();
    this.isLoadingMore = false;
    this.loadMoreQueued = false;
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
    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  private setupIntersectionObserver() {
    if (!this.scrollTrigger) {
      console.warn('ViewChild scroll trigger not initialized');
      return;
    }
    const options = { root: null, rootMargin: '100px', threshold: 0.1 };
    if (this.observer) this.observer.disconnect();
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !this.indexer.loading() && !this.indexer.isComplete()) {
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
              if (project && !project.stats) this.loadProjectStats(project);
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
    setTimeout(() => {
      document.querySelectorAll('.project-card').forEach((card) => {
        if (!this.projectObserver) return;
        if (!card.getAttribute('data-observed')) {
          this.projectObserver.observe(card);
          card.setAttribute('data-observed', 'true');
        }
      });
    }, 100);
  }

  private async loadProjectStats(project: any) {
    try {
      project.stats = await this.indexer.fetchProjectStats(project.projectIdentifier);
    } catch (error) {
      console.error('Error loading project stats:', error);
    }
  }

  getFundingPercentage(project: any): number {
    if (!project.stats || 
        project.stats.amountInvested === undefined || 
        !project.details || 
        project.details.targetAmount === undefined || 
        project.details.targetAmount === 0) {
      return 0;
    }
    
    const invested = Number(project.stats.amountInvested);
    const target = Number(project.details.targetAmount);
    
    if (isNaN(invested) || isNaN(target) || target === 0) return 0;
    
    const percentage = (invested / target) * 100;
    if (percentage > 0 && percentage < 0.1) return 0.1;
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
    const amountInvested = project.stats?.amountInvested ?? 0;
    const targetAmount = project.details?.targetAmount ?? 0;
    if (targetAmount === 0) return false;
    return amountInvested >= targetAmount;
  } 
  
  getRemainingTimeText(endDate: number | undefined): string {
    if (!endDate) return 'period not specified';
    
    const now = Date.now();
    const endMillis = endDate * 1000;
    const diffMillis = endMillis - now;
    
    if (diffMillis <= 0) {
      return 'period has ended';
    }
    
    const diffDays = Math.ceil(diffMillis / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'ends today';
    } else if (diffDays === 1) {
      return 'ends in 1 day';
    } else {
      return `ends in ${diffDays} days`;
    }
  }

  getProjectStatus(project: any): { status: string; color: string; icon: string; class: string } {
    const startDate = project.details?.startDate;
    const expiryDate = project.details?.expiryDate;
    if (!startDate) return { status: 'Upcoming', color: 'text-blue-500', icon: 'schedule', class: 'upcoming' };
    if (this.isProjectNotStarted(startDate)) return { status: 'Upcoming', color: 'text-blue-500', icon: 'schedule', class: 'upcoming' };
    if (this.isProjectSuccessfullyFunded(project)) return { status: 'Funded', color: 'text-green-500', icon: 'check_circle', class: 'funded' };
    if (this.isProjectEnded(expiryDate)) return { status: 'Failed', color: 'text-red-500', icon: 'cancel', class: 'failed' };
    return { status: 'Active', color: 'text-yellow-500', icon: 'trending_up', class: 'active' };
  }

  async loadMore() {
    if (this.isLoadingMore) {
      this.loadMoreQueued = true;
      return;
    }
    if (!this.indexer.loading() && !this.indexer.isComplete()) {
      try {
        this.isLoadingMore = true;
        await this.indexer.loadMore();
        this.observeProjects();
      } finally {
        this.isLoadingMore = false;
        if (this.loadMoreQueued) {
          this.loadMoreQueued = false;
          this.loadMore();
        }
      }
    }
  }

  async retryLoadProjects() {
    this.indexer.error.set(null);
    await this.indexer.fetchProjects(true);
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
    this.showSortDropdown = false;
    this.showFilterDropdown = !this.showFilterDropdown;
    if (this.showFilterDropdown) {
      setTimeout(() => this.document.addEventListener('click', this.closeFilterDropdown), 10);
    } else {
      this.document.removeEventListener('click', this.closeFilterDropdown);
    }
  }

  toggleSortDropdown(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.showFilterDropdown = false;
    this.showSortDropdown = !this.showSortDropdown;
    if (this.showSortDropdown) {
      setTimeout(() => this.document.addEventListener('click', this.closeSortDropdown), 10);
    } else {
      this.document.removeEventListener('click', this.closeSortDropdown);
    }
  }

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
    if (dropdownType === 'filter') this.showFilterDropdown = false;
    else this.showSortDropdown = false;
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  getRandomColor(seed: string): string {
    let hash = 0;
    if (!seed) return '#cbdde1';
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#022229', '#086c81', '#b8c9cd'];
    return colors[Math.abs(hash) % colors.length];
  }

  getInitial(name: string | undefined | null): string {
    if (!name || name.trim() === '') return '#';
    return name.trim()[0].toUpperCase();
  }

  getBannerStyle(project: IndexedProject): string {
    return this.getRandomColor(project.projectIdentifier);
  }

  handleBannerError(projectId: string): void {
    const failedImages = this.failedBannerImages();
    failedImages.add(projectId);
    this.failedBannerImages.set(new Set(failedImages));
  }

  handleProfileError(projectId: string): void {
    const failedImages = this.failedProfileImages();
    failedImages.add(projectId);
    this.failedProfileImages.set(new Set(failedImages));
  }

  hasBannerFailed(projectId: string): boolean {
    return this.failedBannerImages().has(projectId);
  }

  hasProfileFailed(projectId: string): boolean {
    return this.failedProfileImages().has(projectId);
  }

  shouldShowBannerImage(project: any): boolean {
    return !!project.metadata?.['banner'] && !this.hasBannerFailed(project.projectIdentifier);
  }

  shouldShowProfileImage(project: any): boolean {
    return !!project.metadata?.['picture'] && !this.hasProfileFailed(project.projectIdentifier);
  }
}