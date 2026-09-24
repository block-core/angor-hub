import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import { TitleService } from '../../services/title.service';
import { MetaService } from '../../services/meta.service';

interface Step {
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-bitfest',
  standalone: true,
  imports: [CommonModule, RouterLink, BreadcrumbComponent],
  template: `
    <div class="container mx-auto px-4 pt-8 pb-12 relative">
      <app-breadcrumb
        [items]="[
          { label: 'Home', url: '/' },
          { label: 'Bitfest Hackathon', url: '' }
        ]"
        class="mb-4"
      ></app-breadcrumb>

      <div class="max-w-4xl mx-auto bg-surface-card rounded-2xl shadow-lg overflow-hidden transition duration-300 ease-in-out hover:-translate-y-1 hover:shadow-xl">
        <div class="p-6 md:p-8 border-b border-border">
          <h1 class="mb-4 text-text text-3xl md:text-4xl font-bold tracking-tight">Bitfest Hackathon on Angor</h1>
          <p class="m-0 leading-relaxed text-base text-text-secondary">
            Taking part in the
            <a href="https://bitfest.uk/hackathon/" target="_blank" rel="noopener noreferrer" class="text-accent font-semibold hover:underline">Bitfest Hackathon</a>?
            Follow the steps below to launch your project on Angor so it can be discovered, followed and funded by the community.
          </p>

          <div class="flex gap-4 items-start p-4 rounded-xl mt-6 bg-accent/10 border border-accent/30 transition duration-300 ease-in-out">
            <span class="material-icons text-2xl text-accent mt-1 flex-shrink-0">info</span>
            <p class="m-0 leading-relaxed text-base text-text-secondary">
              Every hackathon submission must select the project type <strong class="text-text font-semibold">"I am looking for support"</strong>
              (shown as <strong class="text-text font-semibold">Fund</strong>) and be named
              <strong class="text-text font-semibold">"Bitfest Hackathon - your project name"</strong> &mdash; e.g.
              <em class="text-text">"Bitfest Hackathon - Lightning Notes"</em>.
            </p>
          </div>
        </div>

        <div class="px-4 md:px-8 pb-8">
          <section class="steps-section">
            <h2 class="mt-8 mb-6 text-text text-xl md:text-2xl font-semibold relative pb-3 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-16 after:h-1 after:bg-accent after:rounded">
              Step-by-step guide
            </h2>

            <ol class="flex flex-col gap-4">
              @for (step of steps; track step.title; let i = $index) {
                <li class="flex gap-4 p-5 bg-surface-hover rounded-xl transition duration-300 ease-in-out border border-transparent hover:-translate-y-1 hover:shadow-md hover:border-border">
                  <div class="flex-shrink-0 w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                    <span class="material-icons text-white text-2xl">{{ step.icon }}</span>
                  </div>
                  <div class="flex-grow">
                    <strong class="block mb-2 text-text font-semibold">{{ i + 1 }}. {{ step.title }}</strong>
                    <p class="m-0 text-sm md:text-base leading-normal text-text-secondary" [innerHTML]="step.description"></p>
                  </div>
                </li>
              }
            </ol>
          </section>

          <section class="checklist-section">
            <h2 class="mt-10 mb-6 text-text text-xl md:text-2xl font-semibold relative pb-3 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-16 after:h-1 after:bg-accent after:rounded">
              Project checklist
            </h2>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              @for (item of checklist; track item) {
                <div class="flex gap-3 items-start p-4 bg-surface-hover rounded-xl border border-border">
                  <span class="material-icons text-accent text-xl mt-0.5 flex-shrink-0">check_circle</span>
                  <p class="m-0 text-sm md:text-base leading-normal text-text-secondary">{{ item }}</p>
                </div>
              }
            </div>
          </section>

          <section class="action-section">
            <div class="flex flex-col md:flex-row gap-4 md:gap-6 mt-10 pt-6 border-t border-border">
              <a routerLink="/launch" class="btn-base btn-primary w-full md:w-auto">
                <span class="material-icons text-lg">rocket_launch</span>
                Launch Your Project
              </a>

              <a href="https://bitfest.uk/hackathon/" target="_blank" rel="noopener noreferrer" class="btn-base btn-secondary w-full md:w-auto">
                <span class="material-icons text-lg">open_in_new</span>
                Bitfest Hackathon Details
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  `,
})
export class BitfestComponent implements OnInit {
  private titleService = inject(TitleService);
  private metaService = inject(MetaService);

  protected steps: Step[] = [
    {
      icon: 'download',
      title: 'Get the Angor app',
      description: 'Download the Angor app (desktop or mobile) to create and manage your project. Your project keys never leave your device.',
    },
    {
      icon: 'add_circle',
      title: 'Create a new project',
      description: 'In the app, choose <strong class="text-text">Create Project</strong> and set the project name to <strong class="text-text">"Bitfest Hackathon - your project name"</strong>, replacing "your project name" with your own hackathon entry name.',
    },
    {
      icon: 'volunteer_activism',
      title: 'Select the project type',
      description: 'Choose the project type <strong class="text-text">"I am looking for support"</strong> (this is displayed elsewhere as <strong class="text-text">Fund</strong>) &mdash; a simple, no-lockup crowdfunding model, ideal for hackathon submissions.',
    },
    {
      icon: 'description',
      title: 'Add a description',
      description: 'Describe what you\'re building for the Bitfest Hackathon, the problem it solves, and a link to your GitHub repository or demo.',
    },
    {
      icon: 'image',
      title: 'Add images',
      description: 'Select a logo and banner image for your project so it stands out on Angor Hub.',
    },
    {
      icon: 'savings',
      title: 'Set your goal and threshold',
      description: 'Set the <strong class="text-text">goal</strong> to <strong class="text-text">0.01 BTC</strong> and set the <strong class="text-text">threshold</strong> to <strong class="text-text">0.01 BTC</strong> as well.',
    },
    {
      icon: 'event_repeat',
      title: 'Choose the payout frequency',
      description: 'Select <strong class="text-text">weekly</strong> with <strong class="text-text">3 installments</strong>, matching the 3-week hackathon timeline, and pick the day of the week you want to be able to unlock the funds.',
    },
    {
      icon: 'schedule',
      title: 'Generate the payout schedule',
      description: 'Generate the payout schedule based on your selections. This determines when each installment of funds becomes available to you.',
    },
    {
      icon: 'rocket_launch',
      title: 'Deploy the project',
      description: 'Continue to deploy your project on-chain. You will need about <strong class="text-text">0.000012 BTC (~$1)</strong> to deploy a project to Angor &mdash; if you need help with that, get in touch with the Angor team for funding.',
    },
    {
      icon: 'publish',
      title: 'Publish and share',
      description: 'Once deployed, your project is broadcast to Nostr relays and automatically indexed on <a href="/explore" class="text-accent hover:underline">Angor Hub</a>. Copy your project link and submit it to the Bitfest Hackathon organizers.',
    },
    {
      icon: 'key',
      title: 'Back up your wallet seed words',
      description: 'Remember to save your wallet seed words somewhere safe &mdash; they can be found in <strong class="text-text">Settings</strong>. Anyone with these words can access your funds, so never share them with anyone.',
    },
  ];

  protected checklist: string[] = [
    'Project type is set to "I am looking for support" (Fund)',
    'Project name starts with "Bitfest Hackathon - "',
    'Goal and threshold are both set to 0.01 BTC',
    'Payout frequency is weekly with 3 installments',
    'Payout schedule has been generated',
    'Project is deployed and visible on Angor Hub',
    'Project link is submitted to the hackathon organizers',
    'Wallet seed words have been backed up from Settings',
  ];

  ngOnInit(): void {
    this.titleService.setTitle('Bitfest Hackathon - Create Your Project on Angor');
    this.metaService.updateMetaTags({
      title: 'Bitfest Hackathon - Create Your Project on Angor',
      description: 'Step-by-step instructions for creating a Bitfest Hackathon project on Angor: select "I am looking for support" (Fund), name it "Bitfest Hackathon - your project name", and set a weekly 3-installment schedule.',
      image: 'https://angor.io/assets/angor-hub-social.png',
      url: 'https://angor.io/bitfest',
    });
  }
}
