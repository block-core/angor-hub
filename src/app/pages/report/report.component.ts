import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { IndexerService } from '../../services/indexer.service';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import { TitleService } from '../../services/title.service';

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule, RouterModule, BreadcrumbComponent],
  template: `
    <section class="hero py-4 px-4 bg-gradient-to-b from-header-bg to-background">
      <app-breadcrumb
        [items]="[
          { label: 'Home', url: '/' },
          { label: 'Explore', url: '/explore' },
          { label: projectId, url: '/project/' + projectId },
          { label: 'Report', url: '' }
        ]"
      ></app-breadcrumb>
    </section>

    <div class="px-4 md:px-8 py-8 max-w-7xl mx-auto">
      <div class="max-w-4xl mx-auto bg-surface-card rounded-2xl shadow-lg overflow-hidden transition duration-300 ease-in-out hover:-translate-y-1 hover:shadow-xl">
        <div class="p-8 border-b border-border">
          <h1 class="mb-6 text-text text-3xl md:text-4xl font-bold tracking-tight">Report Project</h1>
          <div class="flex gap-4 items-start p-6 rounded-xl mb-8 bg-yellow-500/10 border border-yellow-500/30 transition duration-300 ease-in-out">
            <span class="material-icons text-2xl text-yellow-500 mt-1">warning</span>
            <p class="m-0 leading-relaxed text-base md:text-lg">You're about to report project <strong class="font-semibold">{{ projectId }}</strong> as potentially problematic.</p>
          </div>
        </div>

        <div class="px-4 md:px-8 pb-8">
          <section class="scam-section">
            <h2 class="mt-8 mb-4 text-text text-xl md:text-2xl font-semibold relative pb-2 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-16 after:h-1 after:bg-accent after:rounded">What to look for in potential scams</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="flex gap-4 p-5 bg-surface-hover rounded-xl transition duration-300 ease-in-out border border-transparent hover:-translate-y-1 hover:shadow-md hover:border-border">
                <div class="flex-shrink-0 w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                  <span class="material-icons text-white text-2xl">trending_up</span>
                </div>
                <div class="flex-grow">
                  <strong class="block mb-2 text-text font-semibold">Unrealistic promises</strong>
                  <p class="m-0 text-sm md:text-base leading-normal text-text-secondary">Projects that guarantee extremely high returns or profit</p>
                </div>
              </div>
              
              <div class="flex gap-4 p-5 bg-surface-hover rounded-xl transition duration-300 ease-in-out border border-transparent hover:-translate-y-1 hover:shadow-md hover:border-border">
                <div class="flex-shrink-0 w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                  <span class="material-icons text-white text-2xl">timer</span>
                </div>
                <div class="flex-grow">
                  <strong class="block mb-2 text-text font-semibold">Pressure tactics</strong>
                  <p class="m-0 text-sm md:text-base leading-normal text-text-secondary">Creating urgency with "limited time" offers</p>
                </div>
              </div>
              
              <div class="flex gap-4 p-5 bg-surface-hover rounded-xl transition duration-300 ease-in-out border border-transparent hover:-translate-y-1 hover:shadow-md hover:border-border">
                <div class="flex-shrink-0 w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                  <span class="material-icons text-white text-2xl">help_outline</span>
                </div>
                <div class="flex-grow">
                  <strong class="block mb-2 text-text font-semibold">Vague details</strong>
                  <p class="m-0 text-sm md:text-base leading-normal text-text-secondary">Lack of clear information about the team, roadmap, or technology</p>
                </div>
              </div>
              
              <div class="flex gap-4 p-5 bg-surface-hover rounded-xl transition duration-300 ease-in-out border border-transparent hover:-translate-y-1 hover:shadow-md hover:border-border">
                <div class="flex-shrink-0 w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                  <span class="material-icons text-white text-2xl">no_accounts</span>
                </div>
                <div class="flex-grow">
                  <strong class="block mb-2 text-text font-semibold">No verifiable identity</strong>
                  <p class="m-0 text-sm md:text-base leading-normal text-text-secondary">Team members without public profiles or history</p>
                </div>
              </div>
              
              <div class="flex gap-4 p-5 bg-surface-hover rounded-xl transition duration-300 ease-in-out border border-transparent hover:-translate-y-1 hover:shadow-md hover:border-border">
                <div class="flex-shrink-0 w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                  <span class="material-icons text-white text-2xl">sms_failed</span>
                </div>
                <div class="flex-grow">
                  <strong class="block mb-2 text-text font-semibold">Poor communication</strong>
                  <p class="m-0 text-sm md:text-base leading-normal text-text-secondary">Website or documentation with spelling/grammar errors</p>
                </div>
              </div>
              
              <div class="flex gap-4 p-5 bg-surface-hover rounded-xl transition duration-300 ease-in-out border border-transparent hover:-translate-y-1 hover:shadow-md hover:border-border">
                <div class="flex-shrink-0 w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                  <span class="material-icons text-white text-2xl">content_copy</span>
                </div>
                <div class="flex-grow">
                  <strong class="block mb-2 text-text font-semibold">Copy of another project</strong>
                  <p class="m-0 text-sm md:text-base leading-normal text-text-secondary">Very similar to an existing project with minor changes</p>
                </div>
              </div>
            </div>
          </section>

          <section class="info-section">
            <h2 class="mt-8 mb-4 text-text text-xl md:text-2xl font-semibold relative pb-2 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-16 after:h-1 after:bg-accent after:rounded">Project Information</h2>
            
            <div class="flex flex-col gap-6 mb-8">
              <div class="w-full">
                <label class="block mb-3 font-semibold text-text">Project ID</label>
                <div class="flex w-full relative rounded-lg overflow-hidden shadow-sm transition duration-300 ease-in-out hover:shadow-md">
                  <input type="text" [value]="projectId" readonly class="flex-1 py-3 pr-12 pl-4 font-mono bg-surface-hover border border-border text-text w-full text-sm md:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
                  <button 
                    (click)="copyToClipboard(projectId)" 
                    class="absolute right-2 top-1/2 -translate-y-1/2 bg-none border-none cursor-pointer flex items-center justify-center text-text-secondary w-9 h-9 rounded-full transition duration-300 ease-in-out hover:bg-accent hover:text-white"
                    [class.bg-green-500]="copied() === 'id'"
                    [class.text-white]="copied() === 'id'"
                    [class.animate-pulse]="copied() === 'id'"
                    aria-label="Copy project ID"
                    title="Copy to clipboard"
                  >
                    <span class="material-icons text-lg md:text-xl">{{ copied() === 'id' ? 'check' : 'content_copy' }}</span>
                  </button>
                </div>
              </div>

              @if (nostrPubKey()) {
                <div class="w-full">
                  <label class="block mb-3 font-semibold text-text">Nostr Public Key</label>
                  <div class="flex w-full relative rounded-lg overflow-hidden shadow-sm transition duration-300 ease-in-out hover:shadow-md">
                    <input type="text" [value]="nostrPubKey()" readonly class="flex-1 py-3 pr-12 pl-4 font-mono bg-surface-hover border border-border text-text w-full text-sm md:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
                    <button 
                      (click)="copyToClipboard(nostrPubKey())" 
                      class="absolute right-2 top-1/2 -translate-y-1/2 bg-none border-none cursor-pointer flex items-center justify-center text-text-secondary w-9 h-9 rounded-full transition duration-300 ease-in-out hover:bg-accent hover:text-white"
                      [class.bg-green-500]="copied() === 'npub'"
                      [class.text-white]="copied() === 'npub'"
                      [class.animate-pulse]="copied() === 'npub'"
                      aria-label="Copy Nostr public key"
                      title="Copy to clipboard"
                    >
                      <span class="material-icons text-lg md:text-xl">{{ copied() === 'npub' ? 'check' : 'content_copy' }}</span>
                    </button>
                  </div>
                </div>
              }
            </div>
          </section>

          <section class="action-section">
            <div class="flex flex-col md:flex-row gap-4 md:gap-6 mt-12">
              <a href="https://github.com/block-core/blockcore-lists/issues/new?title=Report Problematic Angor Project: {{ projectId }}&body=I would like to report an issue with the project: {{ projectId }}." 
                target="_blank" 
                rel="noopener noreferrer"
                class="flex items-center justify-center gap-3 py-3 px-6 rounded-lg text-decoration-none font-semibold transition duration-300 ease-in-out relative overflow-hidden z-[1] bg-accent text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/20 w-full md:w-auto">
                <span class="material-icons text-lg md:text-xl">flag</span>
                Submit Report on GitHub
              </a>
              
              <a [routerLink]="['/project', projectId]" class="flex items-center justify-center gap-3 py-3 px-6 rounded-lg text-decoration-none font-semibold transition duration-300 ease-in-out relative overflow-hidden z-[1] bg-surface-hover text-text border border-border hover:bg-background hover:-translate-y-0.5 hover:shadow-md w-full md:w-auto">
                <span class="material-icons text-lg md:text-xl">arrow_back</span>
                Back to Project
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  `,
})
export class ReportComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private indexer = inject(IndexerService);
  private titleService = inject(TitleService);
  
  projectId: string = '';
  nostrPubKey = signal<string>('');
  copied = signal<string | null>(null);

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
    this.titleService.setTitle(`Report Project - ${this.projectId}`);
    
    if (this.projectId) {
      this.loadProjectDetails();
    }
  }

  async loadProjectDetails() {
    try {
      const project = await this.indexer.fetchProject(this.projectId);
      if (project && project.details) {
        this.nostrPubKey.set(project.details.nostrPubKey);
      }
    } catch (error) {
      console.error('Error loading project details:', error);
    }
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      // Set which field was copied
      const field = text === this.projectId ? 'id' : 'npub';
      this.copied.set(field);
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        if (this.copied() === field) {
          this.copied.set(null);
        }
      }, 2000);
    });
  }
}
