import { Injectable, signal, inject } from '@angular/core';
import { NetworkService } from './network.service';
import { CryptoService, initCrypto, getEcc, getBitcoin, isInitialized } from './crypto.service';
import * as bip39 from 'bip39';
import { BIP32Factory, BIP32Interface } from 'bip32';

export interface WalletData {
  mnemonic: string;
  address: string;
  publicKey: string;
  privateKey: string;
  path: string;
}

export interface StoredWallet {
  encryptedMnemonic: string;
  address: string;
  createdAt: number;
  network: 'main' | 'test';
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private network = inject(NetworkService);
  private cryptoService = inject(CryptoService);

  wallet = signal<WalletData | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  private readonly STORAGE_KEY = 'angor-invest-wallet';
  private bip32Instance: ReturnType<typeof BIP32Factory> | null = null;

  private async ensureInitialized(): Promise<void> {
    await this.cryptoService.ensureInitialized();
    if (!this.bip32Instance) {
      this.bip32Instance = BIP32Factory(getEcc());
    }
  }

  private getNetwork() {
    const bitcoin = getBitcoin();
    return this.network.isMain() ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
  }

  private getDerivationPath(): string {
    return this.network.isMain() ? "m/84'/0'/0'/0/0" : "m/84'/1'/0'/0/0";
  }

  async createWallet(): Promise<WalletData> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.ensureInitialized();
      const mnemonic = bip39.generateMnemonic(128);
      return await this.restoreWallet(mnemonic);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create wallet';
      this.error.set(errorMessage);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async restoreWallet(mnemonic: string): Promise<WalletData> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.ensureInitialized();

      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
      }

      const seed = await bip39.mnemonicToSeed(mnemonic);
      const bitcoin = getBitcoin();
      const network = this.getNetwork();

      const root = this.bip32Instance!.fromSeed(Buffer.from(seed), network);
      const path = this.getDerivationPath();
      const child = root.derivePath(path);

      if (!child.privateKey) {
        throw new Error('Failed to derive private key');
      }

      const { address } = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(child.publicKey),
        network
      });

      if (!address) {
        throw new Error('Failed to generate address');
      }

      const walletData: WalletData = {
        mnemonic,
        address,
        publicKey: Buffer.from(child.publicKey).toString('hex'),
        privateKey: Buffer.from(child.privateKey).toString('hex'),
        path
      };

      this.wallet.set(walletData);
      return walletData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to restore wallet';
      this.error.set(errorMessage);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  getStoredWallet(): StoredWallet | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as StoredWallet;
      }
    } catch (err) {
      console.error('Failed to load stored wallet:', err);
    }
    return null;
  }

  saveWalletToStorage(mnemonic: string, address: string): void {
    const storedWallet: StoredWallet = {
      encryptedMnemonic: btoa(mnemonic),
      address,
      createdAt: Date.now(),
      network: this.network.getNetwork()
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storedWallet));
  }

  clearStoredWallet(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.wallet.set(null);
  }

  async loadOrCreateWallet(): Promise<WalletData> {
    const stored = this.getStoredWallet();

    if (stored && stored.network === this.network.getNetwork()) {
      try {
        const mnemonic = atob(stored.encryptedMnemonic);
        return await this.restoreWallet(mnemonic);
      } catch (err) {
        console.error('Failed to restore stored wallet, creating new one:', err);
      }
    }

    return await this.createWallet();
  }

  getKeyPair(): { publicKey: Buffer; privateKey: Buffer } | null {
    const walletData = this.wallet();
    if (!walletData) return null;

    return {
      publicKey: Buffer.from(walletData.publicKey, 'hex'),
      privateKey: Buffer.from(walletData.privateKey, 'hex')
    };
  }

  async deriveNextAddress(index: number): Promise<string | null> {
    const walletData = this.wallet();
    if (!walletData) return null;

    try {
      await this.ensureInitialized();

      const seed = bip39.mnemonicToSeedSync(walletData.mnemonic);
      const bitcoin = getBitcoin();
      const network = this.getNetwork();

      const root = this.bip32Instance!.fromSeed(Buffer.from(seed), network);
      const basePath = this.network.isMain() ? "m/84'/0'/0'/0" : "m/84'/1'/0'/0";
      const child = root.derivePath(`${basePath}/${index}`);

      const { address } = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(child.publicKey),
        network
      });

      return address || null;
    } catch (err) {
      console.error('Failed to derive address:', err);
      return null;
    }
  }
}
