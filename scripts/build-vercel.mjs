// Packages the app in Vercel's Build Output API format (https://vercel.com/docs/build-output-api):
//   .vercel/output/static/                 the built React app, served from Vercel's CDN
//   .vercel/output/functions/api.func/     the Express API, bundled into one file
//   .vercel/output/config.json             routing + the daily cleanup cron
// Run after `npm run build -w client` (see the `build:vercel` script).
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.vercel/output');
const clientDist = join(root, 'client/dist');
const funcDir = join(out, 'functions/api.func');

if (!existsSync(join(clientDist, 'index.html'))) {
  throw new Error('client/dist is missing — run `npm run build -w client` first');
}

rmSync(out, { recursive: true, force: true });
mkdirSync(funcDir, { recursive: true });

// 1. Static files
cpSync(clientDist, join(out, 'static'), { recursive: true });

// 2. The API as one self-contained ES module (no node_modules needed at runtime)
await build({
  entryPoints: [join(root, 'server/src/vercel.ts')],
  outfile: join(funcDir, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  // pg optionally requires a native addon we don't use.
  external: ['pg-native'],
  // Some bundled CommonJS packages call require(); give them one in ESM.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: 'warning',
});

writeFileSync(
  join(funcDir, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      shouldAddSourcemapSupport: true,
      maxDuration: 30,
    },
    null,
    2,
  ),
);

// 3. Routing
writeFileSync(
  join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        // Hashed build assets never change: cache them for a year.
        {
          src: '^/assets/(.*)$',
          headers: { 'cache-control': 'public, max-age=31536000, immutable' },
          continue: true,
        },
        // Every API path goes to the single Express function (it sees the original URL).
        { src: '^/api(?:/.*)?$', dest: '/api' },
        // Real files (index.html, JS, CSS, favicon) are served as-is…
        { handle: 'filesystem' },
        // …and any other path is a client-side route, so serve the React app.
        { src: '^/(.*)$', dest: '/index.html' },
      ],
      // Vercel Hobby allows daily crons: sweep expired sessions and demo sandboxes.
      crons: [{ path: '/api/cron/purge', schedule: '17 5 * * *' }],
    },
    null,
    2,
  ),
);

console.log('✓ Vercel build output written to .vercel/output');
