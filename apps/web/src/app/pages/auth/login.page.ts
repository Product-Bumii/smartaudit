import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { toApiFailure } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { AuthLayoutComponent } from './auth-layout.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, TranslatePipe, AuthLayoutComponent],
  template: `
    <app-auth-layout>
      <div class="box">
        <h1>{{ 'login.title' | translate }}</h1>
        @if (sent()) {
          @if (devLink(); as link) {
            <div class="dev-link" role="status" data-testid="login-sent">
              <div class="eyebrow">{{ 'login.dev.eyebrow' | translate }}</div>
              <p>{{ 'login.dev.text' | translate }}</p>
              <button mat-flat-button type="button" (click)="useDevLink(link)" data-testid="dev-magic-link">{{ 'login.dev.enter' | translate }}</button>
              <a class="tech url" [href]="link">{{ link }}</a>
            </div>
          } @else {
            <div class="alert info" role="status" data-testid="login-sent">{{ 'login.sent' | translate }}</div>
          }
          <button mat-stroked-button type="button" (click)="sent.set(false)">{{ 'login.again' | translate }}</button>
        } @else {
          <p>{{ 'login.intro' | translate }}</p>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field class="full" appearance="outline">
              <mat-label>{{ 'login.email' | translate }}</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="email" data-testid="login-email" required />
              @if (form.controls.email.touched && form.controls.email.invalid) {
                <mat-error>{{ 'login.invalidEmail' | translate }}</mat-error>
              }
            </mat-form-field>
            @if (error()) {
              <div class="alert error" role="alert">{{ error() }}</div>
            }
            <button mat-flat-button type="submit" [disabled]="busy()" data-testid="login-submit">{{ 'login.submit' | translate }}</button>
          </form>
        }
      </div>
    </app-auth-layout>
  `,
  styles: `
    .box { display: flex; flex-direction: column; gap: 20px; max-width: 440px; width: 100%; }
    h1 { font-size: 36px; }
    p { margin: 0; font-size: 16px; line-height: 1.6; }
    form { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .dev-link { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; background: var(--efr-surface); border-top: 3px solid var(--efr-orange); padding: 20px; }
    .url { font-size: 12px; word-break: break-all; color: var(--efr-gray-dark); }
  `,
})
export class LoginPage {
  readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  readonly form = inject(FormBuilder).nonNullable.group({ email: ['', [Validators.required, Validators.email]] });
  readonly sent = signal(false);
  readonly devLink = signal<string | null>(null);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const res = await this.auth.requestLink(this.form.getRawValue().email);
      this.devLink.set(res.devLink ?? null);
      this.sent.set(true);
    } catch (e) {
      this.error.set(this.i18n.error(toApiFailure(e).code));
    } finally {
      this.busy.set(false);
    }
  }

  /** Opens the on-screen magic link inside the app (same origin as APP_URL). */
  async useDevLink(link: string): Promise<void> {
    const u = new URL(link);
    await this.router.navigateByUrl(u.pathname + u.search);
  }
}
