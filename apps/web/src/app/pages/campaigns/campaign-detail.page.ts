import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService, toApiFailure } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import type { CampaignDto, CampaignStatus, SampleError, SampleSummary } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { TzDatePipe } from '../../shared/tz-date.pipe';

const EDITABLE: CampaignStatus[] = ['borrador', 'muestra_cargada'];
const SUSPENDABLE: CampaignStatus[] = ['borrador', 'muestra_cargada', 'envios_activos', 'en_curso'];

@Component({
  selector: 'app-campaign-detail',
  imports: [RouterLink, MatButtonModule, MatMenuModule, MatProgressBarModule, TranslatePipe, TzDatePipe],
  template: `
    @if (campaign(); as c) {
      <div class="page-header">
        <div class="titles">
          <a class="back-link" routerLink="/campaigns">← {{ 'campaigns.title' | translate }}</a>
          <div class="eyebrow keep-case">{{ orgName() }}</div>
          <h1 class="keep-case">{{ c.reference || orgName() }}</h1>
          <div><span class="chip solid" data-testid="campaign-status">{{ 'campaignStatus.' + c.status | translate }}</span></div>
        </div>
        <div class="row-actions">
          @if (isAuditor() && editable()) {
            <a mat-stroked-button [routerLink]="['/campaigns', c.id, 'edit']">{{ 'common.edit' | translate }}</a>
          }
          @if (canSuspend() || canResume() || canCancel()) {
            <button mat-stroked-button [matMenuTriggerFor]="statusMenu">{{ 'campaigns.changeStatus' | translate }}</button>
            <mat-menu #statusMenu="matMenu">
              @if (canSuspend()) { <button mat-menu-item (click)="changeStatus('suspendida')">{{ 'campaigns.suspend' | translate }}</button> }
              @if (canResume()) { <button mat-menu-item (click)="changeStatus(previousStatus()!)">{{ 'campaigns.resume' | translate }}</button> }
              @if (canCancel()) { <button mat-menu-item (click)="changeStatus('cancelada')">{{ 'campaigns.cancel' | translate }}</button> }
            </mat-menu>
          }
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <span class="value" data-testid="campaign-minimum">{{ c.sampling?.minimum ?? '—' }}</span>
          <span class="label">{{ 'campaigns.minimum' | translate }}</span>
          @if (c.sampling) { <span class="meta">{{ 'campaignForm.bracket' | translate: { min: c.sampling.bracket.min, max: c.sampling.bracket.max ?? '∞' } }} · {{ 'campaigns.tableVersion' | translate: { v: c.sampling.tableVersion } }}</span> }
        </div>
        <div class="stat"><span class="value" data-testid="campaign-sample-size">{{ c.sampleSize }}</span><span class="label">{{ 'campaigns.sampleSize' | translate }}</span></div>
        <div class="stat"><span class="value">{{ c.m1Config.scopeSize }}</span><span class="label">{{ 'campaignForm.scopeSize' | translate }}</span></div>
        <div class="stat"><span class="value small">{{ c.m1Config.visitDate | tzDate: 'UTC' : 'date' }}</span><span class="label">{{ 'campaigns.visitDate' | translate }}</span></div>
      </div>

      <div class="numbered">
        <div class="grid-2 top">
          <section class="card">
            <h2 class="section-title">{{ 'campaignForm.data' | translate }}</h2>
            <dl class="kv">
              <div><dt>{{ 'campaignForm.norm' | translate }}</dt><dd>efr {{ c.m1Config.norm }}</dd></div>
              <div><dt>{{ 'campaigns.auditType' | translate }}</dt><dd>{{ 'auditTypes.' + c.m1Config.auditType | translate }}</dd></div>
              <div><dt>{{ 'campaignForm.excellence' | translate }}</dt><dd>{{ (c.m1Config.excellence ? 'common.yes' : 'common.no') | translate }}</dd></div>
              <div><dt>{{ 'campaignForm.efrManager' | translate }}</dt><dd>{{ c.m1Config.efrManagerName || '—' }}</dd></div>
              <div><dt>{{ 'campaigns.offeredLanguages' | translate }}</dt><dd>@for (l of c.questionnaire?.offeredLanguages ?? []; track l) { <span class="chip">{{ 'lang.' + l | translate }}</span> }</dd></div>
              <div><dt>{{ 'campaigns.questionnaire' | translate }}</dt><dd>{{ 'campaigns.questionnaireVersion' | translate: { v: c.questionnaire?.version } }}</dd></div>
            </dl>
          </section>
          <section class="card">
            <h2 class="section-title">{{ 'campaigns.window' | translate }}</h2>
            @if (c.window; as w) {
              <dl class="kv">
                <div><dt>{{ 'campaigns.opens' | translate }}</dt><dd data-testid="campaign-opens">{{ w.opensAt | tzDate: w.timeZone }}</dd></div>
                <div><dt>{{ 'campaigns.closes' | translate }}</dt><dd data-testid="campaign-closes">{{ w.closesAt | tzDate: w.timeZone }}</dd></div>
                @for (r of w.reminders; track r.businessDay) {
                  <div><dt>{{ 'campaigns.reminderDay' | translate: { n: r.businessDay } }}</dt><dd>{{ r.sendAt | tzDate: w.timeZone }}</dd></div>
                }
              </dl>
              <p class="note days tech">{{ w.businessDays.join(' · ') }}</p>
            }
            <h3>{{ 'campaigns.questions' | translate }}</h3>
            <div class="q-chips">
              @for (q of c.activatedQuestions; track q.code) {
                <span class="chip" [class.neutral]="q.state === 'inactive'" [class.warn]="q.state === 'conditional'" [title]="'questionStates.' + q.state | translate">{{ q.code }}</span>
              }
            </div>
            <div class="legend note">
              <span class="chip">{{ 'questionStates.active' | translate }}</span>
              <span class="chip warn">{{ 'questionStates.conditional' | translate }}</span>
              <span class="chip neutral">{{ 'questionStates.inactive' | translate }}</span>
            </div>
          </section>
        </div>

        @if (isAuditor()) {
          <section class="card alt" data-testid="sample-section">
            <h2 class="section-title">{{ 'sample.title' | translate }}</h2>
            <p class="intro">{{ 'sample.intro' | translate }}</p>
            <div class="row-actions">
              <button mat-stroked-button (click)="download('/campaigns/sample-template?format=xlsx')">{{ 'sample.templateXlsx' | translate }}</button>
              <button mat-button (click)="download('/campaigns/sample-template?format=csv')">{{ 'sample.templateCsv' | translate }}</button>
            </div>

            @if (sampleMode(); as mode) {
              <div class="upload">
                <label class="file-label" for="sample-file">{{ (mode === 'append' ? 'sample.uploadAppend' : (c.sampleSize ? 'sample.uploadReplace' : 'sample.upload')) | translate }}</label>
                <input id="sample-file" type="file" accept=".xlsx,.csv" (change)="upload($event, mode)" data-testid="sample-file" [disabled]="uploading()" />
                @if (uploading()) { <mat-progress-bar mode="indeterminate" /> }
              </div>
            }

            @if (errors().length) {
              <div class="alert error" role="alert" data-testid="sample-errors">
                <strong>{{ 'sample.errorsTitle' | translate: { n: errors().length } }}</strong>
                <div class="table-wrap">
                  <table class="simple-table">
                    <thead><tr><th>{{ 'sample.row' | translate }}</th><th>{{ 'sample.column' | translate }}</th><th>{{ 'sample.problem' | translate }}</th></tr></thead>
                    <tbody>
                      @for (e of errors(); track $index) {
                        <tr>
                          <td class="tech">{{ e.row }}</td>
                          <td class="tech">{{ e.column ?? '—' }}</td>
                          <td>{{ 'sampleErrors.' + e.code | translate: { allowed: e.allowed?.join(', '), firstRow: e.firstRow, limit: e.limit } }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }

            @if (summary(); as s) {
              @if (s.total > 0) {
                <div class="stats inner">
                  <div class="stat"><span class="value">{{ s.total }}</span><span class="label">{{ 'sample.total' | translate }}</span></div>
                  <div class="stat"><span class="value">{{ s.withEmail }}</span><span class="label">{{ 'sample.withEmail' | translate }}</span></div>
                  <div class="stat"><span class="value">{{ s.noEmail }}</span><span class="label">{{ 'sample.noEmail' | translate }}</span></div>
                </div>
              }
              @for (a of s.alerts; track a) {
                <div class="alert warn" role="status" data-testid="sample-alert">{{ 'sampleAlerts.' + a | translate: { minimum: s.minimum, total: s.total } }}</div>
              }
              @if (s.smallGroups.length) {
                <div class="alert warn">{{ 'sample.smallGroups' | translate }}
                  @for (g of s.smallGroups; track g.field + g.value) { <span class="chip">{{ 'demographics.' + g.field | translate }}: {{ g.value }} ({{ g.count }})</span> }
                </div>
              }
              @if (s.noEmail > 0) {
                <div class="codes">
                  <div class="row-actions">
                    <button mat-flat-button (click)="download('/campaigns/' + c.id + '/access-codes?format=xlsx')" data-testid="download-codes">{{ 'sample.downloadCodes' | translate }}</button>
                    <button mat-button (click)="download('/campaigns/' + c.id + '/access-codes?format=csv')">csv</button>
                  </div>
                  <p class="muted">{{ 'sample.codesHelp' | translate }}</p>
                </div>
              }
              @if (s.total > 0) {
                <div class="grid-3">
                  <div>
                    <h3>{{ 'demographics.workCenter' | translate }}</h3>
                    <ul class="values" data-testid="distinct-workcenter">@for (v of s.distinctValues.workCenter; track v.value) { <li><span>{{ v.value }}</span><span class="count">{{ v.count }}</span></li> }</ul>
                  </div>
                  <div>
                    <h3>{{ 'demographics.jobType' | translate }}</h3>
                    <ul class="values" data-testid="distinct-jobtype">@for (v of s.distinctValues.jobType; track v.value) { <li><span>{{ v.value }}</span><span class="count">{{ v.count }}</span></li> }</ul>
                  </div>
                  <div>
                    <h3>{{ 'demographics.sex' | translate }} / {{ 'demographics.ageBand' | translate }}</h3>
                    <ul class="values">
                      @for (v of s.distribution.sex; track v.value) { <li><span>{{ v.value }}</span><span class="count">{{ v.count }}</span></li> }
                      @for (v of s.distribution.ageBand; track v.value) { <li><span>{{ v.value }}</span><span class="count">{{ v.count }}</span></li> }
                    </ul>
                  </div>
                </div>
              }
            }
          </section>
        }

        <section class="card">
          <h2 class="section-title">{{ 'campaigns.history' | translate }}</h2>
          <ol class="history">
            @for (h of c.statusHistory; track $index) {
              <li>
                <span class="when">{{ h.at | tzDate: (c.window?.timeZone ?? 'UTC') }}</span>
                <span>{{ h.from ? ('campaignStatus.' + h.from | translate) + ' → ' : '' }}<strong>{{ 'campaignStatus.' + h.to | translate }}</strong>
                  @if (h.reason) { · {{ 'historyReasons.' + h.reason | translate }} }</span>
              </li>
            }
          </ol>
        </section>
      </div>
    }
  `,
  styles: `
    .top { gap: 24px; margin-bottom: 0; }
    .top .card { margin-bottom: 24px; }
    .kv dt { color: var(--efr-gray-dark); }
    .kv dd { font-weight: 700; }
    h3 { margin: 28px 0 12px; }
    .days { margin: 12px 0 0; }
    .q-chips, .legend { display: flex; flex-wrap: wrap; gap: 6px; }
    .legend { margin-top: 12px; }
    .intro { margin: 0 0 20px; max-width: 680px; }
    .upload { margin: 28px 0; display: grid; gap: 10px; max-width: 520px; }
    .file-label { font-weight: 700; }
    .stats.inner { margin: 28px 0; }
    .codes { margin: 0 0 28px; display: flex; flex-direction: column; gap: 8px; }
    .codes p { margin: 0; }
    .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; }
    .values { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--efr-border-strong); font-size: 15px; }
    .values li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--efr-border-strong); }
    .count { font-weight: 700; color: var(--efr-orange); }
    .history { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--efr-border); font-size: 15px; }
    .history li { display: grid; grid-template-columns: minmax(0, 260px) minmax(0, 1fr); gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--efr-border); }
    .when { color: var(--efr-gray-dark); font-size: 14px; }
    @media (max-width: 720px) { .history li { grid-template-columns: 1fr; gap: 2px; } }
  `,
})
export class CampaignDetailPage implements OnInit {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly i18n = inject(I18nService);

  readonly campaign = signal<CampaignDto | null>(null);
  readonly orgName = signal<string>('');
  readonly summary = signal<SampleSummary | null>(null);
  readonly errors = signal<SampleError[]>([]);
  readonly uploading = signal(false);
  readonly previousStatus = signal<CampaignStatus | null>(null);

  readonly isAuditor = computed(() => this.auth.user()?.role === 'AUDITOR');
  readonly status = computed(() => this.campaign()?.status);
  readonly editable = computed(() => EDITABLE.includes(this.status()!));
  readonly canSuspend = computed(() => SUSPENDABLE.includes(this.status()!));
  readonly canCancel = computed(() => SUSPENDABLE.includes(this.status()!) || this.status() === 'suspendida');
  readonly canResume = computed(() => this.status() === 'suspendida' && !!this.previousStatus());
  readonly sampleMode = computed<'replace' | 'append' | null>(() => {
    const s = this.status();
    if (!s) return null;
    if (EDITABLE.includes(s)) return 'replace';
    if (s === 'envios_activos' || s === 'en_curso') return 'append';
    return null;
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      const res = await this.api.get<{ campaign: CampaignDto; organization: { name: string } }>(`/campaigns/${this.id()}`);
      this.campaign.set(res.campaign);
      this.orgName.set(res.organization.name);
      const hist = res.campaign.statusHistory;
      const last = hist[hist.length - 1];
      this.previousStatus.set(res.campaign.status === 'suspendida' ? (last?.from ?? null) : null);
      if (this.isAuditor()) this.summary.set(await this.api.get<SampleSummary>(`/campaigns/${this.id()}/sample/summary`));
    } catch (e) {
      this.notify.error(e);
    }
  }

  async upload(event: Event, mode: 'replace' | 'append'): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.errors.set([]);
    try {
      await this.api.upload(`/campaigns/${this.id()}/sample?mode=${mode}`, file);
      this.notify.ok('sample.loaded');
      await this.load();
    } catch (e) {
      const f = toApiFailure(e);
      const errs = (f.details as { errors?: SampleError[] })?.errors;
      if (errs) this.errors.set(errs);
      else this.notify.error(e);
    } finally {
      this.uploading.set(false);
      inputEl.value = '';
    }
  }

  async download(url: string): Promise<void> {
    try {
      await this.api.download(url);
    } catch (e) {
      this.notify.error(e);
    }
  }

  async changeStatus(to: CampaignStatus): Promise<void> {
    if (!confirm(this.i18n.t('campaigns.confirmStatus', { status: this.i18n.t('campaignStatus.' + to) }))) return;
    try {
      const res = await this.api.post<{ campaign: CampaignDto }>(`/campaigns/${this.id()}/status`, { to });
      this.campaign.set(res.campaign);
      await this.load();
    } catch (e) {
      this.notify.error(e);
    }
  }
}
