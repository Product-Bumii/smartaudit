import type { Request } from 'express';
import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import mongoose from 'mongoose';
import {
  AGE_BANDS,
  allowedSampleModes,
  BOOL_VALUES,
  generateAccessCode,
  isValidEmail,
  bandFromExcelDate,
  NO_EMAIL_MARKER,
  normalizeEmail,
  normalizeHeader,
  SAMPLE_COLUMNS,
  sampleAlerts,
  sampleTemplate,
  SENIORITY_BANDS,
  SEX_VALUES,
  smallGroups,
  validateSampleFile,
  type Demographics,
  type SampleMode,
} from '@smartaudit/shared';
import type { AppContext } from '../context';
import { audit } from '../lib/audit';
import { randomToken, secureBytes, sha256 } from '../lib/crypto';
import { badRequest, conflict, unprocessable } from '../lib/errors';
import { Campaign, ParticipantContact, Respondent } from '../models';

type CampaignDocument = InstanceType<typeof Campaign>;

export const MAX_SAMPLE_FILE_BYTES = 5 * 1024 * 1024;
/** efr brand for spreadsheets: Arial, header in orange #FF6600 with white bold text. */
const EFR_FONT = { name: 'Arial', size: 10, color: { argb: 'FF333333' } };
function brandHeader(row: ExcelJS.Row): void {
  row.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6600' } };
  row.height = 20;
}
function brandSheet(ws: ExcelJS.Worksheet): void {
  ws.eachRow((row, n) => {
    if (n > 1) row.font = EFR_FONT;
  });
}
/** UTF-8 byte order mark so Excel opens CSV files with accents correctly. */
const BOM = '\uFEFF';

// ---------------------------------------------------------------- Parsing
export async function parseSampleFile(buffer: Buffer, filename: string): Promise<{ headers: string[]; rows: string[][] }> {
  const ext = filename.toLowerCase().split('.').pop();
  let matrix: string[][];
  if (ext === 'csv' || ext === 'txt') {
    matrix = parseCsv(buffer, {
      bom: true,
      delimiter: [',', ';', '\t'],
      relax_column_count: true,
      skip_empty_lines: false,
    }) as string[][];
  } else if (ext === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw badRequest('UNREADABLE_FILE');
    }
    const ws = wb.worksheets[0];
    if (!ws) throw badRequest('UNREADABLE_FILE');
    matrix = [];
    const cols = ws.columnCount;
    for (let i = 1; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const cells: string[] = [];
      for (let j = 1; j <= cols; j++) {
        const value = row.getCell(j).value;
        // A band that Excel turned into a date («6-10» → 6 Oct) in templates downloaded before the fix.
        cells.push(value instanceof Date ? (bandFromExcelDate(value) ?? value.toISOString().slice(0, 10)) : String(row.getCell(j).text ?? ''));
      }
      matrix.push(cells);
    }
  } else {
    throw badRequest('UNSUPPORTED_FILE_TYPE');
  }
  const [headers = [], ...rows] = matrix;
  return { headers, rows };
}

// ---------------------------------------------------------------- Template
export async function sampleTemplateFile(format: 'xlsx' | 'csv'): Promise<{ body: Buffer; contentType: string; filename: string }> {
  const t = sampleTemplate();
  if (format === 'csv') {
    const csv = [t.headers, t.example].map((r) => r.map(csvCell).join(',')).join('\r\n');
    return { body: Buffer.from(`${BOM}${csv}\r\n`, 'utf8'), contentType: 'text/csv; charset=utf-8', filename: 'plantilla-muestra-smartaudit.csv' };
  }
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SmartAudit efr · powered by Bumii';
  const ws = wb.addWorksheet('muestra');
  brandHeader(ws.addRow(t.headers));
  ws.addRow(t.example).font = EFR_FONT;
  ws.columns.forEach((c) => (c.width = 22));
  const list = (values: readonly string[]) => ({ type: 'list' as const, allowBlank: true, formulae: [`"${values.join(',')}"`] });
  const lists: Record<string, readonly string[]> = {
    sexo: SEX_VALUES,
    tramo_edad: AGE_BANDS,
    tramo_antiguedad: SENIORITY_BANDS,
    turnos: BOOL_VALUES,
    teletrabajo: BOOL_VALUES,
    hijos_o_dependientes: BOOL_VALUES,
    rlpt: BOOL_VALUES,
  };
  // Every column is text: otherwise Excel turns bands such as «6-10» or «2-5» into dates (6 Oct, 2 May).
  t.headers.forEach((h, i) => {
    ws.getColumn(i + 1).numFmt = '@';
    const values = lists[h];
    const col = String.fromCharCode(65 + i);
    for (let row = 2; row <= 5001; row++) {
      const cell = ws.getCell(`${col}${row}`);
      cell.numFmt = '@';
      if (values) cell.dataValidation = list(values);
    }
  });
  const help = wb.addWorksheet('instrucciones');
  brandHeader(help.addRow(['columna', 'obligatoria', 'valores']));
  for (const c of SAMPLE_COLUMNS) {
    const values =
      c.spec.kind === 'enum' ? c.spec.values.join(' | ')
      : c.spec.kind === 'bool' ? BOOL_VALUES.join(' | ')
      : c.spec.kind === 'email' ? `Email válido o ${NO_EMAIL_MARKER}`
      : 'Texto';
    help.addRow([c.header, c.required ? 'Sí' : 'No', values]);
  }
  help.addRow([]);
  help.addRow(['No incluya nombres, documentos de identidad, número de empleado, salario, afiliación sindical, datos de salud ni motivos de baja.']);
  help.addRow(['SmartAudit efr · powered by Bumii']);
  help.columns.forEach((c) => (c.width = 40));
  brandSheet(help);
  const body = Buffer.from(await wb.xlsx.writeBuffer());
  return { body, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: 'plantilla-muestra-smartaudit.xlsx' };
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ---------------------------------------------------------------- Upload
export async function uploadSample(
  ctx: AppContext,
  req: Request,
  campaign: CampaignDocument,
  file: { buffer: Buffer; originalname: string },
  mode: SampleMode,
) {
  if (!allowedSampleModes(campaign.status as never).includes(mode)) {
    throw conflict('SAMPLE_MODE_NOT_ALLOWED', { status: campaign.status, mode });
  }
  const { headers, rows } = await parseSampleFile(file.buffer, file.originalname);

  // Existing emails in the campaign (append mode): compare by keyed hash, never by clear text.
  let existingEmails = new Set<string>();
  if (mode === 'append') {
    const emailIdx = headers.findIndex((h) => normalizeHeader(h) === 'correo');
    const candidates = new Map<string, string>();
    if (emailIdx >= 0) {
      for (const r of rows) {
        const e = normalizeEmail(r[emailIdx] ?? '');
        if (e && e.toUpperCase() !== NO_EMAIL_MARKER && isValidEmail(e)) candidates.set(ctx.crypto.hash(e), e);
      }
    }
    const found = await ParticipantContact.find({ campaignId: campaign._id, emailHash: { $in: [...candidates.keys()] } }, { emailHash: 1 }).lean();
    existingEmails = new Set(found.map((c) => candidates.get(c.emailHash as string) as string));
  }

  const result = validateSampleFile(headers, rows, { existingEmails });
  if (!result.ok) throw unprocessable('SAMPLE_INVALID', { errors: result.errors });

  const existingCodes = new Set<string>(
    mode === 'append'
      ? (await ParticipantContact.find({ campaignId: campaign._id, accessCodeHash: { $ne: null } }, { accessCodeHash: 1 }).lean()).map((c) => c.accessCodeHash as string)
      : [],
  );
  const uniqueCode = (): string => {
    for (;;) {
      const code = generateAccessCode(secureBytes);
      const h = sha256(code);
      if (!existingCodes.has(h)) {
        existingCodes.add(h);
        return code;
      }
    }
  };

  await mongoose.connection.transaction(async (session) => {
    if (mode === 'replace') {
      await ParticipantContact.deleteMany({ campaignId: campaign._id }, { session });
      await Respondent.deleteMany({ campaignId: campaign._id }, { session });
    }
    const respondents = await Respondent.insertMany(
      result.rows.map((r) => ({
        campaignId: campaign._id,
        organizationId: campaign.organizationId,
        module: campaign.module,
        demographics: r.demographics,
        status: 'pending',
      })),
      { session },
    );
    await ParticipantContact.insertMany(
      result.rows.map((r, i) => {
        const base = { campaignId: campaign._id, organizationId: campaign.organizationId, respondentId: respondents[i]._id, sourceRow: r.sourceRow, noEmail: r.noEmail };
        if (r.email) {
          const token = randomToken(32);
          return { ...base, emailEncrypted: ctx.crypto.encrypt(r.email), emailHash: ctx.crypto.hash(r.email), invitationTokenHash: sha256(token), invitationTokenEncrypted: ctx.crypto.encrypt(token) };
        }
        const code = uniqueCode();
        return { ...base, accessCodeHash: sha256(code), accessCodeEncrypted: ctx.crypto.encrypt(code) };
      }),
      { session },
    );
    const sampleSize = await Respondent.countDocuments({ campaignId: campaign._id }, { session });
    const update: Record<string, unknown> = { sampleSize, sampleLoadedAt: ctx.now() };
    const push: Record<string, unknown> = {};
    if (campaign.status === 'borrador') {
      update.status = 'muestra_cargada';
      push.statusHistory = { from: 'borrador', to: 'muestra_cargada', at: ctx.now(), by: req.user!.id, reason: 'sample_loaded' };
    }
    await Campaign.updateOne({ _id: campaign._id }, { $set: update, ...(push.statusHistory ? { $push: push } : {}) }, { session });
  });

  await audit(req, {
    action: 'sample.upload',
    resourceType: 'campaign',
    resourceId: String(campaign._id),
    organizationId: String(campaign.organizationId),
    meta: { mode, rows: result.stats.total, withEmail: result.stats.withEmail, noEmail: result.stats.noEmail },
  });
  return { stats: result.stats, distinctValues: result.distinctValues };
}

// ---------------------------------------------------------------- Summary
export async function sampleSummary(campaign: CampaignDocument) {
  const respondents = await Respondent.find({ campaignId: campaign._id }, { demographics: 1, status: 1 }).lean();
  const noEmail = await ParticipantContact.countDocuments({ campaignId: campaign._id, noEmail: true });
  const demographics = respondents.map((r) => r.demographics as Demographics);
  const countBy = (field: keyof Demographics) => {
    const m = new Map<string, number>();
    demographics.forEach((d) => {
      const v = d[field];
      if (v !== null && v !== undefined) m.set(String(v), (m.get(String(v)) ?? 0) + 1);
    });
    return [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, 'es'));
  };
  const minimum = campaign.sampling?.minimum ?? null;
  return {
    total: respondents.length,
    withEmail: respondents.length - noEmail,
    noEmail,
    minimum,
    alerts: sampleAlerts(respondents.length, minimum),
    byStatus: countStatuses(respondents.map((r) => r.status as string)),
    distribution: { sex: countBy('sex'), ageBand: countBy('ageBand') },
    distinctValues: { workCenter: countBy('workCenter'), jobType: countBy('jobType'), area: countBy('area') },
    smallGroups: smallGroups(demographics),
    loadedAt: campaign.sampleLoadedAt,
  };
}

function countStatuses(statuses: string[]): Record<string, number> {
  return statuses.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {});
}

// ---------------------------------------------------------------- Access codes (people without email)
export async function accessCodesFile(ctx: AppContext, req: Request, campaign: CampaignDocument, format: 'xlsx' | 'csv') {
  const contacts = await ParticipantContact.find({ campaignId: campaign._id, noEmail: true, accessCodeEncrypted: { $ne: null }, revokedAt: null })
    .sort({ sourceRow: 1 })
    .lean();
  const respondents = new Map(
    (await Respondent.find({ _id: { $in: contacts.map((c) => c.respondentId) } }, { demographics: 1 }).lean()).map((r) => [String(r._id), r]),
  );
  const link = `${ctx.config.appUrl}/c/${campaign.slug}`;
  const headers = ['fila', 'codigo', 'centro_trabajo', 'tipo_puesto', 'enlace'];
  const rows = contacts.map((c) => {
    const d = respondents.get(String(c.respondentId))?.demographics;
    return [c.sourceRow, ctx.crypto.decrypt(c.accessCodeEncrypted as string), d?.workCenter ?? '', d?.jobType ?? '', link];
  });
  await audit(req, {
    action: 'accessCodes.export',
    resourceType: 'campaign',
    resourceId: String(campaign._id),
    organizationId: String(campaign.organizationId),
    meta: { count: rows.length, format },
  });
  const base = `codigos-acceso-${campaign.slug}`;
  if (format === 'csv') {
    const csv = [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    return { body: Buffer.from(`${BOM}${csv}\r\n`, 'utf8'), contentType: 'text/csv; charset=utf-8', filename: `${base}.csv` };
  }
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SmartAudit efr · powered by Bumii';
  const ws = wb.addWorksheet('codigos');
  brandHeader(ws.addRow(headers));
  rows.forEach((r) => ws.addRow(r));
  ws.columns.forEach((c) => (c.width = 24));
  ws.addRow([]);
  ws.addRow(['SmartAudit efr · powered by Bumii']);
  brandSheet(ws);
  return { body: Buffer.from(await wb.xlsx.writeBuffer()), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `${base}.xlsx` };
}
