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
        <div class="report-header">
          <h1>Report Project</h1>
          <div class="alert warning">
            <span class="material-icons">warning</span>
            <p>You're about to report project <strong>{{ projectId }}</strong> as potentially problematic.</p>
          </div>
        </div>

        <div class="report-sections">
          <section class="scam-section">
            <h2>What to look for in potential scams</h2>
            
            <div class="scam-indicators">
              <div class="scam-grid">
                <div class="scam-item">
                  <div class="scam-icon">
                    <span class="material-icons">trending_up</span>
                  </div>
                  <div class="scam-content">
                    <strong>Unrealistic promises</strong>
                    <p>Projects that guarantee extremely high returns or profit</p>
                  </div>
                </div>
                
                <div class="scam-item">
                  <div class="scam-icon">
                    <span class="material-icons">timer</span>
                  </div>
                  <div class="scam-content">
                    <strong>Pressure tactics</strong>
                    <p>Creating urgency with "limited time" offers</p>
                  </div>
                </div>
                
                <div class="scam-item">
                  <div class="scam-icon">
                    <span class="material-icons">help_outline</span>
                  </div>
                  <div class="scam-content">
                    <strong>Vague details</strong>
                    <p>Lack of clear information about the team, roadmap, or technology</p>
                  </div>
                </div>
                
                <div class="scam-item">
                  <div class="scam-icon">
                    <span class="material-icons">no_accounts</span>
                  </div>
                  <div class="scam-content">
                    <strong>No verifiable identity</strong>
                    <p>Team members without public profiles or history</p>
                  </div>
                </div>
                
                <div class="scam-item">
                  <div class="scam-icon">
                    <span class="material-icons">sms_failed</span>
                  </div>
                  <div class="scam-content">
                    <strong>Poor communication</strong>
                    <p>Website or documentation with spelling/grammar errors</p>
                  </div>
                </div>
                
                <div class="scam-item">
                  <div class="scam-icon">
                    <span class="material-icons">content_copy</span>
                  </div>
                  <div class="scam-content">
                    <strong>Copy of another project</strong>
                    <p>Very similar to an existing project with minor changes</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="info-section">
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
                    aria-label="Copy project ID"
                    title="Copy to clipboard"
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
                      aria-label="Copy Nostr public key"
                      title="Copy to clipboard"
                    >
                      <span class="material-icons">{{ copied() === 'npub' ? 'check' : 'content_copy' }}</span>
                    </button>
                  </div>
                </div>
              }
            </div>
          </section>

          <section class="action-section">
            <div class="actions">
              <a href="https://github.com/block-core/blockcore-lists/issues/new?title=Report Problematic Angor Project: {{ projectId }}&body=I would like to report an issue with the project: {{ projectId }}." 
                target="_blank" 
                rel="noopener noreferrer"
                class="report-button">
                <span class="material-icons">flag</span>
                Submit Report on GitHub
              </a>
              
              <a [routerLink]="['/project', projectId]" class="back-button">
                <span class="material-icons">arrow_back</span>
                Back to Project
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .report-container {
      max-width: 900px;
      margin: 0 auto;
      background: var(--surface-card);
      border-radius: 16px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    
    .report-container:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.12);
    }
    
    .report-header {
      padding: 2rem;
      border-bottom: 1px solid var(--border);
    }
    
    .report-sections {
      padding: 0 2rem 2rem;
    }
    
    h1 {
      margin-bottom: 1.5rem;
      color: var(--text);
      font-size: 2.25rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    
    h2 {
      margin: 2rem 0 1rem;
      color: var(--text);
      font-size: 1.5rem;
      font-weight: 600;
      position: relative;
      padding-bottom: 0.5rem;
    }
    
    h2::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 60px;
      height: 3px;
      background: var(--accent);
      border-radius: 2px;
    }
    
    .alert {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      padding: 1.5rem;
      border-radius: 12px;
      margin-bottom: 2rem;
      transition: all 0.3s ease;
    }
    
    .alert.warning {
      background-color: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
    }
    
    .alert .material-icons {
      font-size: 1.75rem;
      color: #ff9800;
    }
    
    .alert p {
      margin: 0;
      line-height: 1.6;
      font-size: 1.1rem;
    }
    
    .scam-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }
    
    .scam-item {
      display: flex;
      gap: 1rem;
      padding: 1.25rem;
      background: var(--surface-hover);
      border-radius: 12px;
      transition: all 0.3s ease;
      border: 1px solid transparent;
    }
    
    .scam-item:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
      border-color: var(--border);
    }
    
    .scam-icon {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      background: var(--accent);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .scam-icon .material-icons {
      color: white;
      font-size: 1.5rem;
    }
    
    .scam-content {
      flex-grow: 1;
    }
    
    .scam-content strong {
      display: block;
      margin-bottom: 0.5rem;
      color: var(--text);
      font-weight: 600;
    }
    
    .scam-content p {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.5;
      color: var(--text-secondary);
    }
    
    .project-info {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    
    .info-item {
      width: 100%;
    }
    
    .info-item label {
      display: block;
      margin-bottom: 0.75rem;
      font-weight: 600;
      color: var(--text);
    }
    
    .copy-field {
      display: flex;
      width: 100%;
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      transition: all 0.3s ease;
    }
    
    .copy-field:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .copy-field input {
      flex: 1;
      padding: 1rem 3rem 1rem 1rem;
      font-family: monospace;
      background: var(--surface-hover);
      border: 1px solid var(--border);
      color: var(--text);
      width: 100%;
      font-size: 1rem;
      border-radius: 8px;
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
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      transition: all 0.3s ease;
    }
    
    .copy-button:hover {
      background: var(--accent);
      color: white;
    }
    
    .copy-button.copied {
      background: #4CAF50;
      color: white;
      animation: pulse 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    
    @keyframes pulse {
      0% { transform: translateY(-50%) scale(1); }
      50% { transform: translateY(-50%) scale(1.2); }
      100% { transform: translateY(-50%) scale(1); }
    }
    
    .copy-button .material-icons {
      font-size: 1.25rem;
    }
    
    .actions {
      display: flex;
      gap: 1.5rem;
      margin-top: 3rem;
      flex-wrap: wrap;
    }
    
    .report-button, .back-button {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.75rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
      z-index: 1;
    }
    
    .report-button {
      background: var(--accent);
      color: white;
    }
    
    .report-button::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(45deg, var(--accent-dark), var(--accent));
      z-index: -1;
      transition: opacity 0.3s ease;
      opacity: 0;
    }
    
    .report-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(8, 108, 129, 0.2);
    }
    
    .report-button:hover::before {
      opacity: 1;
    }
    
    .back-button {
      background: var(--surface-hover);
      color: var(--text);
      border: 1px solid var(--border);
    }
    
    .back-button:hover {
      background: var(--background);
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.05);
    }
    
    .material-icons {
      font-size: 1.25rem;
      transition: transform 0.3s ease;
    }
    
    .report-button:hover .material-icons {
      animation: wave 0.5s ease infinite alternate;
    }
    
    .back-button:hover .material-icons {
      animation: slideLeft 0.5s ease infinite alternate;
    }
    
    @keyframes wave {
      0% { transform: rotate(-5deg); }
      100% { transform: rotate(5deg); }
    }
    
    @keyframes slideLeft {
      0% { transform: translateX(0); }
      100% { transform: translateX(-3px); }
    }
    
    @media (max-width: 768px) {
      .container {
        padding: 1rem;
      }
      
      .report-container {
        border-radius: 12px;
      }
      
      .report-header {
        padding: 1.5rem;
      }
      
      .report-sections {
        padding: 0 1.5rem 1.5rem;
      }
      
      h1 {
        font-size: 1.75rem;
      }
      
      .scam-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
      }
      
      .alert {
        padding: 1.25rem;
        flex-direction: column;
        align-items: flex-start;
      }
      
      .actions {
        flex-direction: column;
        gap: 1rem;
      }
      
      .report-button, .back-button {
        width: 100%;
        justify-content: center;
      }
    }
    
    @media (max-width: 480px) {
      .report-header {
        padding: 1.25rem;
      }
      
      .report-sections {
        padding: 0 1.25rem 1.25rem;
      }
      
      h1 {
        font-size: 1.5rem;
      }
      
      .scam-item {
        padding: 1rem;
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
