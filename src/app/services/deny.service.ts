import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DenyService {
  private denyListUrl = 'https://lists.blockcore.net/deny/angor.json';
  private denyList = signal<string[]>([]);
  private loaded = signal<boolean>(false);
  private loadingPromise: Promise<void> | null = null;

  async loadDenyList(): Promise<void> {
    if (this.loaded() || this.loadingPromise) {
      return this.loadingPromise || Promise.resolve();
    }

    this.loadingPromise = (async () => {
      try {
        const response = await fetch(this.denyListUrl, { cache: 'no-store' }); // Avoid caching
        if (!response.ok) {
          throw new Error(`Failed to fetch deny list: ${response.statusText}`);
        }
        const list = await response.json();
        if (Array.isArray(list)) {
          this.denyList.set(list);
          this.loaded.set(true);
          console.log('Deny list loaded successfully:', list.length, 'entries');
        } else {
          console.error('Deny list format is incorrect.');
          this.denyList.set([]); // Set to empty array on error
        }
      } catch (error) {
        console.error('Error loading deny list:', error);
        this.denyList.set([]); // Set to empty array on error
      } finally {
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  async isEventDenied(projectIdentifier: string): Promise<boolean> {
    await this.loadDenyList(); // Ensure list is loaded
    const denied = this.denyList().includes(projectIdentifier);
    if (denied) {
      console.warn(`Project ${projectIdentifier} is denied.`);
    }
    return denied;
  }
}
