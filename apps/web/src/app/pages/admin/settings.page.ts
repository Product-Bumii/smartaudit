import { Component, computed, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';

interface Settings {
  confidenceThreshold: number;
  llmProvider: string;
  mailFromName: string;
  mailFromAddress: string;
  norms: string[];
  retention: { enabled: boolean; deleteContactsAfterDays: number | null; anonymizeResponsesAfterYears: number | null };
}

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, TranslatePipe],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()">
      <section class="card">
        <h2>{{ 'settings.general' | translate }}</h2>
        <div class="grid-2">
          <mat-form-field appearance="outline"><mat-label>{{ 'settings.mailFromName' | translate }}</mat-label><input matInput formControlName="mailFromName" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'settings.mailFromAddress' | translate }}</mat-label><input matInput type="email" formControlName="mailFromAddress" /></mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'settings.norms' | translate }}</mat-label>
            <input matInput formControlName="norms" />
            <mat-hint>{{ 'settings.normsHint' | translate }}</mat-hint>
          </mat-form-field>
        </div>
      </section>
      <section class="card">
        <h2>{{ 'settings.technical' | translate }}</h2>
        @if (!isBumii()) { <div class="alert info">{{ 'settings.technicalOnlyBumii' | translate }}</div> }
        <div class="grid-2">
          <mat-form-field appearance="outline"><mat-label>{{ 'settings.confidenceThreshold' | translate }}</mat-label><input matInput type="number" step="0.05" min="0" max="1" formControlName="confidenceThreshold" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'settings.llmProvider' | translate }}</mat-label><input matInput formControlName="llmProvider" /></mat-form-field>
        </div>
        <h3>{{ 'settings.retention' | translate }}</h3>
        <p class="muted">{{ 'settings.retentionHelp' | translate }}</p>
        <div formGroupName="retention">
          <mat-checkbox formControlName="enabled">{{ 'settings.retentionEnabled' | translate }}</mat-checkbox>
          <div class="grid-2">
            <mat-form-field appearance="outline"><mat-label>{{ 'settings.deleteContactsAfterDays' | translate }}</mat-label><input matInput type="number" min="1" formControlName="deleteContactsAfterDays" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ 'settings.anonymizeResponsesAfterYears' | translate }}</mat-label><input matInput type="number" min="1" formControlName="anonymizeResponsesAfterYears" /></mat-form-field>
          </div>
        </div>
      </section>
      <button mat-flat-button type="submit" [disabled]="form.invalid">{{ 'common.save' | translate }}</button>
    </form>
  `,
})
export class SettingsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly auth = inject(AuthService);
  readonly isBumii = computed(() => this.auth.user()?.role === 'SUPERADMIN_BUMII');
  readonly form = inject(FormBuilder).group({
    mailFromName: ['', Validators.required],
    mailFromAddress: ['', [Validators.required, Validators.email]],
    norms: ['', Validators.required],
    confidenceThreshold: [0.8, [Validators.min(0), Validators.max(1)]],
    llmProvider: [''],
    retention: inject(FormBuilder).group({
      enabled: [false],
      deleteContactsAfterDays: [null as number | null],
      anonymizeResponsesAfterYears: [null as number | null],
    }),
  });

  async ngOnInit(): Promise<void> {
    const { item } = await this.api.get<{ item: Settings }>('/config/settings');
    this.form.reset({ ...item, norms: item.norms.join(', ') });
    if (!this.isBumii()) {
      this.form.controls.confidenceThreshold.disable();
      this.form.controls.llmProvider.disable();
      this.form.controls.retention.disable();
    }
  }

  async save(): Promise<void> {
    const v = this.form.getRawValue();
    const body: Record<string, unknown> = {
      mailFromName: v.mailFromName,
      mailFromAddress: v.mailFromAddress,
      norms: (v.norms ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    };
    if (this.isBumii()) {
      body['confidenceThreshold'] = Number(v.confidenceThreshold);
      body['llmProvider'] = v.llmProvider;
      body['retention'] = {
        enabled: !!v.retention.enabled,
        deleteContactsAfterDays: v.retention.deleteContactsAfterDays ? Number(v.retention.deleteContactsAfterDays) : null,
        anonymizeResponsesAfterYears: v.retention.anonymizeResponsesAfterYears ? Number(v.retention.anonymizeResponsesAfterYears) : null,
      };
    }
    try {
      await this.api.put('/config/settings', body);
      this.notify.ok('common.saved');
    } catch (e) {
      this.notify.error(e);
    }
  }
}
