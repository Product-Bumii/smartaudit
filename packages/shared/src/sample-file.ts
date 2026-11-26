/**
 * Sample file validation (section 5.4). Operates on a matrix of strings already extracted from
 * the Excel/CSV file by the API. If any error is returned, nothing must be loaded.
 */
import { AGE_BANDS, SENIORITY_BANDS, SEX_VALUES, type AgeBand, type SeniorityBand, type Sex } from './enums';

export const NO_EMAIL_MARKER = 'SIN_CORREO';
export const MAX_TEXT_LENGTH = 120;
export const DEFAULT_MAX_SAMPLE_ROWS = 5000;

export interface Demographics {
  sex: Sex;
  ageBand: AgeBand;
  workCenter: string;
  jobType: string;
  seniorityBand?: SeniorityBand | null;
  area?: string | null;
  shifts?: boolean | null;
  telework?: boolean | null;
  dependents?: boolean | null;
  rlpt?: boolean | null;
}

type ColumnKind =
  | { kind: 'email' }
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'text' }
  | { kind: 'bool' };

export interface SampleColumn {
  /** Column header in the template (Spanish, as agreed with the Fundación). */
  header: string;
  field: 'email' | keyof Demographics;
  required: boolean;
  spec: ColumnKind;
}

export const SAMPLE_COLUMNS: readonly SampleColumn[] = [
  { header: 'correo', field: 'email', required: true, spec: { kind: 'email' } },
  { header: 'sexo', field: 'sex', required: true, spec: { kind: 'enum', values: SEX_VALUES } },
  { header: 'tramo_edad', field: 'ageBand', required: true, spec: { kind: 'enum', values: AGE_BANDS } },
  { header: 'centro_trabajo', field: 'workCenter', required: true, spec: { kind: 'text' } },
  { header: 'tipo_puesto', field: 'jobType', required: true, spec: { kind: 'text' } },
  { header: 'tramo_antiguedad', field: 'seniorityBand', required: false, spec: { kind: 'enum', values: SENIORITY_BANDS } },
  { header: 'area', field: 'area', required: false, spec: { kind: 'text' } },
  { header: 'turnos', field: 'shifts', required: false, spec: { kind: 'bool' } },
  { header: 'teletrabajo', field: 'telework', required: false, spec: { kind: 'bool' } },
  { header: 'hijos_o_dependientes', field: 'dependents', required: false, spec: { kind: 'bool' } },
  { header: 'rlpt', field: 'rlpt', required: false, spec: { kind: 'bool' } },
];

export const BOOL_VALUES = ['Sí', 'No'] as const;

/**
 * Headers that look like prohibited personal data (section 5.8), matched on normalized headers:
 * substrings anywhere, tokens as whole `_`-separated words.
 */
const FORBIDDEN_SUBSTRINGS: readonly string[] = [
  'nombre', 'apellido', 'name', 'cedula', 'pasaporte', 'passport', 'documento', 'identificacion',
  'salari', 'sueldo', 'nomina', 'retribucion', 'sindica', 'salud', 'health', 'medic', 'enfermedad',
  'discapacidad', 'empleado', 'employee', 'legajo', 'telefono', 'phone', 'movil', 'celular', 'direccion',
  'address', 'seguridad_social',
];
const FORBIDDEN_TOKENS: readonly string[] = ['dni', 'nif', 'nie', 'nss', 'iban', 'union', 'baja', 'id', 'ssn'];

/** Lowercase, strip accents, collapse whitespace. Used for tolerant comparisons. */
export function looseKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Bands that Excel turns into dates when they are typed in a cell without text format («6-10» → 6 Oct,
 * «2-5» → 2 May, or 10 Jun / 5 Feb with a month-first locale). Templates downloaded before the fix may hold
 * such dates: the band is recovered when exactly one reading (day-month or month-day) is a valid band.
 * Returns `null` when the date cannot be one of them (the row then fails validation as usual).
 */
export function bandFromExcelDate(date: Date): string | null {
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const bands: readonly string[] = [...SENIORITY_BANDS, ...AGE_BANDS];
  const matches = [...new Set([`${day}-${month}`, `${month}-${day}`])].filter((b) => bands.includes(b));
  return matches.length === 1 ? matches[0] : null;
}

export function normalizeHeader(header: string): string {
  return looseKey(header).replace(/[\s-]+/g, '_');
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

export function isForbiddenHeader(normalizedHeader: string): boolean {
  const tokens = normalizedHeader.split('_');
  return (
    FORBIDDEN_SUBSTRINGS.some((s) => normalizedHeader.includes(s)) || tokens.some((t) => FORBIDDEN_TOKENS.includes(t))
  );
}

export type SampleErrorCode =
  | 'EMPTY_FILE'
  | 'TOO_MANY_ROWS'
  | 'MISSING_COLUMN'
  | 'DUPLICATE_COLUMN'
  | 'UNKNOWN_COLUMN'
  | 'FORBIDDEN_COLUMN'
  | 'REQUIRED'
  | 'INVALID_EMAIL'
  | 'DUPLICATE_EMAIL'
  | 'EMAIL_ALREADY_IN_CAMPAIGN'
  | 'INVALID_VALUE'
  | 'TOO_LONG';

export interface SampleError {
  /** 1-based row number in the file (row 1 = headers). */
  row: number;
  column?: string;
  code: SampleErrorCode;
  /** Allowed values for INVALID_VALUE, first row for DUPLICATE_EMAIL, limit for TOO_MANY_ROWS/TOO_LONG. */
  allowed?: readonly string[];
  firstRow?: number;
  limit?: number;
}

export interface ParsedSampleRow {
  sourceRow: number;
  email: string | null;
  noEmail: boolean;
  demographics: Demographics;
}

export interface DistinctValue {
  value: string;
  count: number;
}

export interface SampleValidationResult {
  ok: boolean;
  errors: SampleError[];
  rows: ParsedSampleRow[];
  distinctValues: { workCenter: DistinctValue[]; jobType: DistinctValue[]; area: DistinctValue[] };
  stats: { total: number; withEmail: number; noEmail: number };
}

export interface SampleValidationOptions {
  maxRows?: number;
  /** Normalized emails already present in the campaign (append mode). */
  existingEmails?: ReadonlySet<string>;
}

/** Canonicalizes free-text values so that «Sede Madrid» and « sede  madrid» count as one. */
class TextCanonicalizer {
  private readonly firstSeen = new Map<string, string>();
  private readonly counts = new Map<string, number>();
  canonical(value: string): string {
    const key = looseKey(value);
    if (!this.firstSeen.has(key)) this.firstSeen.set(key, value);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    return this.firstSeen.get(key) as string;
  }
  list(): DistinctValue[] {
    return [...this.firstSeen.entries()]
      .map(([key, value]) => ({ value, count: this.counts.get(key) as number }))
      .sort((a, b) => a.value.localeCompare(b.value, 'es'));
  }
}

function matchEnum(value: string, allowed: readonly string[]): string | undefined {
  const key = looseKey(value);
  return allowed.find((a) => looseKey(a) === key);
}

export function validateSampleFile(
  headers: readonly string[],
  dataRows: readonly (readonly string[])[],
  options: SampleValidationOptions = {},
): SampleValidationResult {
  const maxRows = options.maxRows ?? DEFAULT_MAX_SAMPLE_ROWS;
  const errors: SampleError[] = [];
  const canon = { workCenter: new TextCanonicalizer(), jobType: new TextCanonicalizer(), area: new TextCanonicalizer() };
  const result = (rows: ParsedSampleRow[]): SampleValidationResult => {
    const noEmail = rows.filter((r) => r.noEmail).length;
    return {
      ok: errors.length === 0,
      errors,
      rows: errors.length === 0 ? rows : [],
      distinctValues: { workCenter: canon.workCenter.list(), jobType: canon.jobType.list(), area: canon.area.list() },
      stats: { total: rows.length, withEmail: rows.length - noEmail, noEmail },
    };
  };

  // ---- Header checks
  const columnIndex = new Map<string, number>();
  let blockingHeaderError = false;
  headers.forEach((raw, idx) => {
    const normalized = normalizeHeader(raw);
    if (normalized === '') return;
    const column = SAMPLE_COLUMNS.find((c) => c.header === normalized);
    if (column) {
      if (columnIndex.has(column.header)) {
        errors.push({ row: 1, column: column.header, code: 'DUPLICATE_COLUMN' });
        blockingHeaderError = true;
      } else columnIndex.set(column.header, idx);
    } else if (isForbiddenHeader(normalized)) {
      errors.push({ row: 1, column: raw.trim(), code: 'FORBIDDEN_COLUMN' });
    } else {
      errors.push({ row: 1, column: raw.trim(), code: 'UNKNOWN_COLUMN' });
    }
  });
  for (const c of SAMPLE_COLUMNS) {
    if (c.required && !columnIndex.has(c.header)) {
      errors.push({ row: 1, column: c.header, code: 'MISSING_COLUMN' });
      blockingHeaderError = true;
    }
  }
  if (blockingHeaderError) return result([]);

  // ---- Rows
  const nonEmpty = dataRows
    .map((cells, i) => ({ cells, row: i + 2 }))
    .filter(({ cells }) => cells.some((c) => (c ?? '').trim() !== ''));
  if (nonEmpty.length === 0) {
    errors.push({ row: 2, code: 'EMPTY_FILE' });
    return result([]);
  }
  if (nonEmpty.length > maxRows) {
    errors.push({ row: nonEmpty[maxRows].row, code: 'TOO_MANY_ROWS', limit: maxRows });
    return result([]);
  }

  const seenEmails = new Map<string, number>();
  const rows: ParsedSampleRow[] = [];
  for (const { cells, row } of nonEmpty) {
    const values: Record<string, unknown> = {};
    let email: string | null = null;
    let noEmail = false;
    for (const c of SAMPLE_COLUMNS) {
      const idx = columnIndex.get(c.header);
      const raw = idx === undefined ? '' : normalizeText(cells[idx] ?? '');
      if (raw === '') {
        if (c.required) errors.push({ row, column: c.header, code: 'REQUIRED' });
        else values[c.field] = null;
        continue;
      }
      switch (c.spec.kind) {
        case 'email': {
          if (raw.toUpperCase() === NO_EMAIL_MARKER) {
            noEmail = true;
            break;
          }
          const e = normalizeEmail(raw);
          if (!isValidEmail(e)) {
            errors.push({ row, column: c.header, code: 'INVALID_EMAIL' });
          } else if (seenEmails.has(e)) {
            errors.push({ row, column: c.header, code: 'DUPLICATE_EMAIL', firstRow: seenEmails.get(e) });
          } else if (options.existingEmails?.has(e)) {
            errors.push({ row, column: c.header, code: 'EMAIL_ALREADY_IN_CAMPAIGN' });
          } else {
            seenEmails.set(e, row);
            email = e;
          }
          break;
        }
        case 'enum': {
          const match = matchEnum(raw, c.spec.values);
          if (match === undefined) {
            errors.push({ row, column: c.header, code: 'INVALID_VALUE', allowed: c.spec.values });
          } else values[c.field] = match;
          break;
        }
        case 'bool': {
          const match = matchEnum(raw, BOOL_VALUES);
          if (match === undefined) errors.push({ row, column: c.header, code: 'INVALID_VALUE', allowed: BOOL_VALUES });
          else values[c.field] = match === 'Sí';
          break;
        }
        case 'text': {
          if (raw.length > MAX_TEXT_LENGTH) {
            errors.push({ row, column: c.header, code: 'TOO_LONG', limit: MAX_TEXT_LENGTH });
          } else {
            const field = c.field as 'workCenter' | 'jobType' | 'area';
            values[field] = canon[field].canonical(raw);
          }
          break;
        }
      }
    }
    rows.push({ sourceRow: row, email, noEmail, demographics: values as unknown as Demographics });
  }
  return result(rows);
}

/** Header row and an example row for the downloadable template. */
export function sampleTemplate(): { headers: string[]; example: string[]; required: string[] } {
  return {
    headers: SAMPLE_COLUMNS.map((c) => c.header),
    required: SAMPLE_COLUMNS.filter((c) => c.required).map((c) => c.header),
    example: ['persona1@empresa.example', 'Mujer', '30-40', 'Sede central', 'Técnico/a', '2-5', 'Operaciones', 'No', 'Sí', 'Sí', 'No'],
  };
}

export interface SmallGroup {
  field: 'sex' | 'ageBand' | 'workCenter' | 'jobType';
  value: string;
  count: number;
}

/** Demographic groups with fewer than `threshold` people (re-identification risk). */
export function smallGroups(demographics: readonly Demographics[], threshold = 3): SmallGroup[] {
  const fields: SmallGroup['field'][] = ['sex', 'ageBand', 'workCenter', 'jobType'];
  const out: SmallGroup[] = [];
  for (const field of fields) {
    const counts = new Map<string, number>();
    demographics.forEach((d) => counts.set(d[field], (counts.get(d[field]) ?? 0) + 1));
    counts.forEach((count, value) => {
      if (count < threshold) out.push({ field, value, count });
    });
  }
  return out;
}

export type SampleAlert = 'SAMPLE_BELOW_MINIMUM' | 'NO_SAMPLE';

/** Alerts about the loaded sample vs. the minimum of completed interviews. Never blocks. */
export function sampleAlerts(sampleSize: number, minimum: number | null): SampleAlert[] {
  if (sampleSize === 0) return ['NO_SAMPLE'];
  if (minimum !== null && sampleSize < minimum) return ['SAMPLE_BELOW_MINIMUM'];
  return [];
}
