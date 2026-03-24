import { Injectable, inject } from '@angular/core';
import { NetworkService } from './network.service';
import { IndexerService } from './indexer.service';
import { ProjectUpdate } from './relay.service';
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
   * Extracts the CLTV timestamp from the witness script ASM.
   *
   * The ASM looks like: "OP_PUSHBYTES_32 <key> OP_CHECKSIGVERIFY OP_PUSHBYTES_4 <hex> OP_CLTV"
   * The CLTV value is the little-endian hex immediately before OP_CLTV / OP_CHECKLOCKTIMEVERIFY.
   */
  private extractCltvTimestamp(witnessScriptAsm: string): number | null {
    // Match the hex value pushed right before OP_CLTV or OP_CHECKLOCKTIMEVERIFY
    const match = witnessScriptAsm.match(/OP_PUSHBYTES_\d+\s+([0-9a-f]+)\s+(?:OP_CLTV|OP_CHECKLOCKTIMEVERIFY)/i);
    if (!match) return null;

    const hex = match[1];
    // Parse as little-endian unsigned integer
    let value = 0;
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.substring(i, i + 2), 16);
      value += byte * Math.pow(256, i / 2);
    }
    return value;
  }

  /**
   * Classifies an OP_CLTV spend (3 witness items) as founder or investor withdrawal.
   *
   * Heuristic 1 - Multi-input: If the spending tx has inputs from multiple
   * different investment txs, the founder is collecting from several investors
   * → founder spend. If all inputs reference the same investment tx, the
   * investor is reclaiming their own stage outputs → investor withdrawal.
   *
   * Heuristic 2 - CLTV date (when project details are available):
   *   - For "fund" projects (type 1): investor CLTV = startDate.
   *     If CLTV matches startDate → investor withdrawal.
   *   - For "invest" projects (type 0/default): founder CLTV = stage releaseDates.
   *     If CLTV matches a stage releaseDate → founder spend.
   *
   * Returns true if this is a founder spend, false if investor withdrawal.
   */
  private classifyCltvSpend(
    spendTx: MempoolTransaction,
    investmentTxId: string,
    allInvestmentTxIds: Set<string>,
    witnessScriptAsm: string,
    projectType: number,
    projectStartDate: number | undefined,
    stageReleaseDates: Set<number>
  ): boolean {
    // --- Heuristic 1: Multi-input analysis ---
    // Collect all unique source investment txids from the spending tx's inputs
    const sourceTxIds = new Set<string>();
    for (const vin of spendTx.vin) {
      if (allInvestmentTxIds.has(vin.txid)) {
        sourceTxIds.add(vin.txid);
      }
    }

    // If the spending tx pulls inputs from multiple different investment txs,
    // only the founder would do that (collecting stage payments from many investors).
    if (sourceTxIds.size > 1) {
      return true; // founder
    }

    // If all inputs are from the same investment tx (and there's more than one),
    // that's the investor reclaiming their own UTXOs.
    const inputsFromSameTx = spendTx.vin.filter(vin => vin.txid === investmentTxId).length;
    if (sourceTxIds.size === 1 && inputsFromSameTx > 1) {
      return false; // investor
    }

    // --- Heuristic 2: CLTV date comparison ---
    const cltvTimestamp = this.extractCltvTimestamp(witnessScriptAsm);

    if (cltvTimestamp && projectStartDate) {
      if (projectType === 1) {
        // Fund-type project: investor's CLTV is set to startDate
        if (cltvTimestamp === projectStartDate) {
          return false; // investor withdrawal
        }
        // If CLTV doesn't match startDate, it's a founder spend
        return true;
      } else {
        // Invest-type project (default): founder's CLTV matches stage releaseDates
        if (stageReleaseDates.has(cltvTimestamp)) {
          return true; // founder spend
        }
        // If CLTV doesn't match any stage date, it's an investor withdrawal
        return false;
      }
    }

    // --- Fallback: single input, no date info ---
    // Default to founder spend (preserves existing behavior)
    console.warn(
      `[InvestorService] Ambiguous CLTV spend in tx ${spendTx.txid}, ` +
      `defaulting to founder spend (no project details available for date comparison)`
    );
    return true;
  }

  /**
   * Main method: fetches all blockchain data for a project and computes
   * investor stats, investment list, and founder spending.
   *
   * This mirrors the logic in the Angor C# MempoolIndexerMappers when
   * ReadFromAngorApi is false.
   */
  async getProjectOnChainStats(projectId: string, details?: ProjectUpdate): Promise<OnChainProjectStats | null> {
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

      // Step 3: Calculate founder spending and investor withdrawals by finding
      // spending transactions for each investment's taproot outputs.
      //
      // The Blockcore indexer's /outspends endpoint returns only { spent: true/false }
      // without the spending txid, so we cannot use it to look up spending transactions.
      // Instead, we fetch all transactions for each taproot output address — any
      // transaction beyond the original investment tx is a spending transaction whose
      // witness data reveals the spend type.
      //
      // Classification of OP_CLTV spends (3 witness items):
      //   Both founder and investor withdrawals use OP_CHECKSIGVERIFY + OP_CLTV with
      //   3 witness items. To distinguish them we use two heuristics:
      //
      //   1. Multi-input heuristic: The founder typically spends one UTXO from each
      //      of several different investment txs in a single spending tx (collecting
      //      from many investors). An investor spends multiple UTXOs from the SAME
      //      investment tx (reclaiming their own stage outputs). If a spending tx
      //      references inputs from more than one investment tx → founder.
      //
      //   2. CLTV date heuristic (when project details are available):
      //      - For "fund" projects (projectType === 1): the investor's CLTV is the
      //        project startDate. If the CLTV value matches startDate → investor.
      //      - For "invest" projects (default): the founder's CLTV is set to the
      //        stage releaseDates. If CLTV matches a stage releaseDate → founder.
      //
      // OP_CHECKSIGVERIFY spends with 4 witness items are always investor penalties.
      let amountSpentByFounder = 0;
      let amountInPenalties = 0;
      let countInPenalties = 0;

      // Build a set of all known investment txids for the multi-input heuristic
      const investmentTxIds = new Set(investments.map(inv => inv.transactionId));

      // Build a set of stage releaseDates and the startDate for CLTV comparison
      const stageReleaseDates = new Set<number>();
      let projectStartDate: number | undefined;
      const projectType = details?.projectType ?? 0; // 0 = invest (default)

      if (details) {
        projectStartDate = details.startDate;
        if (details.stages) {
          for (const stage of details.stages) {
            stageReleaseDates.add(stage.releaseDate);
          }
        }
      }

      for (const investment of investments) {
        const tx = sortedTxs.find((t) => t.txid === investment.transactionId);
        if (!tx) continue;

        // Collect all unique taproot output addresses from this investment tx
        const taprootOutputs: { index: number; address: string; value: number }[] = [];
        for (let i = 2; i < tx.vout.length; i++) {
          if (tx.vout[i].scriptpubkey_type !== 'v1_p2tr') continue;
          const addr = tx.vout[i].scriptpubkey_address;
          if (!addr) continue;
          taprootOutputs.push({ index: i, address: addr, value: tx.vout[i].value });
        }

        if (taprootOutputs.length === 0) continue;

        // Fetch spending transactions for each taproot output address in parallel
        const addressTxsResults = await Promise.all(
          taprootOutputs.map(async (output) => {
            try {
              const txs = await this.fetchAddressTransactions(output.address);
              return { output, txs };
            } catch (err) {
              console.warn(`[InvestorService] Error fetching txs for ${output.address}:`, err);
              return { output, txs: [] as MempoolTransaction[] };
            }
          })
        );

        for (const { output, txs } of addressTxsResults) {
          // Find spending transactions (any tx that is NOT the original investment tx)
          for (const spendTx of txs) {
            if (spendTx.txid === tx.txid) continue;

            // Find the input that spends our specific output
            const spendingInput = spendTx.vin.find(
              (vin) => vin.txid === tx.txid && vin.vout === output.index
            );
            if (!spendingInput || !spendingInput.witness) continue;

            const witnessCount = spendingInput.witness.length;
            const witnessScriptAsm = spendingInput.inner_witnessscript_asm || '';

            if (witnessCount === 4 && witnessScriptAsm.includes('OP_CHECKSIGVERIFY')) {
              // 4 witness items + OP_CHECKSIGVERIFY = investor penalty (early exit)
              amountInPenalties += output.value;
              countInPenalties++;
            } else if (witnessCount === 3 &&
                       (witnessScriptAsm.includes('OP_CLTV') ||
                        witnessScriptAsm.includes('OP_CHECKLOCKTIMEVERIFY'))) {
              // 3 witness items + OP_CLTV: could be founder OR investor withdrawal.
              // Use heuristics to classify.
              const isFounderSpend = this.classifyCltvSpend(
                spendTx, tx.txid, investmentTxIds, witnessScriptAsm,
                projectType, projectStartDate, stageReleaseDates
              );

              if (isFounderSpend) {
                amountSpentByFounder += output.value;
              } else {
                amountInPenalties += output.value;
                countInPenalties++;
              }
            }
          }
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
