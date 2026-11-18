import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';
import { UserListComponent } from '../../shared/user-list.component';

/** Coordinator: manages the auditors of its audit entity. */
@Component({
  selector: 'app-auditors',
  imports: [TranslatePipe, UserListComponent],
  template: `
    <div class="page-header">
      <div class="titles">
        <div class="eyebrow keep-case">{{ entityName() }}</div>
        <h1>{{ 'entityAuditors.title' | translate }}</h1>
        <p class="lead">{{ 'entityAuditors.intro' | translate }}</p>
      </div>
    </div>
    @if (entityId(); as id) {
      <app-user-list [entityId]="id" kind="auditors" title="entities.auditors" [defaultLanguage]="lang()" />
    }
  `,
})
export class AuditorsPage {
  private readonly auth = inject(AuthService);
  readonly entityId = computed(() => this.auth.user()?.auditEntityId ?? null);
  readonly entityName = computed(() => this.auth.user()?.auditEntityName ?? '');
  readonly lang = computed(() => this.auth.user()?.preferredLanguage ?? 'es');
}
