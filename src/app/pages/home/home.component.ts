import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NetworkService } from '../../services/network.service';
import { BitcoinInfoService } from '../../services/bitcoin-info.service';
import { TitleService } from '../../services/title.service';
import { ThemeService } from '../../services/theme.service';
import { FeaturedService } from '../../services/featured.service';
import { IndexerService, type IndexedProject } from '../../services/indexer.service';
import { RelayService } from '../../services/relay.service';
import { UtilsService } from '../../services/utils.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  providers: []
})
export class HomeComponent implements OnInit, OnDestroy {
  networkService = inject(NetworkService);
  bitcoinInfo = inject(BitcoinInfoService);
  titleService = inject(TitleService);
  themeService = inject(ThemeService);
  private featuredService = inject(FeaturedService);
  private indexer = inject(IndexerService);
  private relay = inject(RelayService);
  private utils = inject(UtilsService);
  
  private subscriptions: { unsubscribe: () => void }[] = []; 

  featuredLoading = signal<boolean>(true);
  featuredError = signal<string | null>(null);
  featuredIds = signal<string[]>([]);
  featuredProjects = signal<IndexedProject[]>([]);

  hasFeatured = computed(() => this.featuredProjects().length > 0);
  
  constructor() {
  }

  async ngOnInit() {
    this.titleService.setTitle('Angor Hub - Decentralized Bitcoin Fundraising');
    
    // Subscribe to Nostr updates for metadata
    this.setupNostrSubscriptions();
    
    await Promise.all([
      this.loadFeaturedProjects(),
    ]);
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
  }

  private fetchedProfiles = new Set<string>();

  private setupNostrSubscriptions(): void {
    // Subscribe to project updates
    const projectSub = this.relay.projectUpdates.subscribe((event) => {
      if (!event) return;
      
      try {
        const update = JSON.parse(event.content);
        const id = update.projectIdentifier;
        const projects = this.featuredProjects();
        const project = projects.find((p) => p.projectIdentifier === id);

        if (project) {
          if (!project.details || event.created_at! > (project.details_created_at || 0)) {
            project.details = update;
            project.details_created_at = event.created_at;
            
            // Fetch profile if we now have a pubkey and haven't fetched it yet
            if (update.nostrPubKey && !this.fetchedProfiles.has(update.nostrPubKey)) {
              console.log('Project details received, fetching profile for:', update.nostrPubKey);
              this.fetchedProfiles.add(update.nostrPubKey);
              this.relay.fetchProfile([update.nostrPubKey]);
            }
            
            // Trigger change detection
            this.featuredProjects.set([...projects]);
          }
        }
      } catch (error) {
        console.error('Error processing project update:', error);
      }
    });

    // Subscribe to profile/metadata updates
    const profileSub = this.relay.profileUpdates.subscribe((event) => {
      if (!event) return;
      
      try {
        const update = JSON.parse(event.content);
        const id = event.pubkey;
        const projects = this.featuredProjects();
        const project = projects.find((p) => p.details?.nostrPubKey === id);

        if (project) {
          if (!project.metadata || event.created_at! > (project.metadata_created_at || 0)) {
            project.metadata = update;
            project.metadata_created_at = event.created_at;
            project.externalIdentities = this.utils.getExternalIdentities(event);
            project.externalIdentities_created_at = event.created_at;
            
            console.log('✓ Profile metadata received for project:', project.projectIdentifier, 'Name:', update.name);
            
            // Trigger change detection
            this.featuredProjects.set([...projects]);
          }
        }
      } catch (error) {
        console.error('Error processing profile update:', error);
      }
    });

    this.subscriptions.push(projectSub, profileSub);
  }

  private async loadFeaturedProjects(): Promise<void> {
    this.featuredLoading.set(true);
    this.featuredError.set(null);

    try {
      const ids = await this.featuredService.loadFeaturedProjects();
      this.featuredIds.set(ids);

      if (ids.length === 0) {
        this.featuredProjects.set([]);
        return;
      }

      // Fetch all projects in parallel for maximum speed
      const projectPromises = ids.map(async (id) => {
        const project = await this.indexer.fetchProject(id);
        if (!project) return null;

        // Fetch stats in parallel
        if (!project.stats) {
          try {
            const stats = await this.indexer.fetchProjectStats(id);
            if (stats) project.stats = stats;
          } catch {
            // ignore stats failure
          }
        }

        return project;
      });

      const fetchedProjects = await Promise.all(projectPromises);
      const projects = fetchedProjects.filter(p => p !== null) as IndexedProject[];

      // Keep display order identical to the whitelist order
      const order = new Map(ids.map((id, idx) => [id, idx] as const));
      projects.sort((a, b) => (order.get(a.projectIdentifier) ?? 0) - (order.get(b.projectIdentifier) ?? 0));
      
      // Set projects immediately so UI can start rendering
      this.featuredProjects.set(projects);

      // Fetch metadata from Nostr in parallel for each project
      this.fetchAllProjectMetadata(projects);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load featured projects';
      this.featuredError.set(msg);
      this.featuredIds.set([]);
      this.featuredProjects.set([]);
    } finally {
      this.featuredLoading.set(false);
    }
  }

  getFundingPercentage(project: IndexedProject): number {
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

  private fetchAllProjectMetadata(projects: IndexedProject[]): void {
    console.log('🚀 Starting parallel metadata fetch for', projects.length, 'projects');
    
    // Fetch each project's metadata independently and in parallel
    projects.forEach((project) => {
      // Fetch project details if not available
      if (project.nostrEventId && !project.details) {
        console.log('📡 Fetching details for:', project.projectIdentifier);
        this.relay.fetchData([project.nostrEventId]);
      }
      
      // Fetch profile if details exist
      if (project.details?.nostrPubKey && !this.fetchedProfiles.has(project.details.nostrPubKey)) {
        console.log('👤 Fetching profile for:', project.projectIdentifier, '- pubkey:', project.details.nostrPubKey);
        this.fetchedProfiles.add(project.details.nostrPubKey);
        this.relay.fetchProfile([project.details.nostrPubKey]);
      }
      
      // Fetch content if not available
      if (project.details?.nostrPubKey && !project.content) {
        this.relay.fetchContent([project.details.nostrPubKey]);
      }
    });
  }

  getInitial(name: string | undefined | null): string {
    if (!name || name.trim() === '') return '#';
    return name.trim()[0].toUpperCase();
  }

  formatBTC(satoshis: number): string {
    return (satoshis / 100000000).toFixed(8).replace(/\.?0+$/, '');
  }
}
