/**
 * Default email templates per language. They can be overridden from the database
 * (`settings.mailTemplates`) without redeploying. Placeholders use `{{name}}` and are HTML-escaped.
 */
import type { Language } from '@smartaudit/shared';

export const TEMPLATE_KEYS = ['magic_link', 'account_created'] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];
// TODO(Fase 2): 'invitation', 'reminder' templates for participants.

export interface TemplateText {
  subject: string;
  /** Title shown in the email body (efr brand: always lowercase). */
  heading?: string;
  /** Paragraphs; a paragraph equal to `{{button}}` renders the call-to-action button. */
  body: string[];
  button?: string;
}

export type TemplateOverrides = Partial<Record<TemplateKey, Partial<Record<Language, TemplateText>>>>;

export const DEFAULT_TEMPLATES: Record<TemplateKey, Record<Language, TemplateText>> = {
  magic_link: {
    es: {
      subject: 'Tu enlace de acceso a SmartAudit efr',
      heading: 'tu enlace de acceso',
      body: ['Hola:', 'Pulsa el botón para entrar en SmartAudit efr. El enlace es de un solo uso y caduca en {{minutes}} minutos.', '{{button}}', 'Si no has solicitado este acceso, ignora este correo.'],
      button: 'Entrar en SmartAudit efr',
    },
    en: {
      subject: 'Your SmartAudit efr sign-in link',
      heading: 'your sign-in link',
      body: ['Hello,', 'Click the button to sign in to SmartAudit efr. The link can be used once and expires in {{minutes}} minutes.', '{{button}}', 'If you did not request this, please ignore this email.'],
      button: 'Sign in to SmartAudit efr',
    },
    ca: {
      subject: "El teu enllaç d'accés a SmartAudit efr",
      heading: "el teu enllaç d'accés",
      body: ["Hola:", "Prem el botó per entrar a SmartAudit efr. L'enllaç és d'un sol ús i caduca en {{minutes}} minuts.", '{{button}}', "Si no has sol·licitat aquest accés, ignora aquest correu."],
      button: 'Entrar a SmartAudit efr',
    },
    pt: {
      subject: 'A sua ligação de acesso ao SmartAudit efr',
      heading: 'a sua ligação de acesso',
      body: ['Olá,', 'Clique no botão para entrar no SmartAudit efr. A ligação é de utilização única e expira em {{minutes}} minutos.', '{{button}}', 'Se não pediu este acesso, ignore este e-mail.'],
      button: 'Entrar no SmartAudit efr',
    },
    fr: {
      subject: "Votre lien d'accès à SmartAudit efr",
      heading: "votre lien d'accès",
      body: ['Bonjour,', 'Cliquez sur le bouton pour accéder à SmartAudit efr. Le lien est à usage unique et expire dans {{minutes}} minutes.', '{{button}}', "Si vous n'avez pas demandé cet accès, ignorez cet e-mail."],
      button: 'Accéder à SmartAudit efr',
    },
  },
  account_created: {
    es: {
      subject: 'Se ha creado tu cuenta en SmartAudit efr',
      heading: 'tu cuenta está lista',
      body: ['Hola:', 'Se ha creado una cuenta de {{role}} para ti en SmartAudit efr ({{organization}}).', 'Para entrar, abre la plataforma e introduce tu correo: recibirás un enlace de acceso.', '{{button}}'],
      button: 'Abrir SmartAudit efr',
    },
    en: {
      subject: 'Your SmartAudit efr account has been created',
      heading: 'your account is ready',
      body: ['Hello,', 'A {{role}} account has been created for you in SmartAudit efr ({{organization}}).', 'To sign in, open the platform and enter your email: you will receive a sign-in link.', '{{button}}'],
      button: 'Open SmartAudit efr',
    },
    ca: {
      subject: "S'ha creat el teu compte a SmartAudit efr",
      heading: 'el teu compte està a punt',
      body: ['Hola:', "S'ha creat un compte de {{role}} per a tu a SmartAudit efr ({{organization}}).", "Per entrar, obre la plataforma i introdueix el teu correu: rebràs un enllaç d'accés.", '{{button}}'],
      button: 'Obrir SmartAudit efr',
    },
    pt: {
      subject: 'A sua conta no SmartAudit efr foi criada',
      heading: 'a sua conta está pronta',
      body: ['Olá,', 'Foi criada para si uma conta de {{role}} no SmartAudit efr ({{organization}}).', 'Para entrar, abra a plataforma e introduza o seu e-mail: receberá uma ligação de acesso.', '{{button}}'],
      button: 'Abrir o SmartAudit efr',
    },
    fr: {
      subject: 'Votre compte SmartAudit efr a été créé',
      heading: 'votre compte est prêt',
      body: ['Bonjour,', 'Un compte {{role}} a été créé pour vous dans SmartAudit efr ({{organization}}).', "Pour vous connecter, ouvrez la plateforme et saisissez votre adresse e-mail : vous recevrez un lien d'accès.", '{{button}}'],
      button: 'Ouvrir SmartAudit efr',
    },
  },
};

/** efr brand (Manual de identidad corporativa efr 2025): Arial, orange #FF6600, gray #333333, flat. */
export interface BrandTheme {
  productName: string;
  poweredBy: string;
  primaryColor: string;
  textColor: string;
  mutedColor: string;
  claim: string;
  siteUrl: string;
  siteLabel: string;
}

export const DEFAULT_BRAND: BrandTheme = {
  productName: 'SmartAudit efr',
  poweredBy: 'powered by Bumii',
  primaryColor: '#FF6600',
  textColor: '#333333',
  mutedColor: '#999999',
  claim: 'efr es conciliación',
  siteUrl: 'https://www.soyefr.org',
  siteLabel: 'www.soyefr.org',
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const fill = (text: string, vars: Record<string, string>, escape: boolean) =>
  text.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => {
    const v = vars[k] ?? '';
    return escape ? escapeHtml(v) : v;
  });

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

export function renderTemplate(
  key: TemplateKey,
  lang: Language,
  vars: Record<string, string> & { url?: string },
  overrides: TemplateOverrides = {},
  brand: BrandTheme = DEFAULT_BRAND,
): RenderedMail {
  const t = overrides[key]?.[lang] ?? DEFAULT_TEMPLATES[key][lang];
  const url = vars.url ?? '';
  const font = 'Arial,Helvetica,sans-serif';
  const htmlParas = t.body.map((p) =>
    p === '{{button}}'
      ? `<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="background:${brand.primaryColor};color:#ffffff;padding:14px 24px;font-family:${font};font-weight:700;font-size:15px;text-decoration:none;display:inline-block">${escapeHtml((t.button ?? url).toLowerCase())}</a></p>`
      : `<p style="margin:0 0 16px;font-size:16px;line-height:1.6">${fill(p, vars, true)}</p>`,
  );
  const textParas = t.body.map((p) => (p === '{{button}}' ? url : fill(p, vars, false)));
  const footer = `${brand.productName} · ${brand.poweredBy}`;
  const heading = t.heading
    ? `<h1 style="margin:0 0 20px;font-family:${font};font-size:28px;line-height:1.2;font-weight:700;color:${brand.primaryColor}">${escapeHtml(t.heading.toLowerCase())}</h1>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff">
<div style="font-family:${font};color:${brand.textColor};max-width:560px;margin:0 auto;padding:32px 24px">
<div style="padding-bottom:20px;margin-bottom:28px;border-bottom:1px solid #E6E6E6"><span style="font-family:${font};font-size:34px;font-weight:700;letter-spacing:-1px;color:${brand.primaryColor}">efr</span> <span style="font-size:13px;color:${brand.textColor};padding-left:8px">${escapeHtml(brand.productName)}</span></div>
${heading}
${htmlParas.join('\n')}
<div style="margin-top:40px;padding-top:16px;border-top:8px solid ${brand.primaryColor};font-size:12px;line-height:1.5;color:${brand.mutedColor}">${escapeHtml(footer)}<br><span style="color:${brand.textColor}">${escapeHtml(brand.claim)}</span> · <a href="${brand.siteUrl}" style="color:${brand.textColor}">${brand.siteLabel}</a></div>
</div></body></html>`;
  return { subject: fill(t.subject, vars, false), html, text: `${textParas.join('\n\n')}\n\n--\n${footer}` };
}
