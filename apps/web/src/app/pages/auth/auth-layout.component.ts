import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';
import { BRAND } from '../../core/brand';
import { I18nService } from '../../core/i18n.service';
import { LANGS } from '../../core/models';
import { BrandComponent } from '../../layout/brand.component';

/** Portada de acceso: claim principal «efr es conciliación.» a la izquierda y el formulario a la derecha. */
@Component({
  selector: 'app-auth-layout',
  imports: [TranslatePipe, BrandComponent],
  template: `
    <div class="auth">
      <header class="hero">
        <div class="top">
          <app-brand />
          <div class="segmented" role="group" [attr.aria-label]="'nav.language' | translate">
            @for (l of langs; track l) {
              <button type="button" [attr.aria-pressed]="i18n.lang() === l" [attr.lang]="l" (click)="auth.setLanguage(l)">{{ l }}</button>
            }
          </div>
        </div>
        <div class="copy">
          <div class="eyebrow">{{ 'login.eyebrow' | translate }}</div>
          <p class="display">{{ brand.claims[0] }}.</p>
          <p class="lead">{{ 'login.lead' | translate }}</p>
        </div>
        <p class="note">{{ 'brand.sideNote' | translate }}</p>
      </header>
      <main class="panel" id="main">
        <ng-content />
      </main>
    </div>
  `,
  styles: `
    .auth, .hero, .panel { box-sizing: border-box; }
    .auth { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(320px, 1fr); min-height: 100vh; }
    .hero { padding: 40px clamp(24px, 6vw, 96px) 40px; display: flex; flex-direction: column; gap: 40px; border-right: 1px solid var(--efr-border); }
    .top { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
    .copy { display: flex; flex-direction: column; gap: 28px; margin: auto 0; }
    .panel { background: var(--efr-surface-alt); padding: 96px clamp(24px, 5vw, 72px); display: flex; flex-direction: column; justify-content: center; }
    @media (max-width: 900px) {
      .auth { grid-template-columns: 1fr; }
      .hero { border-right: 0; border-bottom: 1px solid var(--efr-border); gap: 28px; padding: 24px 16px 40px; }
      .copy { margin: 0; gap: 16px; }
      .panel { padding: 40px 16px; justify-content: flex-start; }
    }
  `,
})
export class AuthLayoutComponent {
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  readonly langs = LANGS;
  readonly brand = BRAND;
}
