/**
 * Generates the synthetic sample files in seed/samples (deterministic, no real people).
 * Run: `npx tsx seed/generate-samples.ts`
 */
import ExcelJS from 'exceljs';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sampleTemplate } from '@smartaudit/shared';

const out = join(dirname(fileURLToPath(import.meta.url)), 'samples');
const H = sampleTemplate().headers;
const SEX = ['Mujer', 'Hombre', 'Mujer', 'Hombre', 'Otro', 'No indica'];
const AGE = ['<30', '30-40', '41-50', '51-60', '>60'];
const CENTERS = ['Sede central', 'Planta norte', 'Oficina sur'];
const JOBS = ['Técnico/a', 'Administrativo/a', 'Operario/a', 'Mando intermedio', 'Dirección'];
const SEN = ['<2', '2-5', '6-10', '>10'];
const YN = ['Sí', 'No'];

function rows(n: number, noEmailEvery: number, domain: string): string[][] {
  return Array.from({ length: n }, (_, i) => [
    i % noEmailEvery === noEmailEvery - 1 ? 'SIN_CORREO' : `persona${String(i + 1).padStart(3, '0')}@${domain}`,
    SEX[i % SEX.length],
    AGE[i % AGE.length],
    CENTERS[i % CENTERS.length],
    JOBS[i % JOBS.length],
    SEN[i % SEN.length],
    i % 2 ? 'Operaciones' : 'Soporte',
    YN[i % 2],
    YN[(i + 1) % 2],
    YN[i % 3 === 0 ? 0 : 1],
    YN[i % 7 === 0 ? 0 : 1],
  ]);
}

const csv = (matrix: string[][]) =>
  `${matrix.map((r) => r.map((c) => (/[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n')}\n`;

async function xlsx(file: string, matrix: string[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('muestra');
  matrix.forEach((r) => ws.addRow(r));
  await wb.xlsx.writeFile(join(out, file));
}

async function main() {
  const valid = [H, ...rows(30, 6, 'andina.example')];
  writeFileSync(join(out, 'muestra-valida-30.csv'), csv(valid));
  await xlsx('muestra-valida-30.xlsx', valid);

  // 12 rows (below the minimum of 14 for ≤ 90 people) to show the alert.
  writeFileSync(join(out, 'muestra-valida-pequena-12.csv'), csv([H, ...rows(12, 4, 'iberica.example')]));

  // Invalid: one error of each kind.
  const bad = rows(8, 100, 'andina.example');
  bad[1][0] = 'correo-malo@';
  bad[2][0] = bad[3][0].toUpperCase(); // duplicate (case-insensitive)
  bad[4][1] = 'Femenino';
  bad[5][2] = '25-35';
  bad[6][3] = '';
  bad[7][7] = 'Quizá';
  writeFileSync(join(out, 'muestra-invalida-errores-fila.csv'), csv([H, ...bad]));

  // Prohibited columns (name, ID document, salary).
  writeFileSync(
    join(out, 'muestra-invalida-columnas-prohibidas.csv'),
    csv([[...H, 'nombre', 'dni', 'salario'], ...rows(3, 100, 'andina.example').map((r) => [...r, 'Persona Ficticia', '00000000T', '1000'])]),
  );
  console.log('samples written to', out);
}

main();
