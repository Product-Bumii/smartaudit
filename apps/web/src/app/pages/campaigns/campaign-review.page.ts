import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import type { LocalizedText, ReviewDecision, ReviewItemDto, ReviewListDto } from '../../core/models';
import { NotifyService } from '../../core/notify.service';

type Filter = 'pending' | 'reviewed' | 'all';
interface Draft {
  decision: ReviewDecision | null;
  codes: string[];
  note: string;
}

/**
 * Review queue (cambios 4 · bloque 2): the answers the AI could not code with enough confidence after its
 * follow-ups. For each one the auditor sees the conversation about that question only and what the AI proposed,
 * and decides the option(s), an abstention or «sin respuesta válida». Nothing identifies the person.
 */
@Component({
  selector: 'app-campaign-review',
  imports: [RouterLink, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, TranslatePipe],
  template: `
    <div class="page-header">
      <div class="titles">
        <a class="back-link" [routerLink]="['/campaigns', id()]">← {{ 'results.backToAudit' | translate }}</a>
        <div class="eyebrow">{{ 'results.eyebrow' | translate }}</div>
        <h1>{{ 'review.title' | translate }}</h1>
      </div>
      <div class="row-actions">
        <a mat-stroked-button [routerLink]="['/campaigns', id(), 'results']">{{ 'review.goResults' | translate }}</a>
      </div>
    </div>
    <div class="alert info" role="note">{{ 'review.confidentiality' | translate }}</div>

    <div class="toolbar">
      <div class="segmented" role="group" [attr.aria-label]="'review.filter' | translate">
        @for (f of filters; track f) {
          <button type="button" [attr.aria-pressed]="filter() === f" (click)="setFilter(f)" [attr.data-testid]="'review-filter-' + f">
            {{ 'review.filters.' + f | translate }}
            @if (list(); as l) { ({{ f === 'all' ? l.counts.pending + l.counts.reviewed : l.counts[f] }}) }
          </button>
        }
      </div>
    </div>

    @if (list(); as l) {
      @if (l.items.length === 0) {
        <div class="card alt" data-testid="review-empty">{{ (filter() === 'pending' ? 'review.emptyPending' : 'review.empty') | translate }}</div>
      }
      @for (group of groups(); track group.code) {
        <section class="card">
          <h2 class="keep-case"><span class="code">{{ group.code }}</span> {{ t(group.text) }}</h2>
          @for (item of group.items; track item.interviewId) {
            <article class="item" data-testid="review-item" [attr.data-question]="item.questionCode">
              <div class="meta">
                @if (item.followUpReason) { <span class="chip" data-testid="review-reason">{{ 'review.reason.' + item.followUpReason | translate }}</span> }
                <span class="chip neutral">{{ 'review.followUps' | translate: { n: item.clarificationsUsed } }}</span>
                <span class="chip neutral">{{ 'lang.' + item.language | translate }}</span>
                @if (item.review) { <span class="chip solid" data-testid="review-done">{{ 'review.decided' | translate }}</span> }
              </div>
              <ol class="thread" [attr.aria-label]="'review.conversation' | translate">
                @for (m of item.thread; track $index) {
                  <li [class.me]="m.role === 'participant'"><span class="who">{{ (m.role === 'participant' ? 'review.person' : 'review.ai') | translate }}</span>{{ m.text }}</li>
                }
              </ol>
              <p class="ai">
                {{ 'review.aiProposal' | translate }}:
                <strong>{{ item.aiCodes.length ? labels(item, item.aiCodes) : ('review.noProposal' | translate) }}</strong>
                @if (item.confidence !== null) { · {{ 'review.confidence' | translate }} {{ num(item.confidence, 2) }} }
              </p>

              <fieldset class="decision" [attr.aria-label]="'review.decision' | translate">
                <legend>{{ 'review.decision' | translate }}</legend>
                <div class="choices">
                  @for (o of item.options; track o.code) {
                    <label class="choice">
                      <input
                        [type]="item.questionType === 'multi' ? 'checkbox' : 'radio'"
                        [name]="'d-' + key(item)"
                        [checked]="draftOf(item).decision === 'codes' && draftOf(item).codes.includes(o.code)"
                        (change)="pick(item, o.code)"
                        [attr.data-testid]="'review-option-' + o.code"
                      />
                      {{ t(o.label) }}
                    </label>
                  }
                  <label class="choice other">
                    <input type="radio" [name]="'d-' + key(item)" [checked]="draftOf(item).decision === 'abstention'" (change)="decide(item, 'abstention')" data-testid="review-abstention" />
                    {{ 'review.abstention' | translate }}
                  </label>
                  <label class="choice other">
                    <input type="radio" [name]="'d-' + key(item)" [checked]="draftOf(item).decision === 'no_valid_answer'" (change)="decide(item, 'no_valid_answer')" data-testid="review-no-valid" />
                    {{ 'review.noValid' | translate }}
                  </label>
                </div>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full">
                  <mat-label>{{ 'review.note' | translate }}</mat-label>
                  <input matInput [ngModel]="draftOf(item).note" (ngModelChange)="setNote(item, $event)" maxlength="1000" data-testid="review-note" />
                </mat-form-field>
                <div class="row-actions">
                  <button mat-flat-button type="button" [disabled]="busy() || !canSave(item)" (click)="save(item)" data-testid="review-save">{{ 'review.save' | translate }}</button>
                  @if (item.review) { <span class="muted">{{ 'review.reviewedAt' | translate: { when: item.review.reviewedAt.slice(0, 10) } }}</span> }
                </div>
              </fieldset>
            </article>
          }
        </section>
      }
    }
  `,
  styles: `
    .toolbar { margin: 8px 0 24px; }
    h2 { font-size: 19px; }
    .code { color: var(--efr-orange); margin-right: 6px; }
    .item { padding: 20px 0; border-top: 1px solid var(--efr-border); display: flex; flex-direction: column; gap: 14px; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; }
    .thread { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .thread li { max-width: 80%; padding: 10px 14px; background: var(--efr-surface-alt); font-size: 15px; line-height: 1.5; white-space: pre-wrap; }
    .thread li.me { align-self: flex-end; background: #fff0e5; }
    .who { display: block; font-size: 12px; color: var(--efr-gray-mid); margin-bottom: 2px; }
    .ai { margin: 0; font-size: 15px; }
    .decision { border: 1px solid var(--efr-border); padding: 16px; margin: 0; display: flex; flex-direction: column; gap: 14px; }
    .decision legend { font-weight: 700; font-size: 14px; padding: 0 6px; }
    .choices { display: flex; flex-wrap: wrap; gap: 10px 20px; }
    .choice { display: inline-flex; gap: 8px; align-items: center; font-size: 15px; cursor: pointer; }
    .choice.other { color: var(--efr-gray-dark); }
    @media (max-width: 720px) { .thread li { max-width: 100%; } }
  `,
})
export class CampaignReviewPage implements OnInit {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly i18n = inject(I18nService);

  readonly filters: Filter[] = ['pending', 'reviewed', 'all'];
  readonly filter = signal<Filter>('pending');
  readonly list = signal<ReviewListDto | null>(null);
  readonly busy = signal(false);
  private readonly drafts = signal<Record<string, Draft>>({});

  /** Items grouped by question, in questionnaire order (the API already sorts them). */
  readonly groups = computed(() => {
    const out: { code: string; text: LocalizedText; items: ReviewItemDto[] }[] = [];
    for (const item of this.list()?.items ?? []) {
      const g = out.find((x) => x.code === item.questionCode);
      if (g) g.items.push(item);
      else out.push({ code: item.questionCode, text: item.questionText, items: [item] });
    }
    return out;
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async setFilter(f: Filter): Promise<void> {
    this.filter.set(f);
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      const l = await this.api.get<ReviewListDto>(`/campaigns/${this.id()}/review?state=${this.filter()}`);
      this.list.set(l);
      const drafts: Record<string, Draft> = {};
      for (const item of l.items) {
        drafts[this.key(item)] = item.review
          ? { decision: item.review.decision, codes: [...item.review.optionCodes], note: item.review.note ?? '' }
          : { decision: item.aiCodes.length ? 'codes' : null, codes: [...item.aiCodes], note: '' };
      }
      this.drafts.set(drafts);
    } catch (e) {
      this.notify.error(e);
    }
  }

  key(item: ReviewItemDto): string {
    return `${item.interviewId}:${item.questionCode}`;
  }

  draftOf(item: ReviewItemDto): Draft {
    return this.drafts()[this.key(item)] ?? { decision: null, codes: [], note: '' };
  }

  private update(item: ReviewItemDto, change: Partial<Draft>): void {
    this.drafts.update((d) => ({ ...d, [this.key(item)]: { ...this.draftOf(item), ...change } }));
  }

  pick(item: ReviewItemDto, code: string): void {
    const d = this.draftOf(item);
    if (item.questionType !== 'multi') return this.update(item, { decision: 'codes', codes: [code] });
    const current = d.decision === 'codes' ? d.codes : [];
    const codes = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
    this.update(item, { decision: codes.length ? 'codes' : null, codes });
  }

  decide(item: ReviewItemDto, decision: ReviewDecision): void {
    this.update(item, { decision, codes: [] });
  }

  setNote(item: ReviewItemDto, note: string): void {
    this.update(item, { note });
  }

  canSave(item: ReviewItemDto): boolean {
    const d = this.draftOf(item);
    return d.decision !== null && (d.decision !== 'codes' || d.codes.length > 0);
  }

  async save(item: ReviewItemDto): Promise<void> {
    const d = this.draftOf(item);
    this.busy.set(true);
    try {
      await this.api.put(`/campaigns/${this.id()}/review/${item.interviewId}/${item.questionCode}`, {
        decision: d.decision,
        optionCodes: d.decision === 'codes' ? d.codes : [],
        note: d.note.trim() || undefined,
      });
      this.notify.ok('review.saved');
      await this.load();
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.busy.set(false);
    }
  }

  num(value: number, digits: number): string {
    return value.toLocaleString(this.i18n.lang(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  t(text: LocalizedText): string {
    return text[this.i18n.lang()] ?? text.es ?? '';
  }

  labels(item: ReviewItemDto, codes: string[]): string {
    return codes.map((c) => this.t(item.options.find((o) => o.code === c)?.label ?? { es: c })).join(' · ');
  }
}
