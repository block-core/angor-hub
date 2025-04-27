import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
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
import { AboutContentComponent } from '../../components/about-content.component'; // Import the new component

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
    AboutContentComponent, // Add the new component here
  ],
  templateUrl: './project.component.html',
})
export class ProjectComponent implements OnInit, OnDestroy { // Removed AfterViewInit
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
    { id: 'project', label: 'Project', icon: 'description' },
    { id: 'faq', label: 'FAQ', icon: 'help_outline' },
    { id: 'updates', label: 'Updates', icon: 'campaign' },
    { id: 'comments', label: 'Comments', icon: 'chat_bubble_outline' },
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
        '#t': ['angor-update'],
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

   
    await this.denyService.loadDenyList();

   
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
    return !this.isProjectEnded() && !this.isProjectSuccessful();
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

  getSpentPercentage(): number {
    const spent = (this.project()?.stats?.amountSpentSoFarByFounder ?? 0);
    const invested = (this.project()?.stats?.amountInvested ?? 1); 
    if (invested === 0) return 0;
    return Number(((spent / invested) * 100).toFixed(1));
  }

  getWithdrawnPercentage(): number {
    const withdrawn = (this.project()?.stats?.amountInPenalties  ?? 0);
    const invested = (this.project()?.stats?.amountInvested ?? 1); 
    if (invested === 0) return 0;
    return Number(((withdrawn / invested) * 100).toFixed(1));
  }

  getPenaltiesPercentage(): number {
    const penalties = (this.project()?.stats?.amountInPenalties ?? 0);
    const invested = (this.project()?.stats?.amountInvested ?? 1); 
    if (invested === 0) return 0;
    return Number(((penalties / invested) * 100).toFixed(1));
  }

  getSocialIcon(platform: string): string {
    const icons: { [key: string]: string } = {
      github: 'code',
      twitter: 'flutter_dash',
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
      mastodon: '',
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

  handleBannerError(): void {
    this.failedBannerImage.set(true);
  }

  handleProfileError(): void {
    this.failedProfileImage.set(true);
  }

  handleMediaError(imageUrl: string): void {
    const failedImages = this.failedMediaImages();
    failedImages.add(imageUrl);
    this.failedMediaImages.set(new Set(failedImages));
  }

  hasMediaFailed(imageUrl: string): boolean {
    return this.failedMediaImages().has(imageUrl);
  }

  getRandomColor(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
     
    const colors = [
      '#022229',
      '#086c81',
      '#cbdde1',
      '#b8c9cd' 
    ];
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }
  
 
  getInitial(name: string | undefined | null): string {
    if (!name || name.trim() === '') {
      return '#';
    }
    return name.trim()[0].toUpperCase();
  }
  
  getBannerStyle(): string {
    return this.getRandomColor(this.projectId);
  }

  isStageCompleted(stageIndex: number): boolean {
    const stage = this.project()?.details?.stages?.[stageIndex];
    if (!stage) return false;
    
    return Date.now() > stage.releaseDate * 1000;
  }
  
  isCurrentStage(stageIndex: number): boolean {
    const stages = this.project()?.details?.stages;
    if (!stages || !stages.length) return false;

    
    if (stageIndex === stages.length - 1 && this.isStageCompleted(stageIndex)) {
      return false;
    }
    
    
    if (!this.isStageCompleted(stageIndex) && (stageIndex === 0 || this.isStageCompleted(stageIndex - 1))) {
      return true;
    }
    
    return false;
  }
  
  getCurrentStageProgress(): number {
    const stages = this.project()?.details?.stages;
    if (!stages) return 0;
    
    for (let i = 0; i < stages.length; i++) {
      if (this.isCurrentStage(i)) {
        const stage = stages[i];
        const stageStartTime = i > 0 ? stages[i-1].releaseDate * 1000 : (this.project()?.details?.startDate ?? 0) * 1000;
        const stageEndTime = stage.releaseDate * 1000;
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
}