import { describe, expect, it } from 'vitest';
import { createLlmProvider, matchOptions, MockLlmProvider, parseClassification, questionWithHint, RecordingLlmProvider, type QuestionPayload } from '../src';

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

  it('recognizes questions about the meaning and confirmations of a proposed interpretation', async () => {
    expect(await llm.classifyAnswer(p3, '¿Qué es un mánager efr?')).toMatchObject({ status: 'question', optionCodes: [] });
    expect(await llm.classifyAnswer(p3, 'que significa eso')).toMatchObject({ status: 'question' });
    const thread = [{ role: 'assistant' as const, text: 'Entiendo que «Algunas veces». ¿Es así?' }];
    expect(await llm.classifyAnswer(p5, 'Sí', { thread, proposedCodes: ['ALGUNAS_VECES'] })).toMatchObject({ status: 'classified', optionCodes: ['ALGUNAS_VECES'], confidence: 0.95 });
    expect(await llm.classifyAnswer(p5, 'No, nunca', { thread, proposedCodes: ['ALGUNAS_VECES'] })).toMatchObject({ optionCodes: ['NUNCA'] });
    expect(await llm.classifyAnswer(p5, 'Sí', { thread: [] })).toMatchObject({ status: 'ambiguous' });
    const p2b = { ...p2, options: [...p2.options, { code: 'NINGUNO', label: 'No he recibido información' }] };
    expect(await llm.classifyAnswer(p2b, 'No me han informado de nada')).toMatchObject({ status: 'classified', optionCodes: ['NINGUNO'] });
  });

  it('follows up with the approved texts for each reason, in the participant language', async () => {
    const r = (reason: 'question' | 'confirm' | 'ambiguous' | 'off_topic', proposedCodes?: string[]) => ({ reason, answer: 'x', thread: [], proposedCodes });
    expect((await llm.phraseClarification({ ...p5, language: 'pt' }, r('ambiguous'))).text).toMatch(/^Obrigado\/a pela sua resposta/);
    expect((await llm.phraseClarification(p5, r('ambiguous'))).text).toContain('(opciones: Siempre · Algunas veces · Nunca)');
    const hinted = { ...p5, answerHint: '¿Diría que siempre, algunas veces o nunca?', explanation: 'Su superior directo/a es la persona de la que depende.' };
    expect((await llm.phraseClarification(hinted, r('off_topic'))).text).toBe('Gracias por su comentario. Volviendo a la pregunta: ¿Su superior directo/a apoya la conciliación y el uso de las medidas efr? ¿Diría que siempre, algunas veces o nunca?');
    expect((await llm.phraseClarification(hinted, r('question'))).text).toMatch(/^Su superior directo\/a es la persona de la que depende\.\n\nSabiendo esto: ¿Su superior/);
    expect((await llm.phraseClarification(p5, r('question'))).text).toMatch(/^Entiendo su duda/);
    expect((await llm.phraseClarification(p5, r('confirm', ['ALGUNAS_VECES']))).text).toBe('Gracias. Entiendo que su respuesta sería «Algunas veces». ¿Es así? Si no, cuénteme cuál sería.');
    expect((await llm.phraseClarification(p2, r('confirm', ['MAIL', 'X']))).text).toContain('«Correo electrónico y X»');
    expect((await llm.phraseClarification(p5, r('confirm', []))).text).toMatch(/^Gracias por su respuesta/);
    for (const language of ['en', 'ca', 'fr'] as const) {
      for (const reason of ['question', 'confirm', 'ambiguous', 'off_topic'] as const) {
        expect((await llm.phraseClarification({ ...p5, language }, r(reason, ['SIEMPRE']))).text.length).toBeGreaterThan(20);
      }
      expect((await llm.phraseClarification({ ...p5, language, explanation: 'E.' }, r('question'))).text).toMatch(/^E\./);
    }
    expect(questionWithHint({ ...p5, options: [] })).toBe(p5.text);
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
    await rec.phraseClarification(p5, { reason: 'ambiguous', answer: 'x', thread: [] });
    await rec.summarize({ tables: {}, comments: [] });
    await rec.anonymizeComment('c', 'es');
    expect(rec.name).toBe('mock');
    expect(rec.calls.map((c) => c.method)).toEqual(['phraseQuestion', 'classifyAnswer', 'phraseClarification', 'summarize', 'anonymizeComment']);
    expect(rec.sentText()).toContain('siempre');
  });
});
