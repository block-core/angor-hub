import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PaymentNavigationService } from '../../services/payment-navigation.service';

/** Keeps existing Hub investment links working without a second payment form. */
@Component({
  selector: 'app-invest',
  standalone: true,
  template: '<p class="p-6 text-text-secondary">Opening Angor payment…</p>',
})
export class InvestComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private paymentNavigation = inject(PaymentNavigationService);

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('id');
    if (projectId) this.paymentNavigation.open(projectId);
  }
}
