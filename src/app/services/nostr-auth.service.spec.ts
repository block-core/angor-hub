import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { NostrAuthService } from './nostr-auth.service';

describe('NostrAuthService (persistence)', () => {
  const STORAGE_KEY = 'angor-hub-nostr-user';

  beforeEach(() => {
    TestBed.resetTestingModule();

    localStorage.clear();

    // Keep tests isolated from any real extension.
    (window as any).nostr = undefined;

    TestBed.configureTestingModule({
      teardown: { destroyAfterEach: true },
    });
  });

  it('restores user from localStorage on startup', fakeAsync(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pubkey: 'pk1', npub: 'npub1' }));

    (window as any).nostr = {
      getPublicKey: () => Promise.resolve('pk1'),
    };

    const service = TestBed.inject(NostrAuthService);
    flushMicrotasks();

    expect(service.isLoggedIn()).toBeTrue();
    expect(service.getPubkey()).toBe('pk1');
    expect(service.getNpub()).toBe('npub1');
  }));

  it('keeps stored session when provider is unavailable', fakeAsync(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pubkey: 'pk2', npub: 'npub2' }));

    const service = TestBed.inject(NostrAuthService);
    flushMicrotasks();

    expect(service.isLoggedIn()).toBeTrue();
    expect(service.getPubkey()).toBe('pk2');
  }));

  it('updates stored pubkey if active signer differs', fakeAsync(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pubkey: 'old', npub: 'npub3' }));

    (window as any).nostr = {
      getPublicKey: () => Promise.resolve('new'),
    };

    const service = TestBed.inject(NostrAuthService);
    flushMicrotasks();

    expect(service.getPubkey()).toBe('new');
    // npub is whatever nostr-login gave us; keep stored value.
    expect(service.getNpub()).toBe('npub3');
  }));

  it('persists auth state changes to localStorage', () => {
    const service = TestBed.inject(NostrAuthService);

    (service as any).user.set({ pubkey: 'pk3', npub: 'npub3' });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      pubkey: 'pk3',
      npub: 'npub3',
    });

    (service as any).user.set(null);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('drops invalid stored payloads', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ npub: 'no-pubkey' }));

    const service = TestBed.inject(NostrAuthService);

    expect(service.isLoggedIn()).toBeFalse();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
