/**
 * Data retention (section 4). Indefinite by default: the purge job exists but is OFF in `settings`.
 */

export interface RetentionSettings {
  enabled: boolean;
  /** Delete participant contacts this many days after campaign close. */
  deleteContactsAfterDays: number | null;
  /** Anonymize responses this many years after campaign close. */
  anonymizeResponsesAfterYears: number | null;
}

export const DEFAULT_RETENTION: RetentionSettings = {
  enabled: false,
  deleteContactsAfterDays: null,
  anonymizeResponsesAfterYears: null,
};

export interface RetentionCutoffs {
  /** Campaigns closed before this instant lose their participant contacts. */
  contactsClosedBefore: Date | null;
  /** Campaigns closed before this instant get their responses anonymized. */
  anonymizeClosedBefore: Date | null;
}

/** Returns `null` when the purge is disabled (default). */
export function retentionCutoffs(settings: RetentionSettings, now: Date): RetentionCutoffs | null {
  if (!settings.enabled) return null;
  const contactsClosedBefore =
    settings.deleteContactsAfterDays != null
      ? new Date(now.getTime() - settings.deleteContactsAfterDays * 86_400_000)
      : null;
  let anonymizeClosedBefore: Date | null = null;
  if (settings.anonymizeResponsesAfterYears != null) {
    anonymizeClosedBefore = new Date(now);
    anonymizeClosedBefore.setUTCFullYear(now.getUTCFullYear() - settings.anonymizeResponsesAfterYears);
  }
  return { contactsClosedBefore, anonymizeClosedBefore };
}
