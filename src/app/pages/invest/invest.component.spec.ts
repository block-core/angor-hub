import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { InvestComponent } from './invest.component';
import { IndexedProject, IndexerService } from '../../services/indexer.service';
import { ProjectUpdate, RelayService } from '../../services/relay.service';
import { NetworkService } from '../../services/network.service';
import { ThemeService } from '../../services/theme.service';

describe('InvestComponent project type flows', () => {
  const projectId = 'angor1test';
  const details = (projectType?: number): ProjectUpdate => ({
    projectType, projectIdentifier: projectId, founderKey: 'founder', founderRecoveryKey: 'recovery',
    nostrPubKey: 'pubkey', startDate: 1, endDate: 2, expiryDate: 3, penaltyDays: 1,
    targetAmount: 100000000, stages: [{ amountToRelease: 100, releaseDate: 2 }], projectSeeders: [],
  });
  const project = (): IndexedProject => ({
    projectIdentifier: projectId, founderKey: 'founder', nostrEventId: 'event', createdOnBlock: 1,
    trxId: 'tx', details_created_at: undefined, metadata_created_at: undefined,
    content_created_at: undefined, members_created_at: undefined, media_created_at: undefined,
    externalIdentities_created_at: undefined,
  });
  let indexer: { getProject: jasmine.Spy; fetchProject: jasmine.Spy; fetchProjectStats: jasmine.Spy };
  let relay: { fetchProjectDetails: jasmine.Spy };
  let mainnet: boolean;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    spyOn(window, 'scrollTo');
    spyOn(console, 'error');
    mainnet = true;
    indexer = {
      getProject: jasmine.createSpy().and.returnValue(undefined),
      fetchProject: jasmine.createSpy().and.resolveTo(project()),
      fetchProjectStats: jasmine.createSpy().and.resolveTo(null),
    };
    relay = { fetchProjectDetails: jasmine.createSpy().and.resolveTo(details(1)) };
    TestBed.configureTestingModule({
      imports: [InvestComponent], teardown: { destroyAfterEach: true },
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: projectId }) } } },
        { provide: Router, useValue: { navigate: jasmine.createSpy() } },
        { provide: IndexerService, useValue: indexer },
        { provide: RelayService, useValue: relay },
        { provide: NetworkService, useValue: { isMain: () => mainnet } },
        { provide: ThemeService, useValue: { isDarkTheme: () => true } },
      ],
    });
  });

  for (const [type, label, card] of [[0, 'Invest Now', '#invest-amount'], [1, 'Fund', '#fund-amount'], [2, 'Subscribe', '.subscription-card'], [undefined, 'Invest Now', '#invest-amount']] as const) {
    it(`loads ${label} details on direct entry and uses them throughout the form`, fakeAsync(() => {
      relay.fetchProjectDetails.and.resolveTo(details(type));
      const fixture = TestBed.createComponent(InvestComponent);
      fixture.detectChanges();
      expect(fixture.componentInstance.canSubmit()).toBeFalse();
      flushMicrotasks();
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      expect(relay.fetchProjectDetails).toHaveBeenCalledWith('event');
      expect(root.querySelector('.footer-submit-btn')?.textContent).toContain(label);
      expect(root.querySelector('.mobile-bar-invest-btn')?.textContent).toContain(label);
      expect(root.querySelector(card)).not.toBeNull();
      const component = fixture.componentInstance;
      if (type !== 2) component.setQuickAmount(0.001);
      expect(component.canSubmit()).toBeTrue();
      expect(component.paymentStages().length).toBe(type === 1 || type === 2 ? 3 : 1);
      const open = spyOn(window, 'open');
      component.handleMobileInvestClick();
      expect(open).toHaveBeenCalledWith(`https://app.angor.io/investview/${projectId}`, '_blank', 'noopener');
      mainnet = false;
      component.setQuickAmount(0.01);
      component.generateInvoice();
      expect(component.showAppDownloadModal()).toBeTrue();
      component.continueWithWeb();
      expect(open).toHaveBeenCalledWith(`https://test.angor.io/investview/${projectId}`, '_blank', 'noopener');
    }));
  }

  it('preserves the Fund type when navigating from a cached project', fakeAsync(() => {
    indexer.getProject.and.returnValue({ ...project(), details: details(1) });
    indexer.fetchProjectStats.and.rejectWith(new Error('Stats unavailable'));
    const fixture = TestBed.createComponent(InvestComponent);
    fixture.detectChanges();
    flushMicrotasks();
    expect(indexer.fetchProject).not.toHaveBeenCalled();
    expect(relay.fetchProjectDetails).not.toHaveBeenCalled();
    expect(fixture.componentInstance.actionButtonText()).toBe('Fund');
    fixture.componentInstance.setQuickAmount(0.0001);
    expect(fixture.componentInstance.amountError()).toBe('Minimum funding is 0.001 BTC');
  }));

  for (const invalid of [null, { ...details(1), projectIdentifier: 'another-project' }, details(9)]) {
    it('blocks payment when project details are missing, mismatched or unsupported', fakeAsync(() => {
      relay.fetchProjectDetails.and.resolveTo(invalid);
      const fixture = TestBed.createComponent(InvestComponent);
      fixture.detectChanges();
      flushMicrotasks();
      fixture.detectChanges();
      expect(fixture.componentInstance.error()).toBeTruthy();
      expect(fixture.componentInstance.canSubmit()).toBeFalse();
      const root: HTMLElement = fixture.nativeElement;
      expect(root.querySelector('.mobile-bar-invest-btn')).toBeNull();
    }));
  }
});
