import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  IndexedProject,
  ProjectStats,
  IndexerService,
} from '../../services/indexer.service';
import { CommonModule, DatePipe } from '@angular/common';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import {
  ProfileUpdate,
  ProjectUpdate,
  RelayService,
} from '../../services/relay.service';
import NDK, {
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
import { DenyService } from '../../services/deny.service';

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    BreadcrumbComponent,
    AgoPipe,
    RouterModule,
    ImagePopupComponent,
    ProfileComponent,
    MarkdownModule,
    SafeContentPipe,
  ],
  templateUrl: './project.component.html',
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

  reloadPage(): void {
    window.location.reload();
  }

  project = signal<IndexedProject | null>(null);
  projectId: string = '';
  isDenied = signal<boolean>(false);

  tabs = [
    { id: 'project', label: 'Project', icon: 'description' }, // Changed icon
    { id: 'faq', label: 'FAQ', icon: 'help_outline' }, // Changed icon
    { id: 'updates', label: 'Updates', icon: 'campaign' }, // Changed icon
    { id: 'comments', label: 'Comments', icon: 'chat_bubble_outline' }, // Changed icon
  ];
  activeTab = 'project';
  updates = signal<NDKEvent[]>([]);
  comments = signal<NDKEvent[]>([]);
  faqItems = signal<FaqItem[]>([]); // Changed to signal

  // Loading and Error Signals for Tabs
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

  async setActiveTab(tabId: string) {
    this.activeTab = tabId;
    if (tabId === 'updates' && this.updates().length === 0 && !this.loadingUpdates() && !this.errorUpdates()) {
      this.fetchUpdates();
    }
    if (tabId === 'comments' && this.comments().length === 0 && !this.loadingComments() && !this.errorComments()) {
      this.fetchComments();
    }
    if (tabId === 'faq' && this.faqItems().length === 0 && !this.loadingFaq() && !this.errorFaq()) {
      this.fetchFaq();
    }
  }

  async fetchFaq() {
    if (!this.project()?.details?.nostrPubKey) return;

    this.loadingFaq.set(true);
    this.errorFaq.set(null); // Reset error before fetching
    try {
      const ndk = await this.relay.ensureConnected();
      const filter = {
        kinds: [NDKKind.AppSpecificData],
        authors: [this.project()!.details!.nostrPubKey],
        '#d': ['angor:faq'],
        limit: 1, // Fetch only the latest FAQ event
      };

      const event = await ndk.fetchEvent(filter);

      if (event && event.content) {
        try {
          const parsedFaq = JSON.parse(event.content);
          if (Array.isArray(parsedFaq)) {
            this.faqItems.set(parsedFaq);
          } else {
            console.warn('FAQ content is not an array:', parsedFaq);
            this.faqItems.set([]); // Set to empty if format is wrong
            this.errorFaq.set('Invalid FAQ format received.');
          }
        } catch (parseError) {
          console.error('Error parsing FAQ content:', parseError);
          this.faqItems.set([]);
          this.errorFaq.set('Failed to parse FAQ data.');
        }
      } else {
        this.faqItems.set([]); // Set empty if no event found
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
        kinds: [1], // Kind 1 for short text notes (updates)
        authors: [this.project()!.details!.nostrPubKey],
        '#t': ['angor-update'], // Optional: Add a tag for specific updates? Or rely on author?
        limit: 50,
      };

      const events = await ndk.fetchEvents(filter);
      // Sort events by creation time, newest first
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
      // Fetch events replying to the project's pubkey OR tagging the project event ID
      const filter = {
        kinds: [1], // Kind 1 for short text notes (comments)
        '#p': [this.project()!.details!.nostrPubKey], // Replies to the project owner
        // '#e': [this.project()?.nostrEventId], // Optionally include replies to the project event itself
        limit: 50,
      };

      const events = await ndk.fetchEvents(filter);
      // Sort events by creation time, newest first
      const sortedEvents = Array.from(events).sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
      this.comments.set(sortedEvents);
    } catch (error) {
      console.error('Error fetching comments:', error);
      this.errorComments.set('Could not load comments. Please try again later.');
    } finally {
      this.loadingComments.set(false);
    }
  }

  // Add to component class:
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

    // Load deny list first
    await this.denyService.loadDenyList();

    // Check if the project is denied
    if (await this.denyService.isEventDenied(this.projectId)) {
      this.isDenied.set(true);
      this.project.set(null); // Ensure project is null
      this.title.setTitle('Project Not Available');
      console.warn(`Access denied for project: ${this.projectId}`);
      return; // Stop further processing
    }

    // 1. First try to get from existing projects cache
    let projectData: IndexedProject | undefined | null =
      this.indexer.getProject(id);

    try {
      // 2. If not in cache, fetch from Indexer API (fetchProject now also checks deny list)
      if (!projectData) {
        projectData = await this.indexer.fetchProject(id);
      }

      // Check again if fetched data is denied (belt and suspenders)
      if (projectData && await this.denyService.isEventDenied(projectData.projectIdentifier)) {
          this.isDenied.set(true);
          this.project.set(null);
          this.title.setTitle('Project Not Available');
          console.warn(`Access denied for project after fetch: ${this.projectId}`);
          return;
      }

      if (projectData) {
        console.log('Project Data:  ', projectData);
        // Set initial project data
        this.project.set(projectData);

        // Go get the stats data.
        if (!projectData.stats) {
          this.indexer
            .fetchProjectStats(id)
            .then((stats: ProjectStats | null) => {
              projectData!.stats = stats!;
            });
        }

        if (!projectData.details) {
          // Go fetch data.
          this.relay.fetchData([projectData.nostrEventId]);
          // Go get the details data.
        } else {
          this.user = new NDKUser({
            pubkey: projectData.details.nostrPubKey,
            relayUrls: this.relay.relayUrls(),
          });

          if (!projectData.content) {
            this.relay.fetchContent([projectData.details.nostrPubKey]);
          }
        }

        // 3. Subscribe to project updates from relay with timestamp check
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

            // As soon as we have details, make an NDKUser instance
            this.user = new NDKUser({
              pubkey: projectData!.details.nostrPubKey,
              relayUrls: this.relay.relayUrls(),
            });

            // Go fetch the profile
            this.relay.fetchProfile([details.nostrPubKey]);
          }
        });

        // 4. Subscribe to profile updates from relay with timestamp check
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
            project.members = JSON.parse(event.content).pubkeys;
            project.members_created_at = event.created_at;
          } else {
            console.warn('Unknown tag:', tag);
          }
        });

        this.subscriptions.push(projectSub, profileSub, contentSub);

        console.log('Subscriptions: ', this.subscriptions);

        if (this.project()?.metadata?.name) {
          this.title.setTitle(this.project()?.metadata?.name);
        }

        // 5. Fetch project details from relay
        // if (projectData.nostrEventId) {
        //   await this.relay.fetchData([projectData.nostrEventId]);
        // }
      } else {
        // If projectData is null and not denied, it means it wasn't found
        if (!this.isDenied()) {
           this.noProjectFoundYet = true;
           this.title.setTitle('Project Not Found');
        }
      }
    } catch (error) {
      console.error('Error loading project:', error);
       if (!this.isDenied()) { // Only set not found if not denied
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
    // Clean up subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];

    // Clear signals
    this.project.set(null);
  }

  // Re-add the formatDate method
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
    return Date.now() < startDate * 1000; // Corrected logic: true if current time is BEFORE start date
  }

  // Add new methods to check project status
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
    // A project is successful if it has reached its funding target, regardless of whether it has ended.
    const amountInvested = this.project()?.stats?.amountInvested ?? 0;
    const targetAmount = this.project()?.details?.targetAmount ?? 0;
    
    // Avoid division by zero or considering success if target is 0
    if (targetAmount === 0) return false; 
    
    return amountInvested >= targetAmount;
  }

  isProjectFailed(): boolean {
    // A project is considered failed only if it has ended AND did not reach its target.
    if (!this.isProjectEnded()) return false; 
    
    const amountInvested = this.project()?.stats?.amountInvested ?? 0;
    const targetAmount = this.project()?.details?.targetAmount ?? 0;
    
    // Avoid division by zero or considering failure if target is 0
    if (targetAmount === 0) return true; // If target is 0 and ended, it's technically failed to raise anything.
    
    return amountInvested < targetAmount;
  }

  /**
   * Determines if investment is currently possible (project has not ended AND not yet successful).
   */
  canInvest(): boolean {
    return !this.isProjectEnded() && !this.isProjectSuccessful();
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

  getSpentPercentage(): number {
    const spent = (this.project()?.stats?.amountSpentSoFarByFounder ?? 0);
    const invested = (this.project()?.stats?.amountInvested ?? 0);
    if (invested === 0) return 0;
    return Number(((spent / invested) * 100).toFixed(1));
  }

  getPenaltiesPercentage(): number {
    const penalties = (this.project()?.stats?.amountInPenalties ?? 0);
    const invested = (this.project()?.stats?.amountInvested ?? 0);
    if (invested === 0) return 0;
    return Number(((penalties / invested) * 100).toFixed(1));
  }

  // externalIdentities = signal<ExternalIdentity[]>([]);

  getSocialIcon(platform: string): string {
    const icons: { [key: string]: string } = {
      github: 'code',
      twitter: 'flutter_dash', // X icon
      facebook: 'facebook',
      telegram: 'telegram',
      instagram: 'photo_camera',
      linkedin: 'work',
      youtube: 'smart_display',
      mastodon: 'forum',
      twitch: 'videogame_asset',
      discord: 'chat',
      email: 'email',
    };

    return icons[platform.toLowerCase()] || 'link';
  }

  getSocialLink(identity: ExternalIdentity): string {
    const baseUrls: { [key: string]: string } = {
      github: 'https://github.com/',
      twitter: 'https://x.com/',
      facebook: 'https://facebook.com/',
      telegram: 'https://t.me/',
      instagram: 'https://instagram.com/',
      linkedin: 'https://linkedin.com/in/',
      youtube: 'https://youtube.com/@',
      mastodon: '', // Will use full username as it contains domain
      twitch: 'https://twitch.tv/',
      discord: 'https://discord.com/users/',
      email: 'mailto:',
    };

    if (identity.platform === 'mastodon') {
      return `https://${identity.username}`;
    }

    const baseUrl = baseUrls[identity.platform.toLowerCase()];
    return baseUrl ? `${baseUrl}${identity.username}` : '#';
  }

  formatUsername(username: string): string {
    // Remove domain parts for mastodon usernames
    if (username.includes('@')) {
      return '@' + username.split('@')[1];
    }
    return '@' + username;
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
  
  openImagePopup(imageUrl: string): void {
    this.selectedImage = imageUrl;
    this.showImagePopup = true;
  }

  // Handle banner image load error
  handleBannerError(): void {
    this.failedBannerImage.set(true);
  }
  
  // Handle profile image load error
  handleProfileError(): void {
    this.failedProfileImage.set(true);
  }
  
  // Handle media image load error
  handleMediaError(imageUrl: string): void {
    const failedImages = this.failedMediaImages();
    failedImages.add(imageUrl);
    this.failedMediaImages.set(new Set(failedImages));
  }
  
  // Check if media image failed to load
  hasMediaFailed(imageUrl: string): boolean {
    return this.failedMediaImages().has(imageUrl);
  }
  
  // Generate a random color based on project identifier using Angor brand colors
  getRandomColor(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Angor Brand Colors
    const colors = [
      '#022229', // Very Dark Teal
      '#086c81', // Dark Cyan
      '#cbdde1', // Light Steel Green - Use a slightly darker version for better contrast as background
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
  getBannerStyle(): string {
    return this.getRandomColor(this.projectId);
  }
}