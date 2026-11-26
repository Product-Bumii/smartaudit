import { describe, expect, it } from 'vitest';
import {
  bandFromExcelDate,
  isForbiddenHeader,
  normalizeHeader,
  sampleAlerts,
  sampleTemplate,
  smallGroups,
  validateSampleFile,
  type Demographics,
} from '../src/sample-file';
import {
  ACCESS_CODE_ALPHABET,
  generateAccessCode,
  generateSlug,
  isWellFormedAccessCode,
  normalizeAccessCode,
  randomString,
} from '../src/codes';

const H = ['correo', 'sexo', 'tramo_edad', 'centro_trabajo', 'tipo_puesto'];
const FULL = [...H, 'tramo_antiguedad', 'area', 'turnos', 'teletrabajo', 'hijos_o_dependientes', 'rlpt'];

describe('validateSampleFile', () => {
  it('accepts a valid file and normalizes values', () => {
    const r = validateSampleFile(
      [' Correo ', 'SEXO', 'Tramo edad', 'Centro-Trabajo', 'tipo puesto', 'tramo_antigüedad', 'Área', 'turnos', 'teletrabajo', 'hijos_o_dependientes', 'rlpt', ''],
      [
        ['Ana@Example.COM ', 'mujer', '<30', ' Sede  Madrid ', 'Técnico', '2-5', 'Ventas', 'si', 'No', 'Sí', 'no'],
        ['sin_correo', 'No Indica', '>60', 'sede madrid', 'Técnico', '', '', '', '', '', ''],
        ['', '', '', '', ''],
        ['b@example.com', 'Hombre', '41-50', 'Sede Bogotá', 'Dirección'],
      ],
    );
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.stats).toEqual({ total: 3, withEmail: 2, noEmail: 1 });
    expect(r.rows[0]).toEqual({
      sourceRow: 2,
      email: 'ana@example.com',
      noEmail: false,
      demographics: {
        sex: 'Mujer',
        ageBand: '<30',
        workCenter: 'Sede Madrid',
        jobType: 'Técnico',
        seniorityBand: '2-5',
        area: 'Ventas',
        shifts: true,
        telework: false,
        dependents: true,
        rlpt: false,
      },
    });
    expect(r.rows[1]).toMatchObject({ sourceRow: 3, email: null, noEmail: true, demographics: { sex: 'No indica', workCenter: 'Sede Madrid', seniorityBand: null, shifts: null } });
    expect(r.rows[2].sourceRow).toBe(5);
    expect(r.distinctValues.workCenter).toEqual([
      { value: 'Sede Bogotá', count: 1 },
      { value: 'Sede Madrid', count: 2 },
    ]);
    expect(r.distinctValues.jobType).toEqual([
      { value: 'Dirección', count: 1 },
      { value: 'Técnico', count: 2 },
    ]);
    expect(r.distinctValues.area).toEqual([{ value: 'Ventas', count: 1 }]);
  });

  it('reports row errors and loads nothing', () => {
    const r = validateSampleFile(FULL, [
      ['malo@', 'Mujer', '30-40', 'A', 'B'],
      ['x@example.com', 'Femenino', '25-30', '', 'B', '20', 'A'.repeat(121), 'quizá'],
      ['X@example.com', 'Hombre', '30-40', 'A', 'B'],
      ['', 'Hombre', '30-40', 'A', 'B'],
      ['dup@example.com', 'Hombre', '30-40', 'A', 'B'],
    ], { existingEmails: new Set(['dup@example.com']) });
    expect(r.ok).toBe(false);
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([
      { row: 2, column: 'correo', code: 'INVALID_EMAIL' },
      { row: 3, column: 'sexo', code: 'INVALID_VALUE', allowed: ['Mujer', 'Hombre', 'Otro', 'No indica'] },
      { row: 3, column: 'tramo_edad', code: 'INVALID_VALUE', allowed: ['<30', '30-40', '41-50', '51-60', '>60'] },
      { row: 3, column: 'centro_trabajo', code: 'REQUIRED' },
      { row: 3, column: 'tramo_antiguedad', code: 'INVALID_VALUE', allowed: ['<2', '2-5', '6-10', '>10'] },
      { row: 3, column: 'area', code: 'TOO_LONG', limit: 120 },
      { row: 3, column: 'turnos', code: 'INVALID_VALUE', allowed: ['Sí', 'No'] },
      { row: 4, column: 'correo', code: 'DUPLICATE_EMAIL', firstRow: 3 },
      { row: 5, column: 'correo', code: 'REQUIRED' },
      { row: 6, column: 'correo', code: 'EMAIL_ALREADY_IN_CAMPAIGN' },
    ]);
  });

  it('flags forbidden and unknown columns but keeps validating rows', () => {
    const r = validateSampleFile([...H, 'Nombre completo', 'DNI', 'num_empleado', 'color'], [['a@example.com', 'Otro', '51-60', 'A', 'B', 'x', 'y', 'z', 'w']]);
    expect(r.errors).toEqual([
      { row: 1, column: 'Nombre completo', code: 'FORBIDDEN_COLUMN' },
      { row: 1, column: 'DNI', code: 'FORBIDDEN_COLUMN' },
      { row: 1, column: 'num_empleado', code: 'FORBIDDEN_COLUMN' },
      { row: 1, column: 'color', code: 'UNKNOWN_COLUMN' },
    ]);
    expect(r.stats.total).toBe(1);
  });

  it('stops at blocking header errors (missing or duplicated columns)', () => {
    const r = validateSampleFile(['correo', 'correo', 'sexo'], [['a@example.com', 'a@example.com', 'Mujer']]);
    expect(r.errors).toEqual([
      { row: 1, column: 'correo', code: 'DUPLICATE_COLUMN' },
      { row: 1, column: 'tramo_edad', code: 'MISSING_COLUMN' },
      { row: 1, column: 'centro_trabajo', code: 'MISSING_COLUMN' },
      { row: 1, column: 'tipo_puesto', code: 'MISSING_COLUMN' },
    ]);
    expect(r.stats.total).toBe(0);
  });

  it('rejects empty files and files over the limit', () => {
    expect(validateSampleFile(H, [['', '', '', '', '']]).errors).toEqual([{ row: 2, code: 'EMPTY_FILE' }]);
    expect(validateSampleFile(H, []).errors).toEqual([{ row: 2, code: 'EMPTY_FILE' }]);
    const rows = [1, 2, 3].map((i) => [`p${i}@example.com`, 'Mujer', '<30', 'A', 'B']);
    expect(validateSampleFile(H, rows, { maxRows: 2 }).errors).toEqual([{ row: 4, code: 'TOO_MANY_ROWS', limit: 2 }]);
  });

  it('treats missing trailing cells as empty', () => {
    const sparse = [undefined, undefined] as unknown as string[];
    const r = validateSampleFile(FULL, [['a@example.com', 'Mujer', '<30', 'A', 'B'], sparse]);
    expect(r.ok).toBe(true);
    expect(r.stats.total).toBe(1);
    expect(r.rows[0].demographics.rlpt).toBeNull();
  });
});

describe('header helpers', () => {
  it('normalizes headers', () => {
    expect(normalizeHeader('  Tramo   de-Edad ')).toBe('tramo_de_edad');
  });
  it.each(['nombre', 'apellidos', 'dni', 'numero_dni', 'cedula', 'salario', 'afiliacion_sindical', 'datos_salud', 'motivo_baja', 'id', 'telefono'])(
    'forbids %s',
    (h) => expect(isForbiddenHeader(h)).toBe(true),
  );
  it.each(['area', 'turnos', 'rlpt', 'centro_trabajo', 'ciudad'])('allows %s', (h) => expect(isForbiddenHeader(h)).toBe(false));

  it('provides the template', () => {
    const t = sampleTemplate();
    expect(t.headers).toEqual(FULL);
    expect(t.required).toEqual(H);
    expect(t.example).toHaveLength(FULL.length);
  });
});

describe('small groups and sample alerts', () => {
  const d = (sex: Demographics['sex'], workCenter: string): Demographics => ({ sex, ageBand: '<30', workCenter, jobType: 'T' });
  it('flags groups under the threshold', () => {
    const groups = smallGroups([d('Mujer', 'A'), d('Mujer', 'A'), d('Mujer', 'A'), d('Hombre', 'B')]);
    expect(groups).toEqual([
      { field: 'sex', value: 'Hombre', count: 1 },
      { field: 'workCenter', value: 'B', count: 1 },
    ]);
  });
  it('alerts when the sample is below the minimum', () => {
    expect(sampleAlerts(0, 14)).toEqual(['NO_SAMPLE']);
    expect(sampleAlerts(10, 14)).toEqual(['SAMPLE_BELOW_MINIMUM']);
    expect(sampleAlerts(20, 14)).toEqual([]);
    expect(sampleAlerts(5, null)).toEqual([]);
  });
});

describe('access codes and slugs', () => {
  let counter = 0;
  const seq = (n: number) => Uint8Array.from({ length: n }, () => counter++ % 256);

  it('generates codes from the unambiguous alphabet', () => {
    const code = generateAccessCode(seq);
    expect(code).toHaveLength(8);
    expect(isWellFormedAccessCode(code)).toBe(true);
    expect(ACCESS_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it('rejects bytes above the unbiased limit (rejection sampling)', () => {
    let calls = 0;
    const highThenLow = (n: number) => Uint8Array.from({ length: n }, () => (calls++ < n ? 255 : 0));
    expect(randomString('ABC', 4, highThenLow)).toBe('AAAA');
  });

  it('generates lowercase slugs', () => {
    expect(generateSlug(seq)).toMatch(/^[a-z2-9]{10}$/);
  });

  it('normalizes typed codes', () => {
    expect(normalizeAccessCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(isWellFormedAccessCode('ABCDEFG0')).toBe(false);
    expect(isWellFormedAccessCode('ABC')).toBe(false);
  });
});

describe('bands that Excel turned into dates (templates downloaded before the fix)', () => {
  it('recovers the band from a day-month or month-day date, only when unambiguous', () => {
    expect(bandFromExcelDate(new Date(Date.UTC(2026, 9, 6)))).toBe('6-10'); // 6-oct
    expect(bandFromExcelDate(new Date(Date.UTC(2026, 5, 10)))).toBe('6-10'); // Jun 10 (month first)
    expect(bandFromExcelDate(new Date(Date.UTC(2026, 4, 2)))).toBe('2-5'); // 2-may
    expect(bandFromExcelDate(new Date(Date.UTC(2026, 1, 5)))).toBe('2-5'); // Feb 5 (month first)
    expect(bandFromExcelDate(new Date(Date.UTC(2026, 2, 3)))).toBeNull(); // 3-3 is no band
  });
});

