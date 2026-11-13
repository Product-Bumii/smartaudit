import { inject, Pipe, PipeTransform } from '@angular/core';
import { I18nService } from '../core/i18n.service';

const LOCALES = { es: 'es-ES', en: 'en-GB', ca: 'ca-ES', pt: 'pt-PT', fr: 'fr-FR' } as const;

/** Formats an instant or local date in an IANA time zone, in the current UI language. */
@Pipe({ name: 'tzDate', pure: false })
export class TzDatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: string | null | undefined, timeZone = 'UTC', mode: 'date' | 'datetime' = 'datetime'): string {
    if (!value) return '—';
    const isLocalDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const date = new Date(isLocalDate ? `${value}T12:00:00Z` : value);
    const opts: Intl.DateTimeFormatOptions =
      mode === 'date' || isLocalDate
        ? { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: isLocalDate ? 'UTC' : timeZone }
        : { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone, timeZoneName: 'short' };
    return new Intl.DateTimeFormat(LOCALES[this.i18n.lang()], opts).format(date);
  }
}
