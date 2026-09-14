import { Injectable, inject, isDevMode } from '@angular/core';
import { NetworkService } from './network.service';
import { ThemeService } from './theme.service';

@Injectable({ providedIn: 'root' })
export class PaymentNavigationService {
  private network = inject(NetworkService);
  private theme = inject(ThemeService);

  getUrl(projectId: string): string {
    const host = this.network.isMain() ? 'app.angor.io' : 'test.angor.io';
    const base = isDevMode() ? 'http://localhost:5062' : `https://${host}`;
    const url = new URL(`/investview/${encodeURIComponent(projectId)}`, base);
    url.searchParams.set('theme', this.theme.isDarkTheme() ? 'dark' : 'light');
    url.searchParams.set('network', this.network.isMain() ? 'Main' : 'Angornet');
    return url.href;
  }

  open(projectId: string): void {
    window.location.assign(this.getUrl(projectId));
  }
}
