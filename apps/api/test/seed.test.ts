import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { missingTranslations, type Question } from '@smartaudit/shared';
import { runSeed } from '../../../seed/seed-lib';
import { Questionnaire } from '../src/models';
import { startTestEnv, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await startTestEnv();
});
afterAll(() => env?.stop());

describe('seed: languages added after the first deploy', () => {
  it('fresh databases get the questionnaire in es, en, ca, pt and fr (only es approved)', async () => {
    const v1 = await Questionnaire.findOne({ module: 'M1', version: 1 }).lean();
    expect(v1!.languages.map((l) => `${l.lang}:${l.status}`)).toEqual([
      'es:approved', 'en:pending_approval', 'ca:pending_approval', 'pt:pending_approval', 'fr:pending_approval',
    ]);
  });

  it('publishes a new version with pt/fr when the latest published one lacks them, without touching it', async () => {
    // Simulate a database seeded before pt/fr existed.
    const v1 = await Questionnaire.findOne({ module: 'M1', version: 1 });
    const questions = (v1!.toObject().questions as Question[]).map((q) => {
      const strip = (t?: Record<string, string> | null) => (t ? (delete t.pt, delete t.fr, t) : t);
      strip(q.text as Record<string, string>);
      strip(q.help as Record<string, string> | null);
      q.options.forEach((o) => {
        strip(o.label as Record<string, string>);
        if (o.freeText) strip(o.freeText.label as Record<string, string>);
      });
      return q;
    });
    v1!.set({ languages: v1!.toObject().languages.filter((l) => !['pt', 'fr'].includes(l.lang)), questions });
    v1!.markModified('questions');
    await v1!.save();

    await runSeed(env.ctx.crypto, () => undefined);

    const v2 = await Questionnaire.findOne({ module: 'M1', version: 2 }).lean();
    expect(v2).toMatchObject({ status: 'published' });
    expect(v2!.languages.map((l) => `${l.lang}:${l.status}`)).toEqual([
      'es:approved', 'en:pending_approval', 'ca:pending_approval', 'pt:pending_approval', 'fr:pending_approval',
    ]);
    expect(missingTranslations(v2!.questions as Question[], 'pt')).toEqual([]);
    expect(missingTranslations(v2!.questions as Question[], 'fr')).toEqual([]);
    const untouched = await Questionnaire.findOne({ module: 'M1', version: 1 }).lean();
    expect(untouched!.languages.map((l) => l.lang)).toEqual(['es', 'en', 'ca']);

    // Idempotent: running the seed again does not create v3.
    await runSeed(env.ctx.crypto, () => undefined);
    expect(await Questionnaire.countDocuments({ module: 'M1' })).toBe(2);
  });

  it('publishes a new version with the Bienestar questions (P11–P15) when the latest one lacks them', async () => {
    const latest = (await Questionnaire.findOne({ module: 'M1' }).sort({ version: -1 }))!;
    const before = latest.version;
    latest.set({ questions: (latest.toObject().questions as Question[]).filter((q) => !/^P1[1-5]$/.test(q.code)) });
    latest.markModified('questions');
    await latest.save();
    await runSeed(env.ctx.crypto, () => undefined);
    const next = (await Questionnaire.findOne({ module: 'M1' }).sort({ version: -1 }).lean())!;
    expect(next.version).toBe(before + 1);
    const codes = (next.questions as Question[]).map((q) => q.code);
    expect(codes.slice(-6)).toEqual(['P11', 'P12', 'P13', 'P14', 'P15', 'P10']);
    expect(next.notes).toContain('preguntas añadidas: P11, P12, P13, P14, P15');
  });

  it('publishes the conversational interview and the results base (seed revisions 2–3) over a questionnaire with buttons, keeping its texts', async () => {
    // Simulate the questionnaire published before the conversational interview (staging, change group 3).
    const latest = (await Questionnaire.findOne({ module: 'M1' }).sort({ version: -1 }))!;
    const before = latest.version;
    const old = (latest.toObject().questions as Question[]).map((q) => {
      const { answerMode: _m, answerHint: _h, explanation: _e, ...rest } = q;
      return { ...rest, maxClarifications: q.type === 'free_text' ? 0 : 1, options: q.options.filter((o) => o.code !== 'NINGUNO') };
    });
    const p1 = old.find((q) => q.code === 'P1')!;
    p1.text = { ...p1.text, es: 'Texto de P1 editado por la Fundación' };
    latest.set({ seedRevision: 1, questions: old });
    latest.markModified('questions');
    await latest.save();

    await runSeed(env.ctx.crypto, () => undefined);
    const next = (await Questionnaire.findOne({ module: 'M1' }).sort({ version: -1 }).lean())!;
    expect(next).toMatchObject({ version: before + 1, seedRevision: 3, status: 'published' });
    expect(next.notes).toContain('revisión 3 de la semilla (entrevista conversada, cálculo de resultados)');
    const byCode = Object.fromEntries((next.questions as Question[]).map((q) => [q.code, q]));
    expect(byCode.P1).toMatchObject({ answerMode: 'text', maxClarifications: 2, text: { es: 'Texto de P1 editado por la Fundación' } });
    expect(byCode.P1.answerHint!.es).toBe('Puede responder que sí, que no o que no lo sabe.');
    expect(byCode['P3.1'].explanation!.es).toMatch(/^El Mánager efr es la persona/);
    expect(byCode.P2.options.map((o) => o.code)).toEqual(['INTRANET', 'MAIL', 'REUNIONES', 'BOCA_A_BOCA', 'OTROS', 'NINGUNO']);
    expect(byCode.P10).toMatchObject({ maxClarifications: 0 });
    expect(byCode.P8.results).toEqual({ excludeFromBase: ['NS_NC'] });
    expect(byCode.P10.answerMode).toBeUndefined();

    // Idempotent, and a draft blocks it.
    await runSeed(env.ctx.crypto, () => undefined);
    expect((await Questionnaire.findOne({ module: 'M1' }).sort({ version: -1 }).lean())!.version).toBe(before + 1);
    await Questionnaire.updateOne({ version: before + 1 }, { $set: { seedRevision: 1 } });
    await Questionnaire.create({ module: 'M1', version: before + 2, status: 'draft', questions: [] });
    const logs: string[] = [];
    await runSeed(env.ctx.crypto, (m) => logs.push(m));
    expect(logs.some((m) => /revisión 3 de la semilla .* not applied \(a draft exists\)/.test(m))).toBe(true);
  });
});
