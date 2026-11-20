import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { debounceTime } from 'rxjs';
import { ApiService, toApiFailure } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import { AUDIT_TYPE_VALUES, LANGS, type CampaignDto, type CampaignOptions, type CampaignPreview, type Language } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { TzDatePipe } from '../../shared/tz-date.pipe';

/**
 * Create / edit an M1 campaign. Every derived value (minimum, window, activated questions) is
 * computed by the API (deterministic code in packages/shared) and only displayed here.
 */
@Component({
  selector: 'app-campaign-form',
  imports: [
    ReactiveFormsModule, RouterLink, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatSlideToggleModule, TranslatePipe, TzDatePipe,
  ],
  template: `
    <div class="page-header">
      <div class="titles">
        <a class="back-link" [routerLink]="id() ? ['/campaigns', id()] : ['/campaigns']">← {{ 'common.back' | translate }}</a>
        <div class="eyebrow">{{ 'campaigns.eyebrow' | translate }}</div>
        <h1>{{ (id() ? 'campaignForm.editTitle' : 'campaignForm.newTitle') | translate }}</h1>
      </div>
    </div>
    <div class="layout numbered">
      <form class="card" [formGroup]="form" (ngSubmit)="submit()">
        <h2 class="section-title">{{ 'campaignForm.data' | translate }}</h2>
        @if (!id() && options() && !options()!.organizations.length) {
          <div class="alert warn" role="status" data-testid="cf-no-orgs">{{ 'campaignForm.noOrganizations' | translate }}</div>
        }
        <div class="grid-2">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'campaigns.organization' | translate }}</mat-label>
            <mat-select formControlName="organizationId" data-testid="cf-organization">
              @for (o of organizations(); track o.id) { <mat-option [value]="o.id"><span class="keep-case">{{ o.name }}</span></mat-option> }
            </mat-select>
            @if (!id()) { <mat-hint>{{ 'campaignForm.organizationHint' | translate }}</mat-hint> }
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'campaigns.reference' | translate }}</mat-label>
            <input matInput formControlName="reference" data-testid="cf-reference" />
            <mat-hint>{{ 'campaignForm.referenceHint' | translate }}</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'campaignForm.norm' | translate }}</mat-label>
            <mat-select formControlName="norm" data-testid="cf-norm">
              @for (n of options()?.norms ?? []; track n) { <mat-option [value]="n">{{ n }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'campaigns.auditType' | translate }}</mat-label>
            <mat-select formControlName="auditType" data-testid="cf-audit-type">
              @for (t of auditTypes; track t) { <mat-option [value]="t">{{ 'auditTypes.' + t | translate }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'campaigns.interviewStartDate' | translate }}</mat-label>
            <input matInput type="date" formControlName="interviewStartDate" data-testid="cf-start-date" />
            <mat-hint>{{ 'campaignForm.interviewStartDateHint' | translate }}</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'campaignForm.scopeSize' | translate }}</mat-label>
            <input matInput type="number" min="1" formControlName="scopeSize" data-testid="cf-scope" />
          </mat-form-field>
          @if (needsAuditorMinimum()) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'campaignForm.auditorMinimum' | translate }}</mat-label>
              <input matInput type="number" formControlName="auditorMinimum" data-testid="cf-auditor-min" />
              <mat-hint>{{ 'campaignForm.auditorMinimumHint' | translate: rangeHint() }}</mat-hint>
            </mat-form-field>
          }
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'campaignForm.maxCompleted' | translate }}</mat-label>
            <input matInput type="number" min="1" formControlName="maxCompleted" [placeholder]="defaultMaximum()" data-testid="cf-max" />
            <mat-hint>{{ 'campaignForm.maxCompletedHint' | translate }}</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'campaignForm.efrManager' | translate }}</mat-label>
            <input matInput formControlName="efrManagerName" />
            <mat-hint>{{ 'campaignForm.efrManagerHint' | translate }}</mat-hint>
          </mat-form-field>
        </div>
        <mat-slide-toggle formControlName="excellence" data-testid="cf-excellence">{{ 'campaignForm.excellence' | translate }}</mat-slide-toggle>

        <fieldset class="langs">
          <legend>{{ 'campaignForm.languages' | translate }}</legend>
          @for (l of options()?.languages ?? []; track l.lang) {
            <mat-checkbox [checked]="selectedLangs().includes(l.lang)" (change)="toggleLang(l.lang, $event.checked)">
              {{ 'lang.' + l.lang | translate }}
              @if (!l.approved) { <span class="chip warn">{{ 'campaignForm.pendingApproval' | translate }}</span> }
            </mat-checkbox>
          }
          <div class="muted small">{{ 'campaignForm.languagesHint' | translate }}</div>
        </fieldset>

        @if (problems().length) {
          <div class="alert error" role="alert" data-testid="cf-problems">
            @for (p of problems(); track p.code) { <div>{{ i18n.error(p.code, p.details) }}</div> }
          </div>
        }
        <div class="row-actions">
          <button mat-flat-button type="submit" [disabled]="form.invalid || busy()" data-testid="cf-submit">{{ (id() ? 'common.save' : 'common.create') | translate }}</button>
        </div>
      </form>

      <aside class="card preview" aria-live="polite" data-testid="cf-preview">
        <h2 class="section-title">{{ 'campaignForm.preview' | translate }}</h2>
        @if (preview(); as p) {
          <div class="stat">
            <span class="value" data-testid="cf-minimum">{{ p.minimum.ok ? (p.minimum.minimum ?? '—') : '—' }}</span>
            <span class="label">{{ 'campaigns.minimum' | translate }}</span>
            @if (p.minimum.ok) {
              <span class="meta">{{ 'campaignForm.bracket' | translate: { min: p.minimum.bracket.min, max: p.minimum.bracket.max ?? '∞' } }}</span>
            }
          </div>
          <div class="stat">
            <span class="value" data-testid="cf-maximum">{{ p.maximum?.ok ? $any(p.maximum).maximum : '—' }}</span>
            <span class="label">{{ 'campaigns.maximum' | translate }}</span>
            <span class="meta">{{ 'campaigns.maximumHint' | translate }}</span>
          </div>
          @if (p.window; as w) {
            <h3>{{ 'campaigns.window' | translate }}</h3>
            <dl class="kv">
              <div><dt>{{ 'campaigns.opens' | translate }}</dt><dd data-testid="cf-opens">{{ w.opensAt | tzDate: w.timeZone }}</dd></div>
              <div><dt>{{ 'campaigns.closes' | translate }}</dt><dd data-testid="cf-closes">{{ w.closesAt | tzDate: w.timeZone }}</dd></div>
              @for (r of w.reminders; track r.businessDay) {
                <div><dt>{{ 'campaigns.reminderDay' | translate: { n: r.businessDay } }}</dt><dd>{{ r.sendAt | tzDate: w.timeZone }}</dd></div>
              }
            </dl>
            @for (warn of p.windowWarnings; track warn) { <div class="alert warn">{{ 'campaigns.warnings.' + warn | translate }}</div> }
          }
          <h3>{{ 'campaigns.questions' | translate }}</h3>
          <div class="q-chips">
            @for (q of p.questions; track q.code) {
              <span class="chip" [class.neutral]="q.state === 'inactive'" [class.warn]="q.state === 'conditional'" [title]="'questionStates.' + q.state | translate">{{ q.code }}</span>
            }
          </div>
          <div class="muted small legend">
            <span class="chip">{{ 'questionStates.active' | translate }}</span>
            <span class="chip warn">{{ 'questionStates.conditional' | translate }}</span>
            <span class="chip neutral">{{ 'questionStates.inactive' | translate }}</span>
          </div>
          <h3>{{ 'campaigns.offeredLanguages' | translate }}</h3>
          <div>@for (l of p.offeredLanguages; track l) { <span class="chip">{{ 'lang.' + l | translate }}</span> }</div>
        } @else {
          <p class="muted">{{ 'campaignForm.previewEmpty' | translate }}</p>
          <div class="closing-block">
            <div class="title">{{ 'campaignForm.howTitle' | translate }}</div>
            <p>{{ 'campaignForm.howText' | translate }}</p>
          </div>
        }
      </aside>
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: 24px; align-items: start; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
    .preview { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 4px; }
    .preview h3 { font-size: 16px; margin: 28px 0 10px; }
    .kv dd { font-weight: 700; }
    .q-chips, .legend { display: flex; flex-wrap: wrap; gap: 6px; }
    .legend { margin-top: 10px; }
    .langs { border: 0; border-top: 1px solid var(--efr-border); margin: 24px 0; padding: 16px 0 0; display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: center; }
    .langs legend { font-weight: 700; font-size: 15px; padding: 0 0 8px; }
    .small { width: 100%; }
    mat-slide-toggle { display: block; margin-top: 28px; }
    .closing-block { margin-top: 20px; }
  `,
})
export class CampaignFormPage implements OnInit {
  readonly id = input<string>();
  /** Query parameter `?org=` preselects an organization (from "mis organizaciones"). */
  readonly org = input<string>();
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(I18nService);
  readonly auditTypes = AUDIT_TYPE_VALUES;
  readonly options = signal<CampaignOptions | null>(null);
  readonly preview = signal<CampaignPreview | null>(null);
  readonly problems = signal<{ code: string; details?: Record<string, unknown> }[]>([]);
  readonly selectedLangs = signal<Language[]>([...LANGS]);
  readonly busy = signal(false);

  /** Assigned organizations (new) or the campaign's organization (edit; it cannot change). */
  readonly organizations = signal<{ id: string; name: string }[]>([]);

  readonly form = inject(FormBuilder).group({
    organizationId: ['', Validators.required],
    reference: [''],
    norm: ['', Validators.required],
    auditType: ['inicial', Validators.required],
    excellence: [false],
    interviewStartDate: ['', Validators.required],
    scopeSize: [null as number | null, [Validators.required, Validators.min(1)]],
    auditorMinimum: [null as number | null],
    maxCompleted: [null as number | null, Validators.min(1)],
    efrManagerName: [''],
  });

  async ngOnInit(): Promise<void> {
    try {
      const opts = await this.api.get<CampaignOptions>('/campaigns/options');
      this.options.set(opts);
      const id = this.id();
      if (id) {
        const { campaign, organization } = await this.api.get<{ campaign: CampaignDto; organization: { id: string; name: string } }>(`/campaigns/${id}`);
        const m = campaign.m1Config;
        this.organizations.set([{ id: organization.id, name: organization.name }]);
        this.form.patchValue({ ...m, organizationId: organization.id, reference: campaign.reference ?? '', efrManagerName: m.efrManagerName ?? '' });
        this.form.controls.organizationId.disable();
        this.selectedLangs.set(m.languages.filter((l) => (LANGS as readonly string[]).includes(l)));
      } else {
        this.organizations.set(opts.organizations);
        const preset = opts.organizations.find((o) => o.id === this.org()) ?? (opts.organizations.length === 1 ? opts.organizations[0] : null);
        this.form.patchValue({ norm: opts.norms[0] ?? '', organizationId: preset?.id ?? '' });
      }
    } catch (e) {
      this.notify.error(e);
    }
    this.form.valueChanges.pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef)).subscribe(() => void this.refreshPreview());
    await this.refreshPreview();
  }

  needsAuditorMinimum(): boolean {
    const m = this.preview()?.minimum;
    return !!m && m.ok && m.requiresAuditorChoice;
  }

  /** Shown as placeholder: the maximum when the field is left empty (= the minimum). */
  defaultMaximum(): string {
    const m = this.preview()?.minimum;
    return m && m.ok && m.minimum != null ? String(m.minimum) : '';
  }

  rangeHint(): Record<string, unknown> {
    const m = this.preview()?.minimum;
    return m && m.ok ? { min: m.bracket.required, max: m.bracket.rangeMax } : {};
  }

  toggleLang(lang: Language, checked: boolean): void {
    this.selectedLangs.update((l) => (checked ? [...new Set([...l, lang])] : l.filter((x) => x !== lang)));
    void this.refreshPreview();
  }

  private body() {
    const v = this.form.getRawValue();
    return {
      organizationId: v.organizationId ?? '',
      reference: v.reference || undefined,
      norm: v.norm,
      auditType: v.auditType,
      excellence: !!v.excellence,
      interviewStartDate: v.interviewStartDate,
      scopeSize: Number(v.scopeSize),
      auditorMinimum: v.auditorMinimum ? Number(v.auditorMinimum) : null,
      maxCompleted: v.maxCompleted ? Number(v.maxCompleted) : null,
      efrManagerName: v.efrManagerName || null,
      languages: this.selectedLangs(),
    };
  }

  async refreshPreview(): Promise<void> {
    const v = this.form.getRawValue();
    if (!v.organizationId || !v.interviewStartDate || !v.scopeSize || !v.norm || this.selectedLangs().length === 0) {
      this.preview.set(null);
      return;
    }
    try {
      const p = await this.api.post<CampaignPreview>('/campaigns/preview', this.body());
      this.preview.set(p);
      this.problems.set(p.problems.filter((x) => x.code !== 'AUDITOR_MINIMUM_REQUIRED' || !!v.auditorMinimum));
    } catch {
      this.preview.set(null);
    }
  }

  async submit(): Promise<void> {
    this.busy.set(true);
    try {
      const id = this.id();
      const res = id
        ? await this.api.put<{ campaign: CampaignDto }>(`/campaigns/${id}`, this.body())
        : await this.api.post<{ campaign: CampaignDto }>('/campaigns', this.body());
      this.notify.ok(id ? 'common.saved' : 'campaignForm.created');
      await this.router.navigate(['/campaigns', res.campaign.id]);
    } catch (e) {
      const f = toApiFailure(e);
      const problems = (f.details as { problems?: { code: string; details?: Record<string, unknown> }[] })?.problems;
      if (problems) this.problems.set(problems);
      else this.notify.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}
