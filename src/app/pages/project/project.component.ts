import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  IndexedProject,
  ProjectStats,
  IndexerService,
} from '../../services/indexer.service';
import { CommonModule } from '@angular/common';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import { IndexerErrorComponent } from '../../components/indexer-error.component';
import {
  ProjectUpdate,
  RelayService,
} from '../../services/relay.service';
import {
  NDKEvent,
  NDKKind,
  NDKUser,
  NDKUserProfile,
} from '@nostr-dev-kit/ndk';
import { AgoPipe } from '../../pipes/ago.pipe';
import { ImagePopupComponent } from '../../components/image-popup.component';
import { NetworkService } from '../../services/network.service';
import { ExternalIdentity, FaqItem } from '../../models/models';
import { UtilsService } from '../../services/utils.service';
import { ProfileComponent } from '../../components/profile.component';
import { BitcoinUtilsService } from '../../services/bitcoin.service';
import { TitleService } from '../../services/title.service';
import { MarkdownModule } from 'ngx-markdown';
import { SafeContentPipe } from '../../pipes/safe-content.pipe';
import { SafePipe } from '../../pipes/safe.pipe';  // Add the SafePipe import
import { DenyService } from '../../services/deny.service';
import { AboutContentComponent } from '../../components/about-content.component';
import { ShareModalComponent, ShareData } from '../../components/share-modal.component';
import { nip19 } from 'nostr-tools';
import { NostrListService } from '../../services/nostr-list.service';
import { NostrAuthService } from '../../services/nostr-auth.service';
import { MetaService } from '../../services/meta.service';

@Component({
  selector: 'app-project',
  standalone: true,  
  imports: [
    RouterModule,
    CommonModule,
    BreadcrumbComponent,
    IndexerErrorComponent,
    AgoPipe,
    RouterModule,
    ImagePopupComponent,
    ProfileComponent,
    MarkdownModule,
    ShareModalComponent,
  ],
  templateUrl: './project.component.html',
  styles: [`
    :host ::ng-deep .prose img {
      display: block !important;
      margin-left: auto !important;
      margin-right: auto !important;
      max-width: 100% !important;
      height: auto !important;
      border-radius: 12px !important;
    }
    
    
    :host ::ng-deep .prose figure {
      text-align: center !important;
      margin: 2rem 0 !important;
    }
    
    :host ::ng-deep .prose figcaption {
      text-align: center !important;
      font-style: italic !important;
      color: var(--text-secondary) !important;
      margin-top: 0.5rem !important;
    }
    
    @media (max-width: 640px) {
      :host ::ng-deep .prose img {
        margin: 1.5rem auto !important;
        border-radius: 8px !important;
      }
    }
    
    @media (min-width: 1024px) {
      :host ::ng-deep .prose img {
        max-width: 80% !important;
        margin: 3rem auto !important;
      }
    }
  `],
})
export class ProjectComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  indexer = inject(IndexerService);
  private relay = inject(RelayService);
  private subscriptions: { unsubscribe: () => void }[] = [];
  public networkService = inject(NetworkService);
  public utils = inject(UtilsService);
  public bitcoin = inject(BitcoinUtilsService);
  public title = inject(TitleService);
  private denyService = inject(DenyService);
  private nostrListService = inject(NostrListService);
  public nostrAuth = inject(NostrAuthService);
  private metaService = inject(MetaService);

  constructor() {
    // Update meta tags when project data changes
    effect(() => {
      const project = this.project();
      const shareData = this.shareData();

      if (project && shareData) {
        this.metaService.updateMetaTags({
          title: shareData.title,
          description: shareData.description,
          image: shareData.imageUrl || 'https://hub.angor.io/assets/angor-hub-social.png',
          url: shareData.url,
          type: 'website'
        });
      }
    });
  }

  // Admin controls
  isInDenyList = signal<boolean>(false);
  isInWhitelist = signal<boolean>(false);
  updatingDenyList = signal<boolean>(false);
  updatingWhitelist = signal<boolean>(false);
  adminActionMessage = signal<string>('');
  bannerLoaded = signal<boolean>(false);
  profileLoaded = signal<boolean>(false);

  reloadPage(): void {
    window.location.reload();
  }

  async retryLoadProject(): Promise<void> {
    this.indexer.error.set(null);
    if (this.projectId) {
      const project = await this.indexer.fetchProject(this.projectId);
      if (project) {
        this.project.set(project);
        if (!project.stats) {
          const stats = await this.indexer.fetchProjectStats(this.projectId);
          if (stats) {
            project.stats = stats;
          }
        }
      }
    }
  }

  project = signal<IndexedProject | null>(null);
  projectId = '';
  isDenied = signal<boolean>(false);

  // Add these new signals for badge verification
  memberBadges = signal<Map<string, boolean>>(new Map());
  loadingMemberBadges = signal<boolean>(false);

  tabs = [
    { id: 'project', label: 'Project', icon: 'description' },
    { id: 'faq', label: 'FAQ', icon: 'help_outline' },
    { id: 'updates', label: 'Updates', icon: 'campaign' },
    // { id: 'comments', label: 'Comments', icon: 'chat_bubble_outline' },
  ];
  activeTab = 'project';
  updates = signal<NDKEvent[]>([]);
  comments = signal<NDKEvent[]>([]);
  faqItems = signal<FaqItem[]>([]);

  loadingUpdates = signal<boolean>(false);
  loadingComments = signal<boolean>(false);
  loadingFaq = signal<boolean>(false);
  errorUpdates = signal<string | null>(null);
  errorComments = signal<string | null>(null);
  errorFaq = signal<string | null>(null);

  showImagePopup = false;
  currentSlide = 0;
  selectedImage: string | null = null;
  failedBannerImage = signal<boolean>(false);
  failedProfileImage = signal<boolean>(false);
  failedMediaImages = signal<Set<string>>(new Set<string>());
  failedMediaVideos = signal<Set<string>>(new Set<string>()); // New signal for video errors  
  showShareModal = signal<boolean>(false);

  shareData = computed<ShareData>(() => {
    const project = this.project();
    if (!project) {
      return {
        title: 'Project on Angor',
        description: 'Check out this project on Angor',
        url: `${window.location.origin}/project/${this.projectId}`,
        projectId: this.projectId
      };
    }

    const about = project.metadata?.about;
    let description = 'Check out this project on Angor';
    if (about && about.length > 0) {
      const plainText = about.replace(/[#*_`~[\]()]/g, '').replace(/<[^>]*>/g, '');
      description = plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText;
    } else {
      description = `${project.metadata?.name || project.metadata?.displayName || 'This project'} on Angor`;
    }

    return {
      title: project.metadata?.name || project.metadata?.displayName || 'Project on Angor',
      description: description,
      url: `${window.location.origin}/project/${this.projectId}`,
      imageUrl: project.metadata?.['picture'],
      projectId: this.projectId
    };
  });

  public projectDuration = computed(() => {
    const start = this.project()?.details?.startDate;
    const end = this.project()?.details?.expiryDate;

    if (!start || !end || end <= start) {
      return null;
    }

    const startDate = new Date(start * 1000);
    const endDate = new Date(end * 1000);
    const diffMillis = endDate.getTime() - startDate.getTime();

    const diffDays = Math.floor(diffMillis / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30.44);
    const diffYears = Math.floor(diffDays / 365.25);

    if (diffYears >= 1) {
      const remainingMonths = Math.floor((diffDays % 365.25) / 30.44);
      let durationStr = `${diffYears} year${diffYears > 1 ? 's' : ''}`;
      if (remainingMonths > 0) {
        durationStr += ` ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
      }
      return durationStr;
    } else if (diffMonths >= 1) {
      return `${diffMonths} month${diffMonths > 1 ? 's' : ''}`;
    } else if (diffDays >= 1) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else {
      return 'Less than a day';
    }
  });

  async setActiveTab(tabId: string) {
    this.activeTab = tabId;
    if (tabId === 'updates' && this.updates().length === 0 && !this.loadingUpdates() && !this.errorUpdates()) {
      this.fetchUpdates();
    }
    if (tabId === 'faq' && this.faqItems().length === 0 && !this.loadingFaq() && !this.errorFaq()) {
      this.fetchFaq();
    }

    // Fetch member badges when project tab is active and members exist
    if (tabId === 'project' && this.project()?.members?.length && this.memberBadges().size === 0) {
      await this.fetchMemberBadges();
    }
  }

  async fetchFaq() {
    if (!this.project()?.details?.nostrPubKey) return;

    this.loadingFaq.set(true);
    this.errorFaq.set(null);
    try {
      const ndk = await this.relay.ensureConnected();
      const filter = {
        kinds: [NDKKind.AppSpecificData],
        authors: [this.project()!.details!.nostrPubKey],
        '#d': ['angor:faq'],
        limit: 1,
      };

      const event = await ndk.fetchEvent(filter);

      if (event && event.content) {
        try {
          const parsedFaq = JSON.parse(event.content);
          if (Array.isArray(parsedFaq)) {
            this.faqItems.set(parsedFaq);
          } else {
            console.warn('FAQ content is not an array:', parsedFaq);
            this.faqItems.set([]);
            this.errorFaq.set('Invalid FAQ format received.');
          }
        } catch (parseError) {
          console.error('Error parsing FAQ content:', parseError);
          this.faqItems.set([]);
          this.errorFaq.set('Failed to parse FAQ data.');
        }
      } else {
        this.faqItems.set([]);
      }
    } catch (error) {
      console.error('Error fetching FAQ:', error);
      this.errorFaq.set('Could not load FAQ. Please try again later.');
    } finally {
      this.loadingFaq.set(false);
    }
  }

  async fetchUpdates() {
    if (!this.project()?.details?.nostrPubKey) return;

    this.loadingUpdates.set(true);
    this.errorUpdates.set(null);
    try {
      const ndk = await this.relay.ensureConnected();
      const filter = {
        kinds: [1],
        authors: [this.project()!.details!.nostrPubKey],
        // '#t': ['angor-update'],
        limit: 50,
      };

      const events = await ndk.fetchEvents(filter);

      const sortedEvents = Array.from(events).sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
      this.updates.set(sortedEvents);
    } catch (error) {
      console.error('Error fetching updates:', error);
      this.errorUpdates.set('Could not load updates. Please try again later.');
    } finally {
      this.loadingUpdates.set(false);
    }
  }

  async fetchComments() {
    if (!this.project()?.details?.nostrPubKey) return;

    this.loadingComments.set(true);
    this.errorComments.set(null);
    try {
      const ndk = await this.relay.ensureConnected();

      const filter = {
        kinds: [1],
        '#p': [this.project()!.details!.nostrPubKey],

        limit: 50,
      };

      const events = await ndk.fetchEvents(filter);

      const sortedEvents = Array.from(events).sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
      this.comments.set(sortedEvents);
    } catch (error) {
      console.error('Error fetching comments:', error);
      this.errorComments.set('Could not load comments. Please try again later.');
    } finally {
      this.loadingComments.set(false);
    }
  }


  isFavorite() {
    const favorites = JSON.parse(
      localStorage.getItem('angor-hub-favorites') || '[]'
    );
    return favorites.includes(this.projectId);
  }

  toggleFavorite() {
    const favorites = JSON.parse(
      localStorage.getItem('angor-hub-favorites') || '[]'
    );
    const index = favorites.indexOf(this.projectId);

    if (index === -1) {
      favorites.push(this.projectId);
    } else {
      favorites.splice(index, 1);
    }

    localStorage.setItem('angor-hub-favorites', JSON.stringify(favorites));
  }

  reportProject() {
    this.router.navigate(['/report', this.projectId]);
  }

  user: NDKUser | undefined;

  profileEvent?: NDKEvent;

  projectEvent?: NDKEvent;

  getDTags(event: NDKEvent): { tag: string }[] {
    if (!event.tags) return [];

    return event.tags
      .filter((tag) => tag[0] === 'd')
      .map((tag) => ({
        tag: tag[1],
      }));
  }

  async ngOnInit() {
    window.scrollTo(0, 0);

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/']);
      return;
    }

    this.projectId = id;

    // Force reload deny list to ensure it's fresh from Nostr
    await this.denyService.reloadDenyList();

    if (await this.denyService.isEventDenied(this.projectId)) {
      this.isDenied.set(true);
      this.project.set(null);
      this.title.setTitle('Project Not Available');
      console.warn(`Access denied for project: ${this.projectId}`);
      return;
    }


    let projectData: IndexedProject | undefined | null =
      this.indexer.getProject(id);

    try {

      if (!projectData) {
        projectData = await this.indexer.fetchProject(id);
      }


      if (projectData && await this.denyService.isEventDenied(projectData.projectIdentifier)) {
        this.isDenied.set(true);
        this.project.set(null);
        this.title.setTitle('Project Not Available');
        console.warn(`Access denied for project after fetch: ${this.projectId}`);
        return;
      }

      if (projectData) {
        console.log('Project Data:  ', projectData);

        this.project.set(projectData);


        if (!projectData.stats) {
          this.indexer
            .fetchProjectStats(id)
            .then((stats: ProjectStats | null) => {
              projectData!.stats = stats!;
            });
        }

        if (!projectData.details) {

          this.relay.fetchData([projectData.nostrEventId]);

        } else {
          this.user = new NDKUser({
            pubkey: projectData.details.nostrPubKey,
            relayUrls: this.relay.relayUrls(),
          });

          if (!projectData.content) {
            this.relay.fetchContent([projectData.details.nostrPubKey]);
          }
        }


        const projectSub = this.relay.projectUpdates.subscribe((event) => {
          if (!event) {
            return;
          }

          const details: ProjectUpdate = JSON.parse(event.content);

          if (details.projectIdentifier == id) {
            if (this.projectEvent) {
              if (this.projectEvent.created_at! > event.created_at!) {
                {
                  return;
                }
              }
            }

            this.projectEvent = event;
            projectData!.details = details;


            this.user = new NDKUser({
              pubkey: projectData!.details.nostrPubKey,
              relayUrls: this.relay.relayUrls(),
            });


            this.relay.fetchProfile([details.nostrPubKey]);
          }
        });


        const profileSub = this.relay.profileUpdates.subscribe((event) => {
          if (!event) {
            return;
          }

          const update: NDKUserProfile = JSON.parse(event.content);

          if (event.pubkey == projectData!.details?.nostrPubKey) {
            if (this.profileEvent) {
              if (this.profileEvent.created_at! > event.created_at!) {
                {
                  return;
                }
              }
            }

            this.profileEvent = event;
            projectData!.metadata = update;

            this.title.setTitle(update.name);

            projectData!.externalIdentities =
              this.utils.getExternalIdentities(event);
            projectData!.externalIdentities_created_at = event.created_at;
          }
        });

        const contentSub = this.relay.contentUpdates.subscribe((event) => {
          const getTag = this.getDTags(event);

          if (getTag.length === 0) {
            return;
          }

          const tag = getTag[0].tag;
          const project = this.project()!;

          if (tag == 'angor:project') {
            project.content = event.content;
            project.content_created_at = event.created_at;
          } else if (tag == 'angor:media') {
            project.media = JSON.parse(event.content);
            project.media_created_at = event.created_at;
          } else if (tag == 'angor:members') {
            // Currently the Angor project members are stored as npubs, this may change in the future.
            const npubs = JSON.parse(event.content).pubkeys.filter((pubkey: string) => pubkey && pubkey.trim() !== '');

            if (npubs.length > 0) {
              if (npubs[0].startsWith('npub')) {
                project.members = npubs.map((npub: string) => {
                  const decoded = nip19.decode(npub);
                  return decoded.data as string;
                });
              } else {
                project.members = JSON.parse(event.content).pubkeys;
              }
            }

            project.members_created_at = event.created_at;

            // Fetch member badges when members are loaded and project tab is active
            if (this.activeTab === 'project' && project.members?.length) {
              this.fetchMemberBadges();
            }
          } else {
            console.warn('Unknown tag:', tag);
          }
        });

        this.subscriptions.push(projectSub, profileSub, contentSub);

        console.log('Subscriptions: ', this.subscriptions);

        if (this.project()?.metadata?.name) {
          this.title.setTitle(this.project()?.metadata?.name);
        }

        // Check admin list status if user is logged in
        if (this.isCurrentUserAdmin()) {
          await this.checkProjectListStatus();
        }

      } else {

        if (!this.isDenied()) {
          this.noProjectFoundYet = true;
          this.title.setTitle('Project Not Found');
        }
      }
    } catch (error) {
      console.error('Error loading project:', error);
      if (!this.isDenied()) {
        this.noProjectFoundYet = true;
        this.title.setTitle('Error Loading Project');
      }
    }
  }

  noProjectFoundYet = false;

  trackById(index: number, item: FaqItem) {
    return item.id;
  }

  ngOnDestroy() {

    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];


    this.project.set(null);
  }


  formatDate(timestamp: number | undefined): string {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  isProjectNotStarted(): boolean {
    const startDate = this.project()?.details?.startDate;
    if (!startDate) return false;
    return Date.now() < startDate * 1000;
  }


  isProjectStarted(): boolean {
    const startDate = this.project()?.details?.startDate;
    if (!startDate) return false;
    return Date.now() >= startDate * 1000;
  }

  isProjectEnded(): boolean {
    const expiryDate = this.project()?.details?.expiryDate;
    if (!expiryDate) return false;
    return Date.now() > expiryDate * 1000;
  }

  isProjectSuccessful(): boolean {

    const amountInvested = this.project()?.stats?.amountInvested ?? 0;
    const targetAmount = this.project()?.details?.targetAmount ?? 0;


    if (targetAmount === 0) return false;

    return amountInvested >= targetAmount;
  }

  isProjectFailed(): boolean {

    if (!this.isProjectEnded()) return false;

    const amountInvested = this.project()?.stats?.amountInvested ?? 0;
    const targetAmount = this.project()?.details?.targetAmount ?? 0;


    if (targetAmount === 0) return true;

    return amountInvested < targetAmount;
  }

  /**
   * Determines if investment is currently possible (project has not ended AND not yet successful).
   */
  canInvest(): boolean {
    return !this.isProjectEnded();
  }

  getRemainingTimeText(expiryDate: number | undefined): string {
    if (!expiryDate) return 'Ending soon';

    const now = Date.now();
    const expiryMillis = expiryDate * 1000;
    const diffMillis = expiryMillis - now;

    if (diffMillis <= 0) {
      return 'Ended';
    }

    const diffSeconds = Math.floor(diffMillis / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

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

  getFundingPercentage(): number {
    const amountInvested = this.project()?.stats?.amountInvested ?? 0;
    const targetAmount = this.project()?.details?.targetAmount ?? 1;
    return Number(((amountInvested / targetAmount) * 100).toFixed(1));
  }

  openInvestWindow() {
    const projectId = this.project()?.projectIdentifier;
    if (!projectId) {
      console.error('Project identifier is missing.');
      return;
    }

    const baseUrl = this.networkService.isMain()
      ? 'https://beta.angor.io/'
      : 'https://test.angor.io/';

    const url = `${baseUrl}view/${projectId}`;
    window.open(url, '_blank');
  }

  getWithdrawnPercentage(): number {
    const withdrawn = (this.project()?.stats?.amountInPenalties ?? 0);
    const invested = (this.project()?.stats?.amountInvested ?? 1);
    if (invested === 0) return 0;
    return Number(((withdrawn / invested) * 100).toFixed(1));
  }

  prevSlide() {
    if (!this.project()?.media) return;
    this.currentSlide =
      (this.currentSlide - 1 + this.project()!.media!.length) %
      this.project()!.media!.length;
  }

  nextSlide() {
    if (!this.project()?.media) return;
    this.currentSlide = (this.currentSlide + 1) % this.project()!.media!.length;
  }

  formatNpub(pubkey: string): string {
    return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8);
  }

  copyToClipboard(text: string | undefined | null): void {
    if (!text) return;

    navigator.clipboard.writeText(text).then(
      () => {
        console.log('Copied to clipboard');
        const button = document.activeElement as HTMLElement;
        if (button) {
          const originalInnerText = button.innerHTML;
          button.innerHTML = '<span class="material-icons text-lg">check</span>';
          setTimeout(() => {
            button.innerHTML = originalInnerText;
          }, 1000);
        }
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  }

  openImagePopup(imageUrl: string): void {
    this.selectedImage = imageUrl;
    this.showImagePopup = true;
  }

  handleMediaError(imageUrl: string): void {
    const failedImages = this.failedMediaImages();
    failedImages.add(imageUrl);
    this.failedMediaImages.set(new Set(failedImages));
  }

  handleVideoError(videoUrl: string): void {
    const failedVideos = this.failedMediaVideos();
    failedVideos.add(videoUrl);
    this.failedMediaVideos.set(new Set(failedVideos));
  }

  hasMediaFailed(imageUrl: string): boolean {
    return this.failedMediaImages().has(imageUrl);
  }

  hasVideoFailed(videoUrl: string): boolean {
    return this.failedMediaVideos().has(videoUrl);
  }

  isStageCompleted(stageIndex: number): boolean {
    const stages = this.project()?.details?.stages;
    if (!stages || !stages[stageIndex]) return false;

    const now = Date.now();
    
    if (stageIndex === stages.length - 1) {
      const expiryDate = this.project()?.details?.expiryDate;
      if (expiryDate) {
        return now > expiryDate * 1000;
      }
      return false;
    }
    
    const nextStage = stages[stageIndex + 1];
    if (nextStage) {
      return now >= nextStage.releaseDate * 1000;
    }
    
    return false;
  }

  isCurrentStage(stageIndex: number): boolean {
    const stages = this.project()?.details?.stages;
    if (!stages || !stages.length) return false;

    if (this.isProjectNotStarted()) return false;

    const currentStage = stages[stageIndex];
    if (!currentStage) return false;

    const now = Date.now();
    const stageReleaseTime = currentStage.releaseDate * 1000;

    if (now < stageReleaseTime) return false;

    if (this.isStageCompleted(stageIndex)) return false;

    if (stageIndex === stages.length - 1) return true;

    const nextStage = stages[stageIndex + 1];
    if (nextStage) {
      const nextStageReleaseTime = nextStage.releaseDate * 1000;
      return now < nextStageReleaseTime;
    }

    return false;
  }

  getCurrentStageProgress(): number {
    const stages = this.project()?.details?.stages;
    if (!stages) return 0;

    for (let i = 0; i < stages.length; i++) {
      if (this.isCurrentStage(i)) {
        const stage = stages[i];
        
        const stageStartTime = stage.releaseDate * 1000;
        
        let stageEndTime: number;
        if (i < stages.length - 1) {
          stageEndTime = stages[i + 1].releaseDate * 1000;
        } else {
          const expiryDate = this.project()?.details?.expiryDate;
          if (expiryDate) {
            stageEndTime = expiryDate * 1000;
          } else {
            stageEndTime = stageStartTime + (30 * 24 * 60 * 60 * 1000);
          }
        }
        
        const currentTime = Date.now();

        if (currentTime <= stageStartTime) return 0;
        if (currentTime >= stageEndTime) return 100;

        const totalDuration = stageEndTime - stageStartTime;
        const elapsed = currentTime - stageStartTime;

        return Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
      }
    }

    return 0;
  }

  getOverallStageProgress(): number {
    const stages = this.project()?.details?.stages;
    if (!stages || !stages.length) return 0;

    let completedPercentage = 0;
    let currentStageContribution = 0;

    for (let i = 0; i < stages.length; i++) {
      if (this.isStageCompleted(i)) {
        completedPercentage += stages[i].amountToRelease;
      } else if (this.isCurrentStage(i)) {
        currentStageContribution = (stages[i].amountToRelease * this.getCurrentStageProgress()) / 100;
        break;
      }
    }

    return Math.min(100, Math.round(completedPercentage + currentStageContribution));
  }

  calculateStageAmount(percentage: number): string {
    const targetAmount = this.project()?.details?.targetAmount ?? 0;
    const amount = (targetAmount * percentage) / 100;
    return this.bitcoin.toBTC(amount);
  }

  getStageRemainingTimeText(releaseDate: number): string {
    if (!releaseDate) return '';

    const now = Date.now();
    const releaseMillis = releaseDate * 1000;

    if (now > releaseMillis) {
      return 'Completed';
    }

    const diffMillis = releaseMillis - now;
    const diffDays = Math.floor(diffMillis / (1000 * 60 * 60 * 24));

    if (diffDays < 1) {
      const diffHours = Math.floor(diffMillis / (1000 * 60 * 60));
      return diffHours <= 0 ? 'Soon' : `${diffHours}h remaining`;
    } else if (diffDays === 1) {
      return '1 day remaining';
    } else if (diffDays < 30) {
      return `${diffDays} days remaining`;
    } else {
      const diffMonths = Math.floor(diffDays / 30);
      return diffMonths === 1 ? '1 month remaining' : `${diffMonths} months remaining`;
    }
  }

  /**
   * Checks if the provided URL is a YouTube video URL.
   * Supports youtube.com/watch, youtu.be, and youtube.com/embed formats
   */
  isYouTubeUrl(url: string): boolean {
    if (!url) return false;

    // Regular expressions to match various YouTube URL formats
    const patterns = [
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/watch\?v=([^&]+)/i,
      /^(https?:\/\/)?(www\.)?(youtu\.?be)\/([^?]+)/i,
      /^(https?:\/\/)?(www\.)?(youtube\.com)\/embed\/([^?]+)/i
    ];

    return patterns.some(pattern => pattern.test(url));
  }

  /**
   * Extracts the video ID from a YouTube URL and returns the embed URL
   */
  getYouTubeEmbedUrl(url: string): string {
    if (!url) return '';

    let videoId = '';

    // Extract video ID from youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?]+)/i);
    if (watchMatch && watchMatch[1]) {
      videoId = watchMatch[1];
    }

    if (!videoId) {
      console.error('Could not extract YouTube video ID from URL:', url);
      return '';
    }

    // Return the embed URL with additional parameters for better UX
    return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&showinfo=0&modestbranding=1`;
  }

  async fetchMemberBadges() {
    if (this.loadingMemberBadges()) {
      return;
    }

    const members = this.project()?.members;
    if (!members || members.length === 0) return;

    this.loadingMemberBadges.set(true);
    try {
      const ndk = await this.relay.ensureConnected();

      const filter = {
        kinds: [30008],
        authors: members,
        // '#d': ['profile_badges'],
        // limit: 50,
      };

      console.log('Fetching member badges with filter:', filter);

      const events = await ndk.fetchEvents(filter);
      const badgeMap = new Map<string, boolean>();

      console.log('Fetched member badge events:', events);

      for (const event of events) {
        const hasAngorBadge = this.checkForAngorProjectMemberBadge(event);
        badgeMap.set(event.pubkey, hasAngorBadge);
      }

      // Ensure all members are in the map (even those without badges)
      members.forEach(member => {
        if (!badgeMap.has(member)) {
          badgeMap.set(member, false);
        }
      });

      this.memberBadges.set(badgeMap);
    } catch (error) {
      console.error('Error fetching member badges:', error);
    } finally {
      this.loadingMemberBadges.set(false);
    }
  }

  private checkForAngorProjectMemberBadge(event: NDKEvent): boolean {
    if (!event.tags) return false;

    const projectPubkey = this.user?.pubkey;
    
    if (!projectPubkey) {
      return false;
    }

    return event.tags.some(tag => {
      return tag[0] === 'a' &&
        tag[1] &&
        tag[1].includes('angor-project-member') &&
        tag[1].includes(projectPubkey);
    });
  }  
  isMemberVerified(pubkey: string): boolean {
    return this.memberBadges().get(pubkey) || false;
  }

  openShareModal(): void {
    this.showShareModal.set(true);
  }
  
  closeShareModal(): void {
    this.showShareModal.set(false);
  }

  // Admin methods
  isCurrentUserAdmin(): boolean {
    return this.nostrAuth.isLoggedIn();
  }

  async checkProjectListStatus(): Promise<void> {
    if (!this.isCurrentUserAdmin() || !this.projectId) {
      return;
    }

    try {
      const denyList = await this.nostrListService.getDenyList();
      const whitelist = await this.nostrListService.getWhiteList();
      
      this.isInDenyList.set(denyList.includes(this.projectId));
      this.isInWhitelist.set(whitelist.includes(this.projectId));
    } catch (error) {
      console.error('Error checking project list status:', error);
    }
  }

  async addToDenyList(): Promise<void> {
    if (!this.projectId) return;

    this.updatingDenyList.set(true);
    this.adminActionMessage.set('');

    try {
      await this.nostrListService.addToDenyList(this.projectId);
      this.isInDenyList.set(true);
      this.adminActionMessage.set('Success: Project added to deny list');
      setTimeout(() => this.adminActionMessage.set(''), 5000);
    } catch (error) {
      console.error('Error adding to deny list:', error);
      this.adminActionMessage.set('Error: ' + (error as Error).message);
    } finally {
      this.updatingDenyList.set(false);
    }
  }

  async removeFromDenyList(): Promise<void> {
    if (!this.projectId) return;

    this.updatingDenyList.set(true);
    this.adminActionMessage.set('');

    try {
      await this.nostrListService.removeFromDenyList(this.projectId);
      this.isInDenyList.set(false);
      this.adminActionMessage.set('Success: Project removed from deny list');
      setTimeout(() => this.adminActionMessage.set(''), 5000);
    } catch (error) {
      console.error('Error removing from deny list:', error);
      this.adminActionMessage.set('Error: ' + (error as Error).message);
    } finally {
      this.updatingDenyList.set(false);
    }
  }

  async addToWhitelist(): Promise<void> {
    if (!this.projectId) return;

    this.updatingWhitelist.set(true);
    this.adminActionMessage.set('');

    try {
      await this.nostrListService.addToWhiteList(this.projectId);
      this.isInWhitelist.set(true);
      this.adminActionMessage.set('Success: Project added to whitelist');
      setTimeout(() => this.adminActionMessage.set(''), 5000);
    } catch (error) {
      console.error('Error adding to whitelist:', error);
      this.adminActionMessage.set('Error: ' + (error as Error).message);
    } finally {
      this.updatingWhitelist.set(false);
    }
  }

  async removeFromWhitelist(): Promise<void> {
    if (!this.projectId) return;

    this.updatingWhitelist.set(true);
    this.adminActionMessage.set('');

    try {
      await this.nostrListService.removeFromWhiteList(this.projectId);
      this.isInWhitelist.set(false);
      this.adminActionMessage.set('Success: Project removed from whitelist');
      setTimeout(() => this.adminActionMessage.set(''), 5000);
    } catch (error) {
      console.error('Error removing from whitelist:', error);
      this.adminActionMessage.set('Error: ' + (error as Error).message);
    } finally {
      this.updatingWhitelist.set(false);
    }
  }

  onBannerLoad(): void {
    this.bannerLoaded.set(true);
  }

  onProfileLoad(): void {
    this.profileLoaded.set(true);
  }

  handleBannerError(): void {
    this.failedBannerImage.set(true);
    this.bannerLoaded.set(true);
  }

  handleProfileError(): void {
    this.failedProfileImage.set(true);
    this.profileLoaded.set(true);
  }

  shouldShowBannerImage(): boolean {
    return !!this.project()?.metadata?.banner && !this.failedBannerImage();
  }

  shouldShowProfileImage(): boolean {
    return !!this.project()?.metadata?.['picture'] && !this.failedProfileImage();
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

  getBannerStyle(): string {
    return this.getRandomColor(this.projectId);
  }

  getProjectStatusInfo(): { label: string; type: string; icon: string } | null {
    if (this.isProjectNotStarted()) {
      return { label: 'Upcoming', type: 'upcoming', icon: 'schedule' };
    }
    
    if (this.isProjectSuccessful()) {
      return { label: 'Successfully Funded', type: 'success', icon: 'check_circle' };
    }
    
    if (this.isProjectFailed()) {
      return { label: 'Failed', type: 'failed', icon: 'cancel' };
    }
    
    if (this.isProjectStarted() && !this.isProjectEnded()) {
      return { label: 'Active', type: 'active', icon: 'trending_up' };
    }
    
    return null;
  }

  getSpentPercentage(): number {
    const spent = this.project()?.stats?.amountSpentSoFarByFounder ?? 0;
    const invested = this.project()?.stats?.amountInvested ?? 1;
    return Math.min(100, Number(((spent / invested) * 100).toFixed(1)));
  }

  getPenaltiesPercentage(): number {
    const penalties = this.project()?.stats?.amountInPenalties ?? 0;
    const invested = this.project()?.stats?.amountInvested ?? 1;
    return Math.min(100, Number(((penalties / invested) * 100).toFixed(1)));
  }

  getWebsiteUrl(website: string | undefined): string {
    if (!website) return '#';
    if (website.startsWith('http://') || website.startsWith('https://')) {
      return website;
    }
    return 'https://' + website;
  }

  formatWebsite(website: string | undefined): string {
    if (!website) return '';
    return website.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
  }

  getSocialLink(identity: ExternalIdentity): string {
    const platform = identity.platform.toLowerCase();
    const username = identity.username;
    
    const platformUrls: { [key: string]: string } = {
      twitter: `https://twitter.com/${username}`,
      github: `https://github.com/${username}`,
      telegram: `https://t.me/${username}`,
      facebook: `https://facebook.com/${username}`,
      instagram: `https://instagram.com/${username}`,
      linkedin: `https://linkedin.com/in/${username}`,
    };
    
    return platformUrls[platform] || identity.proofUrl || '#';
  }

  getSocialIcon(platform: string): string {
    const icons: { [key: string]: string } = {
      twitter: 'chat',
      github: 'code',
      telegram: 'telegram',
      facebook: 'facebook',
      instagram: 'photo_camera',
      linkedin: 'work',
    };
    
    return icons[platform.toLowerCase()] || 'link';
  }

  formatUsername(username: string): string {
    return username.startsWith('@') ? username : `@${username}`;
  }
}