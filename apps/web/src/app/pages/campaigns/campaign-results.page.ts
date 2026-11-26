import { Component, inject, input, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import type { CampaignResultsDto, LocalizedText } from '../../core/models';
import { NotifyService } from '../../core/notify.service';

const SEXES = ['Mujer', 'Hombre', 'Otro', 'No indica'] as const;
const AGES = ['<30', '30-40', '41-50', '51-60', '>60'] as const;

/**
 * Results of the audit (cambios 4 · bloque 1): section 7.1 and one table per question. Everything is calculated by
 * the API with the deterministic code of packages/shared; this page only shows it. Percentages over valid answers,
 * always with n, abstentions, «sin respuesta válida» and answers still waiting for review.
 */
@Component({
  selector: 'app-campaign-results',
  imports: [RouterLink, MatButtonModule, TranslatePipe],
  template: `
    <div class="page-header">
      <div class="titles">
        <a class="back-link" [routerLink]="['/campaigns', id()]">← {{ 'results.backToAudit' | translate }}</a>
        <div class="eyebrow">{{ 'results.eyebrow' | translate }}</div>
        <h1>{{ 'results.title' | translate }}</h1>
      </div>
      <div class="row-actions">
        <a mat-stroked-button [routerLink]="['/campaigns', id(), 'review']" data-testid="go-review">{{ 'results.goReview' | translate }}</a>
        <a mat-stroked-button [routerLink]="['/campaigns', id(), 'responses']">{{ 'results.goResponses' | translate }}</a>
      </div>
    </div>

    @if (results(); as r) {
      @if (r.pendingReview > 0) {
        <div class="alert warn" role="status" data-testid="results-pending">
          {{ 'results.pendingAlert' | translate: { n: r.pendingReview } }}
          <a [routerLink]="['/campaigns', id(), 'review']">{{ 'results.goReview' | translate }}</a>
        </div>
      }
      <p class="muted">{{ 'results.howCalculated' | translate }}</p>

      <div class="stats">
        <div class="stat"><span class="value" data-testid="results-completed">{{ r.completed }}</span><span class="label">{{ 'results.completed' | translate }}</span></div>
        <div class="stat"><span class="value" data-testid="results-pending-count">{{ r.pendingReview }}</span><span class="label">{{ 'results.pendingReview' | translate }}</span></div>
        <div class="stat"><span class="value small">v{{ r.questionnaireVersion ?? '—' }}</span><span class="label">{{ 'campaigns.questionnaire' | translate }}</span></div>
      </div>

      <section class="card" data-testid="results-71">
        <h2 class="section-title">{{ 'results.section71' | translate }}</h2>
        <div class="table-wrap">
          <table class="simple-table">
            <thead><tr><th>{{ 'results.modality' | translate }}</th><th class="num">{{ 'results.interviews' | translate }}</th></tr></thead>
            <tbody><tr><td>{{ 'results.modalityAi' | translate }}</td><td class="num">{{ r.section71.interviews }}</td></tr></tbody>
          </table>
        </div>
        <h3>{{ 'results.bySexAndAge' | translate }}</h3>
        <div class="table-wrap">
          <table class="simple-table" data-testid="results-sex-age">
            <thead>
              <tr>
                <th>{{ 'demographics.sex' | translate }} / {{ 'demographics.ageBand' | translate }}</th>
                @for (a of ages; track a) { <th class="num">{{ a }}</th> }
                <th class="num">{{ 'results.total' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (s of sexes; track s) {
                <tr>
                  <td>{{ s }}</td>
                  @for (a of ages; track a) { <td class="num">{{ r.section71.demographics.sexByAge[s][a] }}</td> }
                  <td class="num strong">{{ r.section71.demographics.bySex[s] }}</td>
                </tr>
              }
              <tr class="total">
                <td>{{ 'results.total' | translate }}</td>
                @for (a of ages; track a) { <td class="num">{{ r.section71.demographics.byAge[a] }}</td> }
                <td class="num">{{ r.completed }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2 class="section-title">{{ 'results.section72' | translate }}</h2>
        @for (q of r.questions; track q.code) {
          <article class="question" [attr.data-question]="q.code" data-testid="results-question">
            <h3 class="keep-case"><span class="code">{{ q.code }}</span> {{ t(q.text) }}</h3>
            @if (q.answered === 0) {
              <p class="muted">{{ 'results.notAsked' | translate }}</p>
            } @else if (q.type === 'free_text') {
              <p class="muted">{{ 'results.comments' | translate: { n: q.comments } }} · <a [routerLink]="['/campaigns', id(), 'responses']" fragment="comments">{{ 'results.seeComments' | translate }}</a></p>
            } @else {
              <div class="table-wrap">
                <table class="simple-table">
                  <thead><tr><th>{{ 'results.option' | translate }}</th><th class="num">{{ 'results.count' | translate }}</th><th class="num">%</th></tr></thead>
                  <tbody>
                    @for (o of q.options; track o.code) {
                      <tr [class.excluded]="o.excludedFromBase">
                        <td>{{ t(o.label) }} @if (o.excludedFromBase) { <span class="chip neutral">{{ 'results.outOfBase' | translate }}</span> }</td>
                        <td class="num">{{ o.count }}</td>
                        <td class="num strong">{{ pct(o.percent) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <p class="base">
                <strong>n = {{ q.valid }}</strong>
                · {{ 'results.abstentions' | translate: { n: q.abstentions } }}
                @if (q.noValidAnswer) { · {{ 'results.noValid' | translate: { n: q.noValidAnswer } }} }
                @if (q.pendingReview) { · <span class="pending">{{ 'results.pendingN' | translate: { n: q.pendingReview } }}</span> }
                @if (q.outsideCondition) { · {{ 'results.outsideCondition' | translate: { n: q.outsideCondition } }} }
              </p>
              @if (q.type === 'multi') { <p class="note">{{ 'results.multiNote' | translate }}</p> }
              @for (entry of texts(q.optionTexts); track entry.code) {
                @if (entry.texts.length) {
                  <details class="texts">
                    <summary>{{ 'results.optionTexts' | translate: { option: optionLabel(q, entry.code), n: entry.texts.length } }}</summary>
                    <ul>@for (txt of entry.texts; track $index) { <li>{{ txt }}</li> }</ul>
                  </details>
                }
              }
            }
          </article>
        }
      </section>
    }
  `,
  styles: `
    h3 { font-size: 17px; margin: 24px 0 12px; }
    .num { text-align: right !important; white-space: nowrap; }
    .strong { font-weight: 700; }
    .total td { font-weight: 700; }
    .question { padding: 8px 0 24px; border-bottom: 1px solid var(--efr-border); }
    .question:last-child { border-bottom: 0; }
    .code { color: var(--efr-orange); margin-right: 6px; }
    .base { font-size: 14px; margin: 10px 0 0; }
    .pending { color: var(--efr-orange); font-weight: 700; }
    .excluded td { color: var(--efr-gray-mid); }
    .texts { margin-top: 10px; font-size: 14px; }
    .texts summary { cursor: pointer; }
  `,
})
export class CampaignResultsPage implements OnInit {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly i18n = inject(I18nService);
  readonly results = signal<CampaignResultsDto | null>(null);
  readonly sexes = SEXES;
  readonly ages = AGES;

  async ngOnInit(): Promise<void> {
    try {
      this.results.set(await this.api.get<CampaignResultsDto>(`/campaigns/${this.id()}/results`));
    } catch (e) {
      this.notify.error(e);
    }
  }

  /** One decimal, in the format of the interface language (the value is already rounded by the API). */
  pct(value: number | null): string {
    return value === null ? '—' : `${value.toLocaleString(this.i18n.lang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  }

  t(text: LocalizedText): string {
    return text[this.i18n.lang()] ?? text.es ?? '';
  }

  optionLabel(q: CampaignResultsDto['questions'][number], code: string): string {
    const o = q.options.find((x) => x.code === code);
    return o ? this.t(o.label) : code;
  }

  texts(map: Record<string, string[]>): { code: string; texts: string[] }[] {
    return Object.entries(map).map(([code, texts]) => ({ code, texts }));
  }
}
