import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService, toApiFailure } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import type { InterviewQuestionView, InterviewStateDto } from '../../core/models';
import { BrandComponent } from '../../layout/brand.component';

type Input =
  | { kind: 'options'; optionCodes: string[]; freeText?: string | null }
  | { kind: 'abstain' }
  | { kind: 'text'; text: string };

/**
 * Written interview (section 5.5), mobile first and keyboard accessible. Options are buttons (checkboxes for
 * multiple choice); the participant may also answer in their own words or tap «Prefiero no responder».
 * Everything is decided by the server; this page only shows the state and sends the input.
 */
@Component({
  selector: 'app-interview',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, TranslatePipe, BrandComponent],
  template: `
    <div class="page">
      <header class="top">
        <app-brand />
        @if (state(); as s) {
          @if (s.state !== 'completed') {
            <div class="progress" data-testid="chat-progress">
              <span class="label">{{ 'interview.progress' | translate: { answered: s.progress.answered, planned: s.progress.planned } }}</span>
              <span class="bar" role="progressbar" [attr.aria-valuenow]="s.progress.answered" aria-valuemin="0" [attr.aria-valuemax]="s.progress.planned"><span [style.width.%]="pct()"></span></span>
            </div>
          }
        }
      </header>

      <main id="main" class="chat">
        @if (expired()) {
          <h1>{{ 'interview.expiredTitle' | translate }}</h1>
          <p class="lead">{{ 'interview.expiredText' | translate }}</p>
        } @else if (state(); as s) {
          <ol class="messages" aria-live="polite" data-testid="chat-messages">
            @for (m of s.messages; track $index) {
              <li class="msg" [class.me]="m.role === 'participant'" [class.clar]="m.kind === 'clarification'" data-testid="chat-message">{{ m.kind === 'abstain' ? ('interview.abstain' | translate) : m.text }}</li>
            }
          </ol>

          @if (s.question; as q) {
            <section class="answer" #answerArea [attr.aria-label]="'interview.answerArea' | translate" [attr.data-question]="q.code" data-testid="chat-answer">
              @if (q.help) { <p class="help">{{ q.help }}</p> }

              @if (q.type === 'multi') {
                <p class="help">{{ 'interview.multiHint' | translate }}</p>
                <div class="options" role="group" [attr.aria-label]="q.text">
                  @for (o of q.options; track o.code) {
                    <button mat-stroked-button type="button" [class.picked]="selected().includes(o.code)" [attr.aria-pressed]="selected().includes(o.code)" [disabled]="busy()" (click)="toggle(o.code)" [attr.data-testid]="'chat-option-' + o.code">{{ o.label }}</button>
                  }
                </div>
              } @else if (q.type !== 'free_text') {
                <div class="options" role="group" [attr.aria-label]="q.text">
                  @for (o of q.options; track o.code) {
                    <button mat-stroked-button type="button" [class.picked]="selected().includes(o.code)" [disabled]="busy()" (click)="pick(q, o.code)" [attr.data-testid]="'chat-option-' + o.code">{{ o.label }}</button>
                  }
                </div>
              }

              @if (freeTextOption(); as ft) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full">
                  <mat-label>{{ ft.label }}</mat-label>
                  <input matInput [(ngModel)]="optionText" name="optionText" data-testid="chat-option-text" />
                </mat-form-field>
              }
              @if (q.type === 'multi' || freeTextOption()) {
                <button mat-flat-button type="button" [disabled]="busy() || !canSendOptions()" (click)="sendOptions()" data-testid="chat-send-options">{{ 'interview.send' | translate }}</button>
              }

              <form class="free" (ngSubmit)="sendText()">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full">
                  <mat-label>{{ (q.type === 'free_text' ? 'interview.comment' : 'interview.ownWords') | translate }}</mat-label>
                  <textarea matInput rows="2" [(ngModel)]="text" name="text" maxlength="2000" data-testid="chat-text"></textarea>
                </mat-form-field>
                <div class="row">
                  <button mat-flat-button type="submit" [disabled]="busy() || !text.trim()" data-testid="chat-send">{{ 'interview.send' | translate }}</button>
                  @if (q.allowAbstain) {
                    <button mat-button type="button" [disabled]="busy()" (click)="send({ kind: 'abstain' })" data-testid="chat-abstain">{{ (q.type === 'free_text' ? 'interview.noComments' : 'interview.abstain') | translate }}</button>
                  }
                </div>
              </form>
              @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
            </section>
          } @else {
            <section class="done" data-testid="chat-done">
              <h1>{{ 'interview.doneTitle' | translate }}</h1>
              <p class="lead">{{ 'interview.doneText' | translate }}</p>
            </section>
          }
        }
      </main>
      <footer class="foot note">SmartAudit efr · powered by Bumii</footer>
    </div>
  `,
  styles: `
    .page { min-height: 100vh; display: flex; flex-direction: column; }
    .top { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; padding: 16px clamp(16px, 5vw, 64px); border-bottom: 1px solid var(--efr-border); }
    .progress { display: flex; flex-direction: column; gap: 6px; min-width: 180px; font-size: 13px; }
    .bar { display: block; height: 6px; background: var(--efr-surface-alt); }
    .bar > span { display: block; height: 100%; background: var(--efr-orange); }
    .chat { flex: 1; width: 100%; max-width: 760px; box-sizing: border-box; padding: 24px clamp(16px, 5vw, 64px); display: flex; flex-direction: column; gap: 20px; }
    .messages { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .msg { max-width: 85%; padding: 12px 16px; background: var(--efr-surface-alt); font-size: 16px; line-height: 1.5; white-space: pre-wrap; }
    .msg.me { align-self: flex-end; background: #fff0e5; }
    .msg.clar { border-left: 4px solid var(--efr-orange); }
    .answer { display: flex; flex-direction: column; gap: 14px; padding-top: 16px; border-top: 1px solid var(--efr-border); }
    .help { margin: 0; font-size: 14px; color: var(--efr-gray-dark); }
    .options { display: flex; flex-wrap: wrap; gap: 8px; }
    .options button { text-transform: none; }
    .options button.picked { border-color: var(--efr-orange) !important; color: var(--efr-orange) !important; }
    .free { display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .full { width: 100%; }
    .foot { padding: 16px clamp(16px, 5vw, 64px); border-top: 1px solid var(--efr-border); }
    @media (max-width: 600px) { .msg { max-width: 100%; } .options button { flex: 1 1 100%; } }
  `,
})
export class InterviewPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly answerArea = viewChild<ElementRef<HTMLElement>>('answerArea');
  readonly state = signal<InterviewStateDto | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly expired = signal(false);
  readonly selected = signal<string[]>([]);
  text = '';
  optionText = '';

  readonly pct = computed(() => {
    const p = this.state()?.progress;
    return p && p.planned ? Math.min(100, (p.answered / p.planned) * 100) : 0;
  });

  /** Option chosen that asks for a complementary text («Otros, ¿cuál?», «compensado…»). */
  readonly freeTextOption = computed(() => {
    const q = this.state()?.question;
    const o = q?.options.find((x) => x.freeText && this.selected().includes(x.code));
    return o?.freeText ?? null;
  });

  async ngOnInit(): Promise<void> {
    try {
      const s = await this.api.get<InterviewStateDto>('/participant/interview');
      await this.i18n.use(s.language, false);
      this.state.set(s);
    } catch {
      this.expired.set(true);
    }
  }

  canSendOptions(): boolean {
    const ft = this.freeTextOption();
    return this.selected().length > 0 && (!ft?.required || !!this.optionText.trim());
  }

  toggle(code: string): void {
    this.selected.update((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));
  }

  /** Single choice: one tap sends it, unless the option asks for a complementary text. */
  pick(q: InterviewQuestionView, code: string): void {
    const option = q.options.find((o) => o.code === code);
    if (option?.freeText) {
      this.selected.set([code]);
      return;
    }
    void this.send({ kind: 'options', optionCodes: [code] });
  }

  sendOptions(): Promise<void> {
    return this.send({ kind: 'options', optionCodes: this.selected(), freeText: this.optionText.trim() || null });
  }

  sendText(): Promise<void> {
    return this.send({ kind: 'text', text: this.text });
  }

  async send(input: Input): Promise<void> {
    const q = this.state()?.question;
    if (!q || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const s = await this.api.post<InterviewStateDto>('/participant/interview/answer', { ...input, questionCode: q.code });
      this.state.set(s);
      this.text = '';
      this.optionText = '';
      this.selected.set([]);
      setTimeout(() => this.answerArea()?.nativeElement.querySelector<HTMLElement>('button, textarea')?.focus());
    } catch (e) {
      const f = toApiFailure(e);
      if (f.code === 'QUESTION_MISMATCH') this.state.set(await this.api.get<InterviewStateDto>('/participant/interview'));
      else this.error.set(this.i18n.error(f.code));
    } finally {
      this.busy.set(false);
    }
  }
}
