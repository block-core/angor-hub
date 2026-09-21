import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import NDK, { NDKEvent, NDKRelay, NDKRelaySet } from '@nostr-dev-kit/ndk';
import { RelayService } from './relay.service';

describe('RelayService project discovery subscription', () => {
  let service: RelayService;
  let listeners: Record<string, (event?: NDKEvent) => void>;
  let start: jasmine.Spy;
  let stop: jasmine.Spy;
  let subscribe: jasmine.Spy;
  let ndk: NDK;
  let connectedRelay: NDKRelay;

  beforeEach(() => {
    // Exercise the subscription lifecycle without opening real relay connections.
    service = Object.create(RelayService.prototype) as RelayService;
    listeners = {};
    start = jasmine.createSpy();
    stop = jasmine.createSpy();
    ndk = new NDK({ explicitRelayUrls: ['wss://available.example', 'wss://offline.example'] });
    connectedRelay = ndk.pool.getRelay('wss://available.example', false);
    spyOn(ndk.pool, 'connectedRelays').and.returnValue([connectedRelay]);
    subscribe = spyOn(ndk, 'subscribe').and.returnValue({
      on: (name: string, callback: (event?: NDKEvent) => void) => listeners[name] = callback,
      start, stop,
    } as unknown as ReturnType<NDK['subscribe']>);
    spyOn(service, 'ensureConnected').and.resolveTo(ndk);
    spyOn(service, 'reconnectToRelays').and.resolveTo();
    spyOn(console, 'error');
  });

  it('attaches listeners before starting and closes a completed page', fakeAsync(() => {
    const event = new NDKEvent();
    start.and.callFake(() => { listeners['event'](event); listeners['eose'](); });
    let result: NDKEvent[] | undefined;
    void service.fetchNostrProjects(128).then(events => result = events);
    flushMicrotasks();
    expect(subscribe).toHaveBeenCalledWith(
      { kinds: [3030], limit: 128 },
      { closeOnEose: true, relaySet: jasmine.any(NDKRelaySet) },
      false
    );
    expect(result).toEqual([event]);
    expect(stop).toHaveBeenCalled();
  }));

  it('discovers projects using only connected relays with canonical URLs', fakeAsync(() => {
    start.and.callFake(() => listeners['eose']());
    void service.fetchNostrProjects(128);
    flushMicrotasks();
    const relaySet = subscribe.calls.mostRecent().args[1].relaySet as NDKRelaySet;
    expect([...relaySet.relays]).toEqual([connectedRelay]);
    expect([...relaySet.relays].map(relay => relay.url)).toEqual(['wss://available.example/']);
  }));

  it('rejects a partial timeout instead of presenting it as the end of discovery', fakeAsync(() => {
    start.and.callFake(() => listeners['event'](new NDKEvent()));
    let error: Error | undefined;
    void service.fetchNostrProjects(128, 123, 1).catch(reason => error = reason);
    flushMicrotasks();
    tick(8000);
    expect(error?.message).toContain('timed out');
    expect(stop).toHaveBeenCalled();
  }));

  it('retries a closed connection once and surfaces failure', fakeAsync(() => {
    start.and.callFake(() => listeners['close']());
    let error: Error | undefined;
    void service.fetchNostrProjects(128).catch(reason => error = reason);
    flushMicrotasks();
    expect(service.reconnectToRelays).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(error?.message).toContain('connection closed');
    expect(stop).toHaveBeenCalledTimes(2);
  }));
});
