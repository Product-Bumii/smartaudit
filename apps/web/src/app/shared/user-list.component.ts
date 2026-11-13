import { Component, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../core/api.service';
import { LANGS, type Language, type UserDto } from '../core/models';
import { NotifyService } from '../core/notify.service';

/** Lists, creates and (de)activates the ORG_ADMINs or AUDITORs of an organization. */
@Component({
  selector: 'app-user-list',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, TranslatePipe],
  template: `
    <section class="card" [attr.data-testid]="'users-' + kind()">
      <h2>{{ title() | translate }}</h2>
      <form class="add" [formGroup]="form" (ngSubmit)="add()">
        <mat-form-field appearance="outline" class="email">
          <mat-label>{{ 'users.email' | translate }}</mat-label>
          <input matInput type="email" formControlName="email" [attr.data-testid]="'new-' + kind() + '-email'" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="lang">
          <mat-label>{{ 'users.language' | translate }}</mat-label>
          <mat-select formControlName="preferredLanguage">
            @for (l of langs; track l) {
              <mat-option [value]="l">{{ 'lang.' + l | translate }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="form.invalid || busy()" [attr.data-testid]="'add-' + kind()">
          {{ 'users.add' | translate }}
        </button>
      </form>
      <div class="table-wrap">
        <table class="simple-table">
          <thead>
            <tr>
              <th>{{ 'users.email' | translate }}</th>
              <th>{{ 'users.language' | translate }}</th>
              <th>{{ 'users.status' | translate }}</th>
              <th><span class="cdk-visually-hidden">{{ 'common.actions' | translate }}</span></th>
            </tr>
          </thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr>
                <td>{{ u.email }}</td>
                <td>{{ 'lang.' + u.preferredLanguage | translate }}</td>
                <td><span class="chip" [class.neutral]="u.status !== 'active'">{{ 'status.' + u.status | translate }}</span></td>
                <td>
                  <button mat-button (click)="toggle(u)">{{ (u.status === 'active' ? 'users.deactivate' : 'users.activate') | translate }}</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="muted">{{ 'users.empty' | translate }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: `
    .add { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
    .email { flex: 1 1 260px; }
    .lang { width: 160px; }
    .add button { margin-top: 8px; }
  `,
})
export class UserListComponent {
  readonly orgId = input.required<string>();
  readonly kind = input.required<'admins' | 'auditors'>();
  readonly title = input.required<string>();
  readonly defaultLanguage = input<Language>('es');

  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  readonly langs = LANGS;
  readonly users = signal<UserDto[]>([]);
  readonly busy = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    preferredLanguage: ['es' as Language],
  });

  constructor() {
    effect(() => {
      this.form.controls.preferredLanguage.setValue(this.defaultLanguage());
      void this.load();
    });
  }

  private base = () => `/organizations/${this.orgId()}/${this.kind()}`;

  async load(): Promise<void> {
    try {
      this.users.set((await this.api.get<{ items: UserDto[] }>(this.base())).items);
    } catch (e) {
      this.notify.error(e);
    }
  }

  async add(): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.post(this.base(), this.form.getRawValue());
      this.form.controls.email.reset('');
      this.notify.ok('users.created');
      await this.load();
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.busy.set(false);
    }
  }

  async toggle(u: UserDto): Promise<void> {
    try {
      await this.api.patch(`${this.base()}/${u.id}`, { status: u.status === 'active' ? 'inactive' : 'active' });
      await this.load();
    } catch (e) {
      this.notify.error(e);
    }
  }
}
