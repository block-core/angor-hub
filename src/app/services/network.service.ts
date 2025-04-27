import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private currentNetwork = signal<'main' | 'test'>('main');

  constructor() {
   
    const savedNetwork = localStorage.getItem('angor-network');
    if (savedNetwork === 'main' || savedNetwork === 'test') {
      this.currentNetwork.set(savedNetwork);
    } else {
     
      this.currentNetwork.set('main');
      localStorage.setItem('angor-network', 'main');
    }
  }

  /**
   * Check if the current network is mainnet
   */
  isMain(): boolean {
    return this.currentNetwork() === 'main';
  }

  /**
   * Check if the current network is testnet
   */
  isTest(): boolean {
    return this.currentNetwork() === 'test';
  }
  
  /**
   * Switch to mainnet
   */
  switchToMain(): void {
    this.setNetwork('main');
  }
  
  /**
   * Switch to testnet
   */
  switchToTest(): void {
    this.setNetwork('test');
  }
  
  /**
   * Get the current network
   */
  getNetwork(): 'main' | 'test' {
    return this.currentNetwork();
  }
  
  /**
   * Set the network
   * @param network The network to set ('main' or 'test')
   */
  setNetwork(network: 'main' | 'test'): void {
    if (this.currentNetwork() !== network) {
      this.currentNetwork.set(network);
      localStorage.setItem('angor-network', network);
      this.handleNetworkChange();
    }
  }
  
  /**
   * Handle network change by reloading the page
   * @private
   */
  private handleNetworkChange(): void {
    window.location.reload();
  }
}
