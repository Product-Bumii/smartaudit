/** Helpers for the Phase 2 tests: launched campaigns, invitation links and participant sessions. */
import type { InterviewAnswerInput, InterviewStateDto } from '@smartaudit/shared';
import request from 'supertest';
import { expect } from 'vitest';
import { Campaign } from '../src/models';
import { runScheduler } from '../src/services/scheduler';
import { campaignInput, type TestEnv } from './helpers';

const HEADER = 'correo,sexo,tramo_edad,centro_trabajo,tipo_puesto';
const SEX = ['Mujer', 'Hombre', 'Otro', 'No indica'];
const AGE = ['<30', '30-40', '41-50', '51-60', '>60'];

/** Synthetic sample: `n` people `<prefix>NNN@demo.example`; every `noEmailEvery`-th one without email. */
export function sampleCsv(n: number, prefix: string, noEmailEvery = 0): Buffer {
  const rows = Array.from({ length: n }, (_, i) => {
    const email = noEmailEvery && (i + 1) % noEmailEvery === 0 ? 'SIN_CORREO' : `${prefix}${String(i + 1).padStart(3, '0')}@demo.example`;
    return [email, SEX[i % 4], AGE[i % 5], i % 2 ? 'Sede central' : 'Planta norte', i % 3 ? 'Técnico/a' : 'Operario/a'].join(',');
  });
  return Buffer.from([HEADER, ...rows].join('\n'));
}

/** Creates the campaign and loads the sample: it is scheduled (`muestra_cargada`) and opens by itself. */
export async function scheduledCampaign(env: TestEnv, auditor: string, csv: Buffer, over: Record<string, unknown> = {}): Promise<string> {
  const created = await request(env.app).post('/api/campaigns').set('Cookie', auditor).send(campaignInput(over)).expect(201);
  const id = created.body.campaign.id as string;
  await request(env.app).post(`/api/campaigns/${id}/sample`).set('Cookie', auditor).attach('file', csv, 'muestra.csv').expect(200);
  return id;
}

/** Moves the clock into the window (1 hour after it opens) and runs the scheduler. */
export async function openWindow(env: TestEnv, campaignId: string): Promise<void> {
  const c = await Campaign.findById(campaignId).lean();
  const t = new Date(c!.window!.opensAt!.getTime() + 3600_000);
  env.ctx.now = () => t;
  await runScheduler(env.ctx);
}

/** Invitation tokens by email, from the emails sent. */
export function invitationTokens(env: TestEnv): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of env.mail.outbox) {
    const token = m.text.match(/\/i\/([A-Za-z0-9_-]+)/)?.[1];
    if (token && !map.has(m.to)) map.set(m.to, token);
  }
  return map;
}

/** A participant browser session opened with the personal link. */
export async function participant(env: TestEnv, token: string) {
  const agent = request.agent(env.app);
  const res = await agent.post(`/api/participant/i/${token}`).expect(200);
  return { agent, session: res.body };
}

export type Persona = (q: NonNullable<InterviewStateDto['question']>, clarifying: boolean) => Omit<InterviewAnswerInput, 'questionCode'>;

/** Answers until the interview is complete; returns the final state. */
export async function runInterview(agent: request.Agent, persona: Persona, language = 'es'): Promise<InterviewStateDto> {
  let state: InterviewStateDto = (await agent.post('/api/participant/interview/start').send({ language, acceptNotice: true }).expect(200)).body;
  for (let guard = 0; state.question && guard < 60; guard++) {
    const input = { ...persona(state.question, state.clarifying), questionCode: state.question.code };
    const res = await agent.post('/api/participant/interview/answer').send(input);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    state = res.body;
  }
  return state;
}

/** Persona that always writes the first option, in its own words (the conversational questionnaire has no buttons). */
export const firstOption: Persona = (q) => ({ kind: 'text', text: q.type === 'free_text' ? 'Sin más comentarios.' : q.options[0].label });
