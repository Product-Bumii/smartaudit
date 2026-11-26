/**
 * Default follow-ups, used by the mock and as the fallback when the AI output is rejected by the guard
 * (decision 91). They only use approved texts (question, answer hint, explanation, option labels) and never
 * suggest an option: they list all of them, except the confirmation, which names the interpretation proposed.
 */
import type { FollowUpReason, Language } from '@smartaudit/shared';
import type { QuestionPayload } from './index';

interface Texts {
  options: (o: string) => string;
  question: (explanation: string | null, q: string) => string;
  confirm: (labels: string) => string;
  ambiguous: (q: string) => string;
  off_topic: (q: string) => string;
  and: string;
}

const TEXTS: Record<Language, Texts> = {
  es: {
    options: (o) => `(opciones: ${o})`,
    question: (e, q) => (e ? `${e}\n\nSabiendo esto: ${q}` : `Entiendo su duda. La pregunta se refiere a su propia percepción y experiencia. ${q}`),
    confirm: (l) => `Gracias. Entiendo que su respuesta sería «${l}». ¿Es así? Si no, cuénteme cuál sería.`,
    ambiguous: (q) => `Gracias por su respuesta. Para registrarla bien, ¿podría concretar un poco más? ${q}`,
    off_topic: (q) => `Gracias por su comentario. Volviendo a la pregunta: ${q}`,
    and: ' y ',
  },
  en: {
    options: (o) => `(options: ${o})`,
    question: (e, q) => (e ? `${e}\n\nWith this in mind: ${q}` : `I understand your doubt. The question is about your own perception and experience. ${q}`),
    confirm: (l) => `Thank you. I understand your answer would be "${l}". Is that right? If not, please tell me what it would be.`,
    ambiguous: (q) => `Thank you for your answer. To record it correctly, could you be a little more specific? ${q}`,
    off_topic: (q) => `Thank you for your comment. Coming back to the question: ${q}`,
    and: ' and ',
  },
  ca: {
    options: (o) => `(opcions: ${o})`,
    question: (e, q) => (e ? `${e}\n\nSabent això: ${q}` : `Entenc el seu dubte. La pregunta es refereix a la seva pròpia percepció i experiència. ${q}`),
    confirm: (l) => `Gràcies. Entenc que la seva resposta seria «${l}». És així? Si no, expliqui'm quina seria.`,
    ambiguous: (q) => `Gràcies per la seva resposta. Per registrar-la bé, podria concretar una mica més? ${q}`,
    off_topic: (q) => `Gràcies pel seu comentari. Tornant a la pregunta: ${q}`,
    and: ' i ',
  },
  pt: {
    options: (o) => `(opções: ${o})`,
    question: (e, q) => (e ? `${e}\n\nSabendo isto: ${q}` : `Compreendo a sua dúvida. A pergunta refere-se à sua própria perceção e experiência. ${q}`),
    confirm: (l) => `Obrigado/a. Entendo que a sua resposta seria «${l}». É isso? Se não, diga-me qual seria.`,
    ambiguous: (q) => `Obrigado/a pela sua resposta. Para a registar bem, pode concretizar um pouco mais? ${q}`,
    off_topic: (q) => `Obrigado/a pelo seu comentário. Voltando à pergunta: ${q}`,
    and: ' e ',
  },
  fr: {
    options: (o) => `(options : ${o})`,
    question: (e, q) => (e ? `${e}\n\nCela étant précisé : ${q}` : `Je comprends votre doute. La question porte sur votre propre perception et expérience. ${q}`),
    confirm: (l) => `Merci. Je comprends que votre réponse serait « ${l} ». Est-ce bien cela ? Sinon, dites-moi laquelle ce serait.`,
    ambiguous: (q) => `Merci pour votre réponse. Pour bien l'enregistrer, pourriez-vous préciser un peu ? ${q}`,
    off_topic: (q) => `Merci pour votre commentaire. Pour revenir à la question : ${q}`,
    and: ' et ',
  },
};

/** The question as asked in the conversational questionnaire: official text + how to answer (or the options). */
export function questionWithHint(q: QuestionPayload): string {
  const hint = q.answerHint?.trim() || (q.options.length ? TEXTS[q.language].options(q.options.map((o) => o.label).join(' · ')) : '');
  return hint ? `${q.text} ${hint}` : q.text;
}

export function defaultClarification(q: QuestionPayload, reason: FollowUpReason = 'ambiguous', proposedCodes: readonly string[] = []): string {
  const t = TEXTS[q.language];
  const asked = questionWithHint(q);
  switch (reason) {
    case 'question':
      return t.question(q.explanation?.trim() || null, asked);
    case 'confirm': {
      const labels = proposedCodes.map((c) => q.options.find((o) => o.code === c)?.label ?? c);
      return labels.length ? t.confirm(labels.join(t.and)) : t.ambiguous(asked);
    }
    case 'off_topic':
      return t.off_topic(asked);
    case 'ambiguous':
      return t.ambiguous(asked);
  }
}
