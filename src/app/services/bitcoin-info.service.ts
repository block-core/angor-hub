import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

// Interface defining the expected structure from /latestblock
interface LatestBlockResponse {
  hash: string;
  time: number;
  block_index: number;
  height: number;
  txIndexes: number[]; // Assuming txIndexes is an array of numbers
}

// Interface for the data stored in the signal
export interface BlockchainInfo {
  height: number;
  hash: string;
  timestamp: number;
}

// Interface for Binance Ticker data
interface BinanceTickerData {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  p: string; // Price change
  P: string; // Price change percent
  w: string; // Weighted average price
  c: string; // Last price
  Q: string; // Last quantity
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  v: string; // Total traded base asset volume
  q: string; // Total traded quote asset volume
  O: number; // Statistics open time
  C: number; // Statistics close time
  F: number; // First trade ID
  L: number; // Last trade ID
  n: number; // Total number of trades
}

@Injectable({
  providedIn: 'root'
})
export class BitcoinInfoService {
  private http = inject(HttpClient);
  
  // WebSocket for real-time price updates
  private binanceSocket: WebSocket | null = null;
  
  // Signals for real-time data - Ensure these are public
  bitcoinPrice = signal<string>('0.00');
  priceChangePercent = signal<string>('0.00');
  priceDirection = signal<'up' | 'down' | 'neutral'>('neutral');
  highPrice24h = signal<string>('0.00'); // Should be public
  lowPrice24h = signal<string>('0.00');  // Should be public
  volume24h = signal<string>('0');      // Should be public
  
  // Signal for blockchain info (simplified)
  latestBlock = signal<BlockchainInfo | null>(null);
  
  constructor() {
    this.connectToBinanceWebSocket();
  }
  
  private connectToBinanceWebSocket(): void {
    // Close existing connection if any
    if (this.binanceSocket) {
      this.binanceSocket.close();
    }
    
    try {
      // Connect to Binance WebSocket for BTC/USDT ticker
      this.binanceSocket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
      
      this.binanceSocket.onopen = () => {
        console.log('Connected to Binance WebSocket');
      };
      
      this.binanceSocket.onmessage = (event) => {
        const data: BinanceTickerData = JSON.parse(event.data);
        
        // --- Price and Direction ---
        const price = parseFloat(data.c);
        const prevPrice = parseFloat(this.bitcoinPrice().replace(/,/g, ''));
        if (price > prevPrice) this.priceDirection.set('up');
        else if (price < prevPrice) this.priceDirection.set('down');
        
        const formatOptions: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
        const formatOptionsVol: Intl.NumberFormatOptions = { minimumFractionDigits: 0, maximumFractionDigits: 0 };

        this.bitcoinPrice.set(new Intl.NumberFormat('en-US', formatOptions).format(price));
        
        // --- Change Percent ---
        const changePercent = parseFloat(data.P);
        this.priceChangePercent.set(changePercent.toFixed(2));

        // --- High, Low, Volume ---
        // Ensure these signals are updated
        this.highPrice24h.set(new Intl.NumberFormat('en-US', formatOptions).format(parseFloat(data.h)));
        this.lowPrice24h.set(new Intl.NumberFormat('en-US', formatOptions).format(parseFloat(data.l)));
        this.volume24h.set(new Intl.NumberFormat('en-US', formatOptionsVol).format(parseFloat(data.v))); // Base asset volume (BTC)
      };
      
      this.binanceSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      this.binanceSocket.onclose = () => {
        console.log('WebSocket connection closed');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.connectToBinanceWebSocket(), 5000);
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.connectToBinanceWebSocket(), 5000);
    }
  }

}
