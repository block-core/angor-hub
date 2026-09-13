import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { IndexerService } from './indexer.service';
import { RelayService } from './relay.service';
import { NetworkService } from './network.service';
import { DenyService } from './deny.service';
import { FeaturedService } from './featured.service';
import { HubConfigService } from './hub-config.service';
import { CachedProjectValidation, NostrProjectVerificationService } from './nostr-project-verification.service';

describe('IndexerService discovery', () => {
  let service: IndexerService;
  let relay: { fetchNostrProjects: jasmine.Spy; fetchProfile: jasmine.Spy };
  let validate: jasmine.Spy;
  let cacheValidation: jasmine.Spy;

  const announcement = (id: string, eventId = id, timestamp = 1000): NDKEvent => new NDKEvent(undefined, {
    id: eventId, pubkey: 'f'.repeat(64), kind: 3030, tags: [], created_at: timestamp,
    content: JSON.stringify({ projectIdentifier: id, networkName: 'Main', nostrPubKey: 'f'.repeat(64) }),
  });
  const proof = (nostrEventId: string): CachedProjectValidation => ({
    nostrEventId, founderKey: 'founder', trxId: 'transaction', createdOnBlock: 123,
  });
  const noise = (count = 128): NDKEvent[] => Array.from({ length: count }, (_, i) => new NDKEvent(undefined, {
    id: `noise-${i}`, pubkey: 'a'.repeat(64), kind: 3030, tags: [], created_at: 999 - i, content: '0xunrelated',
  }));

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    spyOn(console, 'log');
    spyOn(console, 'error');
    relay = { fetchNostrProjects: jasmine.createSpy().and.resolveTo([]), fetchProfile: jasmine.createSpy() };
    cacheValidation = jasmine.createSpy();
    TestBed.configureTestingModule({
      teardown: { destroyAfterEach: true },
      providers: [
        { provide: RelayService, useValue: { ...relay, profileUpdates: new Subject(), projectUpdates: new Subject(), getRelayUrls: () => [] } },
        { provide: NetworkService, useValue: { isMain: () => true } },
        { provide: DenyService, useValue: { loadDenyList: async () => undefined } },
        { provide: FeaturedService, useValue: { loadFeaturedProjects: async () => undefined } },
        { provide: HubConfigService, useValue: { setListsLoaded: () => undefined, shouldShowProject: () => true, hubMode: () => 'blacklist' } },
        { provide: NostrProjectVerificationService, useValue: { getCachedValidation: () => null, cacheValidation } },
      ],
    });
    service = TestBed.inject(IndexerService);
    const internals = service as unknown as { fetchProjectFromMempool(id: string): Promise<CachedProjectValidation | null> };
    validate = spyOn(internals, 'fetchProjectFromMempool').and.callFake(async id => proof(id));
  });

  it('scans through full pages of unrelated events to find older projects', fakeAsync(() => {
    relay.fetchNostrProjects.and.returnValues(Promise.resolve(noise()), Promise.resolve([announcement('angor1older')]));
    void service.fetchProjects();
    flushMicrotasks();
    expect(relay.fetchNostrProjects.calls.first().args[0]).toBeGreaterThan(8);
    expect(relay.fetchNostrProjects.calls.argsFor(1)[1]).toBe(871);
    expect(service.projects().map(p => p.projectIdentifier)).toEqual(['angor1older']);
    expect(service.isComplete()).toBeTrue();
  }));

  it('keeps scanning when an entire candidate page fails on-chain validation', fakeAsync(() => {
    relay.fetchNostrProjects.and.returnValues(
      Promise.resolve([announcement('angor1invalid'), ...noise(127)]),
      Promise.resolve([announcement('angor1older')]),
    );
    validate.and.callFake(async id => id === 'angor1invalid' ? null : proof(id));
    void service.fetchProjects();
    flushMicrotasks();
    expect(service.projects().map(p => p.projectIdentifier)).toEqual(['angor1older']);
    expect(service.loading()).toBeFalse();
  }));

  it('does not finish a page after finding only one project among unrelated events', fakeAsync(() => {
    relay.fetchNostrProjects.and.returnValues(
      Promise.resolve([announcement('angor1new'), ...noise(127)]),
      Promise.resolve([announcement('angor1older')]),
    );
    void service.fetchProjects();
    flushMicrotasks();
    expect(service.projects().length).toBe(2);
    expect(relay.fetchNostrProjects).toHaveBeenCalledTimes(2);
  }));

  it('stays loading until validation completes and shares overlapping fetches', fakeAsync(() => {
    let finish!: (value: CachedProjectValidation) => void;
    validate.and.returnValue(new Promise<CachedProjectValidation>(resolve => finish = resolve));
    relay.fetchNostrProjects.and.resolveTo([announcement('angor1pending')]);
    let finished = false;
    void service.fetchProjects().then(() => finished = true);
    flushMicrotasks();
    void service.fetchProjects();
    expect(service.loading()).toBeTrue();
    expect(service.projects()).toEqual([]);
    expect(finished).toBeFalse();
    finish(proof('angor1pending'));
    flushMicrotasks();
    expect(service.loading()).toBeFalse();
    expect(service.validatingCount()).toBe(0);
    expect(service.projects().length).toBe(1);
    expect(relay.fetchNostrProjects).toHaveBeenCalledTimes(1);
  }));

  it('shares duplicate address lookups but only accepts the on-chain event', fakeAsync(() => {
    relay.fetchNostrProjects.and.resolveTo([announcement('angor1project', 'wrong'), announcement('angor1project', 'right')]);
    validate.and.resolveTo(proof('right'));
    void service.fetchProjects();
    flushMicrotasks();
    expect(validate).toHaveBeenCalledTimes(1);
    expect(service.projects().map(p => p.nostrEventId)).toEqual(['right']);
  }));

  it('leaves discovery resumable after a bounded scan with no projects', fakeAsync(() => {
    relay.fetchNostrProjects.and.resolveTo(noise());
    void service.fetchProjects();
    flushMicrotasks();
    expect(service.isComplete()).toBeFalse();
    expect(service.loading()).toBeFalse();
    relay.fetchNostrProjects.and.resolveTo([announcement('angor1older')]);
    void service.loadMore();
    flushMicrotasks();
    expect(service.projects().length).toBe(1);
  }));

  it('preserves cards and the cursor when discovery fails, then retries the same page', fakeAsync(() => {
    relay.fetchNostrProjects.and.resolveTo(Array.from({ length: 128 }, (_, i) => announcement(`angor1${i}`)));
    void service.fetchProjects();
    flushMicrotasks();
    relay.fetchNostrProjects.and.rejectWith(new Error('Project discovery timed out. Please retry.'));
    void service.loadMore();
    flushMicrotasks();
    expect(service.projects().length).toBe(128);
    expect(service.isComplete()).toBeFalse();
    expect(service.error()).toContain('timed out');
    const cursor = relay.fetchNostrProjects.calls.mostRecent().args[1];
    relay.fetchNostrProjects.and.resolveTo([announcement('angor1older')]);
    void service.fetchProjects();
    flushMicrotasks();
    expect(relay.fetchNostrProjects.calls.mostRecent().args[1]).toBe(cursor);
    expect(service.projects().length).toBe(129);
    expect(service.error()).toBeNull();
  }));

  it('does not let card statistics end an active discovery request', fakeAsync(() => {
    let finish!: (value: CachedProjectValidation) => void;
    validate.and.returnValue(new Promise<CachedProjectValidation>(resolve => finish = resolve));
    relay.fetchNostrProjects.and.resolveTo([announcement('angor1pending')]);
    void service.fetchProjects();
    flushMicrotasks();
    const internals = service as unknown as {
      convertAngorKeyToBitcoinAddress(id: string): string;
      fetchMempoolAddressTxs(address: string): Promise<unknown[]>;
    };
    spyOn(internals, 'convertAngorKeyToBitcoinAddress').and.returnValue('bc1test');
    spyOn(internals, 'fetchMempoolAddressTxs').and.resolveTo([]);
    void service.fetchProjectStats('angor1existing');
    flushMicrotasks();
    expect(service.loading()).toBeTrue();
    finish(proof('angor1pending'));
    flushMicrotasks();
    expect(service.loading()).toBeFalse();
  }));

  it('ignores validation results from a previous network/reset', fakeAsync(() => {
    let finish!: (value: CachedProjectValidation) => void;
    validate.and.returnValue(new Promise<CachedProjectValidation>(resolve => finish = resolve));
    relay.fetchNostrProjects.and.resolveTo([announcement('angor1oldnetwork')]);
    void service.fetchProjects();
    flushMicrotasks();
    service.resetProjects();
    finish(proof('angor1oldnetwork'));
    flushMicrotasks();
    expect(service.projects()).toEqual([]);
    expect(cacheValidation).not.toHaveBeenCalled();
    expect(service.validatingCount()).toBe(0);
    expect(service.isComplete()).toBeFalse();
  }));
});
