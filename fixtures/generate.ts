/**
 * Generates the fictional demo documents and their recorded extractions.
 * Run from the repo root: npm run fixtures:generate   (or npx tsx fixtures/generate.ts)
 *
 * Dates are relative to the generation day (UTC). Re-run before a demo so that, for example,
 * Bina Jaya's public liability insurance expires in exactly 23 days.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { DocType, type ExtractionRecording } from '@vp/shared';
import { BINA_JAYA, MEGA_WIRA } from './lib/companies';
import { rel } from './lib/common';
import {
  bankReferenceScan,
  brochure,
  cidbCertificate,
  isoCertificate,
  liabilityScheduleScan,
  liabilitySchedulePdf,
  socsoCertificate,
  ssmCertificate,
  ssmEInfoProfile,
  taxClearance,
  type Generated,
} from './lib/docs';
import { validateFixtures } from './validate';

const ROOT = __dirname;
const DOCS = path.join(ROOT, 'documents');
const EXTRACTIONS = path.join(ROOT, 'extractions');

async function clean(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  for (const f of await fs.readdir(dir)) {
    if (f === '.gitkeep' || f.endsWith('.md')) continue;
    await fs.rm(path.join(dir, f), { recursive: true, force: true });
  }
}

async function writeRecording(rec: ExtractionRecording): Promise<void> {
  await fs.writeFile(path.join(EXTRACTIONS, `${rec.fileName}.json`), `${JSON.stringify(rec, null, 2)}\n`);
}

async function main(): Promise<void> {
  const binaDir = path.join(DOCS, 'bina-jaya');
  const megaDir = path.join(DOCS, 'mega-wira');
  const miscDir = path.join(DOCS, 'misc');
  await Promise.all([clean(binaDir), clean(megaDir), clean(miscDir), clean(EXTRACTIONS)]);

  const generated: Generated[] = [];

  // ---- Bina Jaya: the demo upload. Deliberate issues: insurance name mismatch, G5 vs RM8m tender,
  //      insurance expiring in 23 days, two low-confidence fields (SOCSO coverage, bank account_since).
  generated.push(await ssmCertificate(binaDir, '01-ssm-form9.pdf', BINA_JAYA));
  generated.push(await ssmEInfoProfile(binaDir, '02-ssm-einfo-profile.pdf', BINA_JAYA, rel(-5)));
  generated.push(await cidbCertificate(binaDir, '03-cidb-certificate.pdf', BINA_JAYA, rel(-300), rel(+425)));
  generated.push(
    await liabilityScheduleScan(
      binaDir,
      '04-public-liability-policy.jpg',
      {
        insurer: 'Perisai Takaful Am Berhad',
        policyNo: 'PL/2025/0098765',
        insuredParty: 'Bina Jaya Engineering Sdn Bhd',
        address: BINA_JAYA.addressLines,
        limit: 'RM 2,000,000.00',
        from: rel(-342),
        to: rel(+23),
        premium: 'RM 6,850.00',
      },
      42,
    ),
  );
  generated.push(
    await socsoCertificate(binaDir, '05-socso-coverage.pdf', BINA_JAYA, rel(-316), rel(+414), { amount: 'RM 500,000.00', confidence: 0.72, faint: true }, 48),
  );
  generated.push(await taxClearance(binaDir, '06-lhdn-tax-clearance.pdf', BINA_JAYA, rel(-60), rel(+305)));
  generated.push(
    await bankReferenceScan(binaDir, '07-bank-reference.png', BINA_JAYA, 'Bank Maju Berhad', rel(-15), { printed: '10 March 2016', confidence: 0.66, faint: true }, 77),
  );
  generated.push(
    await isoCertificate(binaDir, '08-iso9001.pdf', BINA_JAYA, {
      body: 'Nusantara Certification Services Sdn Bhd',
      standard: 'ISO 9001:2015',
      system: 'Quality Management System',
      certNo: 'NCS-QMS-24-01877',
      scope: 'Provision of building and civil engineering construction services',
      issue: rel(-400),
      expiry: rel(+695),
    }),
  );

  // ---- Mega Wira: clean, fully consistent supplier seeded as already verified (score 100).
  generated.push(await ssmCertificate(megaDir, 'mw-01-ssm-form9.pdf', MEGA_WIRA));
  generated.push(await cidbCertificate(megaDir, 'mw-02-cidb-certificate.pdf', MEGA_WIRA, rel(-200), rel(+500)));
  generated.push(
    await liabilitySchedulePdf(megaDir, 'mw-03-public-liability-policy.pdf', {
      insurer: 'Amanah General Insurance Berhad',
      policyNo: 'PLI-2026-0412233',
      insuredParty: MEGA_WIRA.name,
      address: MEGA_WIRA.addressLines,
      limit: 'RM 5,000,000.00',
      from: rel(-65),
      to: rel(+300),
      premium: 'RM 14,200.00',
    }),
  );
  generated.push(
    await socsoCertificate(megaDir, 'mw-04-socso-coverage.pdf', MEGA_WIRA, rel(-100), rel(+400), { amount: 'RM 1,000,000.00', confidence: 0.93, faint: false }, 126),
  );
  generated.push(await taxClearance(megaDir, 'mw-05-lhdn-tax-clearance.pdf', MEGA_WIRA, rel(-85), rel(+280)));
  generated.push(
    await isoCertificate(megaDir, 'mw-06-iso14001.pdf', MEGA_WIRA, {
      body: 'Nusantara Certification Services Sdn Bhd',
      standard: 'ISO 14001:2015',
      system: 'Environmental Management System',
      certNo: 'NCS-EMS-25-00412',
      scope: 'Building, civil and mechanical & electrical construction works',
      issue: rel(-500),
      expiry: rel(+600),
    }),
  );

  // ---- Misc: an unrelated brochure (OTHER) and a blank "unreadable" scan.
  generated.push(await brochure(miscDir, 'company-brochure.pdf', BINA_JAYA));
  const blankPath = path.join(miscDir, 'unreadable-scan.png');
  await sharp({ create: { width: 64, height: 64, channels: 3, background: '#f2f2f2' } }).png().toFile(blankPath);
  generated.push({
    filePath: blankPath,
    pageCount: 1,
    recording: {
      fileName: 'unreadable-scan.png',
      classification: { docType: DocType.OTHER, confidence: 0.15, reason: 'Image is blank; no readable text' },
      fields: [],
    },
  });

  for (const g of generated) await writeRecording(g.recording);

  const errors = await validateFixtures(ROOT);
  if (errors.length) {
    console.error('Validation failed:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  for (const g of generated) {
    const size = (await fs.stat(g.filePath)).size;
    console.log(
      `${path.relative(ROOT, g.filePath).padEnd(48)} ${g.recording.classification.docType.padEnd(17)} ${String(g.pageCount).padStart(2)}p ${String(Math.round(size / 1024)).padStart(5)} KB  ${g.recording.fields.length} fields`,
    );
  }
  console.log(`\n✔ ${generated.length} documents and recordings written. Fixtures valid.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
