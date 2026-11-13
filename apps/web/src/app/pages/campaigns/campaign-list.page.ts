import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import type { CampaignListItem } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { TzDatePipe } from '../../shared/tz-date.pipe';

@Component({
  selector: 'app-campaign-list',
  imports: [RouterLink, MatButtonModule, TranslatePipe, TzDatePipe],
  template: `
    <div class="page-header">
      <div class="titles">
        <div class="eyebrow">{{ 'campaigns.eyebrow' | translate }}</div>
        <h1>{{ 'campaigns.title' | translate }}</h1>
      </div>
      @if (auth.user()?.role === 'AUDITOR') {
        <a mat-flat-button routerLink="/campaigns/new" data-testid="new-campaign">{{ 'campaigns.new' | translate }}</a>
      }
    </div>
    <section class="card">
      <div class="table-wrap">
        <table class="simple-table">
          <thead>
            <tr>
              <th>{{ 'campaigns.reference' | translate }}</th>
              @if (auth.isSuperadmin()) { <th>{{ 'campaigns.organization' | translate }}</th> }
              <th>{{ 'campaigns.visitDate' | translate }}</th>
              <th>{{ 'campaigns.auditType' | translate }}</th>
              <th>{{ 'campaigns.minimum' | translate }}</th>
              <th>{{ 'campaigns.sampleSize' | translate }}</th>
              <th>{{ 'campaigns.status' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (c of items(); track c.id) {
              <tr>
                <td><a class="strong" [routerLink]="['/campaigns', c.id]">{{ c.reference || c.organizationName }}</a></td>
                @if (auth.isSuperadmin()) { <td>{{ c.organizationName }}</td> }
                <td>{{ c.m1Config.visitDate | tzDate: 'UTC' : 'date' }}</td>
                <td>{{ 'auditTypes.' + c.m1Config.auditType | translate }}</td>
                <td class="num">{{ c.sampling?.minimum ?? '—' }}</td>
                <td class="num">{{ c.sampleSize }}</td>
                <td><span class="chip">{{ 'campaignStatus.' + c.status | translate }}</span></td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="muted">{{ 'campaigns.empty' | translate }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: `
    .strong { font-weight: 700; }
    .num { font-weight: 700; color: var(--efr-orange); }
  `,
})
export class CampaignListPage implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  readonly items = signal<CampaignListItem[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      this.items.set((await this.api.get<{ items: CampaignListItem[] }>('/campaigns')).items);
    } catch (e) {
      this.notify.error(e);
    }
  }
}
