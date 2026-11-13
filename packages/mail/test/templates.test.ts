import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '@smartaudit/shared';
import { DEFAULT_TEMPLATES, DisabledMailProvider, MemoryMailProvider, renderTemplate, TEMPLATE_KEYS } from '../src';

describe('mail templates', () => {
  it('exist for every key and language', () => {
    for (const k of TEMPLATE_KEYS) for (const l of LANGUAGES) expect(DEFAULT_TEMPLATES[k][l].subject).toBeTruthy();
  });

  it('renders the magic link with brand footer and escaped values', () => {
    const m = renderTemplate('magic_link', 'es', { url: 'https://efr.bumii.ai/auth/verify?token=a&b', minutes: '15' });
    expect(m.subject).toBe('Tu enlace de acceso a SmartAudit efr');
    expect(m.html).toContain('href="https://efr.bumii.ai/auth/verify?token=a&amp;b"');
    expect(m.html).toContain('powered by Bumii');
    expect(m.html).toContain('#FF6600');
    expect(m.html).toContain('>tu enlace de acceso</h1>');
    expect(m.html).toContain('www.soyefr.org');
    expect(m.text).toContain('caduca en 15 minutos');
    expect(m.text).toContain('https://efr.bumii.ai/auth/verify?token=a&b');
  });

  it('escapes HTML in variables', () => {
    const m = renderTemplate('account_created', 'en', { role: '<b>x</b>', organization: 'A&B', url: 'u' });
    expect(m.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(m.html).toContain('A&amp;B');
  });

  it('uses database overrides when present', () => {
    const m = renderTemplate('magic_link', 'ca', { url: 'u' }, { magic_link: { ca: { subject: 'Hola {{x}}', body: ['b'] } } });
    expect(m.subject).toBe('Hola ');
  });

  it('disabled provider drops messages', async () => {
    expect(await new DisabledMailProvider().send({ to: 'a@example.com', subject: 's', html: 'h', text: 't' })).toEqual({ messageId: 'disabled' });
  });

  it('memory provider stores messages', async () => {
    const p = new MemoryMailProvider();
    await p.send({ to: 'a@example.com', subject: 's', html: 'h', text: 't' });
    expect(p.outbox).toHaveLength(1);
    p.clear();
    expect(p.outbox).toHaveLength(0);
  });
});
