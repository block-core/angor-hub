import { Injectable, inject, signal } from '@angular/core';
import { NetworkService } from './network.service';
import { IndexerService } from './indexer.service';
import { Subject, interval, Subscription } from 'rxjs';

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
  };
  scriptPubKey?: string;
}

export interface MempoolTransaction {
  txid: string;
  version: number;
  locktime: number;
  vin: {
    txid: string;
    vout: number;
    prevout: {
      scriptpubkey: string;
      scriptpubkey_asm: string;
      scriptpubkey_type: string;
      scriptpubkey_address: string;
      value: number;
    };
    scriptsig: string;
    scriptsig_asm: string;
    witness?: string[];
    is_coinbase: boolean;
    sequence: number;
  }[];
  vout: {
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address?: string;
    value: number;
  }[];
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class MempoolService {
  private network = inject(NetworkService);
  private indexer = inject(IndexerService);

  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  utxos = signal<UTXO[]>([]);
  lastTransaction = signal<MempoolTransaction | null>(null);

  paymentDetected = new Subject<UTXO>();

  private pollingSubscription: Subscription | null = null;
  private watchedAddress: string | null = null;

  private getMempoolApiUrl(): string {
    return this.network.isMain()
      ? 'https://mempool.space/api'
      : 'https://mempool.space/testnet/api';
  }

  async fetchAddressUtxos(address: string): Promise<UTXO[]> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await fetch(`${this.getMempoolApiUrl()}/address/${address}/utxo`);

      if (!response.ok) {
        throw new Error(`Failed to fetch UTXOs: ${response.status}`);
      }

      const utxos = await response.json() as UTXO[];
      this.utxos.set(utxos);
      return utxos;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch UTXOs';
      this.error.set(errorMessage);
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  async fetchTransaction(txid: string): Promise<MempoolTransaction | null> {
    try {
      const response = await fetch(`${this.getMempoolApiUrl()}/tx/${txid}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch transaction: ${response.status}`);
      }

      const tx = await response.json() as MempoolTransaction;
      this.lastTransaction.set(tx);
      return tx;
    } catch (err) {
      console.error('Failed to fetch transaction:', err);
      return null;
    }
  }

  async fetchTransactionHex(txid: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.getMempoolApiUrl()}/tx/${txid}/hex`);

      if (!response.ok) {
        throw new Error(`Failed to fetch transaction hex: ${response.status}`);
      }

      return await response.text();
    } catch (err) {
      console.error('Failed to fetch transaction hex:', err);
      return null;
    }
  }

  async broadcastTransaction(txHex: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.getMempoolApiUrl()}/tx`, {
        method: 'POST',
        body: txHex
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to broadcast transaction: ${errorText}`);
      }

      return await response.text();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to broadcast transaction';
      this.error.set(errorMessage);
      throw err;
    }
  }

  async getRecommendedFees(): Promise<{ fastestFee: number; halfHourFee: number; hourFee: number; economyFee: number; minimumFee: number }> {
    try {
      const response = await fetch(`${this.getMempoolApiUrl()}/v1/fees/recommended`);

      if (!response.ok) {
        throw new Error(`Failed to fetch fees: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Failed to fetch recommended fees:', err);
      // Return default fees
      return {
        fastestFee: 10,
        halfHourFee: 8,
        hourFee: 5,
        economyFee: 2,
        minimumFee: 1
      };
    }
  }

  startWatchingAddress(address: string, pollIntervalMs: number = 5000): void {
    this.stopWatching();
    this.watchedAddress = address;
    this.utxos.set([]);

    // Initial fetch
    this.fetchAddressUtxos(address);

    // Start polling
    this.pollingSubscription = interval(pollIntervalMs).subscribe(async () => {
      if (!this.watchedAddress) return;

      try {
        const previousUtxos = this.utxos();
        const currentUtxos = await this.fetchAddressUtxos(this.watchedAddress);

        // Check for new UTXOs
        for (const utxo of currentUtxos) {
          const isNew = !previousUtxos.some(
            prev => prev.txid === utxo.txid && prev.vout === utxo.vout
          );

          if (isNew) {
            console.log('New payment detected:', utxo);
            this.paymentDetected.next(utxo);
          }
        }
      } catch (err) {
        console.error('Error polling address:', err);
      }
    });
  }

  stopWatching(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
    this.watchedAddress = null;
  }

  async waitForPayment(address: string, timeoutMs: number = 300000): Promise<UTXO | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.stopWatching();
        resolve(null);
      }, timeoutMs);

      const subscription = this.paymentDetected.subscribe((utxo) => {
        clearTimeout(timeout);
        subscription.unsubscribe();
        resolve(utxo);
      });

      this.startWatchingAddress(address);
    });
  }

  getTotalBalance(): number {
    return this.utxos().reduce((sum, utxo) => sum + utxo.value, 0);
  }
}
