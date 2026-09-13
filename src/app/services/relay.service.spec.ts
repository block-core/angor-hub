import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { RelayService } from './relay.service';

describe('RelayService project discovery subscription', () => {
  let service: RelayService;
  let listeners: Record<string, (event?: NDKEvent) => void>;
  let start: jasmine.Spy;
  let stop: jasmine.Spy;
  let subscribe: jasmine.Spy;

  beforeEach(() => {
    // Exercise the subscription lifecycle without opening real relay connections.
    service = Object.create(RelayService.prototype) as RelayService;
    listeners = {};
    start = jasmine.createSpy();
    stop = jasmine.createSpy();
    subscribe = jasmine.createSpy().and.returnValue({
      on: (name: string, callback: (event?: NDKEvent) => void) => listeners[name] = callback,
      start, stop,
    });
    spyOn(service, 'ensureConnected').and.resolveTo({ subscribe } as unknown as NDK);
    spyOn(service, 'reconnectToRelays').and.resolveTo();
    spyOn(console, 'error');
  });

  it('attaches listeners before starting and closes a completed page', fakeAsync(() => {
    const event = new NDKEvent();
    start.and.callFake(() => { listeners['event'](event); listeners['eose'](); });
    let result: NDKEvent[] | undefined;
    void service.fetchNostrProjects(128).then(events => result = events);
    flushMicrotasks();
    expect(subscribe).toHaveBeenCalledWith({ kinds: [3030], limit: 128 }, { closeOnEose: true }, false);
    expect(result).toEqual([event]);
    expect(stop).toHaveBeenCalled();
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
