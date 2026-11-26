import { JsonPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService, toApiFailure } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import { LANGS, type Language } from '../../core/models';
import { NotifyService } from '../../core/notify.service';

interface QLang {
  lang: Language;
  status: 'approved' | 'pending_approval';
}
interface QuestionView {
  code: string;
  block: string;
  order: number;
  type: string;
  mandatory: boolean;
  text: Partial<Record<Language, string>>;
  help?: Partial<Record<Language, string>> | null;
  answerMode?: 'buttons' | 'text';
  answerHint?: Partial<Record<Language, string>> | null;
  explanation?: Partial<Record<Language, string>> | null;
  maxClarifications?: number;
  options: { code: string; label: Partial<Record<Language, string>> }[];
  activation: unknown;
}
interface QuestionnaireItem {
  _id: string;
  module: string;
  version: number;
  status: 'draft' | 'published';
  title: string | null;
  languages: QLang[];
  questions?: QuestionView[];
}

@Component({
  selector: 'app-questionnaires',
  imports: [FormsModule, JsonPipe, MatButtonModule, TranslatePipe],
  template: `
    <section class="card">
      <div class="page-header">
        <h2>{{ 'config.questionnaires' | translate }} · M1</h2>
        @if (!hasDraft() && selected()) {
          <button mat-stroked-button (click)="newVersion()">{{ 'questionnaires.newVersionFrom' | translate: { v: selected()!.version } }}</button>
        }
      </div>
      <div class="row-actions">
        @for (q of items(); track q._id) {
          <button mat-button [class.selected]="selected()?._id === q._id" (click)="open(q._id)">
            v{{ q.version }} <span class="chip" [class.warn]="q.status === 'draft'">{{ 'config.status.' + q.status | translate }}</span>
          </button>
        }
      </div>
    </section>

    @if (selected(); as q) {
      <section class="card">
        <h2>{{ q.title }} · v{{ q.version }}</h2>
        <h3 class="sub">{{ 'questionnaires.languages' | translate }}</h3>
        <div class="row-actions langs">
          @for (l of q.languages; track l.lang) {
            <span class="chip" [class.warn]="l.status !== 'approved'">{{ 'lang.' + l.lang | translate }} · {{ 'questionnaires.lang.' + l.status | translate }}</span>
            @if (l.status !== 'approved') {
              <button mat-button (click)="approve(l.lang)" [attr.data-testid]="'approve-' + l.lang">{{ 'questionnaires.approve' | translate }}</button>
            }
          }
        </div>
        <p class="muted">{{ 'questionnaires.approvalHelp' | translate }}</p>
        @if (issues().length) {
          <div class="alert error" role="alert">
            @for (i of issues(); track $index) { <div>{{ i | json }}</div> }
          </div>
        }

        <div class="row-actions">
          <div class="segmented" role="group" [attr.aria-label]="'questionnaires.viewIn' | translate">
            @for (l of langs; track l) { <button type="button" [attr.aria-pressed]="viewLang === l" (click)="viewLang = l">{{ l }}</button> }
          </div>
          @if (q.status === 'draft') {
            <button mat-stroked-button (click)="toggleEditor()">{{ 'questionnaires.editJson' | translate }}</button>
            <button mat-flat-button (click)="publish()">{{ 'config.publish' | translate }}</button>
            <button mat-button (click)="remove()">{{ 'config.deleteDraft' | translate }}</button>
          }
        </div>

        @if (editing()) {
          <p class="muted">{{ 'questionnaires.jsonHelp' | translate }}</p>
          <textarea class="code full" rows="24" [(ngModel)]="json" [attr.aria-label]="'questionnaires.editJson' | translate"></textarea>
          <div class="row-actions"><button mat-flat-button (click)="saveJson()">{{ 'common.save' | translate }}</button></div>
        }

        <div class="table-wrap">
          <table class="simple-table">
            <thead>
              <tr>
                <th>{{ 'questionnaires.code' | translate }}</th>
                <th>{{ 'questionnaires.text' | translate }}</th>
                <th>{{ 'questionnaires.type' | translate }}</th>
                <th>{{ 'questionnaires.options' | translate }}</th>
                <th>{{ 'questionnaires.activation' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (question of q.questions ?? []; track question.code) {
                <tr>
                  <td><strong>{{ question.code }}</strong>@if (!question.mandatory) { <div class="chip neutral">{{ 'questionnaires.optional' | translate }}</div> }</td>
                  <td>
                    {{ question.text[viewLang] || '—' }}
                    @if (question.help?.[viewLang]) { <div class="muted small">{{ question.help?.[viewLang] }}</div> }
                    @if (question.answerHint?.[viewLang]) { <div class="small" data-testid="q-hint">{{ question.answerHint?.[viewLang] }}</div> }
                    @if (question.explanation?.[viewLang]) {
                      <div class="muted small" data-testid="q-explanation"><strong>{{ 'questionnaires.explanation' | translate }}:</strong> {{ question.explanation?.[viewLang] }}</div>
                    }
                    @if (question.answerMode === 'text') {
                      <div class="chip neutral">{{ 'questionnaires.conversation' | translate: { n: question.maxClarifications ?? 0 } }}</div>
                    }
                  </td>
                  <td>{{ 'questionnaires.types.' + question.type | translate }}</td>
                  <td class="small">
                    @for (o of question.options; track o.code) { <div><code>{{ o.code }}</code> {{ o.label[viewLang] }}</div> }
                  </td>
                  <td class="small"><code>{{ describe(question.activation) }}</code></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
  `,
  styles: `
    .selected { font-weight: 700; box-shadow: inset 0 -3px 0 var(--efr-orange); }
    .sub { font-size: 14px; margin: 8px 0; }
    .small { font-size: 12px; }
    .langs { margin-bottom: 8px; }
  `,
})
export class QuestionnairesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly i18n = inject(I18nService);
  readonly langs = LANGS;
  readonly items = signal<QuestionnaireItem[]>([]);
  readonly selected = signal<QuestionnaireItem | null>(null);
  readonly editing = signal(false);
  readonly issues = signal<unknown[]>([]);
  readonly hasDraft = computed(() => this.items().some((i) => i.status === 'draft'));
  viewLang: Language = 'es';
  json = '';

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(selectId?: string): Promise<void> {
    const { items } = await this.api.get<{ items: QuestionnaireItem[] }>('/config/questionnaires', { module: 'M1' });
    this.items.set(items);
    const target = items.find((i) => i._id === selectId) ?? items.find((i) => i.status === 'draft') ?? items[0];
    if (target) await this.open(target._id);
  }

  async open(id: string): Promise<void> {
    const { item } = await this.api.get<{ item: QuestionnaireItem }>(`/config/questionnaires/${id}`);
    this.selected.set(item);
    this.editing.set(false);
    this.issues.set([]);
  }

  /** Human-readable activation rule (rules are evaluated in code, never by the AI). */
  describe(a: unknown): string {
    const r = a as { kind: string; question?: string; values?: unknown[]; field?: string; of?: unknown[]; expr?: unknown };
    switch (r.kind) {
      case 'always': return this.i18n.t('questionnaires.always');
      case 'answer_in': return `${r.question} ∈ {${r.values?.join(', ')}}`;
      case 'campaign_in': return `${r.field} ∈ {${r.values?.join(', ')}}`;
      case 'all': return (r.of ?? []).map((x) => this.describe(x)).join(' ∧ ');
      case 'any': return (r.of ?? []).map((x) => this.describe(x)).join(' ∨ ');
      case 'not': return `¬(${this.describe(r.expr)})`;
      default: return JSON.stringify(a);
    }
  }

  toggleEditor(): void {
    this.json = JSON.stringify(this.selected()?.questions ?? [], null, 2);
    this.editing.set(!this.editing());
  }

  async saveJson(): Promise<void> {
    let questions: unknown;
    try {
      questions = JSON.parse(this.json);
    } catch {
      this.notify.code('INVALID_JSON');
      return;
    }
    try {
      const { item } = await this.api.put<{ item: QuestionnaireItem }>(`/config/questionnaires/${this.selected()!._id}`, { questions });
      this.selected.set(item);
      this.editing.set(false);
      this.issues.set([]);
      this.notify.ok('common.saved');
    } catch (e) {
      this.issues.set(((toApiFailure(e).details as { issues?: unknown[] })?.issues as unknown[]) ?? []);
      this.notify.error(e);
    }
  }

  async newVersion(): Promise<void> {
    try {
      const { item } = await this.api.post<{ item: QuestionnaireItem }>(`/config/questionnaires/${this.selected()!._id}/new-version`);
      await this.load(item._id);
    } catch (e) {
      this.notify.error(e);
    }
  }

  async approve(lang: Language): Promise<void> {
    if (!confirm(this.i18n.t('questionnaires.confirmApprove', { lang: this.i18n.t('lang.' + lang) }))) return;
    try {
      const { item } = await this.api.post<{ item: QuestionnaireItem }>(`/config/questionnaires/${this.selected()!._id}/languages/${lang}/approve`);
      this.selected.set(item);
      this.notify.ok('questionnaires.approved');
    } catch (e) {
      this.issues.set(((toApiFailure(e).details as { issues?: unknown[] })?.issues as unknown[]) ?? []);
      this.notify.error(e);
    }
  }

  async publish(): Promise<void> {
    if (!confirm(this.i18n.t('config.confirmPublish'))) return;
    try {
      await this.api.post(`/config/questionnaires/${this.selected()!._id}/publish`);
      this.notify.ok('config.published');
      await this.load();
    } catch (e) {
      this.issues.set(((toApiFailure(e).details as { issues?: unknown[] })?.issues as unknown[]) ?? []);
      this.notify.error(e);
    }
  }

  async remove(): Promise<void> {
    if (!confirm(this.i18n.t('config.confirmDelete'))) return;
    try {
      await this.api.delete(`/config/questionnaires/${this.selected()!._id}`);
      await this.load();
    } catch (e) {
      this.notify.error(e);
    }
  }
}
