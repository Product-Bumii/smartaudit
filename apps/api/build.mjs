// Bundles the API (and workspace packages) into a single CommonJS file per entry point.
import { build } from 'esbuild';

// Optional native/cloud dependencies of the MongoDB driver that are not used.
const external = [
  'kerberos', '@mongodb-js/zstd', 'snappy', 'socks', 'aws4', 'mongodb-client-encryption',
  'gcp-metadata', '@aws-sdk/credential-providers', 'bson-ext', 'pino-pretty',
];

await build({
  entryPoints: { server: 'src/server.ts', migrate: 'src/migrate.ts', seed: '../../seed/seed.ts' },
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  outdir: 'dist',
  outExtension: { '.js': '.cjs' },
  sourcemap: true,
  external,
  logLevel: 'info',
});
