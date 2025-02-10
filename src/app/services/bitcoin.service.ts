import { Injectable } from '@angular/core';
import Big from 'big.js';

@Injectable({
  providedIn: 'root'
})
export class BitcoinUtilsService {
  private readonly SATOSHIS_PER_BTC = 100000000;

  /**
   * Converts satoshis to BTC
   * @param satoshis Amount in satoshis
   * @param decimals Number of decimal places (default 8)
   * @returns String representation of BTC amount
   */
  toBTC(satoshis: number | string, decimals: number = 8): string {
    try {
      const amount = new Big(satoshis);
      return amount.div(this.SATOSHIS_PER_BTC).toFixed(decimals);
    } catch (error) {
      console.error('Error converting satoshis to BTC:', error);
      return '0';
    }
  }

  /**
   * Converts BTC to satoshis
   * @param btc Amount in BTC
   * @returns Number of satoshis
   */
  toSatoshis(btc: number | string): number {
    try {
      const amount = new Big(btc);
      return Number(amount.times(this.SATOSHIS_PER_BTC).toFixed(0));
    } catch (error) {
      console.error('Error converting BTC to satoshis:', error);
      return 0;
    }
  }

  /**
   * Formats a BTC amount with appropriate decimals
   * @param btc Amount in BTC
   * @param showFullPrecision Whether to show all 8 decimals
   * @returns Formatted BTC string
   */
  formatBTC(btc: number | string, showFullPrecision: boolean = false): string {
    try {
      const amount = new Big(btc);
      if (showFullPrecision) {
        return amount.toFixed(8);
      }
      // Show fewer decimals for larger amounts
      if (amount.gte(1000)) return amount.toFixed(2);
      if (amount.gte(100)) return amount.toFixed(3);
      if (amount.gte(1)) return amount.toFixed(4);
      return amount.toFixed(6);
    } catch (error) {
      console.error('Error formatting BTC:', error);
      return '0';
    }
  }
}