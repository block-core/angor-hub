import { IndexerService } from '../../services/indexer.service';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { InvestComponent } from './invest.component';
import { PaymentNavigationService } from '../../services/payment-navigation.service';
import { NetworkService } from '../../services/network.service';
import { ThemeService } from '../../services/theme.service';

describe('Payment handoff', () => {
  let mainnet: boolean;
  let dark: boolean;
  let activeIndexer: string;

  beforeEach(() => {
    TestBed.resetTestingModule();
    mainnet = true;
    dark = true;
    activeIndexer = 'https://indexer.angor.io/';
    TestBed.configureTestingModule({
      imports: [InvestComponent],
      teardown: { destroyAfterEach: true },
      providers: [
        { provide: IndexerService, useValue: { getActiveIndexerUrl: () => activeIndexer } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'angor1test' }) } } },
        { provide: NetworkService, useValue: { isMain: () => mainnet } },
        { provide: ThemeService, useValue: { isDarkTheme: () => dark } },
      ],
    });
  });

  it('sends the project, network and theme directly to the local payment screen', () => {
    const service = TestBed.inject(PaymentNavigationService);
    const url = new URL(service.getUrl('angor1test'));
    expect(url.origin).toBe('http://localhost:5062');
    expect(url.pathname).toBe('/investview/angor1test');
    expect(url.searchParams.get('indexer')).toBe(activeIndexer);
    expect(url.searchParams.get('network')).toBe('Main');
    expect(url.searchParams.get('theme')).toBe('dark');
    expect(url.searchParams.has('amount')).toBeFalse();
    expect(url.searchParams.has('installments')).toBeFalse();
    activeIndexer = 'https://test.indexer.angor.io/';
    mainnet = false;
    dark = false;
    const testUrl = new URL(service.getUrl('angor1test'));
    expect(testUrl.searchParams.get('indexer')).toBe(activeIndexer);
    expect(testUrl.searchParams.get('network')).toBe('Angornet');
    expect(testUrl.searchParams.get('theme')).toBe('light');
  });

  it('redirects existing Hub investment links without loading a duplicate form', () => {
    const open = spyOn(TestBed.inject(PaymentNavigationService), 'open');
    const fixture = TestBed.createComponent(InvestComponent);
    fixture.detectChanges();
    expect(open).toHaveBeenCalledOnceWith('angor1test');
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
  });
});
