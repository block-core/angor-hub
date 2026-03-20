import { Injectable, inject } from '@angular/core';
import { NetworkService } from './network.service';
import { IndexerService } from './indexer.service';
import { bech32, bech32m } from '@scure/base';

/**
 * Mempool.space-compatible transaction format returned by /api/v1/address/{address}/txs.
 * The Blockcore indexer used by Angor supports this format as well.
 */
export interface MempoolTransaction {
  txid: string;
  version: number;
  locktime: number;
  size: number;
  weight: number;
  fee: number;
  vin: MempoolVin[];
  vout: MempoolVout[];
  status: MempoolTxStatus;
}

export interface MempoolVin {
  is_coinbase: boolean;
  prevout: MempoolVout;
  scriptsig: string;
  scriptsig_asm: string;
  sequence: number;
  txid: string;
  vout: number;
  witness: string[];
  inner_redeemscript_asm?: string;
  inner_witnessscript_asm?: string;
}

export interface MempoolVout {
  value: number;
  scriptpubkey: string;
  scriptpubkey_address: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
}

export interface MempoolTxStatus {
  confirmed: boolean;
  block_height: number;
  block_hash: string;
  block_time: number;
}

export interface MempoolOutspend {
  spent: boolean;
  txid: string | null;
  vin: number;
  status: MempoolTxStatus | null;
}

/** Parsed investment data for a single investor transaction. */
export interface InvestmentInfo {
  transactionId: string;
  investorPubKey: string;
  totalAmount: number;
  isSeeder: boolean;
  blockHeight: number;
  blockTime: number;
}

/** Aggregate stats computed from raw blockchain data. */
export interface OnChainProjectStats {
  investorCount: number;
  amountInvested: number;
  amountSpentSoFarByFounder: number;
  amountInPenalties: number;
  countInPenalties: number;
  investments: InvestmentInfo[];
}

/** Info extracted from the project funding (creation) transaction. */
export interface ProjectFundingInfo {
  founderKey: string;
  nostrEventId: string;
  fundingTxId: string;
  blockHeight: number;
}

@Injectable({
  providedIn: 'root',
})
export class InvestorService {
  private network = inject(NetworkService);
  private indexer = inject(IndexerService);

  /**
   * Converts an Angor project identifier (bech32 with "angor" HRP)
   * to a standard Bitcoin witness address (bech32/bech32m with "bc1"/"tb1" HRP).
   *
   * This mirrors the C# DerivationOperations.ConvertAngorKeyToBitcoinAddress logic:
   *   1. Decode the angor bech32 string to get witness version + data bytes
   *   2. Re-encode with the network's bech32 HRP (bc for mainnet, tb for testnet/signet)
   */
  convertAngorKeyToBitcoinAddress(projectId: string): string {
    // Decode with "angor" HRP - try bech32m first (witness version >= 1), then bech32 (version 0)
    let decoded: { prefix: string; words: number[] };
    let isBech32m = false;

    try {
      decoded = bech32m.decode(projectId as `angor1${string}`);
      isBech32m = true;
    } catch {
      decoded = bech32.decode(projectId as `angor1${string}`);
    }

    // First word is the witness version
    const witnessVersion = decoded.words[0];
    const dataWords = decoded.words.slice(1);

    // Determine network HRP
    const hrp = this.network.isMain() ? 'bc' : 'tb';

    // Re-encode using the appropriate encoding for the witness version
    // Witness version 0 uses bech32, version >= 1 uses bech32m
    if (witnessVersion === 0 || !isBech32m) {
      return bech32.encode(hrp, [witnessVersion, ...dataWords]);
    } else {
      return bech32m.encode(hrp, [witnessVersion, ...dataWords]);
    }
  }

  /**
   * Gets the base URL for the mempool-compatible API on the current indexer.
   * The Blockcore indexer supports /api/v1/ endpoints for mempool.space compatibility.
   */
  private getApiBaseUrl(): string {
    const isMainnet = this.network.isMain();
    const indexerUrl = this.indexer.getPrimaryIndexerUrl(isMainnet);
    return `${indexerUrl}api/v1`;
  }

  /**
   * Fetches all transactions for a given address from the mempool.space-compatible API.
   * Handles pagination (mempool.space returns max 25 txs per request).
   */
  async fetchAddressTransactions(address: string): Promise<MempoolTransaction[]> {
    const baseUrl = this.getApiBaseUrl();
    const allTxs: MempoolTransaction[] = [];
    let lastTxId: string | undefined;

    while (true) {
      let url = `${baseUrl}/address/${address}/txs`;
      if (lastTxId) {
        url += `?after_txid=${lastTxId}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          return allTxs;
        }
        throw new Error(`Failed to fetch address transactions: ${response.status}`);
      }

      const txs: MempoolTransaction[] = await response.json();
      if (!txs || txs.length === 0) {
        break;
      }

      allTxs.push(...txs);

      // Mempool.space returns 25 txs per page
      if (txs.length < 25) {
        break;
      }

      lastTxId = txs[txs.length - 1].txid;
    }

    return allTxs;
  }

  /**
   * Fetches outspend info for a transaction (which outputs are spent, by which tx).
   */
  async fetchOutspends(txId: string): Promise<MempoolOutspend[]> {
    const baseUrl = this.getApiBaseUrl();
    const response = await fetch(`${baseUrl}/tx/${txId}/outspends`);
    if (!response.ok) {
      throw new Error(`Failed to fetch outspends for ${txId}: ${response.status}`);
    }
    return await response.json();
  }

  /**
   * Parses the OP_RETURN from the founder's project creation transaction.
   *
   * OP_RETURN format: OP_RETURN <founder_pubkey(33 bytes)> <key_type(2 bytes)> <nostr_event_id(32 bytes)>
   *
   * The scriptpubkey hex format is:
   *   6a  - OP_RETURN
   *   21  - PUSH 33 bytes
   *   <33 bytes founder pubkey>
   *   02  - PUSH 2 bytes
   *   <2 bytes key type>
   *   20  - PUSH 32 bytes
   *   <32 bytes nostr event id>
   */
  parseFounderInfoFromOpReturn(scriptpubkeyHex: string): { founderKey: string; nostrEventId: string } | null {
    try {
      // Parse the raw hex to extract OP_RETURN pushdata
      const ops = this.parseScriptOps(scriptpubkeyHex);

      // ops[0] = OP_RETURN (0x6a)
      // ops[1] = founder pubkey (33 bytes)
      // ops[2] = key type (2 bytes)
      // ops[3] = nostr event id (32 bytes)
      if (ops.length < 4) return null;

      const founderKeyBytes = ops[1];
      const nostrEventIdBytes = ops[3];

      if (!founderKeyBytes || founderKeyBytes.length !== 33) return null;

      const founderKey = this.bytesToHex(founderKeyBytes);
      const nostrEventId = nostrEventIdBytes ? this.bytesToHex(nostrEventIdBytes) : '';

      return { founderKey, nostrEventId };
    } catch {
      return null;
    }
  }

  /**
   * Parses the OP_RETURN from an investor's investment transaction.
   *
   * OP_RETURN format: OP_RETURN <investor_pubkey(33 bytes)> [<secret_hash(32 bytes)>]
   */
  parseInvestorInfoFromOpReturn(scriptpubkeyHex: string): { investorPubKey: string; isSeeder: boolean } | null {
    try {
      const ops = this.parseScriptOps(scriptpubkeyHex);

      // ops[0] = OP_RETURN (0x6a)
      // ops[1] = investor pubkey (33 bytes)
      // ops[2] = optional secret hash (32 bytes) - present for seeders
      if (ops.length < 2) return null;

      const investorKeyBytes = ops[1];
      if (!investorKeyBytes || investorKeyBytes.length !== 33) return null;

      const isSeeder = ops.length >= 3 && ops[2] && ops[2].length === 32;

      return {
        investorPubKey: this.bytesToHex(investorKeyBytes),
        isSeeder,
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse a Bitcoin script hex string into its pushdata operations.
   * Returns an array where each element is the bytes of a pushdata operation.
   * For OP_RETURN scripts, the first element is empty (the OP_RETURN opcode itself).
   */
  private parseScriptOps(hex: string): Uint8Array[] {
    const bytes = this.hexToBytes(hex);
    const ops: Uint8Array[] = [];
    let i = 0;

    while (i < bytes.length) {
      const opcode = bytes[i];
      i++;

      if (opcode === 0x6a) {
        // OP_RETURN - push an empty marker
        ops.push(new Uint8Array(0));
        continue;
      }

      // Standard pushdata opcodes (1-75 bytes)
      if (opcode >= 0x01 && opcode <= 0x4b) {
        const len = opcode;
        if (i + len > bytes.length) break;
        ops.push(bytes.slice(i, i + len));
        i += len;
        continue;
      }

      // OP_PUSHDATA1
      if (opcode === 0x4c) {
        if (i >= bytes.length) break;
        const len = bytes[i];
        i++;
        if (i + len > bytes.length) break;
        ops.push(bytes.slice(i, i + len));
        i += len;
        continue;
      }

      // OP_PUSHDATA2
      if (opcode === 0x4d) {
        if (i + 1 >= bytes.length) break;
        const len = bytes[i] | (bytes[i + 1] << 8);
        i += 2;
        if (i + len > bytes.length) break;
        ops.push(bytes.slice(i, i + len));
        i += len;
        continue;
      }

      // Other opcodes - push empty
      ops.push(new Uint8Array(0));
    }

    return ops;
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Checks if a transaction output is an OP_RETURN / nulldata output.
   */
  private isOpReturn(vout: MempoolVout): boolean {
    return vout.scriptpubkey_type === 'op_return' || vout.scriptpubkey_type === 'nulldata';
  }

  /**
   * Main method: fetches all blockchain data for a project and computes
   * investor stats, investment list, and founder spending.
   *
   * This mirrors the logic in the Angor C# MempoolIndexerMappers when
   * ReadFromAngorApi is false.
   */
  async getProjectOnChainStats(projectId: string): Promise<OnChainProjectStats | null> {
    try {
      const address = this.convertAngorKeyToBitcoinAddress(projectId);
      console.log(`[InvestorService] Project ${projectId} -> address ${address}`);

      const allTxs = await this.fetchAddressTransactions(address);
      if (!allTxs || allTxs.length === 0) {
        console.warn(`[InvestorService] No transactions found for ${address}`);
        return null;
      }

      // Sort by block height (unconfirmed = 0 go last)
      const sortedTxs = [...allTxs].sort((a, b) => {
        const aHeight = a.status.confirmed ? a.status.block_height : Number.MAX_SAFE_INTEGER;
        const bHeight = b.status.confirmed ? b.status.block_height : Number.MAX_SAFE_INTEGER;
        return aHeight - bHeight;
      });

      // Step 1: Find the funding transaction
      let fundingTx: MempoolTransaction | null = null;
      let founderKey: string | null = null;

      for (const tx of sortedTxs) {
        if (tx.vout.length < 2) continue;

        const opReturnOutput = tx.vout[1];
        if (!this.isOpReturn(opReturnOutput)) continue;

        const parsed = this.parseFounderInfoFromOpReturn(opReturnOutput.scriptpubkey);
        if (parsed) {
          fundingTx = tx;
          founderKey = parsed.founderKey;
          console.log(`[InvestorService] Found funding tx: ${tx.txid}, founder: ${founderKey}`);
          break;
        }
      }

      if (!fundingTx || !founderKey) {
        console.warn(`[InvestorService] No funding transaction found for project ${projectId}`);
        return null;
      }

      // Step 2: Find investment transactions and calculate stats
      const uniqueInvestors = new Set<string>();
      let totalAmountInvested = 0;
      const investments: InvestmentInfo[] = [];

      for (const tx of sortedTxs) {
        // Skip the funding transaction
        if (tx.txid === fundingTx.txid) continue;

        if (tx.vout.length < 2) continue;

        const opReturnOutput = tx.vout[1];
        if (!this.isOpReturn(opReturnOutput)) continue;

        const investorInfo = this.parseInvestorInfoFromOpReturn(opReturnOutput.scriptpubkey);
        if (!investorInfo) continue;

        uniqueInvestors.add(investorInfo.investorPubKey);

        // Sum all v1_p2tr (taproot) outputs starting from index 2
        // Skip first two outputs (index 0 = Angor fee, index 1 = OP_RETURN)
        let investmentAmount = 0;
        for (let i = 2; i < tx.vout.length; i++) {
          if (tx.vout[i].scriptpubkey_type === 'v1_p2tr') {
            investmentAmount += tx.vout[i].value;
          }
        }

        if (investmentAmount > 0) {
          totalAmountInvested += investmentAmount;
        }

        investments.push({
          transactionId: tx.txid,
          investorPubKey: investorInfo.investorPubKey,
          totalAmount: investmentAmount,
          isSeeder: investorInfo.isSeeder,
          blockHeight: tx.status.confirmed ? tx.status.block_height : 0,
          blockTime: tx.status.confirmed ? tx.status.block_time : 0,
        });
      }

      // Step 3: Calculate founder spending and penalties by checking outspends
      let amountSpentByFounder = 0;
      let amountInPenalties = 0;
      let countInPenalties = 0;

      // Check outspends for each investment transaction's taproot outputs
      for (const investment of investments) {
        const tx = sortedTxs.find((t) => t.txid === investment.transactionId);
        if (!tx) continue;

        try {
          const outspends = await this.fetchOutspends(tx.txid);

          for (let i = 2; i < tx.vout.length; i++) {
            if (tx.vout[i].scriptpubkey_type !== 'v1_p2tr') continue;
            if (!outspends[i] || !outspends[i].spent) continue;

            const spendTxId = outspends[i].txid;
            if (!spendTxId) continue;

            // Fetch the spending transaction to analyze the witness
            const spendTxResponse = await fetch(`${this.getApiBaseUrl()}/tx/${spendTxId}`);
            if (!spendTxResponse.ok) continue;
            const spendTx: MempoolTransaction = await spendTxResponse.json();

            // Find the input that spends our output
            const spendingInput = spendTx.vin.find(
              (vin) => vin.txid === tx.txid && vin.vout === i
            );
            if (!spendingInput || !spendingInput.witness) continue;

            // Analyze witness to determine spend type:
            // - Founder spend (withdrawal): 3 witness items, script contains OP_CLTV
            // - Investor penalty: 4 witness items, script contains OP_CHECKSIGVERIFY + OP_CHECKSIG
            // - Investor end-of-project reclaim: 3 witness items, different timelock
            const witnessCount = spendingInput.witness.length;
            const witnessScriptAsm = spendingInput.inner_witnessscript_asm || '';

            if (witnessCount === 3 && witnessScriptAsm.includes('OP_CHECKLOCKTIMEVERIFY')) {
              // Founder withdrawal
              amountSpentByFounder += tx.vout[i].value;
            } else if (witnessCount === 4 && witnessScriptAsm.includes('OP_CHECKSIGVERIFY')) {
              // Investor penalty (early exit)
              amountInPenalties += tx.vout[i].value;
              countInPenalties++;
            }
          }
        } catch (err) {
          console.warn(`[InvestorService] Error checking outspends for ${tx.txid}:`, err);
          // Continue processing other investments
        }
      }

      console.log(
        `[InvestorService] Stats for ${projectId}: ` +
        `investors=${uniqueInvestors.size}, invested=${totalAmountInvested}, ` +
        `founderSpent=${amountSpentByFounder}, penalties=${amountInPenalties}`
      );

      return {
        investorCount: uniqueInvestors.size,
        amountInvested: totalAmountInvested,
        amountSpentSoFarByFounder: amountSpentByFounder,
        amountInPenalties,
        countInPenalties,
        investments,
      };
    } catch (err) {
      console.error(`[InvestorService] Error computing on-chain stats for ${projectId}:`, err);
      return null;
    }
  }

  /**
   * Fetches just the project creation info from the blockchain.
   * Useful for validating project data without computing full stats.
   */
  async getProjectFundingInfo(projectId: string): Promise<ProjectFundingInfo | null> {
    try {
      const address = this.convertAngorKeyToBitcoinAddress(projectId);
      const allTxs = await this.fetchAddressTransactions(address);
      if (!allTxs || allTxs.length === 0) return null;

      const sortedTxs = [...allTxs].sort((a, b) => {
        const aHeight = a.status.confirmed ? a.status.block_height : Number.MAX_SAFE_INTEGER;
        const bHeight = b.status.confirmed ? b.status.block_height : Number.MAX_SAFE_INTEGER;
        return aHeight - bHeight;
      });

      for (const tx of sortedTxs) {
        if (tx.vout.length < 2) continue;
        const opReturnOutput = tx.vout[1];
        if (!this.isOpReturn(opReturnOutput)) continue;

        const parsed = this.parseFounderInfoFromOpReturn(opReturnOutput.scriptpubkey);
        if (parsed) {
          return {
            founderKey: parsed.founderKey,
            nostrEventId: parsed.nostrEventId,
            fundingTxId: tx.txid,
            blockHeight: tx.status.confirmed ? tx.status.block_height : 0,
          };
        }
      }

      return null;
    } catch (err) {
      console.error(`[InvestorService] Error fetching funding info for ${projectId}:`, err);
      return null;
    }
  }
}
