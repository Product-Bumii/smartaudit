import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import type { AuditEntityDto } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { COUNTRIES } from '../../shared/org-form';
import { UserListComponent } from '../../shared/user-list.component';

/** Superadmins: an audit entity, its coordinators and its auditors. */
@Component({
  selector: 'app-audit-entity-detail',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, TranslatePipe, UserListComponent],
  template: `
    <div class="page-header">
      <div class="titles">
        <a class="back-link" routerLink="/admin/audit-entities">← {{ 'entities.title' | translate }}</a>
        <div class="eyebrow">{{ 'entities.eyebrow' | translate }}</div>
        <h1 class="keep-case">{{ entity()?.name }}</h1>
      </div>
      @if (entity(); as e) {
        <button mat-stroked-button (click)="toggleStatus(e)">{{ (e.status === 'active' ? 'orgs.deactivate' : 'orgs.activate') | translate }}</button>
      }
    </div>

    @if (entity(); as e) {
      <section class="card">
        <h2>{{ 'orgs.details' | translate }}</h2>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="grid-2">
            <mat-form-field appearance="outline"><mat-label>{{ 'entities.name' | translate }}</mat-label><input matInput formControlName="name" /></mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'orgs.country' | translate }}</mat-label>
              <mat-select formControlName="country">
                @for (c of countries; track c.code) {
                  <mat-option [value]="c.code">{{ 'countries.' + c.code | translate }} ({{ c.code }})</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
          <button mat-flat-button type="submit" [disabled]="form.invalid || form.pristine">{{ 'common.save' | translate }}</button>
        </form>
      </section>

      <app-user-list [entityId]="e.id" kind="coordinators" title="entities.coordinators" />
      <app-user-list [entityId]="e.id" kind="auditors" title="entities.auditors" />
    }
  `,
})
export class AuditEntityDetailPage implements OnInit {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  readonly countries = COUNTRIES;
  readonly entity = signal<AuditEntityDto | null>(null);
  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    country: ['ES', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    try {
      const { auditEntity } = await this.api.get<{ auditEntity: AuditEntityDto }>(`/audit-entities/${this.id()}`);
      this.set(auditEntity);
    } catch (e) {
      this.notify.error(e);
    }
  }

  private set(e: AuditEntityDto): void {
    this.entity.set(e);
    this.form.reset({ name: e.name, country: e.country });
  }

  async save(): Promise<void> {
    try {
      const { auditEntity } = await this.api.patch<{ auditEntity: AuditEntityDto }>(`/audit-entities/${this.id()}`, this.form.getRawValue());
      this.set(auditEntity);
      this.notify.ok('common.saved');
    } catch (e) {
      this.notify.error(e);
    }
  }

  async toggleStatus(e: AuditEntityDto): Promise<void> {
    try {
      const { auditEntity } = await this.api.patch<{ auditEntity: AuditEntityDto }>(`/audit-entities/${e.id}`, { status: e.status === 'active' ? 'inactive' : 'active' });
      this.set(auditEntity);
    } catch (err) {
      this.notify.error(err);
    }
  }
}
