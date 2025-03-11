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

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [
    CommonModule,
    BreadcrumbComponent,
    AgoPipe,
    RouterModule,
    ImagePopupComponent,
    ProfileComponent,
    MarkdownModule,
  ],
  template: `
    <!-- <app-breadcrumb
      [items]="[
        { label: 'Home', url: '/' },
        { label: 'Explore', url: '/explore' },
        { label: projectId, url: '' }
      ]"
    ></app-breadcrumb> -->

    <!-- <section
      class="hero"
    >
    <app-breadcrumb
      [items]="[
        { label: 'Home', url: '/' },
        { label: 'Explore', url: '/explore' },
        { label: projectId, url: '' }
      ]"
    ></app-breadcrumb>

    </section> -->

    <section class="hero">
      <app-breadcrumb
        [items]="[
          { label: 'Home', url: '/' },
          { label: 'Explore', url: '/explore' },
          { label: projectId, url: '' }
        ]"
      ></app-breadcrumb>

      <div
        class="project-details-banner"
        [ngStyle]="{
          'background-image': project()?.metadata?.banner
            ? 'url(' + project()?.metadata?.banner + ')'
            : 'none'
        }"
      ></div>

      <div class="hero-wrapper">
        <div class="hero-content">
          @if (!project() && indexer.loading()) {
          <div class="loading-spinner">
            <div class="spinner"></div>
          </div>
          }
        </div>
      </div>
    </section>

    <!-- Add new mobile invest button here -->
    <div class="mobile-invest-button-container">
      <button
        class="invest-button"
        [disabled]="isProjectNotStarted()"
        [class.disabled]="isProjectNotStarted()"
        (click)="!isProjectNotStarted() && openInvestWindow()"
      >
        @if (isProjectNotStarted()) { Starts
        {{ project()?.details?.startDate ?? 0 | ago }}
        } @else { Invest Now }
      </button>
    </div>

    <div class="container">
      @if (project()) {
      <div class="project-header">
        @if (project()?.metadata?.['picture']) {
        <img
          #projectImage
          [src]="project()?.metadata?.['picture']"
          class="project-logo"
          alt="Project logo"
          (click)="showImagePopup = true"
          [style.cursor]="'pointer'"
          loading="eager"
        />
        }
        <div class="project-title-content">
          <div class="project-title-header">
            <h1>{{ project()?.metadata?.name || projectId }}</h1>

            <span
              [title]="'Click to toggle as favorite'"
              [class.favorite]="isFavorite()"
              (click)="toggleFavorite()"
              class="material-icons favorite-icon"
              >{{ isFavorite() ? 'star' : 'star_border' }}</span
            >

            <!-- <mat-icon 
            class="favorite-icon" 
            [class.favorite]="isFavorite()"
            (click)="toggleFavorite()">
            {{ isFavorite() ? 'star' : 'star_border' }}
          </mat-icon> -->
          </div>

          <!-- <h1>{{ project()?.metadata?.name || projectId }}</h1> -->

          <p class="project-about">{{ project()?.metadata?.about }}</p>
          @if (project()?.details?.nostrPubKey) { 
          <div class="external-links">
            <a
              [href]="'https://primal.net/p/' + user?.npub"
              target="_blank"
              class="external-link-button"
            >
              <span class="material-icons">launch</span>
              Primal
            </a>
            <a
              [href]="'https://notes.blockcore.net/p/' + user?.npub"
              target="_blank"
              class="external-link-button"
            >
              <span class="material-icons">launch</span>
              Notes
            </a>
            <a
              [href]="'https://njump.me/' + user?.npub"
              target="_blank"
              class="external-link-button"
            >
              <span class="material-icons">launch</span>
              njump
            </a>
          </div>
          }
          <div class="social-links">
            @for (identity of project()?.externalIdentities; track
            identity.platform) {
            <a
              [href]="getSocialLink(identity)"
              target="_blank"
              class="social-link"
              [title]="identity.username"
            >
              <span class="material-icons">{{
                getSocialIcon(identity.platform)
              }}</span>
              <span>{{ formatUsername(identity.username) }}</span>
            </a>
            }
          </div>
        </div>
        <div class="invest-button-container">
          <button
            class="invest-button"
            [disabled]="isProjectNotStarted()"
            [class.disabled]="isProjectNotStarted()"
            (click)="!isProjectNotStarted() && openInvestWindow()"
          >
            @if (isProjectNotStarted()) { Starts
            {{ project()?.details?.startDate ?? 0 | ago }}
            } @else { Invest Now }
          </button>
        </div>
      </div>

      @if (showImagePopup && project()?.metadata?.['picture']) {
      <app-image-popup
        [imageUrl]="project()?.metadata?.['picture']?.toString() || ''"
        altText="Project logo"
        (close)="showImagePopup = false"
      ></app-image-popup>
      }

      <div class="tabs">
        <button
          *ngFor="let tab of tabs"
          [class.active]="activeTab === tab.id"
          (click)="setActiveTab(tab.id)"
        >
          <span class="tab-text">{{ tab.label }}</span>
          <span class="tab-icon">{{ tab.icon }}</span>
        </button>
      </div>

      <div class="tab-content" [ngSwitch]="activeTab">
        <div *ngSwitchCase="'project'">
          <div class="project-grid">
            <!-- Project Content -->
            <div class="project-content">
              @if (project()?.media?.length) {
              <div class="carousel">
                <div
                  class="carousel-inner"
                  [style.transform]="'translateX(' + -currentSlide * 100 + '%)'"
                >
                  @for (item of project()?.media; track item.url) { @if
                  (item.type === 'image') {
                  <div class="carousel-item">
                    <img
                      [src]="item.url"
                      alt="Project media"
                      loading="lazy"
                      (click)="showImagePopup = true; selectedImage = item.url"
                    />
                  </div>
                  } }
                </div>
                @if (project()?.media?.length) {
                <button class="carousel-control prev" (click)="prevSlide()">
                  ❮
                </button>
                <button class="carousel-control next" (click)="nextSlide()">
                  ❯
                </button>
                }
              </div>
              } @if (project()?.members?.length) {
              <div class="members-list">
                <h3>Project Members</h3>
                <div class="member-grid">
                  @for (member of project()?.members; track member) {
                  <div class="member-item">
                    <app-profile
                      [npub]="member"
                      [link]="'https://primal.net/p/' + member"
                    ></app-profile>

                    <!-- <span class="material-icons">person</span>
                    <span class="member-npub"
                      ><a
                        href="https://primal.net/p/{{ member }}"
                        target="_blank"
                        >{{ formatNpub(member) }}</a
                      ></span
                    > -->
                  </div>
                  }
                </div>
              </div>
              }

              <div class="content-text">
                <markdown [data]="project()?.content"></markdown>
              </div>
            </div>

            <!-- Project Statistics -->
            <div class="project-sidebar">
              <section class="stats-grid">
                <div
                  class="stat-card investment-card"
                  [style.--investment-percentage]="
                    ((project()?.stats?.amountInvested ?? 0) /
                      ((project()?.details?.targetAmount ?? 1))) *
                      100 +
                    '%'
                  "
                >
                  <div class="stat-values">
                    <div>
                      <div class="stat-value">
                        {{
                          bitcoin.toBTC((project()?.stats?.amountInvested ?? 0))
                        }}
                        {{ networkService.isMain() ? 'BTC' : 'TBTC' }}
                      </div>
                      <div class="stat-label">Total Raised</div>
                    </div>
                    <div>
                      <div class="stat-value target">
                        {{ bitcoin.toBTC(project()?.details?.targetAmount ?? 0) }}
                        {{ networkService.isMain() ? 'BTC' : 'TBTC' }}
                      </div>
                      <div class="stat-label">Target Amount  ({{
                      (
                        ((project()?.stats?.amountInvested ?? 0) /
                          ((project()?.details?.targetAmount ?? 1))) *
                        100
                      ).toFixed(1)
                    }}%)</div>
                    </div>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">
                    {{ project()?.stats?.investorCount }}
                  </div>
                  <div class="stat-label">Total Investors</div>
                </div>
                <div
                  class="stat-card spending-card"
                  [style.--spent-percentage]="getSpentPercentage()"
                >
                  <div class="stat-value">
                    {{
                      bitcoin.toBTC((project()?.stats?.amountSpentSoFarByFounder ?? 0))
                    }}
                    {{ networkService.isMain() ? 'BTC' : 'TBTC' }}
                  </div>
                  <div class="stat-label">
                  Founder has spent ({{ getSpentPercentage() }}%)
                  </div>
                </div>
                <div
                  class="stat-card penalties-card"
                  [style.--penalties-percentage]="getPenaltiesPercentage()"
                >
                  <div class="stat-value">
                    {{ bitcoin.toBTC((project()?.stats?.amountInPenalties ?? 0)) }}
                    {{ networkService.isMain() ? 'BTC' : 'TBTC' }}
                  </div>
                  <div class="stat-label">
                  {{ project()?.stats?.countInPenalties }} Investors withdrew after investing ({{ getPenaltiesPercentage() }}%)
                  </div>
                </div>
                <!-- <div class="stat-card">
                  <div class="stat-value">
                    {{ project()?.stats?.countInPenalties }}
                  </div>
                  <div class="stat-label">Investors who exited</div>
                </div> -->
              </section>

              <!-- Project Details -->
              <section class="project-details">
                <h2>Project Details</h2>
                <div class="info-grid">
                  <!-- <div class="info-item">
                    <label>Target Amount</label>
                    <span>{{ project()?.details?.targetAmount }} BTC</span>
                  </div> -->

                  <div class="info-item">
                    <label>Start Date</label>
                    <span>{{ formatDate(project()?.details?.startDate) }}</span>
                  </div>
                  <div class="info-item">
                    <label>Expiry Date</label>
                    <span>{{
                      formatDate(project()?.details?.expiryDate)
                    }}</span>
                  </div>
                  <div class="info-item">
                    <label>Penalty Days</label>
                    <span>{{ project()?.details?.penaltyDays }} days</span>
                  </div>
                </div>
              </section>

              <!-- Funding Stages -->
              <section class="funding-stages">
                <h2>Funding Stages</h2>
                <div class="stages-timeline">
                  @for (stage of project()?.details?.stages; track $index) {
                  <div class="stage-card">
                    <div class="stage-number">Stage {{ $index + 1 }}</div>
                    <div class="stage-amount">{{ stage.amountToRelease }}%</div>
                    <div class="stage-date">
                      {{ formatDate(stage.releaseDate) }}
                    </div>
                  </div>
                  }
                </div>
              </section>

              <section class="project-details">
                <h2>Public Keys</h2>
                <div class="info-stack">
                  <div class="info-item">
                    <label>Project ID</label>
                    <span class="ellipsis">{{
                      project()?.projectIdentifier
                    }}</span>
                  </div>
                  <div class="info-item">
                    <label>Founder Key</label>
                    <span class="ellipsis">{{ project()?.founderKey }}</span>
                  </div>
                  <div class="info-item">
                    <label>Recovery Key</label>
                    <span class="ellipsis">{{
                      project()?.details?.founderRecoveryKey
                    }}</span>
                  </div>
                  <div class="info-item">
                    <label>Nostr Public Key</label>
                    <span class="ellipsis">
                      {{ user?.npub }}
                    </span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        <div *ngSwitchCase="'faq'" class="faq-tab">
          <h2>Frequently Asked Questions</h2>

          <div class="faq-container">
            <div
              *ngFor="let faq of faqItems; trackBy: trackById"
              class="faq-item"
            >
              <div class="faq-header"></div>
              <div class="form-group">
                <label>Question</label>
                <span>{{ faq.question }}</span>
              </div>
              <div class="form-group">
                <label>Answer</label>
                <span>{{ faq.answer }}</span>
              </div>
            </div>
          </div>
        </div>

        <div *ngSwitchCase="'updates'" class="updates-tab">
          <h2>Project Updates</h2>
          @if (loading()) {
          <div class="loading">Loading updates...</div>
          } @for (update of updates(); track update.id) {
          <div class="update-card">
            <div class="update-header">
              <span class="update-date">{{
                formatDate(update.created_at)
              }}</span>
            </div>
            <div class="update-content">{{ update.content }}</div>
          </div>
          }
        </div>

        <div *ngSwitchCase="'comments'" class="comments-tab">
          <h2>Comments</h2>
          @if (loading()) {
          <div class="loading">Loading comments...</div>
          } @for (comment of comments(); track comment.id) {
          <div class="comment-card">
            <div class="comment-header">
              <span class="comment-author">{{ comment.pubkey }}</span>
              <span class="comment-date">{{
                formatDate(comment.created_at)
              }}</span>
            </div>
            <div class="comment-content">{{ comment.content }}</div>
          </div>
          }
        </div>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .hero-stats {
        display: flex;
        gap: 2rem;
        margin-top: 1rem;
      }

      .hero-stat {
        font-size: 0.9rem;
        opacity: 0.8;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1.5rem;
      }

      .stat-card {
        background: var(--surface-card);
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .stat-value {
        font-size: 1.5rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
      }

      .stat-label {
        font-size: 0.9rem;
        opacity: 0.8;
      }

      .spending-card {
        position: relative;
        overflow: hidden;
      }

      .spending-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: var(--spent-percentage);
        height: 100%;
        background: rgba(255, 165, 0, 0.2);
        z-index: 0;
        transition: width 0.3s ease;
      }

      .spending-card .stat-value,
      .spending-card .stat-label {
        position: relative;
        z-index: 1;
      }

      .penalties-card {
        position: relative;
        overflow: hidden;
      }

      .penalties-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: var(--penalties-percentage);
        height: 100%;
        background: rgba(255, 0, 0, 0.2);
        z-index: 0;
        transition: width 0.3s ease;
      }

      .penalties-card .stat-value,
      .penalties-card .stat-label {
        position: relative;
        z-index: 1;
      }

      .investment-card {
        position: relative;
        overflow: hidden;
        grid-column: span 2;
      }

      .investment-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: var (--investment-percentage);
        height: 100%;
        background: rgba(0, 255, 0, 0.1);
        z-index: 0;
        transition: width 0.3s ease;
      }

      .stat-values {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        position: relative;
        z-index: 1;
      }

      .stat-value.target {
        opacity: 0.7;
        font-size: 1.2rem;
      }

      .project-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
        gap: 2rem;
        margin: 2rem 2rem;
      }

      .project-content {
        background: var(--surface-card);
        padding: 2rem;
        border-radius: 12px;
        border: 1px solid var(--border);
      }

      .content-text {
        font-size: 1.1rem;

      }

      .project-sidebar {
        display: flex;
        flex-direction: column;
        gap: 2rem;
      }

      @media (max-width: 1024px) {
        .project-grid {
          grid-template-columns: 1fr;
        }

        .project-content {
          order: 2;
        }

        .project-sidebar {
          order: 1;
        }
      }

      .project-header {
        display: flex;
        align-items: flex-start;
        gap: 2rem;
        margin: 2rem;
        padding: 0;
      }

      .project-logo {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid var(--border);
      }

      .project-title-content {
        flex: 1;
      }

      .project-title-content h1 {
        margin: 0 0 1rem 0;
        font-size: 2rem;
      }

      .project-about {
        margin: 0;
        font-size: 1.1rem;
        color: var(--text);
        opacity: 0.8;
        margin-bottom: 1rem;
      }

      .primal-link {
        display: inline-block;
        color: var(--primary-color);
        text-decoration: none;
        font-size: 0.9rem;
      }

      .primal-link:hover {
        text-decoration: underline;
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1.5rem;
        margin-top: 1rem;
      }

      .info-item {
        background: var(--surface-card);
        padding: 1rem;
        border-radius: 8px;
      }

      .info-item span {
        font-weight: 700;
      }

      .info-item label {
        display: block;
        font-size: 0.9rem;
        color: var(--text-color-secondary);
        margin-bottom: 0.5rem;
      }

      .ellipsis {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .stages-timeline {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 1rem;
        margin-top: 1rem;
      }

      .stage-card {
        background: var(--surface-card);
        padding: 1.5rem;
        border-radius: 8px;
        text-align: center;
      }

      .stage-number {
        font-weight: bold;
        color: var(--primary-color);
        margin-bottom: 0.5rem;
      }

      .stage-amount {
        font-size: 1.25rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
      }

      .stage-date {
        font-size: 0.9rem;
        color: var(--text-color-secondary);
      }

      .hero {
        height: 200px;
      }

      .info-stack {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 2rem;
      }

      .info-stack .info-item {
        background: var(--background);
        border: 1px solid var(--border);
        padding: 0.75rem 1rem;
        border-radius: 8px;
      }

      .info-stack .info-item label {
        display: block;
        font-size: 0.8rem;
        color: var(--text);
        opacity: 0.7;
        margin-bottom: 0.25rem;
      }

      .info-stack .info-item span {
        display: block;
        font-family: monospace;
        font-size: 0.9rem;
        word-break: break-all;
        white-space: normal;
        line-height: 1.4;
      }

      .tabs {
        display: flex;
        gap: 1rem;
        margin: 2rem;
        border-bottom: 1px solid var(--border);
        padding-bottom: 0;
      }

      .tabs button {
        background: none;
        border: none;
        padding: 0.75rem 1.5rem;
        cursor: pointer;
        color: var(--text);
        font-size: 1rem;
        position: relative;
        transition: all 0.3s ease;
        opacity: 0.7;
        flex: 1;
      }

      @media (max-width: 540px) {
        .tabs {
          gap: 0.5rem;
          margin: 1rem;
        }

        .tabs button {
          padding: 0.75rem 0.5rem;
          min-width: 0;
          text-align: center;
        }

        .tab-text {
          display: none;
        }

        .tab-icon {
          display: inline;
          font-size: 1.2rem;
        }
      }

      .tabs button:hover {
        opacity: 1;
        background: var(--background);
      }

      .tabs button.active {
        color: var(--accent);
        opacity: 1;
      }

      .tabs button.active::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--accent);
        border-radius: 2px 2px 0 0;
      }

      .tab-icon {
        display: none;
      }

      @media (max-width: 540px) {
        .tab-text {
          display: none;
        }

        .tab-icon {
          display: inline;
          font-size: 1.2rem;
        }

        .tabs button {
          padding: 0.75rem 1rem;
        }
      }

      .update-card,
      .comment-card {
        background: var(--surface-card);
        padding: 2rem;
        margin-bottom: 1.5rem;
        border-radius: 12px;
        border: 1px solid var(--border);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .update-card:hover,
      .comment-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .update-header,
      .comment-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--border);
      }

      .update-date,
      .comment-date {
        font-size: 0.9rem;
        color: var(--text-color-secondary);
      }

      .comment-author {
        font-weight: 600;
        color: var (--primary-color);
      }

      .update-content,
      .comment-content {
        font-size: 1.1rem;
        line-height: 1.6;
        color: var(--text);
        white-space: pre-wrap;
      }

      .loading {
        text-align: center;
        padding: 2rem;
        color: var(--text-color-secondary);
      }

      .project-details-banner {
        min-height: 170px;
        width: 100%;
        background-size: cover;
        background-position: center;
        background-color: rgba(0, 0, 0, 0.1);
        border-radius: 12px;
      }

      .faq-tab,
      .updates-tab,
      .comments-tab {
        margin: 2rem;
      }

      .invest-button-container {
        margin-left: auto;
        display: flex;
        align-items: flex-start;
        padding-right: 1rem;
      }

      .invest-button {
        padding: 1rem 2rem;
        font-size: 1.2rem;
        font-weight: bold;
        color: white;
        background: var(--accent);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 200px;
      }

      .invest-button:hover:not(.disabled) {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .invest-button.disabled {
        background: var(--surface-card);
        color: var(--text-color-secondary);
        cursor: not-allowed;
        font-size: 1rem;
      }

      .mobile-invest-button-container {
        display: none;
        padding: 1rem 2rem;
        margin-top: -1rem;
      }

      @media (max-width: 768px) {
        .mobile-invest-button-container {
          display: block;
          padding: 1rem;
          margin: 1rem 0;
        }

        .mobile-invest-button-container .invest-button {
          width: 100%;
          min-width: unset;
        }

        .invest-button-container {
          display: none;
        }

        .project-header {
          margin: 1rem;
        }
      }

      .faq-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        max-width: 800px;
        margin: 2rem auto;
      }

      .faq-item {
        background: var(--surface-card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 1.5rem;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .faq-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .faq-item .form-group {
        margin-bottom: 1rem;
      }

      .faq-item .form-group:last-child {
        margin-bottom: 0;
      }

      .faq-item label {
        display: block;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--accent);
        margin-bottom: 0.5rem;
      }

      .faq-item span {
        display: block;
        font-size: 1rem;
        line-height: 1.6;
        color: var(--text);
        white-space: pre-wrap;
      }

      .faq-item .form-group:first-child span {
        font-weight: 500;
      }

      @media (max-width: 768px) {
        .faq-container {
          margin: 1rem;
        }

        .faq-item {
          padding: 1rem;
        }
      }

      .social-links {
        display: flex;
        gap: 1rem;
        margin-top: 0.5rem;
        flex-wrap: wrap;
      }

      .social-link {
        color: var(--text-secondary);
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .social-link:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
      }

      .social-link .material-icons {
        font-size: 1.2rem;
      }

      .carousel {
        position: relative;
        width: 100%;
        margin-bottom: 2rem;
        border-radius: 12px;
        overflow: hidden;
        aspect-ratio: 16/9;
      }

      .carousel-inner {
        display: flex;
        transition: transform 0.3s ease-in-out;
        height: 100%;
      }

      .carousel-item {
        min-width: 100%;
        height: 100%;
      }

      .carousel-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        cursor: pointer;
      }

      .carousel-control {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.5);
        color: white;
        border: none;
        padding: 1rem;
        cursor: pointer;
        font-size: 1.5rem;
        transition: background-color 0.2s;
      }

      .carousel-control:hover {
        background: rgba(0, 0, 0, 0.7);
      }

      .carousel-control.prev {
        left: 0;
        border-radius: 0 4px 4px 0;
      }

      .carousel-control.next {
        right: 0;
        border-radius: 4px 0 0 4px;
      }

      .members-list {
        margin: 2rem 0;
        padding: 1.5rem;
        background: var(--surface-card);
        border-radius: 8px;
        border: 1px solid var(--border);
      }

      .members-list h3 {
        margin: 0 0 1rem 0;
        color: var(--text);
      }

      .member-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
      }

      .member-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        background: var(--background);
        border-radius: 4px;
        font-family: monospace;
      }

      .member-item .material-icons {
        font-size: 1.2rem;
        opacity: 0.7;
      }

      .project-title-header {
        display: flex;
        gap: 1em;
      }

      .project-title-header h1 {
        padding: 0;
        margin: 0;
      }

      .favorite-icon {
        align-self: center;
        align-items: center;

        cursor: pointer;
        color: #666;

        &.favorite {
          color: #ffd700;
        }

        &:hover {
          transform: scale(1.1);
        }
      }

      .external-links {
        display: flex;
        gap: 0.75rem;
        margin: 0.75rem 0;
        flex-wrap: wrap;
      }

      .external-link-button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: var(--surface-card);
        border: 1px solid var(--border);
        border-radius: 6px;
        color: var(--text);
        text-decoration: none;
        font-size: 0.9rem;
        transition: all 0.2s ease;
      }

      .external-link-button:hover {
        background: var(--surface-hover);
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .external-link-button .material-icons {
        font-size: 1rem;
        opacity: 0.7;
      }
    `,
  ],
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
            relayUrls: this.relay.relayUrls,
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
              relayUrls: this.relay.relayUrls,
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

          // const update = JSON.parse(event.content);
          // const id = update.projectIdentifier;
          // const project = this.indexer
          //   .projects()
          //   .find((p) => p.projectIdentifier === id);

          // if (project) {
          //   // Only update if new data is newer or we don't have existing details
          //   if (
          //     !project.details ||
          //     event.created_at! > project.details_created_at!
          //   ) {
          //     project.details = update;
          //     project.details_created_at = event.created_at;
          //   }
          // }
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
      }
    } catch (error) {
      console.error('Error loading project:', error);
    }
  }

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
    if (!startDate) return true;
    return Date.now() < startDate * 1000;
  }

  openInvestWindow() {
    const url =
      'https://test.angor.io/view/' + this.project()?.projectIdentifier;
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
}
