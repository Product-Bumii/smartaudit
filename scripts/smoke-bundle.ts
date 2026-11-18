/**
 * Smoke test of the PRODUCTION bundles (apps/api/dist/*.cjs) against an in-memory MongoDB:
 * migrate → seed → server → magic link → campaign → template → sample upload → access codes.
 * Run after `npm run build -w apps/api`: `npm run smoke:bundle`
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const root = join(__dirname, '..');
const port = 3911;
const base = `http://localhost:${port}/api`;

/** Async on purpose: a sync child would block the event loop that drains mongod's output. */
const run = (file: string, env: NodeJS.ProcessEnv) =>
  new Promise<void>((resolve, reject) => {
    const p = spawn('node', [file], { env, stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${file} exited ${code}`))));
  });

async function main() {
  const rs = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 90_000 }] });
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(port),
    MONGO_URL: rs.getUri('smartaudit_smoke'),
    JWT_SECRET: 'smoke-jwt-secret-000000000000000000000000',
    FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
    EMAIL_HASH_KEY: 'smoke-email-hash-key-00000000000000000000',
    MAIL_PROVIDER: 'memory',
    ENABLE_DEV_OUTBOX: 'true',
    LOG_LEVEL: 'warn',
  };
  const dist = join(root, 'apps/api/dist');
  await run(join(dist, 'migrate.cjs'), env);
  await run(join(dist, 'seed.cjs'), env);
  const server = spawn('node', [join(dist, 'server.cjs')], { env, stdio: 'inherit' });
  try {
    for (let i = 0; i < 40; i++) {
      if (await fetch(`${base}/health`).then((r) => r.ok).catch(() => false)) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    const json = { 'content-type': 'application/json' };
    await fetch(`${base}/auth/magic-link`, { method: 'POST', headers: json, body: JSON.stringify({ email: 'auditor2@auditoria.example' }) });
    const outbox = (await (await fetch(`${base}/dev/outbox`)).json()) as { items: { text: string }[] };
    const token = outbox.items.at(-1)!.text.match(/token=([\w-]+)/)![1];
    const verify = await fetch(`${base}/auth/verify`, { method: 'POST', headers: json, body: JSON.stringify({ token }) });
    const cookie = verify.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    const auth = { cookie };

    // auditor2 is the assigned auditor of the seed organization Montaña Textil.
    const options = (await (await fetch(`${base}/campaigns/options`, { headers: auth })).json()) as { organizations: { id: string }[] };
    const created = await fetch(`${base}/campaigns`, {
      method: 'POST',
      headers: { ...json, ...auth },
      body: JSON.stringify({ organizationId: options.organizations[0]?.id, norm: '1000-1', auditType: 'inicial', excellence: false, interviewStartDate: '2026-11-25', scopeSize: 50, languages: ['es'] }),
    });
    const { campaign } = (await created.json()) as { campaign: { id: string; sampling?: { minimum: number } } };
    if (campaign?.sampling?.minimum !== 14) throw new Error(`unexpected campaign ${JSON.stringify(campaign)}`);

    const tpl = await fetch(`${base}/campaigns/sample-template?format=xlsx`, { headers: auth });
    if (!tpl.ok || (await tpl.arrayBuffer()).byteLength < 1000) throw new Error('template download failed');

    const form = new FormData();
    form.append('file', new Blob([readFileSync(join(root, 'seed/samples/muestra-valida-30.xlsx'))]), 'muestra.xlsx');
    const up = await fetch(`${base}/campaigns/${campaign.id}/sample`, { method: 'POST', headers: auth, body: form });
    const upBody = (await up.json()) as { campaign?: { status: string } };
    if (upBody.campaign?.status !== 'muestra_cargada') throw new Error(`upload failed ${JSON.stringify(upBody)}`);

    const codes = await fetch(`${base}/campaigns/${campaign.id}/access-codes?format=xlsx`, { headers: auth });
    if (!codes.ok) throw new Error('codes download failed');
    console.log('✔ production bundle smoke test passed');
  } finally {
    server.kill();
    await rs.stop();
  }
}

main().catch((e) => {
  console.error('✘ smoke test failed:', e);
  process.exit(1);
});
