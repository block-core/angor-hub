import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DenyService {
  private denyList: string[] = [];
  private readonly denyListUrl = 'https://lists.blockcore.net/deny/angor.json';

  async loadDenyList(): Promise<string[]> {
    if (this.denyList.length > 0) {
      return this.denyList;
    }

    try {
      const response = await fetch(this.denyListUrl);
      this.denyList = await response.json();
      return this.denyList;
    } catch (error) {
      console.error('Failed to load deny list:', error);
      return [];
    }
  }

  isEventDenied(nostrEventId: string): boolean {
    if (!this.denyList) {
      return false;
    }
    return this.denyList.includes(nostrEventId);
  }
}
