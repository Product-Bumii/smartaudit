import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService, toApiFailure } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import { LANGS, type Language } from '../../core/models';
import { BrandComponent } from '../../layout/brand.component';
import { TzDatePipe } from '../../shared/tz-date.pipe';

type Availability = 'not_open_yet' | 'open' | 'closed' | 'completed' | 'unavailable';
interface AccessResult {
  availability: Availability;
  offeredLanguages: Language[];
  window: { opensAt: string; closesAt: string; timeZone: string } | null;
}

/**
 * Public landing for people without email (`/c/<slug>`, also printed as QR): they type the 8-character
 * code they were given on paper. Keyboard accessible; no organization data is shown.
 * TODO(Fase 2): start/resume the interview after accepting the notice.
 */
@Component({
  selector: 'app-access-code',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, TranslatePipe, BrandComponent, TzDatePipe],
  template: `
    <div class="page">
      <header class="top">
        <app-brand />
        <div class="segmented" role="group" [attr.aria-label]="'nav.language' | translate">
          @for (l of langs; track l) {
            <button type="button" [attr.aria-pressed]="i18n.lang() === l" [attr.lang]="l" (click)="i18n.use(l)">{{ l }}</button>
          }
        </div>
      </header>

      <main id="main" class="content" aria-live="polite">
        <div class="eyebrow">{{ 'participant.eyebrow' | translate }}</div>

        @if (notFound()) {
          <h1>{{ 'participant.notFoundTitle' | translate }}</h1>
          <p class="lead">{{ 'participant.notFoundText' | translate }}</p>
        } @else if (result(); as r) {
          @switch (r.availability) {
            @case ('completed') {
              <h1>{{ 'participant.completedTitle' | translate }}</h1>
              <p class="lead">{{ 'participant.completedText' | translate }}</p>
            }
            @case ('closed') {
              <h1>{{ 'participant.closedTitle' | translate }}</h1>
              <p class="lead">{{ 'participant.closedText' | translate }}</p>
            }
            @case ('unavailable') {
              <h1>{{ 'participant.unavailableTitle' | translate }}</h1>
              <p class="lead">{{ 'participant.unavailableText' | translate }}</p>
            }
            @default {
              <h1 data-testid="code-ok">{{ 'participant.validTitle' | translate }}</h1>
              @if (r.availability === 'not_open_yet') {
                <div class="stat" data-testid="not-open-yet">
                  @if (r.window; as w) {
                    <span class="value small">{{ w.opensAt | tzDate: w.timeZone }}</span>
                    <span class="label">{{ 'participant.opensOn' | translate }} · {{ 'participant.closesOn' | translate }} {{ w.closesAt | tzDate: w.timeZone }}</span>
                  } @else {
                    <span class="label">{{ 'participant.notOpenNoDate' | translate }}</span>
                  }
                </div>
              }
              <section class="notice">
                <h2>{{ 'participant.noticeTitle' | translate }}</h2>
                <ul>
                  <li>{{ 'participant.noticeAi' | translate }}</li>
                  <li>{{ 'participant.noticePurpose' | translate }}</li>
                  <li>{{ 'participant.noticeConfidential' | translate }}</li>
                  <li>{{ 'participant.noticeAbstain' | translate }}</li>
                  <li>{{ 'participant.noticeContact' | translate }}</li>
                </ul>
              </section>
              <section class="lang">
                <h2>{{ 'participant.chooseLanguage' | translate }}</h2>
                <div class="segmented" role="group" [attr.aria-label]="'participant.chooseLanguage' | translate">
                  @for (l of r.offeredLanguages; track l) {
                    <button type="button" [attr.aria-pressed]="interviewLang() === l" [attr.lang]="l" (click)="interviewLang.set(l)">{{ 'lang.' + l | translate }}</button>
                  }
                </div>
              </section>
              <button mat-flat-button type="button" disabled>{{ 'participant.start' | translate }}</button>
              <p class="note">{{ (r.availability === 'open' ? 'participant.startPhase2' : 'participant.startWhenOpen') | translate }}</p>
            }
          }
        } @else {
          <h1>{{ 'participant.title' | translate }}</h1>
          <p class="lead">{{ 'participant.intro' | translate }}</p>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline" class="code-field" subscriptSizing="dynamic">
              <mat-label>{{ 'participant.codeLabel' | translate }}</mat-label>
              <input matInput formControlName="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" class="code-input" data-testid="access-code" />
              <mat-hint>{{ 'participant.codeHint' | translate }}</mat-hint>
            </mat-form-field>
            @if (error()) {
              <div class="alert error" role="alert" data-testid="access-error">{{ error() }}</div>
            }
            <button mat-flat-button type="submit" [disabled]="form.invalid || busy()" data-testid="access-submit">{{ 'participant.continue' | translate }}</button>
          </form>
        }
      </main>

      <footer class="foot note">SmartAudit efr · powered by Bumii</footer>
    </div>
  `,
  styles: `
    .page, .top, .content { box-sizing: border-box; }
    .page { min-height: 100vh; display: flex; flex-direction: column; }
    .top { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; padding: 24px clamp(16px, 6vw, 96px); border-bottom: 1px solid var(--efr-border); }
    .content { flex: 1; width: 100%; max-width: 720px; padding: 64px clamp(16px, 6vw, 96px); display: flex; flex-direction: column; gap: 24px; align-items: flex-start; }
    .lead { margin: 0; }
    form { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; width: 100%; }
    .code-field { width: 100%; max-width: 360px; }
    .code-input { font-family: var(--efr-font-tech); font-size: 22px; letter-spacing: 4px; text-transform: uppercase; }
    .notice, .lang { width: 100%; }
    .notice h2, .lang h2 { font-size: 20px; margin-bottom: 12px; }
    .notice ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.5; }
    .stat { width: 100%; }
    .note { margin: 0; }
    .foot { padding: 24px clamp(16px, 6vw, 96px); border-top: 1px solid var(--efr-border); }
  `,
})
export class AccessCodePage implements OnInit {
  readonly slug = input.required<string>();
  private readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);
  readonly langs = LANGS;
  readonly form = inject(FormBuilder).nonNullable.group({ code: ['', [Validators.required, Validators.minLength(8)]] });
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notFound = signal(false);
  readonly result = signal<AccessResult | null>(null);
  readonly interviewLang = signal<Language>('es');

  async ngOnInit(): Promise<void> {
    try {
      await this.api.get(`/participant/c/${this.slug()}`);
    } catch {
      this.notFound.set(true);
    }
  }

  async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const r = await this.api.post<AccessResult>(`/participant/c/${this.slug()}/access`, { code: this.form.getRawValue().code });
      const current = this.i18n.lang();
      this.interviewLang.set(r.offeredLanguages.includes(current) ? current : (r.offeredLanguages[0] ?? 'es'));
      this.result.set(r);
    } catch (e) {
      const f = toApiFailure(e);
      if (f.code === 'CAMPAIGN_NOT_FOUND') this.notFound.set(true);
      else this.error.set(this.i18n.error(f.code));
    } finally {
      this.busy.set(false);
    }
  }
}
