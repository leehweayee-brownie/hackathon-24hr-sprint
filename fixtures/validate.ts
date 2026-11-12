/**
 * Validates every recording in fixtures/extractions against the document-type field definitions
 * and checks that each recorded file exists. Run: npx tsx fixtures/validate.ts
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DOC_TYPE_DEFINITIONS, DocType, type ExtractionRecording } from '@vp/shared';
import { TOKEN_RE, resolveDateTokens } from './relative-dates';

export async function validateFixtures(root = __dirname): Promise<string[]> {
  const errors: string[] = [];
  const extractionsDir = path.join(root, 'extractions');
  const docsDir = path.join(root, 'documents');
  const files = (await fs.readdir(extractionsDir)).filter((f) => f.endsWith('.json'));
  const documentFiles = new Map<string, string>();
  for (const folder of await fs.readdir(docsDir)) {
    const full = path.join(docsDir, folder);
    if (!(await fs.stat(full)).isDirectory()) continue;
    for (const f of await fs.readdir(full)) documentFiles.set(f.toLowerCase(), path.join(full, f));
  }
  for (const file of files) {
    const rec = JSON.parse(await fs.readFile(path.join(extractionsDir, file), 'utf8')) as ExtractionRecording;
    const where = `extractions/${file}`;
    if (`${rec.fileName}.json` !== file) errors.push(`${where}: fileName "${rec.fileName}" does not match the recording file name`);
    if (!documentFiles.has(rec.fileName.toLowerCase())) errors.push(`${where}: no generated document named ${rec.fileName}`);
    const def = DOC_TYPE_DEFINITIONS[rec.classification.docType as DocType];
    if (!def) {
      errors.push(`${where}: unknown docType ${rec.classification.docType}`);
      continue;
    }
    const c = rec.classification.confidence;
    if (typeof c !== 'number' || c < 0 || c > 1) errors.push(`${where}: classification confidence out of range`);
    const seen = new Set<string>();
    for (const f of rec.fields) {
      const fdef = def.fields.find((d) => d.key === f.key);
      if (!fdef) errors.push(`${where}: field "${f.key}" is not defined for ${def.type}`);
      if (seen.has(f.key)) errors.push(`${where}: duplicate field "${f.key}"`);
      seen.add(f.key);
      if (typeof f.confidence !== 'number' || f.confidence < 0 || f.confidence > 1) errors.push(`${where}: ${f.key} confidence out of range`);
      if (!Number.isInteger(f.page) || f.page < 1) errors.push(`${where}: ${f.key} page must be >= 1`);
      if (f.bbox) {
        const { x, y, width, height } = f.bbox;
        if ([x, y, width, height].some((n) => typeof n !== 'number' || n < 0 || n > 1) || x + width > 1.0001 || y + height > 1.0001) {
          errors.push(`${where}: ${f.key} bbox is not within the page (${JSON.stringify(f.bbox)})`);
        }
      }
      if (f.rawValue && TOKEN_RE.test(f.rawValue)) {
        TOKEN_RE.lastIndex = 0;
        if (fdef && fdef.kind !== 'date') errors.push(`${where}: ${f.key} uses a date token but is not a date field`);
        try {
          resolveDateTokens(f.rawValue);
        } catch (e) {
          errors.push(`${where}: ${f.key} token cannot be resolved: ${(e as Error).message}`);
        }
      }
      TOKEN_RE.lastIndex = 0;
    }
    if (rec.classification.confidence >= 0.5) {
      for (const d of def.fields.filter((x) => x.required)) {
        if (!seen.has(d.key)) errors.push(`${where}: required field "${d.key}" missing`);
      }
    }
  }
  for (const [name, full] of documentFiles) {
    if (!files.some((f) => f.toLowerCase() === `${name}.json`)) errors.push(`documents: ${path.relative(root, full)} has no recording`);
  }
  return errors;
}

if (require.main === module) {
  validateFixtures()
    .then((errors) => {
      if (errors.length) {
        console.error(`✖ ${errors.length} problem(s):`);
        for (const e of errors) console.error(`  - ${e}`);
        process.exit(1);
      }
      console.log('✔ fixtures valid');
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
