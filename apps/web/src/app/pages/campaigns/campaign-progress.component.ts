import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import type { CampaignDto, CampaignProgressDto, ParticipantTestLinkDto } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { TzDatePipe } from '../../shared/tz-date.pipe';

/**
 * Progress of a launched audit (section 5.4): completed interviews against the minimum and the maximum, with
 * the minimum alerts. The responsible auditor (and superadmins) also see each person by the row of their own
 * sample file (never names) and may extend the window. Coordinators only see the aggregate.
 */
@Component({
  selector: 'app-campaign-progress',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, TranslatePipe, TzDatePipe],
  template: `
    <section class="card" data-testid="progress-section">
      <h2 class="section-title">{{ 'progress.title' | translate }}</h2>
      @if (progress(); as p) {
        <div class="stats inner">
          <div class="stat">
            <span class="value" data-testid="progress-completed">{{ p.completed }}</span>
            <span class="label">{{ 'progress.completed' | translate }}</span>
            <span class="meta">{{ 'progress.ofMinimum' | translate: { pct: p.percentOfMinimum ?? '—', minimum: p.minimum ?? '—' } }}</span>
          </div>
          <div class="stat"><span class="value">{{ p.started }}</span><span class="label">{{ 'progress.started' | translate }}</span></div>
          <div class="stat"><span class="value">{{ p.invited }}</span><span class="label">{{ 'progress.invited' | translate }}</span></div>
          <div class="stat"><span class="value">{{ p.maximum ?? '—' }}</span><span class="label">{{ 'campaigns.maximum' | translate }}</span></div>
        </div>
        <div class="bar" role="progressbar" [attr.aria-valuenow]="p.completed" aria-valuemin="0" [attr.aria-valuemax]="p.minimum ?? 0" [attr.aria-label]="'progress.completed' | translate">
          <span [style.width.%]="barWidth()"></span>
        </div>
        @for (a of p.alerts; track a) {
          <div class="alert warn" role="status" data-testid="progress-alert">{{ 'progress.alerts.' + a | translate: { minimum: p.minimum, projection: p.projection } }}</div>
        }

        @if (p.people; as people) {
          <h3>{{ 'progress.people' | translate }}</h3>
          <p class="muted small">{{ 'progress.peopleHint' | translate }}</p>
          @if (p.testLinks) {
            <div class="alert warn" role="note" data-testid="test-links-notice">{{ 'progress.testLinksNotice' | translate }}</div>
          }
          <div class="table-wrap">
            <table class="simple-table" data-testid="progress-people">
              <thead>
                <tr>
                  <th>{{ 'progress.row' | translate }}</th>
                  <th>{{ 'progress.channel' | translate }}</th>
                  <th>{{ 'progress.status' | translate }}</th>
                  <th>{{ 'progress.invitedAt' | translate }}</th>
                  <th>{{ 'progress.reminders' | translate }}</th>
                  @if (p.testLinks) { <th>{{ 'progress.testAccess' | translate }}</th> }
                </tr>
              </thead>
              <tbody>
                @for (r of people; track r.sourceRow) {
                  <tr>
                    <td>{{ r.sourceRow }}</td>
                    <td>{{ (r.noEmail ? 'progress.paperCode' : 'progress.email') | translate }}</td>
                    <td><span class="chip" [class.neutral]="r.status !== 'completed'">{{ 'respondentStatus.' + r.status | translate }}</span></td>
                    <td>{{ r.invitedAt ? (r.invitedAt | tzDate: timeZone()) : '—' }}</td>
                    <td>{{ r.remindersSent }}</td>
                    @if (p.testLinks && r.ref) {
                      <td class="test-cell">
                        @if (links()[r.ref]; as l) {
                          <a [href]="l.url" target="_blank" rel="noopener" data-testid="test-link-open">{{ 'progress.openInterview' | translate }}</a>
                          @if (l.kind === 'code') { <span class="code" data-testid="test-link-code">{{ 'progress.code' | translate }}: <strong>{{ l.code }}</strong></span> }
                          <button mat-button type="button" (click)="copy(l.kind === 'code' ? l.url + ' · ' + l.code : l.url)">{{ 'progress.copy' | translate }}</button>
                        } @else {
                          <button mat-stroked-button type="button" [disabled]="busy()" (click)="showLink(r.ref)" [attr.data-testid]="'test-link-' + r.sourceRow">{{ 'progress.showLink' | translate }}</button>
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        @if (canExtend()) {
          <h3>{{ 'progress.extendTitle' | translate }}</h3>
          <form class="extend" (ngSubmit)="extend()">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'progress.newCloseDate' | translate }}</mat-label>
              <input matInput type="date" name="closeDate" [(ngModel)]="closeDate" required data-testid="extend-date" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'progress.reason' | translate }}</mat-label>
              <input matInput name="reason" [(ngModel)]="reason" maxlength="500" />
            </mat-form-field>
            <button mat-stroked-button type="submit" [disabled]="!closeDate || busy()" data-testid="extend-submit">{{ 'progress.extend' | translate }}</button>
          </form>
        }
      } @else {
        <p class="muted">…</p>
      }
    </section>
  `,
  styles: `
    .stats.inner { margin: 8px 0 20px; }
    .bar { height: 8px; background: var(--efr-surface-alt); margin-bottom: 20px; }
    .bar span { display: block; height: 100%; background: var(--efr-orange); max-width: 100%; }
    h3 { margin: 28px 0 8px; }
    .small { font-size: 13px; margin: 0 0 12px; }
    .extend { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    .test-cell { white-space: nowrap; }
    .test-cell a, .test-cell .code { margin-right: 12px; font-size: 14px; }
  `,
})
export class CampaignProgressComponent {
  readonly campaign = input.required<CampaignDto>();
  readonly changed = output<CampaignDto>();
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  readonly progress = signal<CampaignProgressDto | null>(null);
  readonly busy = signal(false);
  /** TEMPORARY test aid (decision 98): links already asked for, by person. */
  readonly links = signal<Record<string, ParticipantTestLinkDto>>({});
  closeDate = '';
  reason = '';

  readonly timeZone = computed(() => this.campaign().window?.timeZone ?? 'UTC');
  readonly canExtend = computed(() => this.campaign().access === 'manage' && ['envios_activos', 'en_curso'].includes(this.campaign().status));
  readonly barWidth = computed(() => {
    const p = this.progress();
    return p?.minimum ? Math.min(100, (p.completed / p.minimum) * 100) : 0;
  });

  constructor() {
    effect(() => {
      const c = this.campaign();
      void this.load(c.id);
    });
  }

  private async load(id: string): Promise<void> {
    try {
      this.progress.set(await this.api.get<CampaignProgressDto>(`/campaigns/${id}/progress`));
    } catch (e) {
      this.notify.error(e);
    }
  }

  /** TEMPORARY test aid (decision 98): the person's invitation link or paper code, while there is no email. */
  async showLink(ref: string): Promise<void> {
    this.busy.set(true);
    try {
      const link = await this.api.post<ParticipantTestLinkDto>(`/campaigns/${this.campaign().id}/people/${ref}/test-link`);
      this.links.update((l) => ({ ...l, [ref]: link }));
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.busy.set(false);
    }
  }

  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.notify.ok('progress.copied');
    } catch (e) {
      this.notify.error(e);
    }
  }

  async extend(): Promise<void> {
    this.busy.set(true);
    try {
      const res = await this.api.post<{ campaign: CampaignDto }>(`/campaigns/${this.campaign().id}/window/extend`, { closeDate: this.closeDate, reason: this.reason || undefined });
      this.notify.ok('progress.extended');
      this.closeDate = '';
      this.reason = '';
      this.changed.emit(res.campaign);
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}
