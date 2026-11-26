import { Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import type { CommentsDto, LocalizedText, ResponseRow, ResponsesDto } from '../../core/models';
import { NotifyService } from '../../core/notify.service';

const DIMENSIONS = ['sex', 'ageBand', 'workCenter', 'jobType', 'seniorityBand', 'area', 'shifts', 'telework', 'dependents', 'rlpt'] as const;

/**
 * Individual answers (cambios 4 · bloque 2, section 5.6). Nothing is loaded until the auditor accepts the
 * confidentiality notice; each load is recorded by the API. Rows carry demographics and coded answers only (no
 * identity, file row or date, not in interview order). Open answers are listed apart, without demographics.
 */
@Component({
  selector: 'app-campaign-responses',
  imports: [RouterLink, MatButtonModule, TranslatePipe],
  template: `
    <div class="page-header">
      <div class="titles">
        <a class="back-link" [routerLink]="['/campaigns', id()]">← {{ 'results.backToAudit' | translate }}</a>
        <div class="eyebrow">{{ 'results.eyebrow' | translate }}</div>
        <h1>{{ 'responses.title' | translate }}</h1>
      </div>
      <div class="row-actions">
        <a mat-stroked-button [routerLink]="['/campaigns', id(), 'results']">{{ 'review.goResults' | translate }}</a>
      </div>
    </div>

    @if (!data()) {
      <section class="card" data-testid="responses-notice">
        <h2>{{ 'responses.noticeTitle' | translate }}</h2>
        <p class="lead">{{ 'responses.notice' | translate }}</p>
        <ul class="muted">
          <li>{{ 'responses.notice1' | translate }}</li>
          <li>{{ 'responses.notice2' | translate }}</li>
          <li>{{ 'responses.notice3' | translate }}</li>
        </ul>
        <button mat-flat-button type="button" [disabled]="busy()" (click)="open()" data-testid="responses-accept">{{ 'responses.accept' | translate }}</button>
      </section>
    } @else {
      @if (data(); as d) {
        @if (d.smallGroups.length) {
          <div class="alert warn" role="status" data-testid="responses-small-groups">
            {{ 'sample.smallGroups' | translate }}
            @for (g of d.smallGroups; track g.field + g.value) { <span class="chip">{{ 'demographics.' + g.field | translate }}: {{ g.value }} ({{ g.count }})</span> }
          </div>
        }
        <section class="card">
          <h2>{{ 'responses.closedTitle' | translate: { n: d.rows.length } }}</h2>
          <p class="muted">{{ 'responses.legend' | translate }}</p>
          <div class="table-wrap">
            <table class="simple-table dense" data-testid="responses-table">
              <thead>
                <tr>
                  @for (k of dims; track k) { <th>{{ 'demographics.' + k | translate }}</th> }
                  @for (q of d.questions; track q.code) { <th [attr.title]="t(q.text)">{{ q.code }}</th> }
                </tr>
              </thead>
              <tbody>
                @for (row of d.rows; track $index) {
                  <tr data-testid="responses-row">
                    @for (k of dims; track k) { <td>{{ dim(row, k) }}</td> }
                    @for (q of d.questions; track q.code) {
                      <td [class.reviewed]="row.answers[q.code]?.reviewed" [class.pending]="row.answers[q.code]?.kind === 'pending'">{{ cell(row, q) }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
      @if (comments(); as c) {
        <section class="card" id="comments" data-testid="responses-comments">
          <h2>{{ 'responses.commentsTitle' | translate }}</h2>
          <p class="muted">{{ 'responses.commentsNote' | translate }}</p>
          @for (q of c.questions; track q.code) {
            <h3 class="keep-case"><span class="code">{{ q.code }}</span> {{ t(q.text) }} <span class="muted">({{ q.comments.length }})</span></h3>
            @if (q.comments.length) {
              <ul class="comments">@for (txt of q.comments; track $index) { <li>{{ txt }}</li> }</ul>
            } @else {
              <p class="muted">{{ 'responses.noComments' | translate }}</p>
            }
          }
        </section>
      }
    }
  `,
  styles: `
    h3 { font-size: 16px; margin: 20px 0 10px; }
    .code { color: var(--efr-orange); margin-right: 6px; }
    .dense th, .dense td { padding: 10px 10px 10px 0; font-size: 13px; white-space: nowrap; }
    td.reviewed { font-weight: 700; }
    td.pending { color: var(--efr-orange); }
    .comments { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 15px; }
  `,
})
export class CampaignResponsesPage {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly i18n = inject(I18nService);
  readonly data = signal<ResponsesDto | null>(null);
  readonly comments = signal<CommentsDto | null>(null);
  readonly busy = signal(false);
  readonly dims = DIMENSIONS;

  /** After the confidentiality notice: each load is an access recorded by the API. */
  async open(): Promise<void> {
    this.busy.set(true);
    try {
      const [rows, comments] = await Promise.all([
        this.api.get<ResponsesDto>(`/campaigns/${this.id()}/responses`),
        this.api.get<CommentsDto>(`/campaigns/${this.id()}/comments`),
      ]);
      this.data.set(rows);
      this.comments.set(comments);
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.busy.set(false);
    }
  }

  t(text: LocalizedText): string {
    return text[this.i18n.lang()] ?? text.es ?? '';
  }

  dim(row: ResponseRow, k: string): string {
    const v = row.demographics[k];
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return this.i18n.t(v ? 'common.yes' : 'common.no');
    return String(v);
  }

  /** Effective coded answer: option label(s), abstention, «sin respuesta válida» or pending review. */
  cell(row: ResponseRow, q: ResponsesDto['questions'][number]): string {
    const a = row.answers[q.code];
    if (!a) return '';
    if (a.kind === 'abstention') return this.i18n.t('responses.abstention');
    if (a.kind === 'no_valid_answer') return this.i18n.t('responses.noValid');
    if (a.kind === 'pending') return this.i18n.t('responses.pending');
    return a.codes.map((c) => this.t(q.options.find((o) => o.code === c)?.label ?? { es: c })).join(' · ');
  }
}
