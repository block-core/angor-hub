import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NostrListService } from './nostr-list.service';
import { RelayService } from './relay.service';
import { NostrAuthService, type NostrUser } from './nostr-auth.service';

describe('NostrListService (auth wiring)', () => {
  function createAuthStub(initial: NostrUser | null = null) {
    const s = signal<NostrUser | null>(initial);
    return {
      currentUser: s.asReadonly(),
      getPubkey: () => s()?.pubkey ?? null,
      // used by publishDenyList but not in these tests
      signEvent: async (e: any) => e,
      __setUser: (u: NostrUser | null) => s.set(u),
    };
  }

  it('syncs admin pubkey from NostrAuthService.currentUser', () => {
    const auth = createAuthStub(null);

    TestBed.configureTestingModule({
      providers: [
        NostrListService,
        { provide: RelayService, useValue: {} },
        { provide: NostrAuthService, useValue: auth },
      ],
    });

    const service = TestBed.inject(NostrListService);
    expect(service.isLoggedIn()).toBeFalse();

    auth.__setUser({ pubkey: 'pk1', npub: 'npub1' });
    expect(service.isLoggedIn()).toBeTrue();
    expect(service.getAdminPubkey()).toBe('pk1');
  });

  it('can resolve admin pubkey from auth getter before effect runs', () => {
    const auth = createAuthStub({ pubkey: 'pk2', npub: 'npub2' });

    TestBed.configureTestingModule({
      providers: [
        NostrListService,
        { provide: RelayService, useValue: {} },
        { provide: NostrAuthService, useValue: auth },
      ],
    });

    const service = TestBed.inject(NostrListService);

    // Intentionally call the private helper through an any-cast.
    const pubkey = (service as any).requireAdminPubkey() as string;
    expect(pubkey).toBe('pk2');
    expect(service.getAdminPubkey()).toBe('pk2');
  });
});
