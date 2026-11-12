// Copies the pdf.js runtime into public/pdfjs so the browser loads it as a static ES module.
// pdf.js 5 ships pre-bundled by webpack; re-bundling it through Next's webpack breaks it at runtime.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const buildDir = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'build');
const outDir = path.join(here, '..', 'public', 'pdfjs');
mkdirSync(outDir, { recursive: true });
for (const file of ['pdf.min.mjs', 'pdf.worker.min.mjs']) copyFileSync(path.join(buildDir, file), path.join(outDir, file));
console.log(`pdf.js copied to ${path.relative(process.cwd(), outDir)}`);
