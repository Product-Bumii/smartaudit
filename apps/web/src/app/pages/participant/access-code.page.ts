import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService, toApiFailure } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import { LANGS, type Language, type ParticipantSessionDto } from '../../core/models';
import { BrandComponent } from '../../layout/brand.component';
import { TzDatePipe } from '../../shared/tz-date.pipe';

type AccessResult = ParticipantSessionDto;

/**
 * Public participant landing (section 5.4), keyboard accessible, without organization data:
 * - `/c/<slug>` (also printed as QR): people without email type the 8-character code they got on paper.
 * - `/i/<token>`: personal invitation link from the email.
 * Then the notice, the language choice and «empezar» (or «continuar», resuming where it was left).
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
              <h1 data-testid="code-ok">{{ (token() ? 'participant.welcomeTitle' : 'participant.validTitle') | translate }}</h1>
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
              <button mat-flat-button type="button" [disabled]="r.availability !== 'open' || busy()" (click)="start()" data-testid="start-interview">
                {{ (r.interview ? 'participant.resume' : 'participant.start') | translate }}
              </button>
              @if (r.availability !== 'open') {
                <p class="note">{{ 'participant.startWhenOpen' | translate }}</p>
              }
              @if (error()) {
                <div class="alert error" role="alert">{{ error() }}</div>
              }
            }
          }
        } @else if (token()) {
          <p class="lead">…</p>
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
  /** Landing with code (`/c/<slug>`) or personal link (`/i/<token>`). */
  readonly slug = input<string>();
  readonly token = input<string>();
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
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
      const token = this.token();
      if (token) this.show(await this.api.post<AccessResult>(`/participant/i/${token}`));
      else await this.api.get(`/participant/c/${this.slug()}`);
    } catch {
      this.notFound.set(true);
    }
  }

  private show(r: AccessResult): void {
    const current = this.i18n.lang();
    const chosen = r.interview?.language ?? (r.offeredLanguages.includes(current) ? current : (r.offeredLanguages[0] ?? 'es'));
    this.interviewLang.set(chosen);
    this.result.set(r);
  }

  /** Accepting the notice is pressing «empezar» after reading it. */
  async start(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.api.post('/participant/interview/start', { language: this.interviewLang(), acceptNotice: true });
      await this.i18n.use(this.interviewLang(), false);
      await this.router.navigate(['/p/entrevista']);
    } catch (e) {
      this.error.set(this.i18n.error(toApiFailure(e).code));
    } finally {
      this.busy.set(false);
    }
  }

  async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      this.show(await this.api.post<AccessResult>(`/participant/c/${this.slug()}/access`, { code: this.form.getRawValue().code }));
    } catch (e) {
      const f = toApiFailure(e);
      if (f.code === 'CAMPAIGN_NOT_FOUND') this.notFound.set(true);
      else this.error.set(this.i18n.error(f.code));
    } finally {
      this.busy.set(false);
    }
  }
}
