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
    <section class="hero">
      <app-breadcrumb
        [items]="[
          { label: 'Home', url: '/' },
          { label: 'Explore', url: '/explore' },
          { label: projectId, url: '/project/' + projectId },
          { label: 'Report', url: '' }
        ]"
      ></app-breadcrumb>
    </section>

    <div class="container">
      <div class="report-container">
        <h1>Report Project</h1>
        
        <div class="alert warning">
          <span class="material-icons">warning</span>
          <p>You're about to report project <strong>{{ projectId }}</strong> as potentially problematic.</p>
        </div>

        <h2>What to look for in potential scams</h2>
        
        <div class="scam-indicators">
          <ul>
            <li>
              <strong>Unrealistic promises:</strong> Projects that guarantee extremely high returns or profit
            </li>
            <li>
              <strong>Pressure tactics:</strong> Creating urgency with "limited time" offers
            </li>
            <li>
              <strong>Vague details:</strong> Lack of clear information about the team, roadmap, or technology
            </li>
            <li>
              <strong>No verifiable identity:</strong> Team members without public profiles or history
            </li>
            <li>
              <strong>Poor communication:</strong> Website or documentation with spelling/grammar errors
            </li>
            <li>
              <strong>Copy of another project:</strong> Very similar to an existing project with minor changes
            </li>
          </ul>
        </div>

        <h2>Project Information</h2>
        
        <div class="project-info">
          <div class="info-item">
            <label>Project ID</label>
            <div class="copy-field">
              <input type="text" [value]="projectId" readonly />
              <button 
                (click)="copyToClipboard(projectId)" 
                class="copy-button" 
                [class.copied]="copied() === 'id'"
              >
                <span class="material-icons">{{ copied() === 'id' ? 'check' : 'content_copy' }}</span>
              </button>
            </div>
          </div>

          @if (nostrPubKey()) {
            <div class="info-item">
              <label>Nostr Public Key</label>
              <div class="copy-field">
                <input type="text" [value]="nostrPubKey()" readonly />
                <button 
                  (click)="copyToClipboard(nostrPubKey())" 
                  class="copy-button"
                  [class.copied]="copied() === 'npub'"
                >
                  <span class="material-icons">{{ copied() === 'npub' ? 'check' : 'content_copy' }}</span>
                </button>
              </div>
            </div>
          }
        </div>

        <div class="actions">
          <a href="https://github.com/block-core/blockcore-lists/issues/new?title=Report Problematic Angor Project: {{ projectId }}&body=I would like to report an issue with the project: {{ projectId }}." 
             target="_blank" 
             class="report-button">
            <span class="material-icons">flag</span>
            Submit Report on GitHub
          </a>
          
          <a [routerLink]="['/project', projectId]" class="back-button">
            <span class="material-icons">arrow_back</span>
            Back to Project
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      padding: 2rem;
    }
    
    .report-container {
      max-width: 800px;
      margin: 0 auto;
    }
    
    h1 {
      margin-bottom: 1.5rem;
      color: var(--text);
    }
    
    h2 {
      margin: 2rem 0 1rem;
      color: var(--text);
    }
    
    .alert {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
    }
    
    .alert.warning {
      background-color: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
    }
    
    .alert .material-icons {
      font-size: 1.5rem;
      color: #ff9800;
    }
    
    .alert p {
      margin: 0;
      line-height: 1.5;
    }
    
    .scam-indicators {
      background: var(--surface-card);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      border: 1px solid var(--border);
    }
    
    .scam-indicators ul {
      margin: 0;
      padding-left: 1.5rem;
    }
    
    .scam-indicators li {
      margin-bottom: 0.75rem;
      line-height: 1.5;
    }
    
    .scam-indicators li:last-child {
      margin-bottom: 0;
    }
    
    .project-info {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    
    .info-item {
      width: 100%;
    }
    
    .info-item label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }
    
    .copy-field {
      display: flex;
      width: 100%;
      position: relative;
    }
    
    .copy-field input {
      flex: 1;
      padding: 0.75rem;
      font-family: monospace;
      background: var(--surface-card);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text);
      width: 100%;
    }
    
    .copy-button {
      position: absolute;
      right: 0.5rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      width: 2rem;
      height: 2rem;
      border-radius: 4px;
    }
    
    .copy-button:hover {
      background: var(--surface-hover);
      color: var(--text);
    }
    
    .copy-button.copied {
      color: green;
    }
    
    .actions {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      margin-top: 2rem;
    }
    
    .report-button {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: var(--accent);
      color: white;
      border-radius: 4px;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s ease;
    }
    
    .report-button:hover {
      background: var(--accent-light);
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    
    .back-button {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: var(--surface-card);
      color: var(--text);
      border-radius: 4px;
      text-decoration: none;
      border: 1px solid var(--border);
      transition: all 0.2s ease;
    }
    
    .back-button:hover {
      background: var(--surface-hover);
    }
    
    @media (max-width: 768px) {
      .container {
        padding: 1rem;
      }
      
      .actions {
        flex-direction: column;
      }
      
      .report-button, .back-button {
        width: 100%;
        justify-content: center;
      }
    }
  `]
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
