/**
 * Cambios 4 · bloques 1 y 2: results tables, the auditor's review queue, individual answers and open comments.
 * Synthetic interviews answered in own words through the API (mock AI): «depende» three times ends in review.
 */
import { MockLlmProvider } from '@smartaudit/llm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_USERS } from '../../../seed/seed-lib';
import { AuditLog, Campaign, Interview } from '../src/models';
import { sessionFor, startTestEnv, type TestEnv } from './helpers';
import { firstOption, invitationTokens, openWindow, participant, runInterview, sampleCsv, scheduledCampaign, type Persona } from './phase2-helpers';

let env: TestEnv;
let auditor: string;
let coordinator: string;
let otherEntityAuditor: string;
let superadmin: string;
let id: string;

/** Writes `answers[code]` (or the first option); «depende» three times sends the question to review. */
const scripted =
  (answers: Record<string, string>, comment = 'Sin más comentarios.'): Persona =>
  (q) => {
    if (q.type === 'free_text') return { kind: 'text', text: q.code === 'P10' ? comment : 'Nada que añadir.' };
    return { kind: 'text', text: answers[q.code] ?? q.options[0].label };
  };

beforeAll(async () => {
  env = await startTestEnv({ llm: new MockLlmProvider() });
  auditor = await sessionFor(env, SEED_USERS.auditorMulti, env.entities.CO);
  coordinator = await sessionFor(env, SEED_USERS.coordinatorCO, env.entities.CO);
  otherEntityAuditor = await sessionFor(env, SEED_USERS.auditorES, env.entities.ES);
  superadmin = await sessionFor(env, SEED_USERS.superFundacion);
  id = await scheduledCampaign(env, auditor, sampleCsv(4, 'res', 0), { auditType: 'renovacion', excellence: true, wellbeing: true, interviewStartDate: '2026-11-16', scopeSize: 60 });
  await openWindow(env, id);
  const tokens = invitationTokens(env);
  const run = async (n: number, persona: Persona) => runInterview((await participant(env, tokens.get(`res00${n}@demo.example`)!)).agent, persona);
  await run(1, firstOption);
  await run(2, scripted({ P1: 'depende', P7: 'Siempre', 'P7.1': 'Con tiempo libre', P8: 'No sé' }, 'Más flexibilidad en verano'));
  await run(3, scripted({ P7: 'depende', 'P7.1': 'Me lo pagan con dinero' }, 'Todo bien'));
  // Person 4 starts but does not finish: never counted.
  const p4 = await participant(env, tokens.get('res004@demo.example')!);
  await p4.agent.post('/api/participant/interview/start').send({ language: 'es', acceptNotice: true }).expect(200);
  await p4.agent.post('/api/participant/interview/answer').send({ kind: 'text', questionCode: 'P1', text: 'No' }).expect(200);
}, 120_000);
afterAll(() => env?.stop());

describe('results (bloque 1)', () => {
  it('only completed interviews count; pending answers are counted apart', async () => {
    const r = (await request(env.app).get(`/api/campaigns/${id}/results`).set('Cookie', auditor).expect(200)).body;
    expect(r).toMatchObject({ completed: 3, pendingReview: 2, questionnaireVersion: 1 });
    expect(r.section71).toMatchObject({ modality: 'ai_written_interview', interviews: 3 });
    expect(r.section71.demographics.bySex).toEqual({ Mujer: 1, Hombre: 1, Otro: 1, 'No indica': 0 });
    const p1 = r.questions.find((q: { code: string }) => q.code === 'P1');
    expect(p1).toMatchObject({ answered: 3, valid: 2, pendingReview: 1, text: { es: expect.stringMatching(/^¿Conoce o ha oído hablar/) } });
    expect(p1.options.find((o: { code: string }) => o.code === 'SI')).toMatchObject({ count: 2, percent: 100, label: { es: 'Sí' } });
    // P8: «No sabe / No contesta» out of the base.
    const p8 = r.questions.find((q: { code: string }) => q.code === 'P8');
    expect(p8).toMatchObject({ valid: 2 });
    expect(p8.options.find((o: { code: string }) => o.code === 'NS_NC')).toMatchObject({ count: 1, percent: null, excludedFromBase: true });
    // P7.1 asked after «siempre» and after an unresolved P7.
    expect(r.questions.find((q: { code: string }) => q.code === 'P7.1')).toMatchObject({ answered: 2, valid: 2 });
  });

  it('lead auditor and superadmins only: the coordinator gets 403, another audit entity 404', async () => {
    await request(env.app).get(`/api/campaigns/${id}/results`).set('Cookie', superadmin).expect(200);
    await request(env.app).get(`/api/campaigns/${id}/results`).set('Cookie', coordinator).expect(403);
    await request(env.app).get(`/api/campaigns/${id}/results`).set('Cookie', otherEntityAuditor).expect(404);
    for (const path of ['review', 'responses', 'comments']) {
      await request(env.app).get(`/api/campaigns/${id}/${path}`).set('Cookie', coordinator).expect(403);
      await request(env.app).get(`/api/campaigns/${id}/${path}`).set('Cookie', otherEntityAuditor).expect(404);
    }
  });
});

describe('review (bloque 2)', () => {
  it('the queue shows each pending answer with its conversation and what the AI proposed; the access is logged', async () => {
    const list = (await request(env.app).get(`/api/campaigns/${id}/review`).set('Cookie', auditor).expect(200)).body;
    expect(list.counts).toEqual({ pending: 2, reviewed: 0 });
    expect(list.items.map((i: { questionCode: string }) => i.questionCode)).toEqual(['P1', 'P7']);
    const p7 = list.items[1];
    expect(p7).toMatchObject({ questionType: 'single', status: 'pending_review', aiCodes: [], originalText: 'depende', clarificationsUsed: 2, followUpReason: 'ambiguous', review: null, language: 'es' });
    expect(p7.thread.map((m: { role: string }) => m.role)).toEqual(['assistant', 'participant', 'assistant', 'participant', 'assistant', 'participant']);
    expect(p7.options.map((o: { code: string }) => o.code)).toEqual(['NUNCA', 'ALGUNAS_VECES', 'SIEMPRE']);
    expect(JSON.stringify(list)).not.toMatch(/@demo\.example|respondentId/);
    expect(await AuditLog.exists({ action: 'responses.review.view', resourceId: id })).toBeTruthy();
  });

  it('the auditor decides; results use the decision (P7 «Nunca» takes P7.1 out of the base)', async () => {
    const list = (await request(env.app).get(`/api/campaigns/${id}/review`).set('Cookie', auditor).expect(200)).body;
    const [p1, p7] = list.items as { interviewId: string; questionCode: string }[];
    const put = (item: { interviewId: string; questionCode: string }, body: object, cookie = auditor) =>
      request(env.app).put(`/api/campaigns/${id}/review/${item.interviewId}/${item.questionCode}`).set('Cookie', cookie).send(body);

    expect((await put(p7, { decision: 'codes', optionCodes: ['NUNCA'], note: 'Por el contexto' }).expect(200)).body).toEqual({ counts: { pending: 1, reviewed: 1 } });
    await put(p1, { decision: 'no_valid_answer' }).expect(200);

    const r = (await request(env.app).get(`/api/campaigns/${id}/results`).set('Cookie', auditor).expect(200)).body;
    expect(r.pendingReview).toBe(0);
    expect(r.questions.find((q: { code: string }) => q.code === 'P1')).toMatchObject({ valid: 2, noValidAnswer: 1, pendingReview: 0 });
    expect(r.questions.find((q: { code: string }) => q.code === 'P7')).toMatchObject({ valid: 3 });
    expect(r.questions.find((q: { code: string }) => q.code === 'P7.1')).toMatchObject({ answered: 2, valid: 1, outsideCondition: 1 });

    const reviewed = (await request(env.app).get(`/api/campaigns/${id}/review?state=reviewed`).set('Cookie', auditor).expect(200)).body;
    expect(reviewed.items.find((i: { questionCode: string }) => i.questionCode === 'P7').review).toMatchObject({ decision: 'codes', optionCodes: ['NUNCA'], note: 'Por el contexto' });
    expect((await request(env.app).get(`/api/campaigns/${id}/review?state=all`).set('Cookie', auditor).expect(200)).body.items).toHaveLength(2);
    // A decision can be changed (and is logged each time).
    await put(p1, { decision: 'abstention' }).expect(200);
    expect(await AuditLog.countDocuments({ action: 'responses.review', 'meta.campaignId': id })).toBe(3);
    // Superadmins may review too; the coordinator may not.
    await put(p1, { decision: 'codes', optionCodes: ['SI'] }, superadmin).expect(200);
    await put(p1, { decision: 'abstention' }, coordinator).expect(403);
  });

  it('invalid decisions and answers that were not sent to review are refused', async () => {
    const i = await Interview.findOne({ campaignId: id, state: 'completed' }).lean();
    const base = `/api/campaigns/${id}/review/${i!._id}`;
    await request(env.app).put(`${base}/P1`).set('Cookie', auditor).send({ decision: 'codes', optionCodes: ['SI', 'NO'] }).expect(422);
    await request(env.app).put(`${base}/P1`).set('Cookie', auditor).send({ decision: 'maybe' }).expect(400);
    await request(env.app).put(`${base}/P10`).set('Cookie', auditor).send({ decision: 'abstention' }).expect(422);
    await request(env.app).put(`${base}/P99`).set('Cookie', auditor).send({ decision: 'abstention' }).expect(404);
    await request(env.app).put(`/api/campaigns/${id}/review/not-an-id/P1`).set('Cookie', auditor).send({ decision: 'abstention' }).expect(404);
    await request(env.app).put(`/api/campaigns/${id}/review/${'a'.repeat(24)}/P1`).set('Cookie', auditor).send({ decision: 'abstention' }).expect(404);
    // Person 1 answered P2 clearly: there is nothing to review.
    const first = (await Interview.find({ campaignId: id, state: 'completed' }).lean()).find((x) => x.answers.every((a) => a.status !== 'pending_review'))!;
    const conflict = await request(env.app).put(`/api/campaigns/${id}/review/${first._id}/P2`).set('Cookie', auditor).send({ decision: 'abstention' }).expect(409);
    expect(conflict.body.error.code).toBe('NOT_REVIEWABLE');
  });
});

describe('individual answers and open comments (bloque 2)', () => {
  it('rows with demographics and effective codes; no identity, file row or dates; small groups; access logged', async () => {
    const r = (await request(env.app).get(`/api/campaigns/${id}/responses`).set('Cookie', auditor).expect(200)).body;
    expect(r.rows).toHaveLength(3);
    expect(r.questions.map((q: { code: string }) => q.code)).not.toContain('P10');
    expect(r.questions.map((q: { code: string }) => q.code)).toContain('P11');
    expect(Object.keys(r.rows[0].demographics)).toEqual(['sex', 'ageBand', 'workCenter', 'jobType', 'seniorityBand', 'area', 'shifts', 'telework', 'dependents', 'rlpt']);
    expect(r.rows.map((x: { answers: Record<string, { kind: string }> }) => x.answers.P7.kind).sort()).toEqual(['codes', 'codes', 'codes']);
    expect(r.rows.some((x: { answers: Record<string, { reviewed: boolean; codes: string[] }> }) => x.answers.P7.reviewed && x.answers.P7.codes[0] === 'NUNCA')).toBe(true);
    expect(r.smallGroups.length).toBeGreaterThan(0);
    expect(JSON.stringify(r)).not.toMatch(/@|sourceRow|completedAt|respondentId|interviewId/);
    expect(await AuditLog.exists({ action: 'responses.view', resourceId: id })).toBeTruthy();
  });

  it('open answers are listed apart, without demographics', async () => {
    const r = (await request(env.app).get(`/api/campaigns/${id}/comments`).set('Cookie', auditor).expect(200)).body;
    expect(r.questions.map((q: { code: string }) => q.code)).toEqual(['P14', 'P15', 'P10']);
    expect([...r.questions[2].comments].sort()).toEqual(['Más flexibilidad en verano', 'Sin más comentarios.', 'Todo bien']);
    expect([...r.questions[0].comments].sort()).toEqual(['Nada que añadir.', 'Nada que añadir.', 'Sin más comentarios.']);
    expect(JSON.stringify(r)).not.toMatch(/sex|ageBand|workCenter/);
    expect(await AuditLog.exists({ action: 'responses.comments.view', resourceId: id })).toBeTruthy();
  });

  it('after the report is generated, decisions can no longer change', async () => {
    await Campaign.updateOne({ _id: id }, { $set: { status: 'informe_generado' } });
    const list = (await request(env.app).get(`/api/campaigns/${id}/review?state=all`).set('Cookie', auditor).expect(200)).body;
    const item = list.items[0];
    const res = await request(env.app).put(`/api/campaigns/${id}/review/${item.interviewId}/${item.questionCode}`).set('Cookie', auditor).send({ decision: 'abstention' }).expect(409);
    expect(res.body.error.code).toBe('REPORT_ALREADY_GENERATED');
  });
});
