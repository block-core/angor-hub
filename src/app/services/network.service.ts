import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private currentNetwork = signal<'main' | 'test'>('main');

  constructor() {
    // Check URL parameters first for network setting
    const urlParams = new URLSearchParams(window.location.search);
    const networkParam = urlParams.get('network');
    
    if (networkParam === 'main' || networkParam === 'test') {
      this.currentNetwork.set(networkParam);
      localStorage.setItem('angor-network', networkParam);
      // Remove network param from URL after initial load
      this.removeNetworkParamFromUrl();
    } else {
      // Fall back to localStorage if no URL parameter
      const savedNetwork = localStorage.getItem('angor-network');
      if (savedNetwork === 'main' || savedNetwork === 'test') {
        this.currentNetwork.set(savedNetwork);
      } else {
        // Default to main if nothing is specified
        this.currentNetwork.set('main');
        localStorage.setItem('angor-network', 'main');
      }
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
   * @param updateUrl Whether to update the URL with the network parameter (default: false)
   */
  setNetwork(network: 'main' | 'test', updateUrl: boolean = false): void {
    if (this.currentNetwork() !== network) {
      this.currentNetwork.set(network);
      localStorage.setItem('angor-network', network);
      
      if (updateUrl) {
        // Remove network param from URL instead of updating it
        this.removeNetworkParamFromUrl();
      }
      
      this.handleNetworkChange();
    }
  }
  
  /**
   * Set the network from URL parameter without reloading the page
   * @param network The network to set ('main' or 'test')
   */
  setNetworkFromUrlParam(network: 'main' | 'test'): void {
    if (this.currentNetwork() !== network) {
      this.currentNetwork.set(network);
      localStorage.setItem('angor-network', network);
      // Don't reload when set from URL parameter
    }
  }
  
  /**
   * Remove network parameter from URL
   * @private
   */
  private removeNetworkParamFromUrl(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('network');
    window.history.replaceState({}, '', url);
  }
  
  /**
   * Handle network change by reloading the page
   * @private
   */
  private handleNetworkChange(): void {
    window.location.reload();
  }
}
