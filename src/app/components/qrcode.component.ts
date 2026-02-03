import { Component, Input, OnChanges, SimpleChanges, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import QRCode from 'qrcode';

@Component({
  selector: 'app-qrcode',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="qr-container flex flex-col items-center">
      @if (loading()) {
        <div class="w-48 h-48 bg-surface-hover rounded-lg animate-pulse flex items-center justify-center">
          <span class="material-icons text-4xl text-text-secondary animate-spin">hourglass_empty</span>
        </div>
      } @else if (error()) {
        <div class="w-48 h-48 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
          <span class="material-icons text-4xl text-red-500">error</span>
        </div>
        <p class="text-sm text-red-500 mt-2">{{ error() }}</p>
      } @else {
        <div class="bg-white p-4 rounded-xl shadow-lg">
          <canvas #qrCanvas></canvas>
        </div>
        @if (showValue && value) {
          <div class="mt-3 w-full">
            <div class="flex items-center gap-2 bg-surface-ground rounded-lg px-3 py-2">
              <span class="text-xs text-text-secondary font-mono truncate flex-1">{{ value }}</span>
              <button
                (click)="copyToClipboard()"
                class="p-1.5 hover:bg-surface-hover rounded transition-colors"
                [title]="copied() ? 'Copied!' : 'Copy to clipboard'">
                <span class="material-icons text-sm" [class.text-green-500]="copied()">
                  {{ copied() ? 'check' : 'content_copy' }}
                </span>
              </button>
            </div>
          </div>
        }
      }
    </div>
  `
})
export class QRCodeComponent implements OnChanges, AfterViewInit {
  @Input() value: string = '';
  @Input() size: number = 192;
  @Input() showValue: boolean = true;
  @Input() errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M';

  @ViewChild('qrCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  copied = signal<boolean>(false);

  private initialized = false;

  ngAfterViewInit(): void {
    this.initialized = true;
    if (this.value) {
      this.generateQRCode();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && this.initialized) {
      this.generateQRCode();
    }
  }

  private async generateQRCode(): Promise<void> {
    if (!this.value || !this.canvasRef?.nativeElement) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await QRCode.toCanvas(this.canvasRef.nativeElement, this.value, {
        width: this.size,
        margin: 2,
        errorCorrectionLevel: this.errorCorrectionLevel,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.error('Failed to generate QR code:', err);
      this.error.set('Failed to generate QR code');
    } finally {
      this.loading.set(false);
    }
  }

  async copyToClipboard(): Promise<void> {
    if (!this.value) return;

    try {
      await navigator.clipboard.writeText(this.value);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }
}
