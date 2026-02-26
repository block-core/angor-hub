import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
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
  ],
  template: `
    <!-- Invest App Shell -->
    <div class="min-h-screen bg-gradient-to-br from-surface-ground via-surface-ground to-accent/5 flex flex-col">

      <!-- Invest Mini-Header -->
      <div class="sticky top-0 z-50 bg-surface-card/95 backdrop-blur-lg border-b border-border shadow-sm">
        <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <!-- Logo + Back -->
          <div class="flex items-center gap-3">
            <a [routerLink]="projectId ? ['/project', projectId] : ['/']"
               class="flex items-center gap-2 text-text-secondary hover:text-text transition-colors group">
              <span class="material-icons text-lg group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
              <span class="hidden sm:block text-sm">Back to Project</span>
            </a>
            <div class="w-px h-5 bg-border hidden sm:block"></div>
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
                <span class="material-icons text-white text-sm">bolt</span>
              </div>
              <span class="font-bold text-text text-sm">Angor Invest</span>
            </div>
          </div>

          <!-- Network Badge -->
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                 [class.bg-green-100]="networkService.isMain()"
                 [class.text-green-700]="networkService.isMain()"
                 [class.dark:bg-green-900/30]="networkService.isMain()"
                 [class.dark:text-green-400]="networkService.isMain()"
                 [class.bg-yellow-100]="!networkService.isMain()"
                 [class.text-yellow-700]="!networkService.isMain()"
                 [class.dark:bg-yellow-900/30]="!networkService.isMain()"
                 [class.dark:text-yellow-400]="!networkService.isMain()">
              <span class="w-1.5 h-1.5 rounded-full"
                    [class.bg-green-500]="networkService.isMain()"
                    [class.bg-yellow-500]="!networkService.isMain()"></span>
              {{ networkService.isMain() ? 'Mainnet' : 'Testnet' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Step Progress (visible when not loading/error) -->
      @if (currentStep() !== 'loading' && currentStep() !== 'error') {
        <div class="bg-surface-card border-b border-border">
          <div class="max-w-5xl mx-auto px-4 py-4">
            <div class="flex items-center justify-center gap-0">
              @for (step of stepIndicators; track step.id; let i = $index) {
                <!-- Step dot -->
                <div class="flex items-center gap-0">
                  <div class="flex flex-col items-center">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                         [class.bg-accent]="isStepActive(step.id) || isStepDone(step.id)"
                         [class.text-white]="isStepActive(step.id) || isStepDone(step.id)"
                         [class.bg-surface-hover]="!isStepActive(step.id) && !isStepDone(step.id)"
                         [class.text-text-secondary]="!isStepActive(step.id) && !isStepDone(step.id)">
                      @if (isStepDone(step.id)) {
                        <span class="material-icons text-sm">check</span>
                      } @else {
                        {{ i + 1 }}
                      }
                    </div>
                    <span class="text-xs mt-1 hidden sm:block whitespace-nowrap"
                          [class.text-accent]="isStepActive(step.id)"
                          [class.text-text]="isStepDone(step.id)"
                          [class.font-semibold]="isStepActive(step.id)"
                          [class.text-text-secondary]="!isStepActive(step.id) && !isStepDone(step.id)">
                      {{ step.label }}
                    </span>
                  </div>
                  <!-- Connector -->
                  @if (i < stepIndicators.length - 1) {
                    <div class="w-12 sm:w-20 h-0.5 mx-1 mb-4 sm:mb-0 transition-all duration-300"
                         [class.bg-accent]="isStepDone(step.id)"
                         [class.bg-surface-hover]="!isStepDone(step.id)"></div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Main Content -->
      <div class="flex-1 max-w-5xl w-full mx-auto px-4 py-8">

        <!-- ===== LOADING STATE ===== -->
        @if (currentStep() === 'loading') {
          <div class="flex flex-col items-center justify-center min-h-[60vh]">
            <div class="bg-surface-card rounded-3xl p-12 text-center shadow-xl max-w-md w-full">
              <div class="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
                <div class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h2 class="text-2xl font-bold text-text mb-2">Preparing Your Investment</h2>
              <p class="text-text-secondary">{{ loadingMessage() }}</p>
              <div class="mt-6 space-y-2">
                @for (msg of loadingSteps(); track msg.label) {
                  <div class="flex items-center gap-3 text-sm" [class.opacity-50]="!msg.done && !msg.active">
                    @if (msg.done) {
                      <span class="material-icons text-green-500 text-base">check_circle</span>
                    } @else if (msg.active) {
                      <span class="material-icons text-accent text-base animate-pulse">pending</span>
                    } @else {
                      <span class="material-icons text-text-secondary text-base">radio_button_unchecked</span>
                    }
                    <span [class.text-text]="msg.done || msg.active" [class.text-text-secondary]="!msg.done && !msg.active">
                      {{ msg.label }}
                    </span>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- ===== ERROR STATE ===== -->
        @if (currentStep() === 'error') {
          <div class="flex flex-col items-center justify-center min-h-[60vh]">
            <div class="bg-surface-card rounded-3xl p-12 text-center shadow-xl max-w-md w-full">
              <div class="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6">
                <span class="material-icons text-5xl text-red-500">error_outline</span>
              </div>
              <h2 class="text-2xl font-bold text-text mb-2">Something Went Wrong</h2>
              <p class="text-text-secondary mb-8">{{ errorMessage() }}</p>
              <div class="flex flex-col gap-3">
                <button (click)="retryInvestment()"
                        class="w-full py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent-dark transition-colors flex items-center justify-center gap-2">
                  <span class="material-icons">refresh</span>
                  Try Again
                </button>
                <a [routerLink]="['/project', projectId]"
                   class="w-full py-3 bg-surface-hover text-text rounded-xl font-medium hover:bg-surface-ground transition-colors text-center">
                  Back to Project
                </a>
              </div>
            </div>
          </div>
        }

        <!-- ===== STEP 1: AMOUNT SELECTION ===== -->
        @if (currentStep() === 'amount') {
          <div class="grid lg:grid-cols-5 gap-6">

            <!-- Project Info Panel (left, narrower) -->
            <div class="lg:col-span-2 space-y-4">
              <!-- Project Card -->
              <div class="bg-surface-card rounded-2xl overflow-hidden shadow-lg border border-border">
                <!-- Banner -->
                @if (project()?.metadata?.['banner']) {
                  <div class="h-24 bg-gradient-to-r from-accent/20 to-accent/5 relative overflow-hidden">
                    <img [src]="project()?.metadata?.['banner']" class="w-full h-full object-cover" [alt]="project()?.metadata?.name">
                  </div>
                } @else {
                  <div class="h-24 bg-gradient-to-r from-accent/30 to-accent/10 flex items-center justify-center">
                    <span class="material-icons text-4xl text-accent/40">rocket_launch</span>
                  </div>
                }

                <div class="p-5">
                  <div class="flex items-start gap-3 -mt-8 mb-4">
                    @if (project()?.metadata?.['picture']) {
                      <img [src]="project()?.metadata?.['picture']"
                           [alt]="project()?.metadata?.name"
                           class="w-14 h-14 rounded-xl border-2 border-surface-card object-cover shadow-lg flex-shrink-0">
                    } @else {
                      <div class="w-14 h-14 rounded-xl border-2 border-surface-card bg-accent/20 flex items-center justify-center flex-shrink-0 shadow-lg">
                        <span class="material-icons text-xl text-accent">rocket_launch</span>
                      </div>
                    }
                    <div class="pt-6">
                      <h3 class="font-bold text-text text-base leading-tight">{{ project()?.metadata?.name || 'Project' }}</h3>
                      <p class="text-xs text-text-secondary font-mono truncate max-w-[160px]">{{ project()?.projectIdentifier }}</p>
                    </div>
                  </div>

                  @if (project()?.metadata?.about) {
                    <p class="text-sm text-text-secondary line-clamp-3 mb-4">{{ project()?.metadata?.about }}</p>
                  }

                  <!-- Stats -->
                  <div class="space-y-2.5">
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-text-secondary flex items-center gap-1">
                        <span class="material-icons text-xs">flag</span> Target
                      </span>
                      <span class="font-semibold text-text">{{ bitcoin.toBTC(project()?.details?.targetAmount || 0) }} BTC</span>
                    </div>
                    <!-- Funding progress bar -->
                    @if (project()?.stats) {
                      <div class="space-y-1">
                        <div class="flex justify-between text-xs text-text-secondary">
                          <span>Raised</span>
                          <span class="text-accent font-semibold">{{ getFundingPercent() }}%</span>
                        </div>
                        <div class="w-full bg-surface-hover rounded-full h-1.5">
                          <div class="h-1.5 rounded-full bg-gradient-to-r from-accent to-accent-dark transition-all duration-500"
                               [style.width.%]="Math.min(getFundingPercent(), 100)"></div>
                        </div>
                        <div class="flex justify-between text-xs">
                          <span class="text-text-secondary">{{ bitcoin.toBTC(project()?.stats?.amountInvested || 0) }} BTC raised</span>
                          <span class="text-text-secondary">{{ project()?.stats?.investorCount || 0 }} investors</span>
                        </div>
                      </div>
                    }
                    <div class="flex items-center justify-between text-sm pt-1">
                      <span class="text-text-secondary flex items-center gap-1">
                        <span class="material-icons text-xs">calendar_today</span> Expires
                      </span>
                      <span class="font-medium text-text text-xs">{{ formatDate(project()?.details?.expiryDate) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Penalty Warning -->
              @if (penaltyWarning()) {
                <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
                  <div class="flex items-start gap-3">
                    <span class="material-icons text-yellow-500 text-xl flex-shrink-0">warning</span>
                    <div>
                      <p class="text-sm font-bold text-yellow-700 dark:text-yellow-400">Penalty Period Active</p>
                      <p class="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                        This project has entered the penalty period. Early withdrawal may result in reduced returns.
                      </p>
                    </div>
                  </div>
                </div>
              }

              <!-- How it works -->
              <div class="bg-surface-card rounded-2xl p-5 border border-border">
                <h4 class="font-bold text-text text-sm mb-3 flex items-center gap-2">
                  <span class="material-icons text-accent text-base">info</span>
                  How it works
                </h4>
                <div class="space-y-2.5">
                  @for (step of howItWorksSteps; track step.label) {
                    <div class="flex items-start gap-2.5">
                      <div class="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span class="material-icons text-accent text-xs">{{ step.icon }}</span>
                      </div>
                      <p class="text-xs text-text-secondary">{{ step.label }}</p>
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Amount Selection Panel (right, wider) -->
            <div class="lg:col-span-3 space-y-4">
              <!-- Amount Input Card -->
              <div class="bg-surface-card rounded-2xl p-6 shadow-lg border border-border">
                <h3 class="text-lg font-bold text-text mb-5 flex items-center gap-2">
                  <span class="material-icons text-accent">payments</span>
                  Investment Amount
                </h3>

                <!-- BTC / SAT Toggle + Input -->
                <div class="mb-5">
                  <div class="flex items-center gap-2 mb-3">
                    <button (click)="inputMode = 'btc'"
                            class="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                            [class.bg-accent]="inputMode === 'btc'"
                            [class.text-white]="inputMode === 'btc'"
                            [class.bg-surface-hover]="inputMode !== 'btc'"
                            [class.text-text-secondary]="inputMode !== 'btc'">
                      BTC
                    </button>
                    <button (click)="inputMode = 'sats'"
                            class="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                            [class.bg-accent]="inputMode === 'sats'"
                            [class.text-white]="inputMode === 'sats'"
                            [class.bg-surface-hover]="inputMode !== 'sats'"
                            [class.text-text-secondary]="inputMode !== 'sats'">
                      Satoshis
                    </button>
                  </div>

                  @if (inputMode === 'btc') {
                    <div class="relative">
                      <input
                        type="number"
                        [(ngModel)]="investmentBtc"
                        (ngModelChange)="onBtcAmountChange()"
                        step="0.0001"
                        min="0.0001"
                        class="w-full px-5 py-4 bg-surface-ground border-2 border-border rounded-xl text-text text-2xl font-mono focus:outline-none focus:border-accent transition-colors pr-20"
                        placeholder="0.001">
                      <span class="absolute right-5 top-1/2 -translate-y-1/2 text-text-secondary font-semibold">BTC</span>
                    </div>
                    <p class="text-sm text-text-secondary mt-2 text-right">≈ {{ investmentSats.toLocaleString() }} sats</p>
                  } @else {
                    <div class="relative">
                      <input
                        type="number"
                        [(ngModel)]="investmentSats"
                        (ngModelChange)="onSatsAmountChange()"
                        step="1000"
                        min="10000"
                        class="w-full px-5 py-4 bg-surface-ground border-2 border-border rounded-xl text-text text-2xl font-mono focus:outline-none focus:border-accent transition-colors pr-20"
                        placeholder="100000">
                      <span class="absolute right-5 top-1/2 -translate-y-1/2 text-text-secondary font-semibold">sats</span>
                    </div>
                    <p class="text-sm text-text-secondary mt-2 text-right">≈ {{ bitcoin.toBTC(investmentSats) }} BTC</p>
                  }
                </div>

                <!-- Quick Amounts -->
                <div class="mb-5">
                  <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Quick amounts</label>
                  <div class="grid grid-cols-4 gap-2">
                    @for (amt of quickAmountsSats; track amt.label) {
                      <button (click)="setQuickAmountSats(amt.value)"
                              class="py-2 rounded-lg text-sm font-semibold border-2 transition-all"
                              [class.border-accent]="investmentSats === amt.value"
                              [class.bg-accent/10]="investmentSats === amt.value"
                              [class.text-accent]="investmentSats === amt.value"
                              [class.border-border]="investmentSats !== amt.value"
                              [class.bg-surface-hover]="investmentSats !== amt.value"
                              [class.text-text-secondary]="investmentSats !== amt.value"
                              [class.hover:border-accent/50]="investmentSats !== amt.value">
                        {{ amt.label }}
                      </button>
                    }
                  </div>
                </div>

                <!-- Fee Selection -->
                <div class="mb-6">
                  <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Network fee</label>
                  <div class="grid grid-cols-3 gap-2">
                    @for (fee of feeOptions; track fee.id) {
                      <button (click)="selectedFeeLevel = fee.id"
                              class="p-3 rounded-xl border-2 text-center transition-all"
                              [class.border-accent]="selectedFeeLevel === fee.id"
                              [class.bg-accent/5]="selectedFeeLevel === fee.id"
                              [class.border-border]="selectedFeeLevel !== fee.id"
                              [class.bg-surface-hover]="selectedFeeLevel !== fee.id">
                        <div class="text-xs font-bold"
                             [class.text-accent]="selectedFeeLevel === fee.id"
                             [class.text-text]="selectedFeeLevel !== fee.id">
                          {{ fee.label }}
                        </div>
                        <div class="text-xs text-text-secondary mt-0.5">{{ getFeeRate(fee.id) }} sat/vB</div>
                      </button>
                    }
                  </div>
                </div>

                <!-- Summary -->
                <div class="bg-surface-ground rounded-xl p-4 mb-5 space-y-2">
                  <div class="flex justify-between text-sm">
                    <span class="text-text-secondary">Investment</span>
                    <span class="font-medium text-text">{{ bitcoin.toBTC(investmentSats) }} BTC</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-text-secondary">Estimated fee</span>
                    <span class="font-medium text-text">~{{ estimatedFee() }} sats</span>
                  </div>
                  <div class="border-t border-border pt-2 flex justify-between">
                    <span class="font-bold text-text">Total to send</span>
                    <span class="font-bold text-accent text-lg">{{ bitcoin.toBTC(totalAmountToSend()) }} BTC</span>
                  </div>
                </div>

                <!-- CTA -->
                <button (click)="proceedToPayment()"
                        [disabled]="!isValidAmount()"
                        class="w-full py-4 bg-gradient-to-r from-accent to-accent-dark text-white rounded-xl font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-accent/20">
                  <span class="material-icons">qr_code_2</span>
                  Get Payment Address
                </button>

                @if (!isValidAmount()) {
                  <p class="text-xs text-center text-red-500 mt-2">Minimum investment: 10,000 satoshis (0.0001 BTC)</p>
                }
              </div>
            </div>
          </div>
        }

        <!-- ===== STEP 2: PAYMENT (QR Code) ===== -->
        @if (currentStep() === 'payment') {
          <div class="grid lg:grid-cols-2 gap-6">

            <!-- Left: QR Code + Address -->
            <div class="space-y-4">
              <!-- QR Card -->
              <div class="bg-surface-card rounded-2xl p-6 shadow-lg border border-border">
                <div class="flex items-center justify-between mb-5">
                  <h3 class="text-lg font-bold text-text flex items-center gap-2">
                    <span class="material-icons text-accent">qr_code_2</span>
                    Send Bitcoin
                  </h3>
                  <!-- Toggle BTC / Lightning -->
                  @if (showLightningOption) {
                    <div class="flex rounded-lg overflow-hidden border border-border">
                      <button (click)="showLightningQR.set(false)"
                              class="px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1"
                              [class.bg-accent]="!showLightningQR()"
                              [class.text-white]="!showLightningQR()"
                              [class.text-text-secondary]="showLightningQR()">
                        <span class="material-icons text-xs">currency_bitcoin</span>
                        Bitcoin
                      </button>
                      <button (click)="showLightningQR.set(true)"
                              class="px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1"
                              [class.bg-yellow-500]="showLightningQR()"
                              [class.text-white]="showLightningQR()"
                              [class.text-text-secondary]="!showLightningQR()">
                        <span class="material-icons text-xs">bolt</span>
                        Lightning
                      </button>
                    </div>
                  }
                </div>

                <!-- QR Code Display -->
                <div class="flex flex-col items-center">
                  <div class="relative">
                    <!-- Payment detected overlay -->
                    @if (paymentReceived()) {
                      <div class="absolute inset-0 bg-green-500/90 rounded-xl flex flex-col items-center justify-center z-10 animate-in fade-in duration-300">
                        <span class="material-icons text-6xl text-white">check_circle</span>
                        <p class="text-white font-bold mt-2">Payment Detected!</p>
                      </div>
                    }
                    <app-qrcode
                      [value]="showLightningQR() ? lightningInvoice() : bitcoinQrValue()"
                      [size]="240"
                      [showValue]="false"
                      errorCorrectionLevel="M">
                    </app-qrcode>
                  </div>

                  <!-- Amount Badge -->
                  <div class="mt-4 px-4 py-2 bg-accent/10 rounded-full border border-accent/20">
                    <span class="text-accent font-bold text-lg">{{ bitcoin.toBTC(totalAmountToSend()) }} BTC</span>
                    <span class="text-text-secondary text-sm ml-2">({{ totalAmountToSend().toLocaleString() }} sats)</span>
                  </div>
                </div>

                <!-- Address Row -->
                <div class="mt-5">
                  @if (!showLightningQR()) {
                    <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                      Bitcoin Address
                    </label>
                    <div class="flex items-center gap-2 bg-surface-ground rounded-xl px-4 py-3 border border-border">
                      <span class="text-sm font-mono text-text break-all flex-1 leading-relaxed">{{ depositAddress() }}</span>
                      <button (click)="copyAddress()"
                              class="p-2 hover:bg-surface-hover rounded-lg transition-colors flex-shrink-0"
                              [title]="addressCopied() ? 'Copied!' : 'Copy address'">
                        <span class="material-icons text-base transition-colors"
                              [class.text-green-500]="addressCopied()"
                              [class.text-text-secondary]="!addressCopied()">
                          {{ addressCopied() ? 'check' : 'content_copy' }}
                        </span>
                      </button>
                    </div>
                    <p class="text-xs text-text-secondary mt-2">
                      Send exactly <strong class="text-text">{{ bitcoin.toBTC(totalAmountToSend()) }} BTC</strong>
                      to this address. Sending less may cause failure.
                    </p>
                  } @else {
                    <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="material-icons text-yellow-500">bolt</span>
                        <span class="font-semibold text-sm text-yellow-700 dark:text-yellow-400">Pay via Lightning (Boltz Swap)</span>
                      </div>
                      <p class="text-xs text-yellow-600 dark:text-yellow-500">
                        Scan this Lightning invoice to pay via Boltz. Funds will be automatically swapped to the Bitcoin address.
                      </p>
                    </div>
                  }
                </div>

                <!-- Waiting Indicator -->
                <div class="mt-5 p-4 rounded-xl border"
                     [class.bg-blue-50]="!paymentReceived()"
                     [class.dark:bg-blue-900/20]="!paymentReceived()"
                     [class.border-blue-200]="!paymentReceived()"
                     [class.dark:border-blue-800]="!paymentReceived()"
                     [class.bg-green-50]="paymentReceived()"
                     [class.dark:bg-green-900/20]="paymentReceived()"
                     [class.border-green-200]="paymentReceived()"
                     [class.dark:border-green-800]="paymentReceived()">
                  <div class="flex items-center gap-3">
                    @if (!paymentReceived()) {
                      <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <span class="material-icons text-blue-500 text-lg animate-pulse">sensors</span>
                      </div>
                      <div>
                        <p class="text-sm font-semibold text-blue-700 dark:text-blue-400">Monitoring for payment...</p>
                        <p class="text-xs text-blue-500 dark:text-blue-400">Page will automatically update when payment is detected</p>
                      </div>
                    } @else {
                      <div class="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                        <span class="material-icons text-green-500 text-lg">check_circle</span>
                      </div>
                      <div>
                        <p class="text-sm font-semibold text-green-700 dark:text-green-400">Payment received!</p>
                        <p class="text-xs text-green-500 dark:text-green-400">Building your investment transaction...</p>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <!-- Lightning Option Toggle (if not enabled above) -->
              @if (!showLightningOption) {
                <button (click)="showLightningOption = true"
                        class="w-full py-3 border-2 border-dashed border-yellow-400/50 text-yellow-600 dark:text-yellow-400 rounded-xl font-medium hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-colors flex items-center justify-center gap-2 text-sm">
                  <span class="material-icons text-base">bolt</span>
                  Pay with Lightning via Boltz
                </button>
              }
            </div>

            <!-- Right: Wallet Backup + Summary -->
            <div class="space-y-4">
              <!-- Wallet Backup -->
              <div class="bg-surface-card rounded-2xl p-6 shadow-lg border border-border">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-lg font-bold text-text flex items-center gap-2">
                    <span class="material-icons text-yellow-500">key</span>
                    Backup Recovery Phrase
                  </h3>
                  @if (backupConfirmed) {
                    <div class="flex items-center gap-1 text-green-500 text-xs font-semibold">
                      <span class="material-icons text-sm">verified</span>
                      Saved
                    </div>
                  }
                </div>

                <div class="bg-yellow-50 dark:bg-yellow-900/10 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800 mb-4">
                  <p class="text-sm text-yellow-700 dark:text-yellow-400 font-semibold mb-1">
                    Critical: Save these 12 words
                  </p>
                  <p class="text-xs text-yellow-600 dark:text-yellow-500">
                    This wallet holds your investment. Without these words you cannot recover it. Store them safely offline.
                  </p>
                </div>

                @if (showMnemonic()) {
                  <!-- Word Grid -->
                  <div class="grid grid-cols-3 gap-2 mb-4">
                    @for (word of mnemonicWords(); track $index) {
                      <div class="flex items-center gap-2 bg-surface-ground rounded-lg px-3 py-2 border border-border">
                        <span class="text-xs text-text-secondary w-5 text-right font-mono flex-shrink-0">{{ $index + 1 }}.</span>
                        <span class="text-sm font-semibold text-text font-mono">{{ word }}</span>
                      </div>
                    }
                  </div>

                  <button (click)="copyMnemonic()"
                          class="w-full py-2.5 border-2 border-border rounded-xl font-semibold text-sm text-text hover:bg-surface-hover transition-colors flex items-center justify-center gap-2 mb-4">
                    <span class="material-icons text-base" [class.text-green-500]="mnemonicCopied()">
                      {{ mnemonicCopied() ? 'check' : 'content_copy' }}
                    </span>
                    {{ mnemonicCopied() ? 'Copied to clipboard!' : 'Copy all words' }}
                  </button>
                } @else {
                  <div class="grid grid-cols-3 gap-2 mb-4">
                    @for (word of mnemonicWords(); track $index) {
                      <div class="flex items-center gap-2 bg-surface-ground rounded-lg px-3 py-2 border border-border">
                        <span class="text-xs text-text-secondary w-5 text-right font-mono flex-shrink-0">{{ $index + 1 }}.</span>
                        <span class="text-sm font-semibold text-text font-mono blur-sm select-none">{{ word }}</span>
                      </div>
                    }
                  </div>
                  <button (click)="showMnemonic.set(true)"
                          class="w-full py-2.5 bg-yellow-500 text-white rounded-xl font-semibold text-sm hover:bg-yellow-600 transition-colors flex items-center justify-center gap-2 mb-4">
                    <span class="material-icons text-base">visibility</span>
                    Reveal Recovery Phrase
                  </button>
                }

                <!-- Backup Confirmation -->
                <label class="flex items-start gap-3 cursor-pointer group">
                  <div class="relative flex-shrink-0 mt-0.5">
                    <input type="checkbox" [(ngModel)]="backupConfirmed"
                           class="peer sr-only">
                    <div class="w-5 h-5 rounded border-2 border-border peer-checked:border-accent peer-checked:bg-accent transition-all flex items-center justify-center"
                         [class.border-accent]="backupConfirmed"
                         [class.bg-accent]="backupConfirmed">
                      @if (backupConfirmed) {
                        <span class="material-icons text-white text-xs">check</span>
                      }
                    </div>
                  </div>
                  <span class="text-sm text-text-secondary group-hover:text-text transition-colors">
                    I have written down / saved my recovery phrase in a secure location
                  </span>
                </label>
              </div>

              <!-- Investment Summary -->
              <div class="bg-surface-card rounded-2xl p-5 shadow border border-border">
                <h4 class="font-bold text-text mb-4 text-sm flex items-center gap-2">
                  <span class="material-icons text-accent text-base">receipt_long</span>
                  Investment Summary
                </h4>
                <div class="space-y-2.5">
                  <div class="flex justify-between text-sm">
                    <span class="text-text-secondary">Project</span>
                    <span class="font-medium text-text truncate max-w-[180px] text-right">{{ project()?.metadata?.name || 'Unknown' }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-text-secondary">Investment</span>
                    <span class="font-medium text-text">{{ bitcoin.toBTC(investmentSats) }} BTC</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-text-secondary">Fee (est.)</span>
                    <span class="font-medium text-text">{{ estimatedFee() }} sats</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-text-secondary">Fee rate</span>
                    <span class="font-medium text-text">{{ getFeeRate(selectedFeeLevel) }} sat/vB</span>
                  </div>
                  <div class="border-t border-border pt-2.5 flex justify-between items-center">
                    <span class="font-bold text-text">Total to send</span>
                    <div class="text-right">
                      <div class="font-bold text-accent text-lg">{{ bitcoin.toBTC(totalAmountToSend()) }} BTC</div>
                      <div class="text-xs text-text-secondary">{{ totalAmountToSend().toLocaleString() }} sats</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Cancel -->
              <button (click)="cancelPayment()"
                      class="w-full py-3 bg-surface-hover text-text rounded-xl font-medium hover:bg-surface-ground transition-colors text-sm border border-border flex items-center justify-center gap-2">
                <span class="material-icons text-base">arrow_back</span>
                Change Amount
              </button>
            </div>
          </div>
        }

        <!-- ===== STEP 3: PROCESSING ===== -->
        @if (currentStep() === 'processing') {
          <div class="flex flex-col items-center justify-center min-h-[60vh]">
            <div class="bg-surface-card rounded-3xl p-10 text-center shadow-xl max-w-md w-full border border-border">

              <!-- Animated Ring -->
              <div class="relative w-24 h-24 mx-auto mb-6">
                <div class="absolute inset-0 border-4 border-accent/20 rounded-full"></div>
                <div class="absolute inset-0 border-4 border-transparent border-t-accent rounded-full animate-spin"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="material-icons text-accent text-3xl animate-pulse">bolt</span>
                </div>
              </div>

              <h2 class="text-2xl font-bold text-text mb-1">Processing Investment</h2>
              <p class="text-text-secondary mb-8 text-sm">{{ processingStatus() }}</p>

              <!-- Steps List -->
              <div class="space-y-3 text-left bg-surface-ground rounded-xl p-4">
                @for (step of processingSteps(); track step.id) {
                  <div class="flex items-center gap-3 py-1">
                    <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                         [class.bg-green-100]="step.status === 'complete'"
                         [class.dark:bg-green-900/30]="step.status === 'complete'"
                         [class.bg-accent/10]="step.status === 'active'"
                         [class.bg-surface-hover]="step.status === 'pending'">
                      @if (step.status === 'complete') {
                        <span class="material-icons text-green-500 text-base">check</span>
                      } @else if (step.status === 'active') {
                        <span class="material-icons text-accent text-base animate-spin">autorenew</span>
                      } @else {
                        <span class="text-xs text-text-secondary font-mono">{{ $index + 1 }}</span>
                      }
                    </div>
                    <span class="text-sm font-medium"
                          [class.text-green-600]="step.status === 'complete'"
                          [class.dark:text-green-400]="step.status === 'complete'"
                          [class.text-accent]="step.status === 'active'"
                          [class.font-bold]="step.status === 'active'"
                          [class.text-text-secondary]="step.status === 'pending'">
                      {{ step.label }}
                    </span>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- ===== STEP 4: COMPLETE ===== -->
        @if (currentStep() === 'complete') {
          <div class="flex flex-col items-center justify-center min-h-[60vh]">
            <div class="bg-surface-card rounded-3xl p-10 text-center shadow-xl max-w-lg w-full border border-border">

              <!-- Success Animation -->
              <div class="relative w-24 h-24 mx-auto mb-6">
                <div class="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-in zoom-in duration-500">
                  <span class="material-icons text-5xl text-green-500">check_circle</span>
                </div>
                <!-- Ripple rings -->
                <div class="absolute inset-0 rounded-full border-2 border-green-400/30 animate-ping"></div>
              </div>

              <h2 class="text-3xl font-bold text-text mb-2">Investment Confirmed!</h2>
              <p class="text-text-secondary mb-8">
                Your investment in <strong class="text-text">{{ project()?.metadata?.name || 'the project' }}</strong> has been broadcast to the Bitcoin network.
              </p>

              <!-- Transaction Details -->
              <div class="bg-surface-ground rounded-2xl p-5 mb-6 text-left space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-text-secondary text-sm">Amount Invested</span>
                  <span class="font-bold text-text">{{ bitcoin.toBTC(investmentSats) }} BTC</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-text-secondary text-sm">Network Fee</span>
                  <span class="font-medium text-text">{{ completedTransaction()?.fee || 0 }} sats</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-text-secondary text-sm">Network</span>
                  <span class="font-medium text-text">{{ networkService.isMain() ? 'Bitcoin Mainnet' : 'Bitcoin Testnet' }}</span>
                </div>
                <div class="border-t border-border pt-3">
                  <div class="flex justify-between items-start">
                    <span class="text-text-secondary text-sm">Transaction ID</span>
                    <a [href]="getExplorerUrl(completedTransaction()?.txId || '')"
                       target="_blank"
                       rel="noopener noreferrer"
                       class="text-accent hover:text-accent-dark text-sm font-mono hover:underline flex items-center gap-1">
                      {{ formatTxId(completedTransaction()?.txId || '') }}
                      <span class="material-icons text-xs">open_in_new</span>
                    </a>
                  </div>
                </div>
              </div>

              <!-- Wallet backup reminder -->
              @if (!backupConfirmed) {
                <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800 mb-5 text-left">
                  <div class="flex items-start gap-2">
                    <span class="material-icons text-yellow-500 flex-shrink-0">warning</span>
                    <div>
                      <p class="text-sm font-bold text-yellow-700 dark:text-yellow-400">Don't forget your recovery phrase!</p>
                      <p class="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                        Make sure you have saved your 12-word recovery phrase before leaving this page.
                      </p>
                      <button (click)="showMnemonic.set(true); currentStep.set('payment')"
                              class="mt-2 text-xs text-yellow-700 dark:text-yellow-400 underline font-semibold">
                        Show recovery phrase
                      </button>
                    </div>
                  </div>
                </div>
              }

              <!-- Actions -->
              <div class="flex flex-col gap-3">
                <a [href]="getExplorerUrl(completedTransaction()?.txId || '')"
                   target="_blank"
                   rel="noopener noreferrer"
                   class="w-full py-3 bg-gradient-to-r from-accent to-accent-dark text-white rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                  <span class="material-icons">open_in_new</span>
                  View on Mempool Explorer
                </a>
                <a [routerLink]="['/project', projectId]"
                   class="w-full py-3 bg-surface-hover text-text rounded-xl font-semibold hover:bg-surface-ground transition-colors border border-border text-sm">
                  Back to Project
                </a>
                <a [routerLink]="['/explore']"
                   class="text-sm text-text-secondary hover:text-text transition-colors">
                  Explore more projects
                </a>
              </div>
            </div>
          </div>
        }

      </div><!-- end main content -->

      <!-- Footer -->
      <div class="text-center py-6 text-xs text-text-secondary border-t border-border mt-auto">
        <p>Powered by <strong class="text-text">Angor Protocol</strong> &middot; Non-custodial Bitcoin investments</p>
      </div>

    </div><!-- end invest shell -->
  `
})
export class InvestComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  public indexer = inject(IndexerService);
  private relay = inject(RelayService);
  public networkService = inject(NetworkService);
  private walletService = inject(WalletService);
  private mempoolService = inject(MempoolService);
  private angorTx = inject(AngorTransactionService);
  public bitcoin = inject(BitcoinUtilsService);
  private titleService = inject(TitleService);

  // Make Math available in template
  Math = Math;

  private subscriptions: Subscription[] = [];
  projectId = '';

  // State
  currentStep = signal<InvestStep>('loading');
  errorMessage = signal<string>('');
  project = signal<IndexedProject | null>(null);
  wallet = signal<WalletData | null>(null);
  paymentReceived = signal<boolean>(false);

  // Loading sub-steps
  loadingMessage = signal<string>('Initializing...');
  loadingSteps = signal<{ label: string; active: boolean; done: boolean }[]>([
    { label: 'Loading project details', active: true, done: false },
    { label: 'Connecting to Nostr relays', active: false, done: false },
    { label: 'Preparing wallet', active: false, done: false },
  ]);

  // Amount inputs
  investmentBtc = 0.001;
  investmentSats = 100000;
  inputMode: 'btc' | 'sats' = 'sats';
  selectedFeeLevel: 'economy' | 'normal' | 'fast' = 'normal';

  quickAmountsSats = [
    { label: '10k', value: 10000 },
    { label: '50k', value: 50000 },
    { label: '100k', value: 100000 },
    { label: '500k', value: 500000 },
    { label: '1M', value: 1000000 },
    { label: '5M', value: 5000000 },
    { label: '0.1 BTC', value: 10000000 },
    { label: '1 BTC', value: 100000000 },
  ];

  feeOptions = [
    { id: 'economy' as const, label: 'Economy' },
    { id: 'normal' as const, label: 'Normal' },
    { id: 'fast' as const, label: 'Fast' },
  ];

  howItWorksSteps = [
    { icon: 'wallet', label: 'A temporary Bitcoin wallet is created in your browser' },
    { icon: 'qr_code_2', label: 'You send BTC to the shown address from any wallet' },
    { icon: 'receipt_long', label: 'We build and sign the Angor investment transaction' },
    { icon: 'send', label: 'Transaction is broadcast to the Bitcoin network' },
  ];

  // Step indicator
  stepIndicators = [
    { id: 'amount', label: 'Amount' },
    { id: 'payment', label: 'Payment' },
    { id: 'processing', label: 'Processing' },
    { id: 'complete', label: 'Complete' },
  ];

  // Payment state
  depositAddress = signal<string>('');
  showMnemonic = signal<boolean>(false);
  addressCopied = signal<boolean>(false);
  mnemonicCopied = signal<boolean>(false);
  backupConfirmed = false;
  showLightningOption = false;
  showLightningQR = signal<boolean>(false);
  lightningInvoice = signal<string>(''); // Boltz placeholder

  // Fees
  recommendedFees = signal<{ fastestFee: number; halfHourFee: number; hourFee: number; economyFee: number; minimumFee: number } | null>(null);

  // Processing
  processingStatus = signal<string>('');
  processingSteps = signal<{ id: string; label: string; status: 'pending' | 'active' | 'complete' }[]>([
    { id: 'detect', label: 'Payment detected on mempool', status: 'pending' },
    { id: 'build', label: 'Building Angor investment transaction', status: 'pending' },
    { id: 'sign', label: 'Signing transaction with wallet key', status: 'pending' },
    { id: 'broadcast', label: 'Broadcasting to Bitcoin network', status: 'pending' },
  ]);

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
    const rate = fees ? this.getFeeRate(this.selectedFeeLevel) : 5;
    return this.angorTx.calculateFee(1, 2, rate);
  });

  totalAmountToSend = computed(() => {
    return this.investmentSats + this.estimatedFee() + 1000;
  });

  bitcoinQrValue = computed(() => {
    const addr = this.depositAddress();
    const amount = this.totalAmountToSend();
    if (!addr) return '';
    const btcAmount = (amount / 1e8).toFixed(8);
    return `bitcoin:${addr}?amount=${btcAmount}`;
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    this.titleService.setTitle('Invest');
    this.projectId = this.route.snapshot.paramMap.get('id') || '';

    if (!this.projectId) {
      this.setError('No project ID provided');
      return;
    }

    // Handle query params
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

  // ─── Initialization ─────────────────────────────────────────────────────────

  private async initialize(): Promise<void> {
    try {
      this.currentStep.set('loading');
      this.updateLoadingStep(0, true, false);

      // Fetch fees in background
      this.mempoolService.getRecommendedFees().then(fees => {
        this.recommendedFees.set(fees);
      });

      // Fetch project data
      let projectData: IndexedProject | null | undefined = this.indexer.getProject(this.projectId);
      if (!projectData) {
        projectData = await this.indexer.fetchProject(this.projectId);
      }

      if (!projectData) {
        this.setError('Project not found. Please check the project ID and try again.');
        return;
      }

      this.project.set(projectData);
      this.titleService.setTitle(`Invest in ${projectData.metadata?.name || 'Project'}`);
      this.updateLoadingStep(0, false, true);
      this.updateLoadingStep(1, true, false);

      // Fetch Nostr details
      if (!projectData.details) {
        this.relay.fetchData([projectData.nostrEventId]);
        const sub = this.relay.projectUpdates.subscribe((event) => {
          if (!event) return;
          try {
            const details: ProjectUpdate = JSON.parse(event.content);
            if (details.projectIdentifier === this.projectId) {
              const curr = this.project();
              if (curr) {
                curr.details = details;
                this.project.set({ ...curr });
              }
            }
          } catch { /* ignore */ }
        });
        this.subscriptions.push(sub);
        // Give it 2s to load
        await new Promise(r => setTimeout(r, 2000));
      }

      this.updateLoadingStep(1, false, true);
      this.updateLoadingStep(2, true, false);

      // Fetch stats
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

      this.updateLoadingStep(2, false, true);

      // Ready
      this.currentStep.set('amount');
    } catch (err) {
      console.error('Initialization error:', err);
      this.setError(err instanceof Error ? err.message : 'Failed to initialize. Please try again.');
    }
  }

  private updateLoadingStep(index: number, active: boolean, done: boolean): void {
    this.loadingSteps.update(steps => steps.map((s, i) => i === index ? { ...s, active, done } : s));
  }

  private setError(message: string): void {
    this.errorMessage.set(message);
    this.currentStep.set('error');
  }

  // ─── Amount Step ────────────────────────────────────────────────────────────

  onBtcAmountChange(): void {
    this.investmentSats = Math.round(this.investmentBtc * 1e8);
  }

  onSatsAmountChange(): void {
    this.investmentBtc = this.investmentSats / 1e8;
  }

  setQuickAmountSats(value: number): void {
    this.investmentSats = value;
    this.investmentBtc = value / 1e8;
  }

  isValidAmount(): boolean {
    return this.investmentSats >= 10000;
  }

  getFeeRate(level: 'economy' | 'normal' | 'fast'): number {
    const fees = this.recommendedFees();
    if (!fees) return level === 'economy' ? 2 : level === 'normal' ? 5 : 10;
    switch (level) {
      case 'economy': return fees.economyFee;
      case 'normal': return fees.halfHourFee;
      case 'fast': return fees.fastestFee;
    }
  }

  getFundingPercent(): number {
    const invested = this.project()?.stats?.amountInvested ?? 0;
    const target = this.project()?.details?.targetAmount ?? 1;
    return Number(((invested / target) * 100).toFixed(1));
  }

  proceedToPayment(): void {
    if (!this.isValidAmount()) return;

    const walletData = this.wallet();
    if (walletData) {
      this.walletService.saveWalletToStorage(walletData.mnemonic, walletData.address);
    }

    this.currentStep.set('payment');
    this.startPaymentWatch();
  }

  // ─── Payment Step ────────────────────────────────────────────────────────────

  private async startPaymentWatch(): Promise<void> {
    const address = this.depositAddress();
    if (!address) return;

    const sub = this.mempoolService.paymentDetected.subscribe(async (utxo) => {
      if (utxo.value >= this.totalAmountToSend()) {
        this.paymentReceived.set(true);
        this.mempoolService.stopWatching();
        // Short delay for UX
        await new Promise(r => setTimeout(r, 1500));
        await this.processInvestment(utxo);
      }
    });

    this.subscriptions.push(sub);
    this.mempoolService.startWatchingAddress(address, 5000);
  }

  cancelPayment(): void {
    this.mempoolService.stopWatching();
    this.currentStep.set('amount');
    this.paymentReceived.set(false);
  }

  async copyAddress(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.depositAddress());
      this.addressCopied.set(true);
      setTimeout(() => this.addressCopied.set(false), 2000);
    } catch { /* ignore */ }
  }

  async copyMnemonic(): Promise<void> {
    const mnemonic = this.wallet()?.mnemonic;
    if (!mnemonic) return;
    try {
      await navigator.clipboard.writeText(mnemonic);
      this.mnemonicCopied.set(true);
      setTimeout(() => this.mnemonicCopied.set(false), 2000);
    } catch { /* ignore */ }
  }

  // ─── Processing Step ─────────────────────────────────────────────────────────

  private async processInvestment(utxo: UTXO): Promise<void> {
    this.currentStep.set('processing');
    this.updateProcessingStep('detect', 'complete');
    this.processingStatus.set('Payment confirmed! Building your Angor investment transaction...');

    try {
      this.updateProcessingStep('build', 'active');

      const projectDetails = this.project()?.details;
      if (!projectDetails) throw new Error('Project details not available');

      const feeRate = this.getFeeRate(this.selectedFeeLevel);

      const builtTx = await this.angorTx.buildInvestmentTransaction({
        projectDetails,
        investmentAmount: this.investmentSats,
        utxo,
        feeRate,
      });

      this.updateProcessingStep('build', 'complete');
      this.updateProcessingStep('sign', 'active');
      this.processingStatus.set('Signing transaction...');

      await new Promise(r => setTimeout(r, 500));
      this.updateProcessingStep('sign', 'complete');
      this.updateProcessingStep('broadcast', 'active');
      this.processingStatus.set('Broadcasting to Bitcoin network...');

      const txId = await this.angorTx.broadcastInvestment(builtTx.txHex);
      console.log('Broadcast successful:', txId);

      this.updateProcessingStep('broadcast', 'complete');
      this.completedTransaction.set(builtTx);
      this.currentStep.set('complete');
    } catch (err) {
      console.error('Investment error:', err);
      this.setError(err instanceof Error ? err.message : 'Failed to process investment');
    }
  }

  private updateProcessingStep(stepId: string, status: 'pending' | 'active' | 'complete'): void {
    this.processingSteps.update(steps =>
      steps.map(s => s.id === stepId ? { ...s, status } : s)
    );
  }

  // ─── Step Indicator Helpers ──────────────────────────────────────────────────

  isStepActive(stepId: string): boolean {
    const stepOrder = ['amount', 'payment', 'processing', 'complete'];
    const currentIdx = stepOrder.indexOf(this.currentStep());
    const stepIdx = stepOrder.indexOf(stepId);
    return stepIdx === currentIdx;
  }

  isStepDone(stepId: string): boolean {
    const stepOrder = ['amount', 'payment', 'processing', 'complete'];
    const currentIdx = stepOrder.indexOf(this.currentStep());
    const stepIdx = stepOrder.indexOf(stepId);
    return stepIdx < currentIdx;
  }

  // ─── Misc Helpers ────────────────────────────────────────────────────────────

  retryInvestment(): void {
    this.initialize();
  }

  formatDate(timestamp: number | undefined): string {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
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
