import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import { NotifyService } from '../../core/notify.service';
import { COUNTRIES } from '../../shared/org-form';

interface Calendar {
  _id: string;
  country: string;
  year: number;
  version: number;
  status: 'draft' | 'published';
  officialDates: string[];
  overrides: { add: string[]; remove: string[] };
  dates: string[];
}

@Component({
  selector: 'app-holidays',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, TranslatePipe],
  template: `
    <section class="card">
      <h2>{{ 'config.holidays' | translate }}</h2>
      <p class="muted">{{ 'holidays.help' | translate }}</p>
      <div class="row-actions">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'orgs.country' | translate }}</mat-label>
          <mat-select [(ngModel)]="country" (selectionChange)="load()">
            @for (c of countries; track c.code) { <mat-option [value]="c.code">{{ 'countries.' + c.code | translate }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="year">
          <mat-label>{{ 'holidays.year' | translate }}</mat-label>
          <input matInput type="number" [(ngModel)]="year" (change)="load()" />
        </mat-form-field>
        <button mat-stroked-button (click)="generate()" [disabled]="hasDraft()">{{ 'holidays.generate' | translate }}</button>
      </div>
      <div class="row-actions">
        @for (c of calendars(); track c._id) {
          <button mat-button [class.selected]="selected()?._id === c._id" (click)="selected.set(c)">
            v{{ c.version }} <span class="chip" [class.warn]="c.status === 'draft'">{{ 'config.status.' + c.status | translate }}</span>
          </button>
        } @empty {
          <span class="muted">{{ 'holidays.none' | translate }}</span>
        }
      </div>
    </section>

    @if (selected(); as c) {
      <section class="card">
        <h2>{{ 'countries.' + c.country | translate }} {{ c.year }} · v{{ c.version }}</h2>
        <div class="table-wrap">
          <table class="simple-table">
            <thead><tr><th>{{ 'holidays.date' | translate }}</th><th>{{ 'holidays.origin' | translate }}</th><th></th></tr></thead>
            <tbody>
              @for (d of allDates(); track d.date) {
                <tr [class.removed]="d.removed">
                  <td>{{ d.date }}</td>
                  <td>{{ (d.manual ? 'holidays.manual' : 'holidays.official') | translate }} @if (d.removed) { · {{ 'holidays.workingDay' | translate }} }</td>
                  <td>
                    @if (c.status === 'draft') {
                      @if (d.manual) { <button mat-button (click)="unAdd(d.date)">{{ 'common.delete' | translate }}</button> }
                      @else { <button mat-button (click)="toggleRemove(d.date)">{{ (d.removed ? 'holidays.restore' : 'holidays.markWorking') | translate }}</button> }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (c.status === 'draft') {
          <div class="row-actions">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'holidays.addDate' | translate }}</mat-label>
              <input matInput type="date" [(ngModel)]="newDate" />
            </mat-form-field>
            <button mat-stroked-button (click)="addDate()" [disabled]="!newDate">{{ 'common.add' | translate }}</button>
            <button mat-flat-button (click)="publish()">{{ 'config.publish' | translate }}</button>
            <button mat-button (click)="remove()">{{ 'config.deleteDraft' | translate }}</button>
          </div>
        }
      </section>
    }
  `,
  styles: `
    .selected { font-weight: 700; box-shadow: inset 0 -3px 0 var(--efr-orange); }
    .year { width: 120px; }
    tr.removed td:first-child { text-decoration: line-through; color: var(--efr-gray-mid); }
  `,
})
export class HolidaysPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly i18n = inject(I18nService);
  readonly countries = COUNTRIES;
  readonly calendars = signal<Calendar[]>([]);
  readonly selected = signal<Calendar | null>(null);
  readonly hasDraft = computed(() => this.calendars().some((c) => c.status === 'draft'));
  readonly allDates = computed(() => {
    const c = this.selected();
    if (!c) return [];
    const removed = new Set(c.overrides.remove);
    return [
      ...c.officialDates.map((date) => ({ date, manual: false, removed: removed.has(date) })),
      ...c.overrides.add.map((date) => ({ date, manual: true, removed: false })),
    ].sort((a, b) => a.date.localeCompare(b.date));
  });
  country = 'ES';
  year = new Date().getFullYear();
  newDate = '';

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(selectId?: string): Promise<void> {
    const { items } = await this.api.get<{ items: Calendar[] }>('/config/holidays', { country: this.country, year: this.year });
    this.calendars.set(items);
    this.selected.set(items.find((c) => c._id === selectId) ?? items.find((c) => c.status === 'draft') ?? items[0] ?? null);
  }

  async generate(): Promise<void> {
    try {
      const { item } = await this.api.post<{ item: Calendar }>('/config/holidays', { country: this.country, year: +this.year });
      await this.load(item._id);
    } catch (e) {
      this.notify.error(e);
    }
  }

  private async saveOverrides(overrides: { add: string[]; remove: string[] }): Promise<void> {
    try {
      const { item } = await this.api.put<{ item: Calendar }>(`/config/holidays/${this.selected()!._id}`, overrides);
      this.selected.set(item);
      this.calendars.update((list) => list.map((c) => (c._id === item._id ? item : c)));
    } catch (e) {
      this.notify.error(e);
    }
  }

  addDate(): void {
    const o = this.selected()!.overrides;
    void this.saveOverrides({ add: [...new Set([...o.add, this.newDate])], remove: o.remove });
    this.newDate = '';
  }
  unAdd(date: string): void {
    const o = this.selected()!.overrides;
    void this.saveOverrides({ add: o.add.filter((d) => d !== date), remove: o.remove });
  }
  toggleRemove(date: string): void {
    const o = this.selected()!.overrides;
    const remove = o.remove.includes(date) ? o.remove.filter((d) => d !== date) : [...o.remove, date];
    void this.saveOverrides({ add: o.add, remove });
  }

  async publish(): Promise<void> {
    if (!confirm(this.i18n.t('config.confirmPublish'))) return;
    try {
      await this.api.post(`/config/holidays/${this.selected()!._id}/publish`);
      this.notify.ok('config.published');
      await this.load();
    } catch (e) {
      this.notify.error(e);
    }
  }

  async remove(): Promise<void> {
    if (!confirm(this.i18n.t('config.confirmDelete'))) return;
    try {
      await this.api.delete(`/config/holidays/${this.selected()!._id}`);
      await this.load();
    } catch (e) {
      this.notify.error(e);
    }
  }
}
