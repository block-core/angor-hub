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
  let mainnet: boolean;

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
    mainnet = true;
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
        { provide: NetworkService, useValue: { isMain: () => mainnet } },
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
    expect(service.discoveryError()).toContain('timed out');
    const cursor = relay.fetchNostrProjects.calls.mostRecent().args[1];
    relay.fetchNostrProjects.and.resolveTo([announcement('angor1older')]);
    void service.fetchProjects();
    flushMicrotasks();
    expect(relay.fetchNostrProjects.calls.mostRecent().args[1]).toBe(cursor);
    expect(service.projects().length).toBe(129);
    expect(service.discoveryError()).toBeNull();
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
  it('surfaces indexer outages and retries the same relay page', fakeAsync(() => {
    relay.fetchNostrProjects.and.resolveTo([announcement('angor1retry')]);
    validate.and.rejectWith(new Error('Indexer unavailable'));
    void service.fetchProjects();
    flushMicrotasks();
    expect(service.discoveryError()).toBe('Indexer unavailable');
    expect(service.isComplete()).toBeFalse();
    expect(service.validatingCount()).toBe(0);
    expect(service.getCurrentOffset()).toBe(0);
    validate.and.resolveTo(proof('angor1retry'));
    void service.fetchProjects();
    flushMicrotasks();
    expect(relay.fetchNostrProjects.calls.mostRecent().args[1]).toBeUndefined();
    expect(service.projects().length).toBe(1);
    expect(service.discoveryError()).toBeNull();
  }));

  it('keeps project-detail failures separate from successful discovery', fakeAsync(() => {
    service.error.set('Project statistics unavailable');
    relay.fetchNostrProjects.and.resolveTo([announcement('angor1separate')]);
    validate.and.resolveTo(proof('angor1separate'));

    void service.fetchProjects();
    flushMicrotasks();

    expect(service.projects().length).toBe(1);
    expect(service.discoveryError()).toBeNull();
    expect(service.error()).toBe('Project statistics unavailable');
  }));

  it('replaces the retired explorer hostname while retaining the saved primary', () => {
    localStorage.setItem('angor-indexers', JSON.stringify({
      mainnet: [
        { url: 'https://explorer.angor.io/', isPrimary: false },
        { url: 'https://fulcrum.angor.online/', isPrimary: true },
      ],
      testnet: [{ url: 'https://custom.example/', isPrimary: true }],
    }));
    const internals = service as unknown as { loadIndexerConfig(): void };
    internals.loadIndexerConfig();
    expect(service.indexers().mainnet[0].url).toBe('https://indexer.angor.io/');
    expect(service.getPrimaryIndexerUrl(true)).toBe('https://fulcrum.angor.online/');
    expect(service.getPrimaryIndexerUrl(false)).toBe('https://custom.example/');
  });

  it('shares fallback selection across failed requests and stays on the selected network', fakeAsync(() => {
    service.setIndexerConfig({
      mainnet: [
        { url: 'https://offline.example/', isPrimary: true },
        { url: 'https://available.example/', isPrimary: false },
      ],
      testnet: [{ url: 'https://test.example/', isPrimary: true }],
    });
    const connection = spyOn(service, 'testIndexerConnection').and.resolveTo(true);
    const fetchSpy = spyOn(window, 'fetch').and.callFake(async input => {
      if (String(input).startsWith('https://offline.example/')) throw new TypeError('Failed to fetch');
      return { ok: true, status: 200, json: async () => [] } as Response;
    });
    const internals = service as unknown as { fetchMempoolAddressTxs(address: string): Promise<unknown[]> };
    let completed = false;
    void Promise.all([internals.fetchMempoolAddressTxs('bc1a'), internals.fetchMempoolAddressTxs('bc1b')])
      .then(() => completed = true);
    flushMicrotasks();
    expect(completed).toBeTrue();
    expect(connection).toHaveBeenCalledOnceWith('https://available.example/');
    expect(fetchSpy.calls.allArgs().map(args => args[0])).toEqual([
      'https://offline.example/api/v1/address/bc1a/txs',
      'https://offline.example/api/v1/address/bc1b/txs',
      'https://available.example/api/v1/address/bc1a/txs',
      'https://available.example/api/v1/address/bc1b/txs',
    ]);
  }));

  it('does not cache partial address history after an indexer outage', fakeAsync(() => {
    const page = Array.from({ length: 10 }, (_, i) => ({ txid: `tx${i}` }));
    const fetchSpy = spyOn(window, 'fetch').and.callFake(async input => {
      if (String(input).includes('after_txid')) return new Response('', { status: 503 });
      return { ok: true, status: 200, json: async () => page } as Response;
    });
    spyOn(service, 'testIndexerConnection').and.resolveTo(false);
    const internals = service as unknown as { fetchMempoolAddressTxs(address: string): Promise<unknown[]> };
    let error: Error | undefined;
    void internals.fetchMempoolAddressTxs('bc1a').catch(reason => error = reason);
    flushMicrotasks();
    expect(error?.message).toContain('Unable to reach');
    fetchSpy.and.resolveTo({ ok: true, status: 200, json: async () => [] } as Response);
    let result: unknown[] | undefined;
    void internals.fetchMempoolAddressTxs('bc1a').then(txs => result = txs);
    flushMicrotasks();
    expect(result).toEqual([]);
  }));

  it('uses testnet fallbacks without requesting any mainnet indexer', fakeAsync(() => {
    mainnet = false;
    service.setIndexerConfig({
      mainnet: [{ url: 'https://main.example/', isPrimary: true }],
      testnet: [
        { url: 'https://offline-test.example/', isPrimary: true },
        { url: 'https://available-test.example/', isPrimary: false },
      ],
    });
    const connection = spyOn(service, 'testIndexerConnection').and.resolveTo(true);
    const fetchSpy = spyOn(window, 'fetch').and.callFake(async input => {
      if (String(input).startsWith('https://offline-test.example/')) throw new TypeError('Failed to fetch');
      return { ok: true, status: 200, json: async () => [] } as Response;
    });
    let complete = false;
    void service.fetchIndexerResponse('api/v1/address/tb1test/txs').then(() => complete = true);
    flushMicrotasks();
    expect(complete).toBeTrue();
    expect(connection).toHaveBeenCalledOnceWith('https://available-test.example/');
    expect(fetchSpy.calls.allArgs().every(args => !String(args[0]).includes('main.example'))).toBeTrue();
    expect(service.getActiveIndexerUrl()).toBe('https://available-test.example/');
  }));

  it('keeps verified projects when another address fails and retries the unfinished page', fakeAsync(() => {
    relay.fetchNostrProjects.and.resolveTo([announcement('angor1valid'), announcement('angor1retry')]);
    validate.and.callFake(async id => {
      if (id === 'angor1retry') throw new Error('HTTP 500');
      return proof(id);
    });
    void service.fetchProjects();
    flushMicrotasks();
    expect(service.projects().map(project => project.projectIdentifier)).toEqual(['angor1valid']);
    expect(service.isComplete()).toBeFalse();
    expect(service.discoveryError()).toBeNull();
    expect(service.getCurrentOffset()).toBe(0);
    validate.and.callFake(async id => proof(id));
    void service.loadMore();
    flushMicrotasks();
    expect(service.projects().length).toBe(2);
    expect(service.isComplete()).toBeTrue();
  }));

});
