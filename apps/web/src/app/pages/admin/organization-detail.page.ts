import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { LANGS, type OrganizationDto } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { buildOrgForm, COUNTRIES, supportedTimeZones } from '../../shared/org-form';
import { UserListComponent } from '../../shared/user-list.component';

@Component({
  selector: 'app-organization-detail',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, TranslatePipe, UserListComponent],
  template: `
    <div class="page-header">
      <div class="titles">
        <a class="back-link" routerLink="/admin/organizations">← {{ 'orgs.title' | translate }}</a>
        <div class="eyebrow">{{ 'orgs.eyebrow' | translate }}</div>
        <h1 class="keep-case">{{ org()?.name }}</h1>
      </div>
      @if (org(); as o) {
        <button mat-stroked-button (click)="toggleStatus(o)">{{ (o.status === 'active' ? 'orgs.deactivate' : 'orgs.activate') | translate }}</button>
      }
    </div>

    @if (org(); as o) {
      <section class="card">
        <h2>{{ 'orgs.details' | translate }}</h2>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="grid-2">
            <mat-form-field appearance="outline"><mat-label>{{ 'orgs.name' | translate }}</mat-label><input matInput formControlName="name" /></mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'orgs.country' | translate }}</mat-label>
              <mat-select formControlName="country">
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
          </div>
          <button mat-flat-button type="submit" [disabled]="form.invalid || form.pristine">{{ 'common.save' | translate }}</button>
        </form>
      </section>

      <app-user-list [orgId]="o.id" kind="admins" title="orgs.admins" [defaultLanguage]="o.defaultLanguage" />
      <app-user-list [orgId]="o.id" kind="auditors" title="orgs.auditors" [defaultLanguage]="o.defaultLanguage" />
    }
  `,
})
export class OrganizationDetailPage implements OnInit {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  readonly langs = LANGS;
  readonly countries = COUNTRIES;
  readonly timeZones = supportedTimeZones();
  readonly org = signal<OrganizationDto | null>(null);
  readonly form = buildOrgForm(inject(FormBuilder));

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      const { organization } = await this.api.get<{ organization: OrganizationDto }>(`/organizations/${this.id()}`);
      this.org.set(organization);
      this.form.reset({ ...organization });
    } catch (e) {
      this.notify.error(e);
    }
  }

  async save(): Promise<void> {
    try {
      const { organization } = await this.api.patch<{ organization: OrganizationDto }>(`/organizations/${this.id()}`, this.form.getRawValue());
      this.org.set(organization);
      this.form.reset({ ...organization });
      this.notify.ok('common.saved');
    } catch (e) {
      this.notify.error(e);
    }
  }

  async toggleStatus(o: OrganizationDto): Promise<void> {
    try {
      const { organization } = await this.api.patch<{ organization: OrganizationDto }>(`/organizations/${o.id}`, { status: o.status === 'active' ? 'inactive' : 'active' });
      this.org.set(organization);
    } catch (e) {
      this.notify.error(e);
    }
  }
}
