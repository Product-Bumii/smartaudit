import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService, toApiFailure } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import { NotifyService } from '../../core/notify.service';

interface Bracket {
  min: number;
  max: number | null;
  required: number;
  rangeMax?: number | null;
}
interface SamplingTable {
  _id: string;
  version: number;
  status: 'draft' | 'published';
  publishedAt: string | null;
  brackets: Bracket[];
  notes?: string | null;
}

@Component({
  selector: 'app-sampling-tables',
  imports: [FormsModule, DatePipe, DecimalPipe, MatButtonModule, TranslatePipe],
  template: `
    <section class="card">
      <div class="page-header">
        <h2>{{ 'config.samplingTables' | translate }}</h2>
        @if (!hasDraft()) {
          <button mat-stroked-button (click)="newVersion()">{{ 'config.newVersion' | translate }}</button>
        }
      </div>
      <p class="muted">{{ 'sampling.help' | translate }}</p>
      <div class="versions row-actions">
        @for (t of tables(); track t._id) {
          <button mat-button [class.selected]="selected()?._id === t._id" (click)="select(t)">
            v{{ t.version }} <span class="chip" [class.warn]="t.status === 'draft'">{{ 'config.status.' + t.status | translate }}</span>
          </button>
        }
      </div>
    </section>

    @if (selected(); as t) {
      <section class="card">
        <h2>v{{ t.version }} · {{ 'config.status.' + t.status | translate }}
          @if (t.publishedAt) { <span class="muted small">· {{ t.publishedAt | date: 'mediumDate' }}</span> }
        </h2>
        @if (t.notes) { <p class="muted">{{ t.notes }}</p> }
        <div class="table-wrap">
          <table class="simple-table">
            <thead>
              <tr>
                <th>{{ 'sampling.from' | translate }}</th>
                <th>{{ 'sampling.to' | translate }}</th>
                <th>{{ 'sampling.required' | translate }}</th>
                <th>{{ 'sampling.rangeMax' | translate }}</th>
                @if (editable()) { <th></th> }
              </tr>
            </thead>
            <tbody>
              @for (b of rows(); track $index; let i = $index) {
                <tr>
                  @if (editable()) {
                    <td><input type="number" min="1" [(ngModel)]="b.min" [attr.aria-label]="'sampling.from' | translate" /></td>
                    <td><input type="number" min="1" [ngModel]="b.max" (ngModelChange)="b.max = $event === '' || $event === null ? null : +$event" [attr.aria-label]="'sampling.to' | translate" [placeholder]="'sampling.openEnded' | translate" /></td>
                    <td><input type="number" min="1" [(ngModel)]="b.required" [attr.aria-label]="'sampling.required' | translate" /></td>
                    <td><input type="number" min="1" [ngModel]="b.rangeMax" (ngModelChange)="b.rangeMax = $event === '' || $event === null ? null : +$event" [attr.aria-label]="'sampling.rangeMax' | translate" /></td>
                    <td><button mat-button (click)="removeRow(i)">{{ 'common.delete' | translate }}</button></td>
                  } @else {
                    <td>{{ b.min | number }}</td>
                    <td>{{ b.max === null ? ('sampling.openEnded' | translate) : (b.max | number) }}</td>
                    <td>{{ b.required }}</td>
                    <td>{{ b.rangeMax ?? '—' }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (issues().length) {
          <div class="alert error" role="alert">
            @for (i of issues(); track $index) { <div>{{ 'sampling.issues.' + i.code | translate: { row: (i.index ?? 0) + 1 } }}</div> }
          </div>
        }
        @if (editable()) {
          <div class="row-actions">
            <button mat-button (click)="addRow()">{{ 'sampling.addRow' | translate }}</button>
            <button mat-stroked-button (click)="save()">{{ 'common.save' | translate }}</button>
            <button mat-flat-button (click)="publish()">{{ 'config.publish' | translate }}</button>
            <button mat-button color="warn" (click)="remove()">{{ 'config.deleteDraft' | translate }}</button>
          </div>
        }
      </section>
    }
  `,
  styles: `
    .selected { font-weight: 700; box-shadow: inset 0 -3px 0 var(--efr-orange); }
    input[type='number'] { width: 110px; padding: 6px; border: 1px solid var(--efr-border); border-radius: 6px; font: inherit; }
    .small { font-size: 13px; font-weight: 400; }
  `,
})
export class SamplingTablesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly i18n = inject(I18nService);
  readonly tables = signal<SamplingTable[]>([]);
  readonly selected = signal<SamplingTable | null>(null);
  readonly rows = signal<Bracket[]>([]);
  readonly issues = signal<{ code: string; index?: number }[]>([]);
  readonly hasDraft = computed(() => this.tables().some((t) => t.status === 'draft'));
  readonly editable = computed(() => this.selected()?.status === 'draft');

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(selectId?: string): Promise<void> {
    const { items } = await this.api.get<{ items: SamplingTable[] }>('/config/sampling-tables');
    this.tables.set(items);
    const target = items.find((t) => t._id === selectId) ?? items.find((t) => t.status === 'draft') ?? items[0];
    if (target) this.select(target);
  }

  select(t: SamplingTable): void {
    this.selected.set(t);
    this.rows.set(t.brackets.map((b) => ({ ...b, rangeMax: b.rangeMax ?? null })));
    this.issues.set([]);
  }

  addRow(): void {
    this.rows.update((r) => [...r, { min: 1, max: null, required: 1, rangeMax: null }]);
  }
  removeRow(i: number): void {
    this.rows.update((r) => r.filter((_, idx) => idx !== i));
  }

  private payload() {
    return { brackets: this.rows().map((b) => ({ min: +b.min, max: b.max === null ? null : +b.max, required: +b.required, rangeMax: b.rangeMax == null ? null : +b.rangeMax })) };
  }

  async newVersion(): Promise<void> {
    const published = this.tables().find((t) => t.status === 'published');
    try {
      const res = await this.api.post<{ item: SamplingTable }>('/config/sampling-tables', { brackets: published?.brackets ?? [{ min: 1, max: null, required: 1 }] });
      await this.load(res.item._id);
    } catch (e) {
      this.notify.error(e);
    }
  }

  async save(): Promise<void> {
    try {
      const res = await this.api.put<{ item: SamplingTable; issues: { code: string; index?: number }[] }>(`/config/sampling-tables/${this.selected()!._id}`, this.payload());
      this.issues.set(res.issues);
      this.notify.ok('common.saved');
    } catch (e) {
      this.notify.error(e);
    }
  }

  async publish(): Promise<void> {
    if (!confirm(this.i18n.t('config.confirmPublish'))) return;
    try {
      await this.save();
      await this.api.post(`/config/sampling-tables/${this.selected()!._id}/publish`);
      this.notify.ok('config.published');
      await this.load();
    } catch (e) {
      const f = toApiFailure(e);
      this.issues.set((f.details as { issues?: { code: string; index?: number }[] })?.issues ?? []);
      this.notify.error(e);
    }
  }

  async remove(): Promise<void> {
    if (!confirm(this.i18n.t('config.confirmDelete'))) return;
    try {
      await this.api.delete(`/config/sampling-tables/${this.selected()!._id}`);
      await this.load();
    } catch (e) {
      this.notify.error(e);
    }
  }
}
