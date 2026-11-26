/**
 * Deterministic mock adapter for development and tests (no network). It never phrases differently from the
 * official text, classifies by matching option labels and common synonyms in es/en/pt/fr/ca, recognizes when
 * the participant asks what something means and confirmations («sí», «eso es») of a proposed interpretation,
 * and follows up with the default (approved) texts.
 */
import type { Language } from '@smartaudit/shared';
import type { Classification, ClassifyContext, FollowUpRequest, LlmCallMeta, LlmProvider, QuestionPayload } from './index';
import { defaultClarification } from './clarification';
import { PROMPT_VERSION } from './prompts/m1-v2';

const META: LlmCallMeta = { model: 'mock-1', promptVersion: PROMPT_VERSION };

export const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Common ways of saying each option code (normalized, in any supported language). */
const SYNONYMS: Record<string, string[]> = {
  SI: ['si', 'claro', 'por supuesto', 'afirmativo', 'yes', 'of course', 'sim', 'claro que sim', 'oui', 'bien sur'],
  NO: ['no', 'tampoco', 'not really', 'nao', 'non'],
  NS: ['no se', 'no lo se', 'ni idea', 'desconozco', 'dont know', 'do not know', 'no idea', 'nao sei', 'je ne sais pas', 'no ho se'],
  NS_NC: ['no se', 'no lo se', 'ni idea', 'desconozco', 'dont know', 'do not know', 'no idea', 'nao sei', 'je ne sais pas', 'no ho se'],
  SIEMPRE: ['siempre', 'always', 'sempre', 'toujours', 'todos los dias', 'cada dia'],
  ALGUNAS_VECES: ['a veces', 'algunas veces', 'de vez en cuando', 'sometimes', 'as vezes', 'parfois', 'de temps en temps', 'a vegades'],
  NUNCA: ['nunca', 'jamas', 'never', 'jamais', 'mai'],
  POR_ENCIMA: ['mejor', 'por encima', 'superior', 'better', 'above', 'melhor', 'meilleur', 'millor'],
  EN_LA_MEDIA: ['igual', 'en la media', 'parecido', 'similar', 'average', 'the same', 'na media', 'dans la moyenne'],
  POR_DEBAJO: ['peor', 'por debajo', 'inferior', 'worse', 'below', 'pior', 'pire', 'pitjor'],
  POSITIVA: ['positiva', 'buena', 'bien', 'positive', 'good', 'boa', 'bonne'],
  NEUTRA: ['neutra', 'indiferente', 'normal', 'neutral', 'neutre'],
  NEGATIVA: ['negativa', 'mala', 'mal', 'negative', 'bad', 'ma', 'mauvaise'],
  INTRANET: ['intranet', 'portal'],
  MAIL: ['mail', 'correo', 'email', 'e mail', 'courriel'],
  REUNIONES: ['reunion', 'reuniones', 'meeting', 'meetings', 'reuniao', 'reunioes', 'reunions'],
  BOCA_A_BOCA: ['boca a boca', 'companeros', 'colegas', 'word of mouth', 'colleagues', 'bouche a oreille', 'collegues'],
  GRAN_AVANCE: ['mucho', 'gran avance', 'muchisimo', 'a lot', 'great', 'muito', 'beaucoup'],
  MODERADO: ['algo', 'un poco', 'moderado', 'somewhat', 'a little', 'um pouco', 'un peu'],
  NULO: ['nada', 'nulo', 'ninguno', 'nothing', 'nada mudou', 'rien'],
  SI_TIEMPO: ['tiempo', 'horas libres', 'dias libres', 'time off', 'tempo', 'temps'],
  SI_ECONOMICA: ['dinero', 'pagan', 'economica', 'nomina', 'paid', 'money', 'dinheiro', 'argent'],
  SI_AMBAS: ['ambas', 'las dos', 'both', 'ambos', 'les deux'],
  // P2: no information received (conversational questionnaire, decision 92).
  NINGUNO: ['no me han informado', 'no he recibido', 'nadie me ha informado', 'ningun medio', 'por ningun medio', 'ninguno', 'not received', 'nobody told me', 'nao recebi', 'aucune information', 'no m han informat'],
  // P11–P13 (Bienestar): agreement scale. Longer phrases win, so «ni de acuerdo ni en desacuerdo» is not «de acuerdo».
  DE_ACUERDO: ['de acuerdo', 'totalmente de acuerdo', 'estoy de acuerdo', 'agree', 'i agree', 'concordo', 'd accord', 'tout a fait'],
  EN_DESACUERDO: ['en desacuerdo', 'desacuerdo', 'disagree', 'discordo', 'pas d accord', 'en desacord'],
  NI_DE_ACUERDO_NI_EN_DESACUERDO: ['ni de acuerdo ni en desacuerdo', 'neither agree nor disagree', 'nem concordo nem discordo', 'ni l un ni l autre', 'indiferente', 'neutral'],
};

const ABSTAIN = ['prefiero no', 'no quiero responder', 'no quiero contestar', 'paso', 'prefer not', 'rather not', 'prefiro nao', 'je prefere ne pas', 'prefereixo no'];
const HEDGES = ['creo', 'quizas', 'quiza', 'tal vez', 'supongo', 'maybe', 'perhaps', 'i think', 'talvez', 'acho que', 'peut etre', 'je crois'];

/** Asking what something means instead of answering. */
const ASKS = /^(que|a que|en que|what|o que|qu est ce|qu est|que vol dir|quin|quina|cual|como|how)\b/;
/** Confirming a proposed interpretation. */
const AFFIRM = ['si', 'eso es', 'correcto', 'exacto', 'asi es', 'efectivamente', 'yes', 'right', 'correct', 'exactly', 'sim', 'exato', 'isso', 'oui', 'exactement', 'c est ca', 'aixo es'];

const contains = (text: string, phrase: string) => ` ${text} `.includes(` ${phrase} `);

/** Codes mentioned in the text; longer phrases win (so «no sé» is not also «no»). */
export function matchOptions(text: string, options: QuestionPayload['options']): string[] {
  const candidates = options
    .flatMap((o) => [normalize(o.label), ...(SYNONYMS[o.code] ?? [])].filter(Boolean).map((phrase) => ({ code: o.code, phrase })))
    .sort((a, b) => b.phrase.length - a.phrase.length);
  let rest = ` ${text} `;
  const codes = new Set<string>();
  for (const { code, phrase } of candidates) {
    if (contains(rest, phrase)) {
      codes.add(code);
      rest = rest.replaceAll(` ${phrase} `, ' # ');
    }
  }
  return options.map((o) => o.code).filter((c) => codes.has(c));
}

export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';

  async phraseQuestion(q: QuestionPayload) {
    return { text: q.text, ...META };
  }

  async classifyAnswer(q: QuestionPayload, answer: string, context?: ClassifyContext): Promise<Classification & LlmCallMeta> {
    const text = normalize(answer);
    const quote = answer.slice(0, 200);
    const proposed = context?.proposedCodes ?? [];
    if (proposed.length && AFFIRM.some((a) => text === a || text.startsWith(`${a} `))) {
      return { optionCodes: [...proposed], confidence: 0.95, status: 'classified', supportingQuote: quote, ...META };
    }
    if (ABSTAIN.some((p) => contains(text, p))) return { optionCodes: [], confidence: 0.9, status: 'abstained', supportingQuote: quote, ...META };
    const codes = matchOptions(text, q.options);
    if (codes.length === 0 && (answer.includes('?') || ASKS.test(text))) {
      return { optionCodes: [], confidence: 0.9, status: 'question', supportingQuote: '', ...META };
    }
    if (codes.length === 0) {
      const words = text.split(' ').filter(Boolean).length;
      return { optionCodes: [], confidence: 0.3, status: words > 4 ? 'off_topic' : 'ambiguous', supportingQuote: '', ...META };
    }
    if (q.type !== 'multi' && codes.length > 1) return { optionCodes: codes, confidence: 0.4, status: 'ambiguous', supportingQuote: quote, ...META };
    const confidence = HEDGES.some((h) => contains(text, h)) ? 0.6 : 0.92;
    return { optionCodes: codes, confidence, status: 'classified', supportingQuote: quote, ...META };
  }

  async phraseClarification(q: QuestionPayload, request: FollowUpRequest) {
    return { text: defaultClarification(q, request.reason, request.proposedCodes), ...META };
  }

  // TODO(Fase 3): synthesis and comment anonymization (deterministic placeholders for now).
  async summarize(_input?: { tables: unknown; comments: string[] }) {
    return { text: '', ...META };
  }

  async anonymizeComment(comment: string, _language?: Language) {
    return { text: comment, ...META };
  }
}
