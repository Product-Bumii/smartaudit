import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import type { AssignedOrganization, OrganizationDto, UserDto } from '../../core/models';
import { NotifyService } from '../../core/notify.service';

/**
 * Coordinators: organizations assigned to them by F+f, with the responsible auditor (changeable;
 * open campaigns move to the new auditor). Auditors: organizations assigned to them, to start a campaign.
 */
@Component({
  selector: 'app-my-organizations',
  imports: [RouterLink, MatButtonModule, MatFormFieldModule, MatSelectModule, TranslatePipe],
  template: `
    <div class="page-header">
      <div class="titles">
        <div class="eyebrow keep-case">{{ auth.user()?.auditEntityName }}</div>
        <h1>{{ 'myOrgs.title' | translate }}</h1>
        <p class="lead">{{ (isCoordinator() ? 'myOrgs.introCoordinator' : 'myOrgs.introAuditor') | translate }}</p>
      </div>
    </div>
    <section class="card">
      <div class="table-wrap">
        <table class="simple-table" data-testid="my-orgs">
          <thead>
            <tr>
              <th>{{ 'orgs.name' | translate }}</th>
              <th>{{ 'orgs.country' | translate }}</th>
              @if (isCoordinator()) { <th>{{ 'myOrgs.auditor' | translate }}</th> } @else { <th>{{ 'myOrgs.coordinator' | translate }}</th> }
              <th><span class="cdk-visually-hidden">{{ 'common.actions' | translate }}</span></th>
            </tr>
          </thead>
          <tbody>
            @for (o of items(); track o.id) {
              <tr [attr.data-testid]="'my-org-' + o.id">
                <td class="strong keep-case">
                  {{ o.name }}
                  @if (o.status !== 'active') { <span class="chip neutral">{{ 'status.' + o.status | translate }}</span> }
                </td>
                <td>{{ 'countries.' + o.country | translate }}</td>
                @if (isCoordinator()) {
                  <td class="auditor">
                    @if (o.coordinates) {
                      <mat-form-field appearance="outline" subscriptSizing="dynamic">
                        <mat-label>{{ 'myOrgs.auditor' | translate }}</mat-label>
                        <mat-select
                          [value]="o.auditor?.id ?? null"
                          (openedChange)="$event && loadCandidates(o)"
                          (selectionChange)="assign(o, $event.value)"
                          [attr.data-testid]="'auditor-select-' + o.id"
                        >
                          <mat-option [value]="null">{{ 'myOrgs.noAuditor' | translate }}</mat-option>
                          @for (u of candidatesFor(o); track u.id) {
                            <mat-option [value]="u.id">{{ u.email }}@if (u.id === auth.user()?.id) { ({{ 'myOrgs.me' | translate }}) }</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                    } @else {
                      {{ o.auditor?.email ?? '—' }}
                    }
                  </td>
                } @else {
                  <td>{{ o.coordinator?.email ?? '—' }}</td>
                }
                <td>
                  @if (o.audits && o.status === 'active') {
                    <a mat-stroked-button [routerLink]="['/campaigns/new']" [queryParams]="{ org: o.id }" [attr.data-testid]="'new-campaign-' + o.id">{{ 'campaigns.new' | translate }}</a>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="muted">{{ 'myOrgs.empty' | translate }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      @if (isCoordinator()) { <p class="muted small">{{ 'myOrgs.reassignHint' | translate }}</p> }
    </section>
  `,
  styles: `
    .strong { font-weight: 700; }
    .auditor mat-form-field { width: 100%; min-width: 240px; }
    .small { font-size: 13px; margin: 16px 0 0; }
  `,
})
export class MyOrganizationsPage implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  readonly items = signal<AssignedOrganization[]>([]);
  private readonly candidates = signal<Record<string, UserDto[]>>({});
  readonly isCoordinator = computed(() => this.auth.user()?.role === 'COORDINATOR');

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      this.items.set((await this.api.get<{ items: AssignedOrganization[] }>('/assigned-organizations')).items);
    } catch (e) {
      this.notify.error(e);
    }
  }

  /** Eligible auditors; the current one is listed even before the list is loaded. */
  candidatesFor(o: AssignedOrganization): { id: string; email: string }[] {
    const loaded = this.candidates()[o.id];
    if (loaded) return loaded;
    return o.auditor ? [o.auditor] : [];
  }

  async loadCandidates(o: AssignedOrganization): Promise<void> {
    if (this.candidates()[o.id]) return;
    try {
      const { items } = await this.api.get<{ items: UserDto[] }>(`/organizations/${o.id}/assignable-auditors`);
      this.candidates.update((c) => ({ ...c, [o.id]: items }));
    } catch (e) {
      this.notify.error(e);
    }
  }

  async assign(o: AssignedOrganization, auditorId: string | null): Promise<void> {
    try {
      const { organization } = await this.api.put<{ organization: OrganizationDto }>(`/organizations/${o.id}/auditor`, { auditorId });
      this.items.update((list) =>
        list.map((x) => (x.id === o.id ? { ...x, ...organization, audits: organization.auditor?.id === this.auth.user()?.id } : x)),
      );
      this.notify.ok('myOrgs.assigned');
    } catch (e) {
      this.notify.error(e);
      await this.load();
    }
  }
}
