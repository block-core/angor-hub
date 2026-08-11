import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IndexerService, IndexedProject } from '../../services/indexer.service';
import { BitcoinUtilsService } from '../../services/bitcoin.service';
import { NetworkService } from '../../services/network.service';
import { ThemeService } from '../../services/theme.service';

type ProjectTypeName = 'invest' | 'fund' | 'subscription';

interface PaymentStage {
  number: number;
  percentage: number;
  releaseDate: string;
  amount: string;
  amountSats?: number;
}

const MIN_AMOUNT_BTC = 0.001;
const APP_THRESHOLD_SATS = 1_000_000; // 0.01 BTC

@Component({
  selector: 'app-invest',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './invest.component.html',
  styleUrls: ['./invest.component.css'],
})
export class InvestComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private indexer = inject(IndexerService);
  private bitcoin = inject(BitcoinUtilsService);
  private networkService = inject(NetworkService);
  protected themeService = inject(ThemeService);

  projectId = '';
  project = signal<IndexedProject | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  isDark = computed(() => this.themeService.isDarkTheme());

  // ---- Form state ----
  investmentAmount = signal<string>('');
  amountError = signal<string>('');
  selectedQuickAmount = signal<number | null>(null);
  selectedSubscriptionPattern = signal<'pattern1' | 'pattern2' | null>(null);
  selectedFrequency = signal<'weekly' | 'monthly'>('monthly');
  selectedInstallments = signal<'3' | '6'>('3');

  // Validation errors (shown on submit attempt)
  subscriptionPatternError = signal<string>('');
  frequencyError = signal<string>('');
  installmentsError = signal<string>('');
  amountValidationError = signal<string>('');

  // ---- Modal state ----
  showAppDownloadModal = signal<boolean>(false);

  quickAmounts = [0.001, 0.01, 0.1, 0.5];

  async ngOnInit(): Promise<void> {
    window.scrollTo(0, 0);
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.projectId) {
      this.error.set('Project not found');
      this.loading.set(false);
      return;
    }

    try {
      const project = await this.indexer.fetchProject(this.projectId);
      if (!project) {
        this.error.set('Project not found');
        this.loading.set(false);
        return;
      }
      this.project.set(project);

      // Load stats for the nav bar (total raised / progress)
      try {
        const stats = await this.indexer.fetchProjectStats(this.projectId);
        if (stats) {
          const current = this.project();
          if (current) {
            this.project.set({ ...current, stats });
          }
        }
      } catch {
        // Stats are non-critical for the invest form
      }

      // Initialize subscription pattern default (matches prototype)
      if (this.projectTypeName() === 'subscription' && !this.selectedSubscriptionPattern()) {
        this.selectedSubscriptionPattern.set('pattern1');
        this.investmentAmount.set(this.satsToBTC(this.calculateSubscriptionPrice('pattern1')));
      }
    } catch (err) {
      console.error('Failed to load project:', err);
      this.error.set('Failed to load project');
    } finally {
      this.loading.set(false);
    }
  }

  // ---- Derived project data ----

  projectTypeName(): ProjectTypeName {
    const type = this.project()?.details?.projectType ?? 0;
    if (type === 1) return 'fund';
    if (type === 2) return 'subscription';
    return 'invest';
  }

  projectTitle(): string {
    const p = this.project();
    return p?.metadata?.name || p?.projectIdentifier || 'Project';
  }

  targetBtc(): string {
    return this.bitcoin.toBTC(this.project()?.details?.targetAmount ?? 0, 8);
  }

  raisedBtc(): string {
    return this.bitcoin.toBTC(this.project()?.stats?.amountInvested ?? 0, 8);
  }

  progressPercent(): number {
    const invested = this.project()?.stats?.amountInvested ?? 0;
    const target = this.project()?.details?.targetAmount ?? 0;
    if (!target || target <= 0) return 0;
    return Number(((invested / target) * 100).toFixed(1));
  }

  subscriptionPriceSats(): number {
    // Subscription price is not part of the on-chain model yet; default matches prototype
    return 20000;
  }

  actionButtonText = computed(() => {
    const type = this.project()?.details?.projectType ?? 0;
    if (type === 2) return 'Subscribe';
    if (type === 1) return 'Fund';
    return 'Invest Now';
  });

  // ---- Fees / totals ----

  networkFee = '0.00000391';
  angorFeePercentage = 1;

  angorFee = computed(() => {
    const amount = parseFloat(this.investmentAmount()) || 0;
    return (amount * (this.angorFeePercentage / 100)).toFixed(4);
  });

  totalAmount = computed(() => {
    const amount = parseFloat(this.investmentAmount()) || 0;
    const minerFee = parseFloat(this.networkFee) || 0;
    const platformFee = parseFloat(this.angorFee()) || 0;
    return (amount + minerFee + platformFee).toFixed(4);
  });

  // ---- Schedule ----

  paymentStages = computed<PaymentStage[]>(() => {
    const amount = parseFloat(this.investmentAmount()) || 0;
    const type = this.projectTypeNameFromSignal();

    if (type === 'subscription' && this.selectedSubscriptionPattern()) {
      const patternCount = this.selectedSubscriptionPattern() === 'pattern1' ? 3 : 6;
      const priceSats = this.subscriptionPriceSats();
      const today = new Date();
      const stages: PaymentStage[] = [];
      for (let i = 0; i < patternCount; i++) {
        const paymentDate = new Date(today.getFullYear(), today.getMonth() + i + 1, 1);
        stages.push({
          number: i + 1,
          percentage: Math.floor(100 / patternCount),
          releaseDate: paymentDate.toISOString().split('T')[0],
          amount: this.satsToBTC(priceSats),
          amountSats: priceSats,
        });
      }
      return stages;
    }

    if (type === 'fund' && this.selectedFrequency() && this.selectedInstallments() && amount > 0) {
      const installments = parseInt(this.selectedInstallments(), 10) || 3;
      const perInstallment = amount / installments;
      const remainder = amount % installments;
      const isWeekly = this.selectedFrequency() === 'weekly';
      const today = new Date();
      const stages: PaymentStage[] = [];
      for (let i = 0; i < installments; i++) {
        let paymentDate: Date;
        if (isWeekly) {
          paymentDate = new Date(today);
          paymentDate.setDate(today.getDate() + i * 7 + 7);
        } else {
          paymentDate = new Date(today.getFullYear(), today.getMonth() + i + 1, 1);
        }
        const paymentAmount =
          i === 0 ? (perInstallment + remainder).toFixed(4) : perInstallment.toFixed(4);
        stages.push({
          number: i + 1,
          percentage: Math.round((parseFloat(paymentAmount) / amount) * 100),
          releaseDate: paymentDate.toISOString().split('T')[0],
          amount: paymentAmount,
        });
      }
      return stages;
    }

    // Invest projects: use real stages from project details
    const projectStages = this.project()?.details?.stages ?? [];
    return projectStages.map((stage, index) => ({
      number: index + 1,
      percentage: stage.amountToRelease,
      releaseDate: new Date(stage.releaseDate * 1000).toISOString().split('T')[0],
      amount: (amount * (stage.amountToRelease / 100)).toFixed(4),
    }));
  });

  private projectTypeNameFromSignal(): ProjectTypeName {
    const type = this.project()?.details?.projectType ?? 0;
    if (type === 1) return 'fund';
    if (type === 2) return 'subscription';
    return 'invest';
  }

  paymentPricePerInstallment = computed(() => {
    const type = this.projectTypeNameFromSignal();
    if ((type === 'subscription' || type === 'fund') && this.investmentAmount()) {
      const amount = parseFloat(this.investmentAmount()) || 0;
      const count = this.paymentStages().length;
      if (count > 0) return (amount / count).toFixed(4);
    }
    return '0.0000';
  });

  // ---- Validation ----

  canSubmit = computed(() => {
    if (!this.project()) return false;
    const type = this.projectTypeNameFromSignal();
    const amount = parseFloat(this.investmentAmount());
    if (type === 'subscription') {
      return this.selectedSubscriptionPattern() !== null && !!this.investmentAmount() && amount > 0 && !this.amountError();
    }
    if (type === 'fund') {
      return (
        !!this.selectedFrequency() &&
        !!this.selectedInstallments() &&
        !!this.investmentAmount() &&
        amount >= MIN_AMOUNT_BTC &&
        !this.amountError()
      );
    }
    return !!this.investmentAmount() && amount >= MIN_AMOUNT_BTC && !this.amountError();
  });

  validateAmount(): void {
    const amount = parseFloat(this.investmentAmount());
    if (this.investmentAmount() && amount < MIN_AMOUNT_BTC) {
      this.amountError.set('Minimum investment is 0.001 BTC');
    } else if (this.investmentAmount() && isNaN(amount)) {
      this.amountError.set('Please enter a valid amount');
    } else {
      this.amountError.set('');
    }
  }

  handleAmountInput(): void {
    this.validateAmount();
    this.clearValidationError();
    const current = parseFloat(this.investmentAmount());
    if (current && this.quickAmounts.includes(current)) {
      this.selectedQuickAmount.set(current);
    } else {
      this.selectedQuickAmount.set(null);
    }
  }

  setQuickAmount(amount: number): void {
    this.investmentAmount.set(amount.toString());
    this.selectedQuickAmount.set(amount);
    this.validateAmount();
    this.clearValidationError();
  }

  selectSubscriptionPattern(pattern: 'pattern1' | 'pattern2'): void {
    this.selectedSubscriptionPattern.set(pattern);
    this.investmentAmount.set(this.satsToBTC(this.calculateSubscriptionPrice(pattern)));
    this.clearValidationError();
  }

  selectInstallments(inst: '3' | '6'): void {
    this.selectedInstallments.set(inst);
    this.clearValidationError();
  }

  selectFrequency(freq: 'weekly' | 'monthly'): void {
    this.selectedFrequency.set(freq);
    this.clearValidationError();
  }

  clearValidationError(): void {
    this.subscriptionPatternError.set('');
    this.frequencyError.set('');
    this.installmentsError.set('');
    this.amountValidationError.set('');
  }

  showValidationErrors(): void {
    this.clearValidationError();
    let firstErrorSelector: string | null = null;
    const type = this.projectTypeNameFromSignal();
    const amount = parseFloat(this.investmentAmount());

    if (type === 'subscription') {
      if (!this.selectedSubscriptionPattern()) {
        this.subscriptionPatternError.set('Please select a subscription plan');
        firstErrorSelector ??= '.subscription-patterns';
      }
      if (!this.investmentAmount() || amount <= 0) {
        this.amountValidationError.set('Please enter a valid subscription amount');
        firstErrorSelector ??= '.form-group input';
      }
    } else if (type === 'fund') {
      if (!this.selectedFrequency()) {
        this.frequencyError.set('Please select a payment frequency');
        firstErrorSelector ??= '.fund-frequency-options';
      }
      if (!this.selectedInstallments()) {
        this.installmentsError.set('Please select the number of installments');
        firstErrorSelector ??= '.fund-installments-options';
      }
      if (!this.investmentAmount() || amount < MIN_AMOUNT_BTC) {
        this.amountValidationError.set('Please enter a funding amount (minimum 0.001 BTC)');
        firstErrorSelector ??= '.form-group input';
      }
    } else {
      if (!this.investmentAmount() || amount < MIN_AMOUNT_BTC) {
        this.amountValidationError.set('Please enter an investment amount (minimum 0.001 BTC)');
        firstErrorSelector ??= '.form-group input';
      }
    }
    if (this.amountError()) {
      this.amountValidationError.set(this.amountError());
      firstErrorSelector ??= '.form-group input';
    }

    if (firstErrorSelector) {
      setTimeout(() => {
        document
          .querySelector(`.invest-page-container ${firstErrorSelector}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  // ---- Flow ----

  /**
   * Submit: validate, then hand off to the Angor web app where the real
   * wallet + transaction signing flow lives. Large amounts get the
   * "use the app" interstitial first.
   */
  generateInvoice(): void {
    if (!this.canSubmit()) {
      this.showValidationErrors();
      return;
    }

    const amount = parseFloat(String(this.investmentAmount() || '').trim());
    if (!isNaN(amount) && isFinite(amount) && amount > 0) {
      // Compare in sats to avoid floating point issues (0.01 BTC threshold)
      const amountInSats = Math.round(amount * 100_000_000);
      if (amountInSats >= APP_THRESHOLD_SATS) {
        this.showAppDownloadModal.set(true);
        return;
      }
    }
    this.proceedToPayment();
  }

  handleMobileInvestClick(): void {
    if (!this.canSubmit()) {
      this.showValidationErrors();
      const card = document.querySelector('.invest-amount-card');
      card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    this.generateInvoice();
  }

  /** Opens the real invest flow in the Angor web app (network-aware). */
  proceedToPayment(): void {
    this.openExternalApp();
  }

  downloadApp(): void {
    this.router.navigate(['/app']);
  }

  /** Opens the invest flow in the Angor web app (app.angor.io / test.angor.io). */
  openExternalApp(): void {
    const host = this.networkService.isMain() ? 'app.angor.io' : 'test.angor.io';
    window.open(`https://${host}/investview/${this.projectId}`, '_blank', 'noopener');
  }

  continueWithWeb(): void {
    this.showAppDownloadModal.set(false);
    this.proceedToPayment();
  }

  async copyProjectId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.project()?.projectIdentifier ?? '');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  goBack(): void {
    this.router.navigate(['/project', this.projectId]);
  }

  // ---- Helpers ----

  calculateSubscriptionPrice(pattern: 'pattern1' | 'pattern2'): number {
    const pricePerMonth = this.subscriptionPriceSats();
    const months = pattern === 'pattern1' ? 3 : 6;
    return pricePerMonth * months;
  }

  satsToBTC(sats: number): string {
    return (sats / 100_000_000).toFixed(8);
  }

  btcToSats(btc: string | number): number {
    return Math.round(parseFloat(String(btc)) * 100_000_000);
  }

  formatPaymentDate(dateString: string): string {
    if (!dateString) return 'Not set';
    if (/^\d{1,2}\s+\w+\s+\d{4}$/.test(dateString)) return dateString;
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const day = String(date.getDate()).padStart(2, '0');
      const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${monthAbbr[date.getMonth()]} ${date.getFullYear()}`;
    } catch {
      return dateString;
    }
  }
}
