import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { toApiFailure } from './api.service';
import { I18nService } from './i18n.service';

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly snack = inject(MatSnackBar);
  private readonly i18n = inject(I18nService);

  ok(key: string, params?: Record<string, unknown>): void {
    this.snack.open(this.i18n.t(key, params), this.i18n.t('common.close'), { duration: 4000 });
  }

  code(code: string): void {
    this.snack.open(this.i18n.error(code), this.i18n.t('common.close'), { duration: 7000, politeness: 'assertive' });
  }

  error(err: unknown): void {
    const f = toApiFailure(err);
    this.snack.open(this.i18n.error(f.code), this.i18n.t('common.close'), { duration: 7000, politeness: 'assertive' });
  }
}
