import { describe, expect, it } from 'vitest';
import { createLlmProvider, matchOptions, MockLlmProvider, parseClassification, RecordingLlmProvider, type QuestionPayload } from '../src';

const p5: QuestionPayload = {
  questionCode: 'P5',
  text: '¿Su superior directo/a apoya la conciliación y el uso de las medidas efr?',
  type: 'single',
  options: [
    { code: 'SIEMPRE', label: 'Siempre' },
    { code: 'ALGUNAS_VECES', label: 'Algunas veces' },
    { code: 'NUNCA', label: 'Nunca' },
  ],
  language: 'es',
};
const p3: QuestionPayload = { ...p5, questionCode: 'P3.1', text: '¿Conoce quién es el Mánager efr?', options: [{ code: 'SI', label: 'Sí' }, { code: 'NO', label: 'No' }, { code: 'NS', label: 'No sé' }] };
const p2: QuestionPayload = { ...p5, questionCode: 'P2', type: 'multi', options: [{ code: 'INTRANET', label: 'Intranet' }, { code: 'MAIL', label: 'Correo electrónico' }, { code: 'REUNIONES', label: 'Reuniones' }] };

describe('mock provider', () => {
  const llm = new MockLlmProvider();

  it('phrases the question exactly as the official text', async () => {
    expect((await llm.phraseQuestion(p5)).text).toBe(p5.text);
  });

  it('classifies by labels and synonyms, in several languages', async () => {
    expect(await llm.classifyAnswer(p5, 'Sí, siempre me apoya')).toMatchObject({ status: 'classified', optionCodes: ['SIEMPRE'], confidence: 0.92 });
    expect(await llm.classifyAnswer(p5, 'Sometimes, it depends')).toMatchObject({ status: 'classified', optionCodes: ['ALGUNAS_VECES'] });
    expect(await llm.classifyAnswer(p3, 'No sé quién es')).toMatchObject({ status: 'classified', optionCodes: ['NS'] });
    expect(await llm.classifyAnswer(p2, 'Por correo y en reuniones')).toMatchObject({ status: 'classified', optionCodes: ['MAIL', 'REUNIONES'] });
  });

  it('agreement scale (Bienestar P11–P13)', async () => {
    const p11: QuestionPayload = { ...p5, questionCode: 'P11', options: [{ code: 'EN_DESACUERDO', label: 'En desacuerdo' }, { code: 'NI_DE_ACUERDO_NI_EN_DESACUERDO', label: 'Ni de acuerdo ni en desacuerdo' }, { code: 'DE_ACUERDO', label: 'De acuerdo' }] };
    expect(await llm.classifyAnswer(p11, 'Totalmente de acuerdo')).toMatchObject({ status: 'classified', optionCodes: ['DE_ACUERDO'] });
    expect(await llm.classifyAnswer(p11, 'Estoy en desacuerdo')).toMatchObject({ status: 'classified', optionCodes: ['EN_DESACUERDO'] });
    expect(await llm.classifyAnswer(p11, 'Ni de acuerdo ni en desacuerdo')).toMatchObject({ status: 'classified', optionCodes: ['NI_DE_ACUERDO_NI_EN_DESACUERDO'] });
  });

  it('ambiguous, off topic, hedged and abstained answers', async () => {
    expect(await llm.classifyAnswer(p5, 'Siempre no, nunca tampoco')).toMatchObject({ status: 'ambiguous' });
    expect(await llm.classifyAnswer(p5, 'mmm')).toMatchObject({ status: 'ambiguous', optionCodes: [] });
    expect(await llm.classifyAnswer(p5, 'Hoy hace muy buen tiempo en la oficina')).toMatchObject({ status: 'off_topic' });
    expect(await llm.classifyAnswer(p5, 'Creo que a veces')).toMatchObject({ status: 'classified', confidence: 0.6 });
    expect(await llm.classifyAnswer(p5, 'Prefiero no responder a eso')).toMatchObject({ status: 'abstained' });
  });

  it('clarifies neutrally in the participant language, listing all options', async () => {
    expect((await llm.phraseClarification({ ...p5, language: 'pt' }, 'x')).text).toMatch(/^Para registar bem/);
    expect((await llm.phraseClarification(p5, 'x')).text).toContain('Siempre · Algunas veces · Nunca');
  });

  it('phase 3 placeholders, factory and schema parsing', async () => {
    expect((await llm.summarize()).text).toBe('');
    expect((await llm.anonymizeComment('hola')).text).toBe('hola');
    expect(createLlmProvider().name).toBe('mock');
    expect(() => createLlmProvider('nope')).toThrow(/Unknown/);
    expect(parseClassification({ optionCodes: ['SI'], confidence: 1, status: 'classified', supportingQuote: '' })).not.toBeNull();
    expect(parseClassification({ optionCodes: 'SI' })).toBeNull();
    expect(matchOptions('no se', p3.options)).toEqual(['NS']);
  });

  it('records every payload sent', async () => {
    const rec = new RecordingLlmProvider(llm);
    await rec.phraseQuestion(p5);
    await rec.classifyAnswer(p5, 'siempre');
    await rec.phraseClarification(p5, 'x');
    await rec.summarize({ tables: {}, comments: [] });
    await rec.anonymizeComment('c', 'es');
    expect(rec.name).toBe('mock');
    expect(rec.calls.map((c) => c.method)).toEqual(['phraseQuestion', 'classifyAnswer', 'phraseClarification', 'summarize', 'anonymizeComment']);
    expect(rec.sentText()).toContain('siempre');
  });
});
