import { FormBuilder, Validators } from '@angular/forms';
import type { Language } from '../core/models';

/** Countries offered in the organization form. */
export const COUNTRIES = [
  { code: 'ES', tz: 'Europe/Madrid' },
  { code: 'CO', tz: 'America/Bogota' },
  { code: 'MX', tz: 'America/Mexico_City' },
  { code: 'PE', tz: 'America/Lima' },
  { code: 'CL', tz: 'America/Santiago' },
  { code: 'AR', tz: 'America/Argentina/Buenos_Aires' },
  { code: 'EC', tz: 'America/Guayaquil' },
  { code: 'PT', tz: 'Europe/Lisbon' },
];

export function supportedTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  return intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : COUNTRIES.map((c) => c.tz);
}

export function buildOrgForm(fb: FormBuilder) {
  return fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    country: ['ES', Validators.required],
    timeZone: ['Europe/Madrid', Validators.required],
    defaultLanguage: ['es' as Language, Validators.required],
  });
}
