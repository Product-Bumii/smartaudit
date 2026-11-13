import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';
import { UserListComponent } from '../../shared/user-list.component';

/** ORG_ADMIN: manages the auditors of its organization. It never sees samples or responses. */
@Component({
  selector: 'app-auditors',
  imports: [TranslatePipe, UserListComponent],
  template: `
    <div class="page-header">
      <div class="titles">
        <div class="eyebrow keep-case">{{ orgName() }}</div>
        <h1>{{ 'orgAdmin.title' | translate }}</h1>
        <p class="lead">{{ 'orgAdmin.intro' | translate }}</p>
      </div>
    </div>
    @if (orgId(); as id) {
      <app-user-list [orgId]="id" kind="auditors" title="orgs.auditors" [defaultLanguage]="lang()" />
    }
    <!-- TODO(Fase 2): aggregated progress (% completed vs. minimum) per campaign. -->
  `,
})
export class AuditorsPage {
  private readonly auth = inject(AuthService);
  readonly orgId = computed(() => this.auth.user()?.organizationId ?? null);
  readonly orgName = computed(() => this.auth.user()?.organizationName ?? '');
  readonly lang = computed(() => this.auth.user()?.preferredLanguage ?? 'es');
}
