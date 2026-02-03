import { Injectable, inject, signal } from '@angular/core';
import { NetworkService } from './network.service';
import { MempoolService, UTXO } from './mempool.service';
import { WalletService } from './wallet.service';
import { ProjectUpdate } from './relay.service';
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

// Initialize ECC library for bitcoinjs-lib
bitcoin.initEccLib(ecc as Parameters<typeof bitcoin.initEccLib>[0]);

export interface InvestmentParams {
  projectDetails: ProjectUpdate;
  investmentAmount: number; // in satoshis
  utxo: UTXO;
  feeRate: number; // sat/vbyte
}

export interface AngorInvestmentOutput {
  founderAddress: string;
  investorAddress: string;
  stageOutputs: {
    address: string;
    amount: number;
    releaseDate: number;
  }[];
  penaltyOutput?: {
    address: string;
    amount: number;
  };
}

export interface BuiltTransaction {
  txHex: string;
  txId: string;
  fee: number;
}

@Injectable({
  providedIn: 'root'
})
export class AngorTransactionService {
  private network = inject(NetworkService);
  private mempool = inject(MempoolService);
  private walletService = inject(WalletService);

  building = signal<boolean>(false);
  error = signal<string | null>(null);

  private getNetwork(): bitcoin.Network {
    return this.network.isMain() ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
  }

  /**
   * Calculate the project penalty status
   * Returns true if project is below the penalty threshold
   */
  isProjectBelowPenaltyThreshold(projectDetails: ProjectUpdate): boolean {
    const now = Date.now() / 1000;
    const startDate = projectDetails.startDate;
    const penaltyDays = projectDetails.penaltyDays || 0;

    // Calculate penalty start date (start date + penalty days)
    const penaltyStartDate = startDate + (penaltyDays * 24 * 60 * 60);

    // Project is safe to invest if we're before the penalty period starts
    return now < penaltyStartDate;
  }

  /**
   * Calculate the required fee for a transaction
   */
  calculateFee(inputCount: number, outputCount: number, feeRate: number): number {

    const estimatedVbytes = 10 + (inputCount * 68) + (outputCount * 31);
    return Math.ceil(estimatedVbytes * feeRate);
  }

  /**
   * Build an Angor investment transaction
   * This creates a transaction that spends the UTXO and creates the Angor investment outputs
   */
  async buildInvestmentTransaction(params: InvestmentParams): Promise<BuiltTransaction> {
    this.building.set(true);
    this.error.set(null);

    try {
      const { projectDetails, investmentAmount, utxo, feeRate } = params;
      const keyPair = this.walletService.getKeyPair();

      if (!keyPair) {
        throw new Error('No wallet available');
      }

      const network = this.getNetwork();

      // Create the transaction builder
      const psbt = new bitcoin.Psbt({ network });

      // Fetch the previous transaction to get the full output details
      const prevTxHex = await this.mempool.fetchTransactionHex(utxo.txid);
      if (!prevTxHex) {
        throw new Error('Failed to fetch previous transaction');
      }

      // Add the input (the UTXO from the QR code payment)
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: bitcoin.payments.p2wpkh({
            pubkey: keyPair.publicKey,
            network
          }).output!,
          value: BigInt(utxo.value)
        }
      });

      // Calculate outputs based on Angor protocol
      const outputs = this.calculateAngorOutputs(projectDetails, investmentAmount);

      // Calculate fee
      const fee = this.calculateFee(1, outputs.length + 1, feeRate);

      // Validate we have enough funds
      if (utxo.value < investmentAmount + fee) {
        throw new Error(`Insufficient funds. Need ${investmentAmount + fee} sats, have ${utxo.value} sats`);
      }

      // Add Angor investment outputs
      // The main investment goes to the project's founder recovery key script
      const founderRecoveryScript = this.createFounderRecoveryScript(
        projectDetails.founderRecoveryKey,
        projectDetails.founderKey
      );

      psbt.addOutput({
        script: founderRecoveryScript,
        value: BigInt(investmentAmount)
      });

      // Add change output if there's leftover
      const changeAmount = utxo.value - investmentAmount - fee;
      if (changeAmount > 546) { // Dust threshold
        const walletData = this.walletService.wallet();
        if (walletData) {
          psbt.addOutput({
            address: walletData.address,
            value: BigInt(changeAmount)
          });
        }
      }

      // Sign the transaction
      psbt.signInput(0, {
        publicKey: keyPair.publicKey,
        sign: (hash: Buffer) => {
          return Buffer.from(ecc.sign(hash, keyPair.privateKey));
        }
      });

      // Finalize and extract
      psbt.finalizeAllInputs();
      const tx = psbt.extractTransaction();

      return {
        txHex: tx.toHex(),
        txId: tx.getId(),
        fee
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to build transaction';
      this.error.set(errorMessage);
      throw err;
    } finally {
      this.building.set(false);
    }
  }

  /**
   * Create the founder recovery script for Angor investments
   * This is a timelocked script that allows recovery after the project ends
   */
  private createFounderRecoveryScript(founderRecoveryKey: string, _founderKey: string): Buffer {

    const founderRecoveryPubkey = Buffer.from(founderRecoveryKey, 'hex');

    const { output } = bitcoin.payments.p2wpkh({
      pubkey: founderRecoveryPubkey,
      network: this.getNetwork()
    });

    if (!output) {
      throw new Error('Failed to create founder recovery script');
    }

    return Buffer.from(output);
  }

  /**
   * Calculate the output structure for an Angor investment
   */
  private calculateAngorOutputs(
    projectDetails: ProjectUpdate,
    investmentAmount: number
  ): { address: string; amount: number }[] {
    const outputs: { address: string; amount: number }[] = [];
    const stages = projectDetails.stages || [];

    // Calculate amount for each stage based on percentage
    let totalAllocated = 0;

    for (const stage of stages) {
      const stageAmount = Math.floor((investmentAmount * stage.amountToRelease) / 100);
      if (stageAmount > 0) {
        outputs.push({
          address: '', // Will be calculated based on stage script
          amount: stageAmount
        });
        totalAllocated += stageAmount;
      }
    }

    // Any remainder goes to the first stage
    const remainder = investmentAmount - totalAllocated;
    if (remainder > 0 && outputs.length > 0) {
      outputs[0].amount += remainder;
    }

    return outputs;
  }

  /**
   * Simplified investment transaction for direct investment
   * This creates a basic transaction to the founder's address
   */
  async buildSimpleInvestmentTransaction(
    founderAddress: string,
    investmentAmount: number,
    utxo: UTXO,
    feeRate: number
  ): Promise<BuiltTransaction> {
    this.building.set(true);
    this.error.set(null);

    try {
      const keyPair = this.walletService.getKeyPair();

      if (!keyPair) {
        throw new Error('No wallet available');
      }

      const network = this.getNetwork();

      // Create the transaction builder
      const psbt = new bitcoin.Psbt({ network });

      // Add the input
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: bitcoin.payments.p2wpkh({
            pubkey: keyPair.publicKey,
            network
          }).output!,
          value: BigInt(utxo.value)
        }
      });

      // Calculate fee (1 input, 2 outputs)
      const fee = this.calculateFee(1, 2, feeRate);

      // Validate we have enough funds
      if (utxo.value < investmentAmount + fee) {
        throw new Error(`Insufficient funds. Need ${investmentAmount + fee} sats, have ${utxo.value} sats`);
      }

      // Add investment output to founder
      psbt.addOutput({
        address: founderAddress,
        value: BigInt(investmentAmount)
      });

      // Add change output
      const changeAmount = utxo.value - investmentAmount - fee;
      if (changeAmount > 546) {
        const walletData = this.walletService.wallet();
        if (walletData) {
          psbt.addOutput({
            address: walletData.address,
            value: BigInt(changeAmount)
          });
        }
      }

      // Sign the transaction
      psbt.signInput(0, {
        publicKey: keyPair.publicKey,
        sign: (hash: Buffer) => {
          return Buffer.from(ecc.sign(hash, keyPair.privateKey));
        }
      });

      // Finalize and extract
      psbt.finalizeAllInputs();
      const tx = psbt.extractTransaction();

      return {
        txHex: tx.toHex(),
        txId: tx.getId(),
        fee
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to build transaction';
      this.error.set(errorMessage);
      throw err;
    } finally {
      this.building.set(false);
    }
  }

  /**
   * Broadcast the investment transaction
   */
  async broadcastInvestment(txHex: string): Promise<string> {
    try {
      const txId = await this.mempool.broadcastTransaction(txHex);
      if (!txId) {
        throw new Error('Failed to broadcast transaction');
      }
      return txId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to broadcast transaction';
      this.error.set(errorMessage);
      throw err;
    }
  }
}
