/**
 * Verifies that es/en/ca translation files have exactly the same keys and that every literal key
 * used in the Angular templates (`'a.b' | translate`, `t('a.b')`, notify.ok('a.b')) exists.
 * Run: `npm run check:i18n`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '../apps/web');
const langs = ['es', 'en', 'ca'];

const flatten = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const files = Object.fromEntries(
  langs.map((l) => [l, new Set(flatten(JSON.parse(readFileSync(join(root, `public/i18n/${l}.json`), 'utf8'))))]),
);

let problems = 0;
for (const l of langs.slice(1)) {
  const report = (msg: string) => {
    problems++;
    console.error(msg);
  };
  for (const k of files.es) if (!files[l].has(k)) report(`[${l}] missing ${k}`);
  for (const k of files[l]) if (!files.es.has(k)) report(`[es] missing ${k} (present in ${l})`);
}

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });

const patterns = [/'([a-zA-Z]+(?:\.[a-zA-Z_]+)+)'\s*\|\s*translate/g, /\.(?:t|ok)\('([a-zA-Z]+(?:\.[a-zA-Z_]+)+)'/g, /label: '([a-zA-Z]+\.[a-zA-Z_.]+)'/g, /title="([a-zA-Z]+\.[a-zA-Z_.]+)"/g];
for (const file of walk(join(root, 'src'))) {
  const src = readFileSync(file, 'utf8');
  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      if (!files.es.has(m[1])) {
        problems++;
        console.error(`${file.replace(root, 'apps/web')}: unknown key ${m[1]}`);
      }
    }
  }
}

if (problems) {
  console.error(`\n${problems} i18n problem(s)`);
  process.exit(1);
}
console.log(`i18n ok: ${files.es.size} keys × ${langs.length} languages`);
