import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import type { AuditEntityDto, AuditEntityListItem } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { COUNTRIES } from '../../shared/org-form';

/** Superadmins: audit entities (certification bodies) and their first coordinator. */
@Component({
  selector: 'app-audit-entities',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, TranslatePipe],
  template: `
    <div class="page-header">
      <div class="titles">
        <div class="eyebrow">{{ 'entities.eyebrow' | translate }}</div>
        <h1>{{ 'entities.title' | translate }}</h1>
        <p class="lead">{{ 'entities.intro' | translate }}</p>
      </div>
      <button mat-flat-button (click)="showForm.set(!showForm())" data-testid="new-entity">{{ 'entities.new' | translate }}</button>
    </div>

    @if (showForm()) {
      <section class="card">
        <h2>{{ 'entities.new' | translate }}</h2>
        <form [formGroup]="form" (ngSubmit)="create()">
          <div class="grid-2">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'entities.name' | translate }}</mat-label>
              <input matInput formControlName="name" data-testid="entity-name" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'orgs.country' | translate }}</mat-label>
              <mat-select formControlName="country" data-testid="entity-country">
                @for (c of countries; track c.code) {
                  <mat-option [value]="c.code">{{ 'countries.' + c.code | translate }} ({{ c.code }})</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'entities.coordinatorEmail' | translate }}</mat-label>
              <input matInput type="email" formControlName="coordinatorEmail" data-testid="entity-coordinator-email" />
              <mat-hint>{{ 'entities.coordinatorEmailHint' | translate }}</mat-hint>
            </mat-form-field>
          </div>
          <div class="row-actions">
            <button mat-flat-button type="submit" [disabled]="form.invalid || busy()" data-testid="entity-submit">{{ 'common.create' | translate }}</button>
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
              <th>{{ 'entities.name' | translate }}</th>
              <th>{{ 'orgs.country' | translate }}</th>
              <th>{{ 'entities.coordinators' | translate }}</th>
              <th>{{ 'entities.auditors' | translate }}</th>
              <th>{{ 'entities.organizations' | translate }}</th>
              <th>{{ 'users.status' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (e of items(); track e.id) {
              <tr>
                <td><a class="strong keep-case" [routerLink]="['/admin/audit-entities', e.id]">{{ e.name }}</a></td>
                <td>{{ e.country }}</td>
                <td class="num">{{ e.coordinators }}</td>
                <td class="num">{{ e.auditors }}</td>
                <td class="num">{{ e.organizations }}</td>
                <td><span class="chip" [class.neutral]="e.status !== 'active'">{{ 'status.' + e.status | translate }}</span></td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="muted">{{ 'entities.empty' | translate }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: `.strong { font-weight: 700; } .num { font-weight: 700; }`,
})
export class AuditEntitiesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);
  readonly countries = COUNTRIES;
  readonly items = signal<AuditEntityListItem[]>([]);
  readonly showForm = signal(false);
  readonly busy = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    country: ['ES', Validators.required],
    coordinatorEmail: ['', Validators.email],
  });

  async ngOnInit(): Promise<void> {
    try {
      this.items.set((await this.api.get<{ items: AuditEntityListItem[] }>('/audit-entities')).items);
    } catch (e) {
      this.notify.error(e);
    }
  }

  async create(): Promise<void> {
    this.busy.set(true);
    try {
      const { coordinatorEmail, ...rest } = this.form.getRawValue();
      const res = await this.api.post<{ auditEntity: AuditEntityDto }>('/audit-entities', { ...rest, ...(coordinatorEmail ? { coordinatorEmail } : {}) });
      this.notify.ok('entities.created');
      await this.router.navigate(['/admin/audit-entities', res.auditEntity.id]);
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}
