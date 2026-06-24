// Compiles the KiwiVoca Tailwind theme to a static stylesheet for design-sync.
// The app styles its UI primitives with Tailwind utility classes + CSS-variable
// tokens (frontend/src/index.css) and loads brand fonts from CDNs (index.html).
// design-sync needs ONE compiled stylesheet (cfg.cssEntry) that carries the
// token definitions, every utility the components use, and the font @imports.
// Re-run on every (re)sync — wired as cfg.buildCmd.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FE = join(ROOT, 'frontend');

// Brand fonts ship from CDNs in index.html via <link>; the bundle's stylesheet
// pulls them in via @import so previews/designs render in the real families.
const FONT_IMPORTS = `@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css");
@import url("https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&family=Noto+Sans+JP:wght@500;700;800&display=swap");
`;

const src = readFileSync(join(FE, 'src/index.css'), 'utf8');
writeFileSync(join(FE, '.ds-input.css'), FONT_IMPORTS + src);

// Scan the app source AND the authored design-sync previews so utility classes
// used only in previews aren't purged.
const content = [
  './src/**/*.{ts,tsx}',
  './index.html',
  '../.design-sync/previews/**/*.{ts,tsx}',
].join(',');

execFileSync(
  join(FE, 'node_modules/.bin/tailwindcss'),
  ['-c', './tailwind.config.ts', '-i', '.ds-input.css', '-o', '.ds-styles.css', '--content', content, '--minify'],
  { cwd: FE, stdio: 'inherit' },
);
console.log('wrote frontend/.ds-styles.css');
