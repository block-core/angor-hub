import { NDKEvent } from '@nostr-dev-kit/ndk';
import { ExternalIdentity } from '../models/models';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UtilsService {
  getExternalIdentities(event: NDKEvent): ExternalIdentity[] {
    if (!event.tags) return [];

    return event.tags
      .filter((tag) => tag[0] === 'i')
      .map((tag) => ({
        platform: tag[1].split(':')[0],
        username: tag[1].split(':')[1],
        proofUrl: tag[2],
      }));
  }
}
