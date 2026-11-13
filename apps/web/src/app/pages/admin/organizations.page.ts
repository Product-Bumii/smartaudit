import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { LANGS, type OrganizationDto } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { buildOrgForm, COUNTRIES, supportedTimeZones } from '../../shared/org-form';

@Component({
  selector: 'app-organizations',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, TranslatePipe],
  template: `
    <div class="page-header">
      <div class="titles">
        <div class="eyebrow">{{ 'orgs.eyebrow' | translate }}</div>
        <h1>{{ 'orgs.title' | translate }}</h1>
      </div>
      <button mat-flat-button (click)="showForm.set(!showForm())" data-testid="new-org">{{ 'orgs.new' | translate }}</button>
    </div>

    @if (showForm()) {
      <section class="card">
        <h2>{{ 'orgs.new' | translate }}</h2>
        <form [formGroup]="form" (ngSubmit)="create()">
          <div class="grid-2">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'orgs.name' | translate }}</mat-label>
              <input matInput formControlName="name" data-testid="org-name" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'orgs.country' | translate }}</mat-label>
              <mat-select formControlName="country" (selectionChange)="onCountry($event.value)" data-testid="org-country">
                @for (c of countries; track c.code) {
                  <mat-option [value]="c.code">{{ 'countries.' + c.code | translate }} ({{ c.code }})</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'orgs.timeZone' | translate }}</mat-label>
              <mat-select formControlName="timeZone">
                @for (tz of timeZones; track tz) {
                  <mat-option [value]="tz">{{ tz }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'orgs.defaultLanguage' | translate }}</mat-label>
              <mat-select formControlName="defaultLanguage">
                @for (l of langs; track l) {
                  <mat-option [value]="l">{{ 'lang.' + l | translate }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'orgs.adminEmail' | translate }}</mat-label>
              <input matInput type="email" [formControl]="adminEmail" data-testid="org-admin-email" />
              <mat-hint>{{ 'orgs.adminEmailHint' | translate }}</mat-hint>
            </mat-form-field>
          </div>
          <div class="row-actions">
            <button mat-flat-button type="submit" [disabled]="form.invalid || adminEmail.invalid || busy()" data-testid="org-submit">{{ 'common.create' | translate }}</button>
            <button mat-button type="button" (click)="showForm.set(false)">{{ 'common.cancel' | translate }}</button>
          </div>
        </form>
      </section>
    }

    <section class="card">
      <div class="table-wrap">
        <table class="simple-table">
          <thead>
            <tr>
              <th>{{ 'orgs.name' | translate }}</th>
              <th>{{ 'orgs.country' | translate }}</th>
              <th>{{ 'orgs.timeZone' | translate }}</th>
              <th>{{ 'orgs.defaultLanguage' | translate }}</th>
              <th>{{ 'users.status' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (o of orgs(); track o.id) {
              <tr>
                <td><a class="strong" [routerLink]="['/admin/organizations', o.id]">{{ o.name }}</a></td>
                <td>{{ o.country }}</td>
                <td>{{ o.timeZone }}</td>
                <td>{{ 'lang.' + o.defaultLanguage | translate }}</td>
                <td><span class="chip" [class.neutral]="o.status !== 'active'">{{ 'status.' + o.status | translate }}</span></td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="muted">{{ 'orgs.empty' | translate }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: `.strong { font-weight: 700; }`,
})
export class OrganizationsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly langs = LANGS;
  readonly countries = COUNTRIES;
  readonly timeZones = supportedTimeZones();
  readonly orgs = signal<OrganizationDto[]>([]);
  readonly showForm = signal(false);
  readonly busy = signal(false);
  readonly form = buildOrgForm(this.fb);
  readonly adminEmail = this.fb.nonNullable.control('', [Validators.email]);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    try {
      this.orgs.set((await this.api.get<{ items: OrganizationDto[] }>('/organizations')).items);
    } catch (e) {
      this.notify.error(e);
    }
  }

  onCountry(code: string): void {
    const tz = COUNTRIES.find((c) => c.code === code)?.tz;
    if (tz) this.form.controls.timeZone.setValue(tz);
  }

  async create(): Promise<void> {
    this.busy.set(true);
    try {
      const body = { ...this.form.getRawValue(), ...(this.adminEmail.value ? { adminEmail: this.adminEmail.value } : {}) };
      const res = await this.api.post<{ organization: OrganizationDto }>('/organizations', body);
      this.notify.ok('orgs.created');
      await this.router.navigate(['/admin/organizations', res.organization.id]);
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}
