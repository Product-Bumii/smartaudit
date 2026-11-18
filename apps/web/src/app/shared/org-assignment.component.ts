import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../core/api.service';
import type { AuditEntityListItem, OrganizationDto, UserDto } from '../core/models';
import { NotifyService } from '../core/notify.service';

/**
 * Superadmins: assigns an organization to an audit entity and one of its coordinators, and (optionally)
 * the responsible auditor. The rules (open campaigns, eligibility) are enforced by the API.
 */
@Component({
  selector: 'app-org-assignment',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatSelectModule, TranslatePipe],
  template: `
    <section class="card" data-testid="org-assignment">
      <h2>{{ 'assignment.title' | translate }}</h2>
      <p class="muted">{{ 'assignment.intro' | translate }}</p>
      <form [formGroup]="form" (ngSubmit)="saveAssignment()">
        <div class="grid-2">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'assignment.auditEntity' | translate }}</mat-label>
            <mat-select formControlName="auditEntityId" (selectionChange)="onEntity($event.value)" data-testid="assign-entity">
              <mat-option [value]="null">{{ 'assignment.none' | translate }}</mat-option>
              @for (e of entities(); track e.id) {
                <mat-option [value]="e.id" [disabled]="e.status !== 'active'"><span class="keep-case">{{ e.name }}</span></mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'assignment.coordinator' | translate }}</mat-label>
            <mat-select formControlName="coordinatorId" data-testid="assign-coordinator">
              <mat-option [value]="null">{{ 'assignment.none' | translate }}</mat-option>
              @for (u of coordinators(); track u.id) {
                <mat-option [value]="u.id" [disabled]="u.status !== 'active'">{{ u.email }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <button mat-flat-button type="submit" [disabled]="form.pristine" data-testid="assign-save">{{ 'common.save' | translate }}</button>
      </form>

      @if (org().auditEntity) {
        <h3>{{ 'assignment.auditor' | translate }}</h3>
        <mat-form-field appearance="outline" class="auditor">
          <mat-label>{{ 'assignment.auditor' | translate }}</mat-label>
          <mat-select [value]="org().auditor?.id ?? null" (selectionChange)="saveAuditor($event.value)" data-testid="assign-auditor">
            <mat-option [value]="null">{{ 'assignment.none' | translate }}</mat-option>
            @for (u of auditors(); track u.id) {
              <mat-option [value]="u.id">{{ u.email }}@if (u.role === 'COORDINATOR') { ({{ 'roles.COORDINATOR' | translate }}) }</mat-option>
            }
          </mat-select>
          <mat-hint>{{ 'assignment.auditorHint' | translate }}</mat-hint>
        </mat-form-field>
      }
    </section>
  `,
  styles: `
    h3 { font-size: 16px; margin: 28px 0 10px; }
    .auditor { width: 100%; max-width: 480px; }
  `,
})
export class OrgAssignmentComponent {
  readonly org = input.required<OrganizationDto>();
  readonly changed = output<OrganizationDto>();
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  readonly entities = signal<AuditEntityListItem[]>([]);
  readonly coordinators = signal<UserDto[]>([]);
  readonly auditors = signal<UserDto[]>([]);
  readonly form = inject(FormBuilder).group({
    auditEntityId: [null as string | null],
    coordinatorId: [null as string | null],
  });

  constructor() {
    void this.loadEntities();
    effect(() => {
      const o = this.org();
      this.form.reset({ auditEntityId: o.auditEntity?.id ?? null, coordinatorId: o.coordinator?.id ?? null });
      void this.loadCoordinators(o.auditEntity?.id ?? null);
      void this.loadAuditors(o);
    });
  }

  private async loadEntities(): Promise<void> {
    try {
      this.entities.set((await this.api.get<{ items: AuditEntityListItem[] }>('/audit-entities')).items);
    } catch (e) {
      this.notify.error(e);
    }
  }

  private async loadCoordinators(entityId: string | null): Promise<void> {
    if (!entityId) return this.coordinators.set([]);
    try {
      this.coordinators.set((await this.api.get<{ items: UserDto[] }>(`/audit-entities/${entityId}/coordinators`)).items);
    } catch (e) {
      this.notify.error(e);
    }
  }

  private async loadAuditors(o: OrganizationDto): Promise<void> {
    if (!o.auditEntity) return this.auditors.set([]);
    try {
      this.auditors.set((await this.api.get<{ items: UserDto[] }>(`/organizations/${o.id}/assignable-auditors`)).items);
    } catch (e) {
      this.notify.error(e);
    }
  }

  onEntity(entityId: string | null): void {
    this.form.controls.coordinatorId.setValue(null);
    void this.loadCoordinators(entityId);
  }

  async saveAssignment(): Promise<void> {
    try {
      const { organization } = await this.api.put<{ organization: OrganizationDto }>(`/organizations/${this.org().id}/assignment`, this.form.getRawValue());
      this.notify.ok('assignment.saved');
      this.changed.emit(organization);
    } catch (e) {
      this.notify.error(e);
    }
  }

  async saveAuditor(auditorId: string | null): Promise<void> {
    try {
      const { organization } = await this.api.put<{ organization: OrganizationDto }>(`/organizations/${this.org().id}/auditor`, { auditorId });
      this.notify.ok('assignment.saved');
      this.changed.emit(organization);
    } catch (e) {
      this.notify.error(e);
      this.changed.emit(this.org());
    }
  }
}
