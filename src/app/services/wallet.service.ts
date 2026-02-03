import { Injectable, signal, inject } from '@angular/core';
import { NetworkService } from './network.service';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as secp from '@noble/secp256k1';

// Create a custom ECC implementation using @noble/secp256k1
const ecc = {
  isPoint: (p: Uint8Array): boolean => {
    try {
      secp.Point.fromBytes(p);
      return true;
    } catch {
      return false;
    }
  },
  isPrivate: (d: Uint8Array): boolean => {
    try {
      const n = BigInt('0x' + Buffer.from(d).toString('hex'));
      return n > 0n && n < secp.CURVE.n;
    } catch {
      return false;
    }
  },
  isXOnlyPoint: (p: Uint8Array): boolean => {
    try {
      if (p.length !== 32) return false;
      const x = BigInt('0x' + Buffer.from(p).toString('hex'));
      return x > 0n && x < secp.CURVE.p;
    } catch {
      return false;
    }
  },
  xOnlyPointAddTweak: (p: Uint8Array, tweak: Uint8Array): { parity: 0 | 1; xOnlyPubkey: Uint8Array } | null => {
    try {
      // For x-only points, assume even parity
      const fullPoint = new Uint8Array(33);
      fullPoint[0] = 0x02;
      fullPoint.set(p, 1);
      const point = secp.Point.fromBytes(fullPoint);
      const tweakBigInt = BigInt('0x' + Buffer.from(tweak).toString('hex'));
      const tweakPoint = secp.Point.BASE.multiply(tweakBigInt);
      const result = point.add(tweakPoint);
      const compressed = result.toBytes(true);
      const parity = compressed[0] === 0x02 ? 0 : 1;
      return {
        parity: parity as 0 | 1,
        xOnlyPubkey: compressed.slice(1)
      };
    } catch {
      return null;
    }
  },
  pointFromScalar: (d: Uint8Array, compressed?: boolean): Uint8Array | null => {
    try {
      const pubKey = secp.getPublicKey(d, compressed ?? true);
      return pubKey;
    } catch {
      return null;
    }
  },
  pointCompress: (p: Uint8Array, compressed?: boolean): Uint8Array => {
    const point = secp.Point.fromBytes(p);
    return point.toBytes(compressed ?? true);
  },
  pointAddScalar: (p: Uint8Array, tweak: Uint8Array, compressed?: boolean): Uint8Array | null => {
    try {
      const point = secp.Point.fromBytes(p);
      const tweakBigInt = BigInt('0x' + Buffer.from(tweak).toString('hex'));
      const tweakPoint = secp.Point.BASE.multiply(tweakBigInt);
      const result = point.add(tweakPoint);
      return result.toBytes(compressed ?? true);
    } catch {
      return null;
    }
  },
  privateAdd: (d: Uint8Array, tweak: Uint8Array): Uint8Array | null => {
    try {
      const n1 = BigInt('0x' + Buffer.from(d).toString('hex'));
      const n2 = BigInt('0x' + Buffer.from(tweak).toString('hex'));
      const sum = (n1 + n2) % secp.CURVE.n;
      if (sum === 0n) return null;
      const hex = sum.toString(16).padStart(64, '0');
      return Buffer.from(hex, 'hex');
    } catch {
      return null;
    }
  },
  sign: (h: Uint8Array, d: Uint8Array): Uint8Array => {
    const sig = secp.sign(h, d, { lowS: true });
    return sig.toCompactRawBytes();
  },
  verify: (h: Uint8Array, Q: Uint8Array, signature: Uint8Array): boolean => {
    try {
      const sig = secp.Signature.fromCompact(signature);
      return secp.verify(sig, h, Q, { lowS: true });
    } catch {
      return false;
    }
  }
};

const bip32 = BIP32Factory(ecc);

// Initialize ECC library for bitcoinjs-lib
bitcoin.initEccLib(ecc as Parameters<typeof bitcoin.initEccLib>[0]);

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

  wallet = signal<WalletData | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  private readonly STORAGE_KEY = 'angor-invest-wallet';

  private getNetwork(): bitcoin.Network {
    return this.network.isMain() ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
  }

  private getDerivationPath(): string {
    // BIP84 for native segwit
    // mainnet: m/84'/0'/0'/0/0
    // testnet: m/84'/1'/0'/0/0
    return this.network.isMain() ? "m/84'/0'/0'/0/0" : "m/84'/1'/0'/0/0";
  }

  async createWallet(): Promise<WalletData> {
    this.loading.set(true);
    this.error.set(null);

    try {
      // Generate a new mnemonic (12 words)
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
      // Validate mnemonic
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
      }

      // Generate seed from mnemonic
      const seed = await bip39.mnemonicToSeed(mnemonic);

      // Create HD wallet from seed
      const root = bip32.fromSeed(Buffer.from(seed), this.getNetwork());

      // Derive the key using the BIP84 path
      const path = this.getDerivationPath();
      const child = root.derivePath(path);

      if (!child.privateKey) {
        throw new Error('Failed to derive private key');
      }

      // Create P2WPKH (native segwit) address
      const { address } = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(child.publicKey),
        network: this.getNetwork()
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
      encryptedMnemonic: btoa(mnemonic), // Simple base64 encoding 
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

  deriveNextAddress(index: number): string | null {
    const walletData = this.wallet();
    if (!walletData) return null;

    try {
      const seed = bip39.mnemonicToSeedSync(walletData.mnemonic);
      const root = bip32.fromSeed(Buffer.from(seed), this.getNetwork());

      const basePath = this.network.isMain() ? "m/84'/0'/0'/0" : "m/84'/1'/0'/0";
      const child = root.derivePath(`${basePath}/${index}`);

      const { address } = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(child.publicKey),
        network: this.getNetwork()
      });

      return address || null;
    } catch (err) {
      console.error('Failed to derive address:', err);
      return null;
    }
  }
}
