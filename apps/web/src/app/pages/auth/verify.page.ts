import { Component, inject, input, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { toApiFailure } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import type { AccountChoice } from '../../core/models';
import { AuthLayoutComponent } from './auth-layout.component';

/** Consume el enlace mágico; si el correo tiene varias cuentas, la persona elige la organización. */
@Component({
  selector: 'app-verify',
  imports: [MatButtonModule, MatProgressBarModule, RouterLink, TranslatePipe, AuthLayoutComponent],
  template: `
    <app-auth-layout>
      <div class="box">
        @if (accounts().length) {
          <h1>{{ 'verify.chooseOrg' | translate }}</h1>
          <p>{{ 'verify.chooseOrgHelp' | translate }}</p>
          <ul class="accounts">
            @for (a of accounts(); track a.userId; let i = $index) {
              <li>
                <button type="button" class="account" (click)="choose(a)" [attr.data-testid]="'account-' + (a.auditEntityName ?? 'platform')">
                  <span class="num">{{ (i + 1).toString().padStart(2, '0') }}</span>
                  <span class="org">{{ a.auditEntityName ?? ('verify.platform' | translate) }}</span>
                  <span class="role">{{ 'roles.' + a.role | translate }}</span>
                </button>
              </li>
            }
          </ul>
        } @else if (error()) {
          <h1>{{ 'verify.failedTitle' | translate }}</h1>
          <div class="alert error" role="alert">{{ error() }}</div>
          <a mat-flat-button routerLink="/login">{{ 'verify.backToLogin' | translate }}</a>
        } @else {
          <h1>{{ 'verify.checking' | translate }}</h1>
          <mat-progress-bar mode="indeterminate" />
        }
      </div>
    </app-auth-layout>
  `,
  styles: `
    .box { display: flex; flex-direction: column; gap: 20px; max-width: 480px; width: 100%; }
    h1 { font-size: 36px; }
    p { margin: 0; }
    .accounts { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--efr-border-strong); }
    .account { width: 100%; display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 2px 12px; text-align: left; background: none; border: 0; border-bottom: 1px solid var(--efr-border-strong); padding: 16px 0; cursor: pointer; font: inherit; color: var(--efr-gray-dark); transition: color var(--efr-transition); }
    .account:hover, .account:focus-visible { color: var(--efr-orange); }
    .num { grid-row: span 2; color: var(--efr-gray-mid); font-size: 14px; padding-top: 3px; }
    .org { font-size: 18px; font-weight: 700; }
    .role { font-size: 13px; }
  `,
})
export class VerifyPage implements OnInit {
  readonly token = input<string>();
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  readonly accounts = signal<AccountChoice[]>([]);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const token = this.token();
    try {
      if (!token) {
        // Recarga durante la selección: la cookie de selección sigue siendo válida.
        this.accounts.set((await this.auth.pendingAccounts()).accounts);
        return;
      }
      const res = await this.auth.verify(token);
      // Quita el token de la barra de direcciones y del historial.
      history.replaceState(null, '', '/auth/verify');
      if (res.status === 'authenticated') await this.router.navigateByUrl(this.auth.homeFor(res.user.role));
      else this.accounts.set(res.accounts);
    } catch (e) {
      this.error.set(this.i18n.error(toApiFailure(e).code));
    }
  }

  async choose(a: AccountChoice): Promise<void> {
    try {
      await this.auth.select(a.userId);
      await this.router.navigateByUrl(this.auth.homeFor(a.role));
    } catch (e) {
      this.accounts.set([]);
      this.error.set(this.i18n.error(toApiFailure(e).code));
    }
  }
}
