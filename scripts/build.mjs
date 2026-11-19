// Bundles the three Electron entry points (main, preload, renderer) with esbuild
// and copies the static renderer files into dist/.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const production = process.argv.includes('--production');
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'renderer'), { recursive: true });

const common = {
  bundle: true,
  sourcemap: production ? false : 'linked',
  minify: production,
  logLevel: 'warning',
  define: { __DEV__: JSON.stringify(!production) },
};

await Promise.all([
  build({
    ...common,
    entryPoints: [join(root, 'src/main/main.ts')],
    outfile: join(dist, 'main/main.js'),
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
  }),
  build({
    ...common,
    entryPoints: [join(root, 'src/preload/preload.ts')],
    outfile: join(dist, 'preload/preload.js'),
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
  }),
  build({
    ...common,
    entryPoints: [join(root, 'src/presentation/index.ts')],
    outfile: join(dist, 'renderer/app.js'),
    platform: 'browser',
    format: 'iife',
    target: 'chrome130',
  }),
]);

cpSync(join(root, 'static'), join(dist, 'renderer'), { recursive: true });
console.log(`Build ${production ? 'production' : 'development'} OK -> dist/`);
