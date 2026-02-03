import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IndexerService, IndexedProject } from '../../services/indexer.service';
import { RelayService, ProjectUpdate } from '../../services/relay.service';
import { NetworkService } from '../../services/network.service';
import { WalletService, WalletData } from '../../services/wallet.service';
import { MempoolService, UTXO } from '../../services/mempool.service';
import { AngorTransactionService, BuiltTransaction } from '../../services/angor-transaction.service';
import { BitcoinUtilsService } from '../../services/bitcoin.service';
import { TitleService } from '../../services/title.service';
import { QRCodeComponent } from '../../components/qrcode.component';
import { BreadcrumbComponent } from '../../components/breadcrumb.component';
import { Subscription } from 'rxjs';

type InvestStep = 'loading' | 'amount' | 'payment' | 'processing' | 'complete' | 'error';

@Component({
  selector: 'app-invest',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    QRCodeComponent,
    BreadcrumbComponent
  ],
  template: `
    <div class="min-h-screen bg-surface-ground">
      <!-- Header -->
      <div class="bg-surface-card border-b border-border">
        <div class="max-w-4xl mx-auto px-4 py-6">
          <app-breadcrumb
            [items]="[
              { label: 'Home', url: '/' },
              { label: 'Explore', url: '/explore' },
              { label: project()?.metadata?.name || 'Project', url: '/project/' + projectId },
              { label: 'Invest', url: '' }
            ]">
          </app-breadcrumb>
        </div>
      </div>

      <div class="max-w-4xl mx-auto px-4 py-8">
        <!-- Error State -->
        @if (currentStep() === 'error') {
          <div class="bg-red-50 dark:bg-red-900/20 rounded-2xl p-8 text-center">
            <span class="material-icons text-6xl text-red-500 mb-4">error_outline</span>
            <h2 class="text-2xl font-bold text-text mb-2">Something went wrong</h2>
            <p class="text-text-secondary mb-6">{{ errorMessage() }}</p>
            <div class="flex justify-center gap-4">
              <button
                (click)="retryInvestment()"
                class="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors">
                Try Again
              </button>
              <a
                [routerLink]="['/project', projectId]"
                class="px-6 py-3 bg-surface-hover text-text rounded-lg hover:bg-surface-ground transition-colors">
                Back to Project
              </a>
            </div>
          </div>
        }

        <!-- Loading State -->
        @if (currentStep() === 'loading') {
          <div class="bg-surface-card rounded-2xl p-8 text-center">
            <div class="animate-spin w-16 h-16 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
            <h2 class="text-xl font-bold text-text mb-2">Preparing Investment</h2>
            <p class="text-text-secondary">Loading project details and creating wallet...</p>
          </div>
        }

        <!-- Amount Selection Step -->
        @if (currentStep() === 'amount') {
          <div class="grid lg:grid-cols-2 gap-8">
            <!-- Project Info -->
            <div class="bg-surface-card rounded-2xl p-6">
              <div class="flex items-center gap-4 mb-6">
                @if (project()?.metadata?.['picture']) {
                  <img
                    [src]="project()?.metadata?.['picture']"
                    [alt]="project()?.metadata?.name"
                    class="w-16 h-16 rounded-xl object-cover">
                } @else {
                  <div class="w-16 h-16 rounded-xl bg-accent/20 flex items-center justify-center">
                    <span class="material-icons text-2xl text-accent">rocket_launch</span>
                  </div>
                }
                <div>
                  <h2 class="text-xl font-bold text-text">{{ project()?.metadata?.name || 'Project' }}</h2>
                  <p class="text-sm text-text-secondary">{{ project()?.projectIdentifier }}</p>
                </div>
              </div>

              @if (project()?.metadata?.about) {
                <p class="text-text-secondary text-sm mb-6 line-clamp-3">{{ project()?.metadata?.about }}</p>
              }

              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-text-secondary">Target Amount</span>
                  <span class="text-text font-medium">{{ bitcoin.toBTC(project()?.details?.targetAmount || 0) }} BTC</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-text-secondary">Already Invested</span>
                  <span class="text-text font-medium">{{ bitcoin.toBTC(project()?.stats?.amountInvested || 0) }} BTC</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-text-secondary">Investors</span>
                  <span class="text-text font-medium">{{ project()?.stats?.investorCount || 0 }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-text-secondary">End Date</span>
                  <span class="text-text font-medium">{{ formatDate(project()?.details?.expiryDate) }}</span>
                </div>
              </div>

              @if (penaltyWarning()) {
                <div class="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div class="flex items-start gap-3">
                    <span class="material-icons text-yellow-500">warning</span>
                    <div>
                      <p class="text-sm font-medium text-yellow-700 dark:text-yellow-400">Penalty Period Active</p>
                      <p class="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                        This project is in the penalty period. Early withdrawal may result in penalties.
                      </p>
                    </div>
                  </div>
                </div>
              }
            </div>

            <!-- Investment Amount -->
            <div class="bg-surface-card rounded-2xl p-6">
              <h3 class="text-lg font-bold text-text mb-6">Investment Amount</h3>

              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-text-secondary mb-2">Amount in BTC</label>
                  <div class="relative">
                    <input
                      type="number"
                      [(ngModel)]="investmentBtc"
                      (ngModelChange)="onBtcAmountChange()"
                      step="0.0001"
                      min="0.0001"
                      class="w-full px-4 py-3 bg-surface-ground border border-border rounded-lg text-text text-lg font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="0.001">
                    <span class="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary">BTC</span>
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium text-text-secondary mb-2">Amount in Satoshis</label>
                  <div class="relative">
                    <input
                      type="number"
                      [(ngModel)]="investmentSats"
                      (ngModelChange)="onSatsAmountChange()"
                      step="1"
                      min="10000"
                      class="w-full px-4 py-3 bg-surface-ground border border-border rounded-lg text-text text-lg font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="100000">
                    <span class="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary">sats</span>
                  </div>
                </div>

                <!-- Quick amounts -->
                <div>
                  <label class="block text-sm font-medium text-text-secondary mb-2">Quick Select</label>
                  <div class="grid grid-cols-4 gap-2">
                    @for (amount of quickAmounts; track amount) {
                      <button
                        (click)="setQuickAmount(amount)"
                        class="px-3 py-2 bg-surface-hover hover:bg-accent/10 text-text rounded-lg text-sm font-medium transition-colors">
                        {{ amount }}
                      </button>
                    }
                  </div>
                </div>

                <!-- Fee selection -->
                <div>
                  <label class="block text-sm font-medium text-text-secondary mb-2">Transaction Fee</label>
                  <div class="grid grid-cols-3 gap-2">
                    <button
                      (click)="selectedFeeLevel = 'economy'"
                      [class.ring-2]="selectedFeeLevel === 'economy'"
                      [class.ring-accent]="selectedFeeLevel === 'economy'"
                      class="p-3 bg-surface-hover rounded-lg text-center transition-all">
                      <div class="text-sm font-medium text-text">Economy</div>
                      <div class="text-xs text-text-secondary">{{ recommendedFees()?.economyFee || 1 }} sat/vB</div>
                    </button>
                    <button
                      (click)="selectedFeeLevel = 'normal'"
                      [class.ring-2]="selectedFeeLevel === 'normal'"
                      [class.ring-accent]="selectedFeeLevel === 'normal'"
                      class="p-3 bg-surface-hover rounded-lg text-center transition-all">
                      <div class="text-sm font-medium text-text">Normal</div>
                      <div class="text-xs text-text-secondary">{{ recommendedFees()?.halfHourFee || 5 }} sat/vB</div>
                    </button>
                    <button
                      (click)="selectedFeeLevel = 'fast'"
                      [class.ring-2]="selectedFeeLevel === 'fast'"
                      [class.ring-accent]="selectedFeeLevel === 'fast'"
                      class="p-3 bg-surface-hover rounded-lg text-center transition-all">
                      <div class="text-sm font-medium text-text">Fast</div>
                      <div class="text-xs text-text-secondary">{{ recommendedFees()?.fastestFee || 10 }} sat/vB</div>
                    </button>
                  </div>
                </div>

                <button
                  (click)="proceedToPayment()"
                  [disabled]="!isValidAmount()"
                  class="w-full py-4 bg-accent text-white rounded-lg font-bold text-lg hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Continue to Payment
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Payment Step -->
        @if (currentStep() === 'payment') {
          <div class="grid lg:grid-cols-2 gap-8">
            <!-- QR Code & Address -->
            <div class="bg-surface-card rounded-2xl p-6">
              <h3 class="text-lg font-bold text-text mb-6 flex items-center gap-2">
                <span class="material-icons text-accent">qr_code_2</span>
                Send Bitcoin
              </h3>

              <div class="flex flex-col items-center">
                <app-qrcode
                  [value]="depositAddress()"
                  [size]="220"
                  [showValue]="false">
                </app-qrcode>

                <div class="w-full mt-6 space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-text-secondary mb-2">Deposit Address</label>
                    <div class="flex items-center gap-2 bg-surface-ground rounded-lg px-4 py-3">
                      <span class="text-sm font-mono text-text break-all flex-1">{{ depositAddress() }}</span>
                      <button
                        (click)="copyAddress()"
                        class="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                        [title]="addressCopied() ? 'Copied!' : 'Copy address'">
                        <span class="material-icons text-lg" [class.text-green-500]="addressCopied()">
                          {{ addressCopied() ? 'check' : 'content_copy' }}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-text-secondary mb-2">Amount to Send</label>
                    <div class="flex items-center gap-2 bg-surface-ground rounded-lg px-4 py-3">
                      <span class="text-lg font-bold text-accent">{{ bitcoin.toBTC(totalAmountToSend()) }} BTC</span>
                      <span class="text-sm text-text-secondary">({{ totalAmountToSend().toLocaleString() }} sats)</span>
                    </div>
                    <p class="text-xs text-text-secondary mt-1">Includes {{ investmentSats.toLocaleString() }} sats investment + estimated fee</p>
                  </div>
                </div>

                <!-- Waiting indicator -->
                <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg w-full">
                  <div class="flex items-center gap-3">
                    <div class="animate-pulse">
                      <span class="material-icons text-blue-500">sensors</span>
                    </div>
                    <div>
                      <p class="text-sm font-medium text-blue-700 dark:text-blue-400">Waiting for payment...</p>
                      <p class="text-xs text-blue-600 dark:text-blue-500">Send the exact amount shown above</p>
                    </div>
                  </div>
                </div>

                <!-- Lightning option -->
                @if (showLightningOption) {
                  <button
                    (click)="toggleLightningQR()"
                    class="mt-4 w-full py-3 border border-yellow-500 text-yellow-600 rounded-lg font-medium hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors flex items-center justify-center gap-2">
                    <span class="material-icons">bolt</span>
                    {{ showLightningQR() ? 'Show Bitcoin QR' : 'Pay with Lightning (via Boltz)' }}
                  </button>
                }
              </div>
            </div>

            <!-- Wallet Backup Warning -->
            <div class="space-y-6">
              <div class="bg-surface-card rounded-2xl p-6">
                <h3 class="text-lg font-bold text-text mb-4 flex items-center gap-2">
                  <span class="material-icons text-yellow-500">key</span>
                  Backup Your Wallet
                </h3>

                <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-4">
                  <p class="text-sm text-yellow-700 dark:text-yellow-400 font-medium mb-2">
                    Important: Save these words to recover your investment wallet later.
                  </p>
                  <p class="text-xs text-yellow-600 dark:text-yellow-500">
                    Without these words, you will not be able to access your investment or claim refunds.
                  </p>
                </div>

                @if (showMnemonic()) {
                  <div class="bg-surface-ground rounded-lg p-4 mb-4">
                    <div class="grid grid-cols-3 gap-2">
                      @for (word of mnemonicWords(); track $index) {
                        <div class="flex items-center gap-2 p-2 bg-surface-hover rounded">
                          <span class="text-xs text-text-secondary w-4">{{ $index + 1 }}.</span>
                          <span class="text-sm font-mono text-text">{{ word }}</span>
                        </div>
                      }
                    </div>
                  </div>
                  <button
                    (click)="copyMnemonic()"
                    class="w-full py-3 border border-border text-text rounded-lg font-medium hover:bg-surface-hover transition-colors flex items-center justify-center gap-2">
                    <span class="material-icons text-lg" [class.text-green-500]="mnemonicCopied()">
                      {{ mnemonicCopied() ? 'check' : 'content_copy' }}
                    </span>
                    {{ mnemonicCopied() ? 'Copied!' : 'Copy Seed Words' }}
                  </button>
                } @else {
                  <button
                    (click)="showMnemonic.set(true)"
                    class="w-full py-3 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors flex items-center justify-center gap-2">
                    <span class="material-icons">visibility</span>
                    Reveal Seed Words
                  </button>
                }

                <div class="mt-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="backup-confirmed"
                    [(ngModel)]="backupConfirmed"
                    class="w-4 h-4 rounded border-border text-accent focus:ring-accent">
                  <label for="backup-confirmed" class="text-sm text-text-secondary">
                    I have saved my seed words in a secure location
                  </label>
                </div>
              </div>

              <!-- Investment Summary -->
              <div class="bg-surface-card rounded-2xl p-6">
                <h3 class="text-lg font-bold text-text mb-4">Investment Summary</h3>
                <div class="space-y-3">
                  <div class="flex justify-between">
                    <span class="text-text-secondary">Investment Amount</span>
                    <span class="text-text font-medium">{{ bitcoin.toBTC(investmentSats) }} BTC</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-text-secondary">Estimated Fee</span>
                    <span class="text-text font-medium">~{{ estimatedFee() }} sats</span>
                  </div>
                  <div class="border-t border-border pt-3 flex justify-between">
                    <span class="text-text font-medium">Total to Send</span>
                    <span class="text-accent font-bold">{{ bitcoin.toBTC(totalAmountToSend()) }} BTC</span>
                  </div>
                </div>
              </div>

              <button
                (click)="cancelPayment()"
                class="w-full py-3 bg-surface-hover text-text rounded-lg font-medium hover:bg-surface-ground transition-colors">
                Cancel Investment
              </button>
            </div>
          </div>
        }

        <!-- Processing Step -->
        @if (currentStep() === 'processing') {
          <div class="bg-surface-card rounded-2xl p-8 text-center max-w-lg mx-auto">
            <div class="animate-spin w-20 h-20 border-4 border-accent border-t-transparent rounded-full mx-auto mb-6"></div>
            <h2 class="text-2xl font-bold text-text mb-2">Processing Investment</h2>
            <p class="text-text-secondary mb-6">{{ processingStatus() }}</p>

            <div class="space-y-3 text-left bg-surface-ground rounded-lg p-4">
              @for (step of processingSteps(); track step.id) {
                <div class="flex items-center gap-3">
                  @if (step.status === 'complete') {
                    <span class="material-icons text-green-500">check_circle</span>
                  } @else if (step.status === 'active') {
                    <span class="material-icons text-accent animate-pulse">pending</span>
                  } @else {
                    <span class="material-icons text-text-secondary">circle</span>
                  }
                  <span class="text-sm" [class.text-text]="step.status !== 'pending'" [class.text-text-secondary]="step.status === 'pending'">
                    {{ step.label }}
                  </span>
                </div>
              }
            </div>
          </div>
        }

        <!-- Complete Step -->
        @if (currentStep() === 'complete') {
          <div class="bg-surface-card rounded-2xl p-8 text-center max-w-lg mx-auto">
            <div class="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <span class="material-icons text-5xl text-green-500">check</span>
            </div>
            <h2 class="text-2xl font-bold text-text mb-2">Investment Complete!</h2>
            <p class="text-text-secondary mb-6">Your investment has been successfully submitted to the network.</p>

            <div class="bg-surface-ground rounded-lg p-4 mb-6">
              <div class="space-y-3 text-left">
                <div class="flex justify-between">
                  <span class="text-text-secondary">Amount Invested</span>
                  <span class="text-text font-medium">{{ bitcoin.toBTC(investmentSats) }} BTC</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-text-secondary">Transaction Fee</span>
                  <span class="text-text font-medium">{{ completedTransaction()?.fee || 0 }} sats</span>
                </div>
                <div class="border-t border-border pt-3">
                  <div class="flex justify-between items-start">
                    <span class="text-text-secondary">Transaction ID</span>
                    <a
                      [href]="getExplorerUrl(completedTransaction()?.txId || '')"
                      target="_blank"
                      class="text-accent hover:underline text-sm font-mono truncate max-w-[200px]">
                      {{ formatTxId(completedTransaction()?.txId || '') }}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-3">
              <a
                [routerLink]="['/project', projectId]"
                class="w-full py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-dark transition-colors">
                Back to Project
              </a>
              <a
                [href]="getExplorerUrl(completedTransaction()?.txId || '')"
                target="_blank"
                class="w-full py-3 border border-border text-text rounded-lg font-medium hover:bg-surface-hover transition-colors flex items-center justify-center gap-2">
                <span class="material-icons text-lg">open_in_new</span>
                View on Explorer
              </a>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class InvestComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public indexer = inject(IndexerService);
  private relay = inject(RelayService);
  public networkService = inject(NetworkService);
  private walletService = inject(WalletService);
  private mempoolService = inject(MempoolService);
  private angorTx = inject(AngorTransactionService);
  public bitcoin = inject(BitcoinUtilsService);
  private titleService = inject(TitleService);

  private subscriptions: Subscription[] = [];

  // Route params
  projectId = '';

  // State
  currentStep = signal<InvestStep>('loading');
  errorMessage = signal<string>('');
  project = signal<IndexedProject | null>(null);
  wallet = signal<WalletData | null>(null);

  // Amount inputs
  investmentBtc = 0.001;
  investmentSats = 100000;
  selectedFeeLevel: 'economy' | 'normal' | 'fast' = 'normal';
  quickAmounts = ['0.001', '0.005', '0.01', '0.05', '0.1', '0.5', '1.0', '2.0'];

  // Payment state
  depositAddress = signal<string>('');
  showMnemonic = signal<boolean>(false);
  addressCopied = signal<boolean>(false);
  mnemonicCopied = signal<boolean>(false);
  backupConfirmed = false;
  showLightningOption = false;
  showLightningQR = signal<boolean>(false);

  // Fees
  recommendedFees = signal<{ fastestFee: number; halfHourFee: number; hourFee: number; economyFee: number; minimumFee: number } | null>(null);

  // Processing state
  processingStatus = signal<string>('');
  processingSteps = signal<{ id: string; label: string; status: 'pending' | 'active' | 'complete' }[]>([
    { id: 'payment', label: 'Payment received', status: 'pending' },
    { id: 'build', label: 'Building investment transaction', status: 'pending' },
    { id: 'sign', label: 'Signing transaction', status: 'pending' },
    { id: 'broadcast', label: 'Broadcasting to network', status: 'pending' }
  ]);

  // Completed transaction
  completedTransaction = signal<BuiltTransaction | null>(null);

  // Computed
  mnemonicWords = computed(() => this.wallet()?.mnemonic.split(' ') || []);

  penaltyWarning = computed(() => {
    const details = this.project()?.details;
    if (!details) return false;
    return !this.angorTx.isProjectBelowPenaltyThreshold(details);
  });

  estimatedFee = computed(() => {
    const fees = this.recommendedFees();
    if (!fees) return 500;

    switch (this.selectedFeeLevel) {
      case 'economy': return this.angorTx.calculateFee(1, 2, fees.economyFee);
      case 'normal': return this.angorTx.calculateFee(1, 2, fees.halfHourFee);
      case 'fast': return this.angorTx.calculateFee(1, 2, fees.fastestFee);
      default: return 500;
    }
  });

  totalAmountToSend = computed(() => {
    return this.investmentSats + this.estimatedFee() + 1000; // Extra buffer for fee estimation
  });

  async ngOnInit(): Promise<void> {
    this.titleService.setTitle('Invest');

    // Get project ID from route
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.projectId) {
      this.setError('No project ID provided');
      return;
    }

    // Check for URL parameters (relay, indexer, network)
    const queryParams = this.route.snapshot.queryParams;
    if (queryParams['network']) {
      const network = queryParams['network'] as 'main' | 'test';
      if (network === 'main' || network === 'test') {
        this.networkService.setNetworkFromUrlParam(network);
      }
    }

    await this.initialize();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.mempoolService.stopWatching();
  }

  private async initialize(): Promise<void> {
    try {
      // Fetch recommended fees
      this.mempoolService.getRecommendedFees().then(fees => {
        this.recommendedFees.set(fees);
      });

      // Fetch project data
      let projectData: IndexedProject | null | undefined = this.indexer.getProject(this.projectId);

      if (!projectData) {
        projectData = await this.indexer.fetchProject(this.projectId);
      }

      if (!projectData) {
        this.setError('Project not found');
        return;
      }

      this.project.set(projectData);
      this.titleService.setTitle(`Invest in ${projectData.metadata?.name || 'Project'}`);

      // Fetch project details from Nostr if not available
      if (!projectData.details) {
        this.relay.fetchData([projectData.nostrEventId]);

        // Subscribe to project updates
        const sub = this.relay.projectUpdates.subscribe((event) => {
          if (!event) return;

          try {
            const details: ProjectUpdate = JSON.parse(event.content);
            if (details.projectIdentifier === this.projectId) {
              const currentProject = this.project();
              if (currentProject) {
                currentProject.details = details;
                this.project.set({ ...currentProject });
              }
            }
          } catch (err) {
            console.error('Failed to parse project details:', err);
          }
        });

        this.subscriptions.push(sub);
      }

      // Fetch project stats if not available
      if (!projectData.stats) {
        const stats = await this.indexer.fetchProjectStats(this.projectId);
        if (stats) {
          projectData.stats = stats;
          this.project.set({ ...projectData });
        }
      }

      // Create or load wallet
      const walletData = await this.walletService.loadOrCreateWallet();
      this.wallet.set(walletData);
      this.depositAddress.set(walletData.address);

      // Ready to accept amount
      this.currentStep.set('amount');
    } catch (err) {
      console.error('Initialization error:', err);
      this.setError(err instanceof Error ? err.message : 'Failed to initialize');
    }
  }

  private setError(message: string): void {
    this.errorMessage.set(message);
    this.currentStep.set('error');
  }

  onBtcAmountChange(): void {
    this.investmentSats = Math.round(this.investmentBtc * 100000000);
  }

  onSatsAmountChange(): void {
    this.investmentBtc = this.investmentSats / 100000000;
  }

  setQuickAmount(amount: string): void {
    this.investmentBtc = parseFloat(amount);
    this.onBtcAmountChange();
  }

  isValidAmount(): boolean {
    return this.investmentSats >= 10000; // Minimum 10,000 sats
  }

  proceedToPayment(): void {
    if (!this.isValidAmount()) return;

    // Save wallet to storage
    const walletData = this.wallet();
    if (walletData) {
      this.walletService.saveWalletToStorage(walletData.mnemonic, walletData.address);
    }

    this.currentStep.set('payment');

    // Start watching for payment
    this.startPaymentWatch();
  }

  private async startPaymentWatch(): Promise<void> {
    const address = this.depositAddress();
    if (!address) return;

    // Subscribe to payment detection
    const sub = this.mempoolService.paymentDetected.subscribe(async (utxo) => {
      console.log('Payment detected:', utxo);

      // Check if payment is sufficient
      if (utxo.value >= this.totalAmountToSend()) {
        this.mempoolService.stopWatching();
        await this.processInvestment(utxo);
      } else {
        console.log('Payment amount insufficient, waiting for more...');
      }
    });

    this.subscriptions.push(sub);
    this.mempoolService.startWatchingAddress(address, 3000);
  }

  private async processInvestment(utxo: UTXO): Promise<void> {
    this.currentStep.set('processing');
    this.updateProcessingStep('payment', 'complete');
    this.processingStatus.set('Payment received! Building investment transaction...');

    try {
      // Update step: building
      this.updateProcessingStep('build', 'active');

      const projectDetails = this.project()?.details;
      if (!projectDetails) {
        throw new Error('Project details not available');
      }

      // Get fee rate
      const fees = this.recommendedFees();
      let feeRate = 5;
      if (fees) {
        switch (this.selectedFeeLevel) {
          case 'economy': feeRate = fees.economyFee; break;
          case 'normal': feeRate = fees.halfHourFee; break;
          case 'fast': feeRate = fees.fastestFee; break;
        }
      }

      // Build the investment transaction
      const builtTx = await this.angorTx.buildInvestmentTransaction({
        projectDetails,
        investmentAmount: this.investmentSats,
        utxo,
        feeRate
      });

      this.updateProcessingStep('build', 'complete');
      this.updateProcessingStep('sign', 'complete');
      this.processingStatus.set('Broadcasting transaction to network...');
      this.updateProcessingStep('broadcast', 'active');

      // Broadcast the transaction
      const txId = await this.angorTx.broadcastInvestment(builtTx.txHex);
      console.log('Investment broadcast successful:', txId);

      this.updateProcessingStep('broadcast', 'complete');
      this.completedTransaction.set(builtTx);
      this.currentStep.set('complete');
    } catch (err) {
      console.error('Investment processing error:', err);
      this.setError(err instanceof Error ? err.message : 'Failed to process investment');
    }
  }

  private updateProcessingStep(stepId: string, status: 'pending' | 'active' | 'complete'): void {
    this.processingSteps.update(steps =>
      steps.map(step =>
        step.id === stepId ? { ...step, status } : step
      )
    );
  }

  cancelPayment(): void {
    this.mempoolService.stopWatching();
    this.currentStep.set('amount');
  }

  retryInvestment(): void {
    this.initialize();
  }

  async copyAddress(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.depositAddress());
      this.addressCopied.set(true);
      setTimeout(() => this.addressCopied.set(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  }

  async copyMnemonic(): Promise<void> {
    const mnemonic = this.wallet()?.mnemonic;
    if (!mnemonic) return;

    try {
      await navigator.clipboard.writeText(mnemonic);
      this.mnemonicCopied.set(true);
      setTimeout(() => this.mnemonicCopied.set(false), 2000);
    } catch (err) {
      console.error('Failed to copy mnemonic:', err);
    }
  }

  toggleLightningQR(): void {
    this.showLightningQR.update(v => !v);
  }

  formatDate(timestamp: number | undefined): string {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getExplorerUrl(txId: string): string {
    if (!txId) return '#';
    return this.networkService.isMain()
      ? `https://mempool.space/tx/${txId}`
      : `https://mempool.space/testnet/tx/${txId}`;
  }

  formatTxId(txId: string): string {
    if (!txId || txId.length < 16) return txId;
    return `${txId.substring(0, 8)}...${txId.substring(txId.length - 8)}`;
  }
}
