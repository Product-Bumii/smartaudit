import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRAND } from '../core/brand';
import { EfrLogoComponent } from './efr-logo.component';

/** Firma del aplicativo: logotipo efr + «SmartAudit» + «powered by Bumii». */
@Component({
  selector: 'app-brand',
  imports: [RouterLink, EfrLogoComponent],
  template: `
    <a routerLink="/" class="brand" [class.stacked]="stacked()" [attr.aria-label]="label">
      <app-efr-logo [height]="stacked() ? 34 : 28" />
      <span class="text">
        <span class="product">{{ brand.product }}</span>
        <span class="powered">{{ brand.poweredBy }}</span>
      </span>
    </a>
  `,
  styles: `
    .brand { display: inline-flex; align-items: center; gap: 14px; color: var(--efr-gray-dark); text-decoration: none; }
    .brand:hover { text-decoration: none; color: var(--efr-gray-dark); }
    .brand.stacked { flex-direction: column; align-items: flex-start; gap: 10px; }
    .text { display: flex; flex-direction: column; line-height: 1.3; }
    .product { font-size: 15px; font-weight: 700; }
    .powered { font-size: 12px; color: var(--efr-gray-mid); }
  `,
})
export class BrandComponent {
  readonly stacked = input(false);
  readonly brand = BRAND;
  readonly label = `efr · ${BRAND.product} · ${BRAND.poweredBy}`;
}
