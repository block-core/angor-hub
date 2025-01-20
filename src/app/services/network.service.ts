import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  private readonly NETWORK_KEY = 'angor-hub-network';
  private network: string;

  constructor() {
    this.network = localStorage.getItem(this.NETWORK_KEY) || 'testnet';
  }

  getNetwork(): string {
    return this.network;
  }

  isMain() {
    return this.network === 'mainnet';
  }

  setNetwork(network: string): void {
    this.network = network;
    localStorage.setItem(this.NETWORK_KEY, network);

    // Reload until we can handle proper full network reset, with relays, etc.
    window.location.reload();
  }
}
