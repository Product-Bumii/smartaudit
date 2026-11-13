import { build } from 'esbuild';

await build({
  entryPoints: { main: 'src/main.ts' },
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  outdir: 'dist',
  outExtension: { '.js': '.cjs' },
  sourcemap: true,
  external: ['kerberos', '@mongodb-js/zstd', 'snappy', 'aws4', 'mongodb-client-encryption', 'gcp-metadata', '@aws-sdk/credential-providers', 'bson-ext', 'pino-pretty'],
  logLevel: 'info',
});
