import { Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CAMPAIGN_STATUS_VALUES, PAGE_SIZES, type CampaignListItem, type Paged } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PagedList } from '../../shared/paged-list';
import { TzDatePipe } from '../../shared/tz-date.pipe';

/** Audits (M1 campaigns): searched, filtered by status, sorted and paged on the server. */
@Component({
  selector: 'app-campaign-list',
  imports: [
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    TranslatePipe,
    TzDatePipe,
  ],
  template: `
    <div class="page-header">
      <div class="titles">
        <div class="eyebrow">{{ 'campaigns.eyebrow' | translate }}</div>
        <h1>{{ 'campaigns.title' | translate }}</h1>
      </div>
      @if (!auth.isSuperadmin()) {
        <a mat-flat-button routerLink="/campaigns/new" data-testid="new-campaign">{{ 'campaigns.new' | translate }}</a>
      }
    </div>
    <section class="card">
      <div class="list-toolbar">
        <mat-form-field appearance="outline" class="search" subscriptSizing="dynamic">
          <mat-label>{{ 'list.searchCampaigns' | translate }}</mat-label>
          <input matInput type="search" [value]="list.q()" (input)="list.onSearch($any($event.target).value)" data-testid="campaign-search" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="filter" subscriptSizing="dynamic">
          <mat-label>{{ 'list.status' | translate }}</mat-label>
          <mat-select [value]="list.filters()['status'] ?? ''" (selectionChange)="list.setFilter('status', $event.value)" data-testid="campaign-filter-status">
            <mat-option value="">{{ 'list.all' | translate }}</mat-option>
            <mat-option value="open">{{ 'list.open' | translate }}</mat-option>
            <mat-option value="closed">{{ 'list.closed' | translate }}</mat-option>
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ 'campaignStatus.' + s | translate }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (list.narrowed()) {
          <button mat-button class="clear" type="button" (click)="list.clear()">{{ 'list.clear' | translate }}</button>
        }
      </div>
      <div class="table-wrap">
        <table class="simple-table" matSort [matSortActive]="list.sort()" [matSortDirection]="list.dir()" (matSortChange)="list.onSort($event)" data-testid="campaign-table">
          <thead>
            <tr>
              <th mat-sort-header="reference">{{ 'campaigns.reference' | translate }}</th>
              <th mat-sort-header="organization">{{ 'campaigns.organization' | translate }}</th>
              <th mat-sort-header="interviewStartDate">{{ 'campaigns.interviewStartDate' | translate }}</th>
              <th>{{ 'campaigns.auditType' | translate }}</th>
              <th>{{ 'campaigns.minimum' | translate }}</th>
              <th>{{ 'campaigns.sampleSize' | translate }}</th>
              <th mat-sort-header="status">{{ 'campaigns.status' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (c of list.items(); track c.id) {
              <tr>
                <td><a class="strong" [routerLink]="['/campaigns', c.id]">{{ c.reference || c.organizationName }}</a></td>
                <td class="keep-case">{{ c.organizationName }}</td>
                <td>{{ c.m1Config.interviewStartDate | tzDate: 'UTC' : 'date' }}</td>
                <td>{{ 'auditTypes.' + c.m1Config.auditType | translate }}</td>
                <td class="num">{{ c.sampling?.minimum ?? '—' }}</td>
                <td class="num">{{ c.sampleSize }}</td>
                <td>
                  <span class="chip">{{ 'campaignStatus.' + c.status | translate }}</span>
                  @if (c.access === 'aggregate') { <span class="chip neutral" [title]="'campaigns.aggregateHint' | translate">{{ 'campaigns.aggregateOnly' | translate }}</span> }
                </td>
              </tr>
            } @empty {
              @if (list.loaded()) {
                <tr><td colspan="7" class="muted">{{ (list.narrowed() ? 'campaigns.noResults' : 'campaigns.empty') | translate }}</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
      <mat-paginator
        [length]="list.total()"
        [pageIndex]="list.page()"
        [pageSize]="list.pageSize()"
        [pageSizeOptions]="pageSizes"
        [showFirstLastButtons]="true"
        (page)="list.onPage($event)"
      />
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
  readonly statuses = CAMPAIGN_STATUS_VALUES;
  readonly pageSizes = PAGE_SIZES;
  readonly list = new PagedList<CampaignListItem>({
    load: (params) => this.api.get<Paged<CampaignListItem>>('/campaigns', params),
    onError: (e) => this.notify.error(e),
    sort: 'createdAt',
    dir: 'desc',
    filters: ['status'],
  });

  async ngOnInit(): Promise<void> {
    await this.list.reload();
  }
}
