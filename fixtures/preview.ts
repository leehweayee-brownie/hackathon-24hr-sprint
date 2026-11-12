/**
 * Shows what the rules engine will say about a fixture folder once its recordings are processed,
 * without running the API. Useful before a demo:
 *
 *   npx tsx fixtures/preview.ts bina-jaya 8000000
 *   npx tsx fixtures/preview.ts mega-wira 1800000
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DEFAULT_REQUIRED_DOC_TYPES, DOC_TYPE_DEFINITIONS, DocumentStatus, type ExtractionRecording } from '@vp/shared';
import { evaluate, normalizeValue, type RuleDocument } from '@vp/rules';
import { resolveDateTokens } from './relative-dates';

export async function recordingsToRuleDocuments(folder: string, now = new Date()): Promise<RuleDocument[]> {
  const dir = path.join(__dirname, 'documents', folder);
  const files = (await fs.readdir(dir)).sort();
  const docs: RuleDocument[] = [];
  for (const fileName of files) {
    const rec = JSON.parse(await fs.readFile(path.join(__dirname, 'extractions', `${fileName}.json`), 'utf8')) as ExtractionRecording;
    const def = DOC_TYPE_DEFINITIONS[rec.classification.docType];
    const fields: RuleDocument['fields'] = {};
    for (const f of rec.fields) {
      const raw = f.rawValue === null ? null : resolveDateTokens(f.rawValue, now);
      const kind = def.fields.find((d) => d.key === f.key)?.kind ?? 'text';
      fields[f.key] = { value: normalizeValue(kind, raw), confidence: f.confidence, confirmed: false };
    }
    docs.push({
      id: fileName,
      docType: rec.classification.docType,
      status: DocumentStatus.VERIFIED,
      fileName,
      issuedAt: fields.issue_date?.value ?? null,
      expiresAt: fields.expiry_date?.value ?? null,
      supersededById: null,
      fields,
    });
  }
  return docs;
}

if (require.main === module) {
  const folder = process.argv[2] ?? 'bina-jaya';
  const contractValue = process.argv[3] ? Number(process.argv[3]) : null;
  recordingsToRuleDocuments(folder)
    .then((documents) => {
      const result = evaluate({ documents, contractValue, requiredDocTypes: DEFAULT_REQUIRED_DOC_TYPES, minLiabilityCoverage: 1_000_000 });
      console.log(`${folder}${contractValue ? ` against a RM${contractValue.toLocaleString('en-MY')} tender` : ''}: score ${result.score} (${result.band})`);
      for (const f of result.findings) console.log(`  [${f.severity}] -${f.deduction}  ${f.message}  (${f.documentIds.join(', ')})`);
      if (result.findings.length === 0) console.log('  no findings');
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
