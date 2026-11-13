import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../core/auth.service';
import { BRAND } from '../core/brand';
import { I18nService } from '../core/i18n.service';
import { LANGS } from '../core/models';
import { BrandComponent } from './brand.component';
import { EfrLogoComponent } from './efr-logo.component';

interface NavItem {
  path: string;
  label: string;
}

/**
 * Estructura del área interna según la referencia de marca: navegación lateral fija de 240 px con borde
 * derecho, contenido a la derecha y pie en gris oscuro. En móvil la navegación pasa arriba.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, BrandComponent, EfrLogoComponent],
  template: `
    <a class="skip-link" href="#main">{{ 'common.skipToContent' | translate }}</a>
    <div class="layout">
      <nav class="side" [attr.aria-label]="'nav.main' | translate">
        <app-brand [stacked]="true" />
        <div class="links">
          @for (item of nav(); track item.path; let i = $index) {
            <a [routerLink]="item.path" routerLinkActive="active" #rla="routerLinkActive" [attr.aria-current]="rla.isActive ? 'page' : null">
              <span class="num">{{ (i + 1).toString().padStart(2, '0') }}</span> {{ item.label | translate }}
            </a>
          }
        </div>
        <div class="account">
          <div class="who" data-testid="user-info">
            <span class="email" data-testid="user-email">{{ auth.user()?.email }}</span>
            <span class="role">{{ 'roles.' + auth.user()?.role | translate }}@if (auth.user()?.organizationName) { · <span class="keep-case">{{ auth.user()?.organizationName }}</span> }</span>
          </div>
          <div class="segmented" role="group" [attr.aria-label]="'nav.language' | translate">
            @for (l of langs; track l) {
              <button type="button" [attr.aria-pressed]="i18n.lang() === l" [attr.lang]="l" (click)="auth.setLanguage(l)">{{ l }}</button>
            }
          </div>
          <button type="button" class="logout" (click)="auth.logout()" data-testid="logout">{{ 'nav.logout' | translate }}</button>
        </div>
        <p class="note">{{ 'brand.sideNote' | translate }}</p>
      </nav>
      <div class="main-col">
        <main id="main" class="content" tabindex="-1">
          <router-outlet />
        </main>
        <footer class="footer">
          <app-efr-logo variant="negative-gray" [height]="30" />
          <div class="foot-text">
            <span>{{ brand.product }} · {{ brand.poweredBy }}</span>
            <span class="claim-line">{{ brand.claims[0] }}</span>
          </div>
          <a [href]="brand.links.site" target="_blank" rel="noopener">{{ brand.links.siteLabel }}</a>
        </footer>
      </div>
    </div>
  `,
  styles: `
    .layout, .side, .content, .footer { box-sizing: border-box; }
    .layout { display: grid; grid-template-columns: minmax(0, 240px) minmax(0, 1fr); min-height: 100vh; }
    .side { position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto; padding: 40px 24px; display: flex; flex-direction: column; gap: 28px; border-right: 1px solid var(--efr-border); background: var(--efr-surface); }
    .links { display: flex; flex-direction: column; gap: 10px; font-size: 14px; }
    .links a { color: var(--efr-orange); padding: 2px 0; }
    .links a:hover { color: var(--efr-gray-dark); }
    .links a.active { color: var(--efr-gray-dark); font-weight: 700; }
    .num { color: var(--efr-gray-mid); font-weight: 400; margin-right: 4px; }
    .account { display: flex; flex-direction: column; gap: 12px; margin-top: auto; padding-top: 20px; border-top: 1px solid var(--efr-border); font-size: 13px; }
    .account .segmented { align-self: flex-start; flex-wrap: wrap; }
    .account .segmented button { padding: 6px 9px; }
    .who { display: flex; flex-direction: column; gap: 2px; line-height: 1.4; }
    .email { font-weight: 700; word-break: break-all; }
    .logout { align-self: flex-start; background: none; border: 0; padding: 0; color: var(--efr-orange); font: inherit; font-size: 14px; cursor: pointer; }
    .logout:hover { color: var(--efr-gray-dark); text-decoration: underline; }
    .main-col { display: flex; flex-direction: column; min-width: 0; }
    .content { flex: 1; padding: 72px clamp(24px, 6vw, 96px) 80px; max-width: 1280px; width: 100%; outline: none; }
    .footer { background: var(--efr-gray-dark); color: #fff; padding: 32px clamp(24px, 6vw, 96px); display: flex; align-items: center; gap: 24px; flex-wrap: wrap; font-size: 14px; }
    .foot-text { display: flex; flex-direction: column; flex: 1; line-height: 1.5; }
    .claim-line { color: var(--efr-on-dark-muted); }
    .footer a { color: #fff; }
    .note { margin: 0; }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .side { position: static; height: auto; padding: 20px 16px; gap: 16px; border-right: 0; border-bottom: 1px solid var(--efr-border); }
      .links { flex-direction: row; flex-wrap: wrap; gap: 8px 16px; }
      .account { margin-top: 0; flex-direction: row; flex-wrap: wrap; align-items: center; }
      .note { display: none; }
      .content { padding: 32px 16px 48px; }
    }
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  readonly langs = LANGS;
  readonly brand = BRAND;

  readonly nav = computed<NavItem[]>(() => {
    const role = this.auth.user()?.role;
    if (role === 'ORG_ADMIN') return [{ path: '/org/auditors', label: 'nav.auditors' }];
    if (role === 'AUDITOR') return [{ path: '/campaigns', label: 'nav.campaigns' }];
    return [
      { path: '/admin/organizations', label: 'nav.organizations' },
      { path: '/campaigns', label: 'nav.campaigns' },
      { path: '/admin/config', label: 'nav.config' },
    ];
  });
}
