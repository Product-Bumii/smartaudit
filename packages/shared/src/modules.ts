/**
 * Module-specific configuration sub-documents. Only M1 is built; M2 and M3 are declared for the
 * architecture and intentionally empty.
 */
import type { AuditType, Language } from './enums';

export interface M1Config {
  norm: string;
  auditType: AuditType;
  excellence: boolean;
  /** Bienestar component (P11–P15). */
  wellbeing: boolean;
  leadAuditorId: string;
  /** Only a coding reference; the AI never mentions it. */
  efrManagerName?: string | null;
  /** First day of interviews (local date); the window opens that day (decision 64). */
  interviewStartDate: string;
  scopeSize: number;
  /** Figure chosen by the auditor for ranged brackets (> 16.000). */
  auditorMinimum?: number | null;
  /** Completed interviews at which the campaign closes; `null` = the minimum (decision 65). */
  maxCompleted?: number | null;
  languages: Language[];
}

// TODO(M2): measures inventory and effectiveness evaluation (annex 1000-16).
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface M2Config {}

// TODO(M3): employee / management journeys (annex 1000-12).
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface M3Config {}
