/**
 * Neutral clarification used by the mock and as the fallback when the AI output is rejected: it repeats the
 * question and lists ALL options, so it never suggests one.
 */
import type { Language } from '@smartaudit/shared';
import type { QuestionPayload } from './index';

const TEMPLATES: Record<Language, (q: string, options: string) => string> = {
  es: (q, o) => `Para registrar bien su respuesta, ¿podría contestar de nuevo? ${q} (opciones: ${o})`,
  en: (q, o) => `To record your answer correctly, could you answer again? ${q} (options: ${o})`,
  ca: (q, o) => `Per registrar bé la seva resposta, podria contestar de nou? ${q} (opcions: ${o})`,
  pt: (q, o) => `Para registar bem a sua resposta, pode responder novamente? ${q} (opções: ${o})`,
  fr: (q, o) => `Pour bien enregistrer votre réponse, pourriez-vous répondre à nouveau ? ${q} (options : ${o})`,
};

export const defaultClarification = (q: QuestionPayload): string =>
  TEMPLATES[q.language](q.text, q.options.map((o) => o.label).join(' · '));
