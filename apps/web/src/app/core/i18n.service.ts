import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { LANGS, type Language } from './models';

const STORAGE_KEY = 'sa.lang';

/** Detects the browser language, remembers the choice and switches at runtime (only the offered `LANGS`). */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  readonly lang = signal<Language>('es');

  async init(): Promise<void> {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    const browser = (navigator.language || 'es').slice(0, 2);
    const initial = [stored, browser].find((l): l is Language => !!l && (LANGS as readonly string[]).includes(l)) ?? 'es';
    await this.use(initial, false);
  }

  async use(requested: Language, remember = true): Promise<void> {
    const lang: Language = (LANGS as readonly string[]).includes(requested) ? requested : 'es';
    await firstValueFrom(this.translate.use(lang));
    this.lang.set(lang);
    this.document.documentElement.lang = lang;
    if (remember) {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        /* storage unavailable: keep in memory */
      }
    }
  }

  t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  /** Translation of an API error code with a generic fallback. */
  error(code: string, params?: Record<string, unknown>): string {
    const key = `errors.${code}`;
    const msg = this.translate.instant(key, params);
    return msg === key ? this.translate.instant('errors.GENERIC', { code }) : msg;
  }
}
