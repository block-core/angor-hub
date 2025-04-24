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
  styleUrl: './project.component.scss',
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

  reloadPage(): void {
    window.location.reload();
  }

  project = signal<IndexedProject | null>(null);
  projectId: string = '';

  tabs = [
    { id: 'project', label: 'Project', icon: '📋' },
    { id: 'faq', label: 'FAQ', icon: '❓' },
    { id: 'updates', label: 'Updates', icon: '📢' },
    { id: 'comments', label: 'Comments', icon: '💬' },
  ];
  activeTab = 'project';
  updates = signal<any[]>([]);
  comments = signal<any[]>([]);
  loading = signal<boolean>(false);
  showImagePopup = false;
  faqItems: FaqItem[] = [];
  currentSlide = 0;
  selectedImage: string | null = null;

  failedBannerImage = signal<boolean>(false);
  failedProfileImage = signal<boolean>(false);
  failedMediaImages = signal<Set<string>>(new Set<string>());

  async setActiveTab(tabId: string) {
    this.activeTab = tabId;
    if (tabId === 'updates' && this.updates().length === 0) {
      this.fetchUpdates();
    }
    if (tabId === 'comments' && this.comments().length === 0) {
      this.fetchComments();
    }
    if (tabId === 'faq') {
      this.faqItems = await this.fetchFaq();
    }
  }

  async fetchFaq() {
    if (!this.project()?.details?.nostrPubKey) return;

    this.loading.set(true);
    try {
      const ndk = await this.relay.ensureConnected();
      const filter = {
        kinds: [NDKKind.AppSpecificData],
        authors: [this.project()!.details!.nostrPubKey],
        '#d': ['angor:faq'],
        limit: 50,
      };

      const event = await ndk.fetchEvent(filter);

      if (event) {
        return JSON.parse(event.content);
      }
      return null;

      // this.updates.set(Array.from(events));
    } catch (error) {
      console.error('Error fetching updates:', error);
    } finally {
      this.loading.set(false);
    }
  }

  async fetchUpdates() {
    if (!this.project()?.details?.nostrPubKey) return;

    this.loading.set(true);
    try {
      const ndk = await this.relay.ensureConnected();
      const filter = {
        kinds: [1],
        authors: [this.project()!.details!.nostrPubKey],
        limit: 50,
      };

      const events = await ndk.fetchEvents(filter);
      this.updates.set(Array.from(events));
    } catch (error) {
      console.error('Error fetching updates:', error);
    } finally {
      this.loading.set(false);
    }
  }

  async fetchComments() {
    if (!this.project()?.details?.nostrPubKey) return;

    this.loading.set(true);
    try {
      const ndk = await this.relay.ensureConnected();
      const filter = {
        kinds: [1],
        '#p': [this.project()!.details!.nostrPubKey],
        limit: 50,
      };

      const events = await ndk.fetchEvents(filter);
      this.comments.set(Array.from(events));
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      this.loading.set(false);
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

    // 1. First try to get from existing projects cache
    let projectData: IndexedProject | undefined | null =
      this.indexer.getProject(id);

    try {
      // 2. If not in cache, fetch from Indexer API
      if (!projectData) {
        projectData = await this.indexer.fetchProject(id);
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
        this.noProjectFoundYet = true;
      }
    } catch (error) {
      console.error('Error loading project:', error);
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
    return Date.now() > startDate * 1000;
  }

  // Add new methods to check project status
  isProjectStarted(): boolean {
    const startDate = this.project()?.details?.startDate;
    if (!startDate) return false;
    return Date.now() >= startDate * 1000;
  }

  isProjectSuccessful(): boolean {
    if (!this.isProjectStarted()) return false;
    
    const amountInvested = this.project()?.stats?.amountInvested ?? 0;
    const targetAmount = this.project()?.details?.targetAmount ?? 0;
    
    return amountInvested >= targetAmount;
  }

  isProjectFailed(): boolean {
    if (!this.isProjectStarted()) return false;
    
    const amountInvested = this.project()?.stats?.amountInvested ?? 0;
    const targetAmount = this.project()?.details?.targetAmount ?? 0;
    
    return amountInvested < targetAmount;
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
  
  // Generate a random color based on project identifier
  getRandomColor(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Select from a curated set of pleasant, vibrant colors
    const colors = [
      'rgba(66, 133, 244, 0.85)',  // Blue
      'rgba(219, 68, 55, 0.85)',   // Red
      'rgba(244, 160, 0, 0.85)',   // Amber
      'rgba(15, 157, 88, 0.85)',   // Green
      'rgba(171, 71, 188, 0.85)',  // Purple
      'rgba(0, 172, 193, 0.85)',   // Cyan
      'rgba(255, 112, 67, 0.85)',  // Deep Orange
      'rgba(3, 169, 244, 0.85)',   // Light Blue
    ];
    
    // Use the hash to pick a color from the array
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }
  
  // Get an initial letter for placeholder
  getInitial(name: string): string {
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