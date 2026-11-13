import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { NotifyService } from '../../core/notify.service';

interface Settings {
  mailFromName: string;
  mailFromAddress: string;
  norms: string[];
}

/**
 * General settings. Technical settings (AI confidence threshold, AI provider, data retention) are not
 * exposed in the interface (decision 55); they keep their defaults in the `settings` collection.
 */
@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, TranslatePipe],
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
      <button mat-flat-button type="submit" [disabled]="form.invalid">{{ 'common.save' | translate }}</button>
    </form>
  `,
})
export class SettingsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  readonly form = inject(FormBuilder).nonNullable.group({
    mailFromName: ['', Validators.required],
    mailFromAddress: ['', [Validators.required, Validators.email]],
    norms: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    const { item } = await this.api.get<{ item: Settings }>('/config/settings');
    this.form.reset({ mailFromName: item.mailFromName, mailFromAddress: item.mailFromAddress, norms: item.norms.join(', ') });
  }

  async save(): Promise<void> {
    const v = this.form.getRawValue();
    try {
      await this.api.put('/config/settings', {
        mailFromName: v.mailFromName,
        mailFromAddress: v.mailFromAddress,
        norms: v.norms.split(',').map((s) => s.trim()).filter(Boolean),
      });
      this.notify.ok('common.saved');
    } catch (e) {
      this.notify.error(e);
    }
  }
}
