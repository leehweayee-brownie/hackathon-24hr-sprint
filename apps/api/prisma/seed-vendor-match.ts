/**
 * Vendor Match demo data. Additive and idempotent: adds verified suppliers, their documents and
 * past rated jobs with Northbridge, and skips any supplier that already exists. Safe to run on a
 * database that already has the main seed (it never deletes anything).
 *
 *   npm run db:seed:match -w @vp/api
 *
 * The pool it creates, for the example brief "Building works · RM7M · PL ≥ RM5M · ISO 9001 ·
 * bank reference · Feb 2027 – Jan 2028 · Selangor":
 *   Teguh Struktur  G7, RM10M cover valid past the contract, ISO 9001, rated from 3 past jobs  → qualified
 *   Hijau Landskap  G6, RM6M cover, ISO 9001, no bank reference letter                         → conditional
 *   Seri Murni      G6, RM3M cover (below RM5M), tax clearance expiring mid-contract           → conditional
 *   Cahaya Bina      G5: caps at RM5M, so excluded for a RM7M tender, and shown with the reason   → excluded
 */
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DocType as PrismaDocType, DocumentStatus, OrganizationType, PassportStatus, Prisma, PrismaClient, Severity, UserRole, VendorCheckStatus } from '@prisma/client';
import argon2 from 'argon2';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { DEFAULT_REQUIRED_DOC_TYPES, DOC_TYPE_DEFINITIONS, DocType } from '@vp/shared';
import { evaluate, normalizeValue, type RuleDocument } from '@vp/rules';

const API_DIR = path.resolve(__dirname, '..');
const PASSWORD = 'Password123!';
const NOW = new Date();
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthsAhead = (n: number) => {
  const d = new Date(NOW);
  d.setUTCMonth(d.getUTCMonth() + n);
  return iso(d);
};
const monthsAgo = (n: number) => monthsAhead(-n);
const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const uuid = () => randomBytes(16).toString('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');

async function loadEnv(): Promise<void> {
  try {
    const text = await fs.readFile(path.join(API_DIR, '.env'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    }
  } catch {
    /* no .env: rely on the environment */
  }
}
const env = (key: string, fallback = '') => process.env[key] ?? fallback;

let s3: S3Client | null = null;
async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const driver = env('STORAGE_DRIVER', 's3');
  if (driver === 'blob') {
    const { put } = await import('@vercel/blob');
    await put(key, body, { access: 'private', contentType, addRandomSuffix: false, allowOverwrite: true, token: env('BLOB_READ_WRITE_TOKEN') || undefined });
    return;
  }
  if (driver === 's3') {
    s3 ??= new S3Client({
      region: env('S3_REGION', 'us-east-1'),
      endpoint: env('S3_ENDPOINT') || undefined,
      forcePathStyle: env('S3_FORCE_PATH_STYLE', 'true') === 'true',
      credentials: { accessKeyId: env('S3_ACCESS_KEY'), secretAccessKey: env('S3_SECRET_KEY') },
    });
    await s3.send(new PutObjectCommand({ Bucket: env('S3_BUCKET', 'vendor-passport'), Key: key, Body: body, ContentType: contentType }));
    return;
  }
  const full = path.resolve(API_DIR, env('LOCAL_STORAGE_DIR', './uploads'), key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
}

/** One-page PDF that prints the document's fields, so the viewer has something real to show. */
async function renderPdf(title: string, company: string, fields: Record<string, string>): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawText('SPECIMEN · FICTIONAL DEMO DOCUMENT', { x: 50, y: 800, size: 9, font, color: rgb(0.6, 0.6, 0.6) });
  page.drawText(title, { x: 50, y: 760, size: 18, font: bold });
  page.drawText(company, { x: 50, y: 735, size: 12, font });
  let y = 690;
  for (const [label, value] of Object.entries(fields)) {
    page.drawText(`${label}:`, { x: 50, y, size: 10, font: bold });
    page.drawText(value, { x: 210, y, size: 10, font });
    y -= 24;
  }
  return Buffer.from(await pdf.save());
}

interface DocSpec {
  type: DocType;
  fields: Record<string, string>;
}

interface SupplierSpec {
  name: string;
  registrationNo: string;
  owner: { name: string; email: string };
  address: string;
  docs: DocSpec[];
  /** Approved past jobs with Northbridge and the buyer's rating for each. */
  pastJobs: Array<{ title: string; value: number; score: number; comment: string; monthsAgo: number }>;
}

function suppliers(): SupplierSpec[] {
  const ssm = (name: string, reg: string, address: string, inc: string): DocSpec => ({
    type: DocType.SSM,
    fields: { company_name: name.toUpperCase(), registration_no: reg, incorporation_date: inc, registered_address: address, company_status: 'EXISTING', issuer: 'Suruhanjaya Syarikat Malaysia' },
  });
  const cidb = (name: string, reg: string, grade: string, expiry: string): DocSpec => ({
    type: DocType.CIDB,
    fields: { company_name: name, cidb_registration_no: `0120${reg.slice(0, 6)}-SL${reg.slice(-4)}`, registration_no: reg, grade, categories: 'B, CE', issue_date: monthsAgo(10), expiry_date: expiry, issuer: 'CIDB Malaysia' },
  });
  const pl = (name: string, cover: string, expiry: string): DocSpec => ({
    type: DocType.PUBLIC_LIABILITY,
    fields: { issuer: 'Etiqa General Insurance Berhad', policy_no: `PL-${randomBytes(3).toString('hex').toUpperCase()}`, insured_party: name, company_name: name, coverage_amount: cover, issue_date: monthsAgo(2), expiry_date: expiry },
  });
  const wc = (name: string, expiry: string): DocSpec => ({
    type: DocType.WORKMEN_COMP,
    fields: { issuer: 'PERKESO', policy_no: `E${randomBytes(4).toString('hex').toUpperCase()}`, company_name: name, issue_date: monthsAgo(1), expiry_date: expiry },
  });
  const tax = (name: string, reg: string, expiry: string): DocSpec => ({
    type: DocType.TAX_CLEARANCE,
    fields: { issuer: 'Lembaga Hasil Dalam Negeri', company_name: name, tax_reference_no: `C ${reg.slice(0, 10)}`, registration_no: reg, issue_date: monthsAgo(1), expiry_date: expiry },
  });
  const isoCert = (name: string, expiry: string): DocSpec => ({
    type: DocType.ISO,
    fields: { issuer: 'SIRIM QAS International', company_name: name, standard: 'ISO 9001:2015', certificate_no: `QMS ${randomBytes(2).toString('hex').toUpperCase()}`, issue_date: monthsAgo(14), expiry_date: expiry },
  });
  const bank = (name: string, reg: string): DocSpec => ({
    type: DocType.BANK_REFERENCE,
    fields: { issuer: 'Maybank Islamic Berhad', company_name: name, registration_no: reg, account_since: '2012-03-01', conduct: 'Satisfactory', issue_date: monthsAgo(1) },
  });

  return [
    {
      name: 'Teguh Struktur Sdn Bhd',
      registrationNo: '200901012345 (861234-T)',
      owner: { name: 'Lim Wei Jie', email: 'supplier@teguhstruktur.local' },
      address: 'Lot 12, Jalan Perusahaan 3, 40150 Shah Alam, Selangor',
      docs: [
        ssm('Teguh Struktur Sdn Bhd', '200901012345 (861234-T)', 'Lot 12, Jalan Perusahaan 3, 40150 Shah Alam, Selangor', '2009-04-14'),
        cidb('Teguh Struktur Sdn Bhd', '200901012345', 'G7', monthsAhead(30)),
        pl('Teguh Struktur Sdn Bhd', '10000000', monthsAhead(24)),
        wc('Teguh Struktur Sdn Bhd', monthsAhead(20)),
        tax('Teguh Struktur Sdn Bhd', '200901012345', monthsAhead(16)),
        isoCert('Teguh Struktur Sdn Bhd', monthsAhead(26)),
        bank('Teguh Struktur Sdn Bhd', '200901012345'),
      ],
      pastJobs: [
        { title: 'Warehouse extension, Port Klang', value: 6_200_000, score: 5, comment: 'Handed over two weeks early, clean safety record.', monthsAgo: 14 },
        { title: 'Substation building, Rawang', value: 3_400_000, score: 5, comment: 'Strong site supervision.', monthsAgo: 9 },
        { title: 'Office block retrofit, Petaling Jaya', value: 4_800_000, score: 4, comment: 'Good quality; minor delay on M&E coordination.', monthsAgo: 4 },
      ],
    },
    {
      name: 'Hijau Landskap Sdn Bhd',
      registrationNo: '201301045678 (1045678-H)',
      owner: { name: 'Nor Azlina', email: 'supplier@hijaulandskap.local' },
      address: 'No. 8, Jalan Reko, 43000 Kajang, Selangor',
      docs: [
        ssm('Hijau Landskap Sdn Bhd', '201301045678 (1045678-H)', 'No. 8, Jalan Reko, 43000 Kajang, Selangor', '2013-08-02'),
        cidb('Hijau Landskap Sdn Bhd', '201301045678', 'G6', monthsAhead(28)),
        pl('Hijau Landskap Sdn Bhd', '6000000', monthsAhead(22)),
        wc('Hijau Landskap Sdn Bhd', monthsAhead(24)),
        tax('Hijau Landskap Sdn Bhd', '201301045678', monthsAhead(18)),
        isoCert('Hijau Landskap Sdn Bhd', monthsAhead(24)),
      ],
      pastJobs: [{ title: 'Township landscaping, Cyberjaya', value: 2_100_000, score: 4, comment: 'Reliable, responsive site team.', monthsAgo: 7 }],
    },
    {
      name: 'Seri Murni Builders Sdn Bhd',
      registrationNo: '201601023456 (1189012-W)',
      owner: { name: 'Rajesh Kumar', email: 'supplier@serimurni.local' },
      address: 'No. 21, Jalan Kapar, 41400 Klang, Selangor',
      docs: [
        ssm('Seri Murni Builders Sdn Bhd', '201601023456 (1189012-W)', 'No. 21, Jalan Kapar, 41400 Klang, Selangor', '2016-06-20'),
        cidb('Seri Murni Builders Sdn Bhd', '201601023456', 'G6', monthsAhead(26)),
        pl('Seri Murni Builders Sdn Bhd', '3000000', monthsAhead(20)),
        wc('Seri Murni Builders Sdn Bhd', monthsAhead(18)),
        tax('Seri Murni Builders Sdn Bhd', '201601023456', monthsAhead(8)),
        isoCert('Seri Murni Builders Sdn Bhd', monthsAhead(20)),
        bank('Seri Murni Builders Sdn Bhd', '201601023456'),
      ],
      pastJobs: [],
    },
    {
      name: 'Cahaya Bina Enterprise Sdn Bhd',
      registrationNo: '201101067890 (950123-P)',
      owner: { name: 'Wong Kar Mun', email: 'supplier@cahayabina.local' },
      address: 'No. 3, Jalan Bukit Raja, 40000 Shah Alam, Selangor',
      docs: [
        ssm('Cahaya Bina Enterprise Sdn Bhd', '201101067890 (950123-P)', 'No. 3, Jalan Bukit Raja, 40000 Shah Alam, Selangor', '2011-11-03'),
        cidb('Cahaya Bina Enterprise Sdn Bhd', '201101067890', 'G5', monthsAhead(30)),
        pl('Cahaya Bina Enterprise Sdn Bhd', '5000000', monthsAhead(24)),
        wc('Cahaya Bina Enterprise Sdn Bhd', monthsAhead(24)),
        tax('Cahaya Bina Enterprise Sdn Bhd', '201101067890', monthsAhead(18)),
        isoCert('Cahaya Bina Enterprise Sdn Bhd', monthsAhead(24)),
        bank('Cahaya Bina Enterprise Sdn Bhd', '201101067890'),
      ],
      pastJobs: [{ title: 'Surau and community hall, Klang', value: 2_600_000, score: 5, comment: 'Excellent finishing.', monthsAgo: 11 }],
    },
  ];
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await loadEnv();
  const buyer = await prisma.organization.findFirst({ where: { type: OrganizationType.BUYER, name: 'Northbridge Infrastructure Bhd' } });
  const buyerUser = buyer ? await prisma.user.findFirst({ where: { organizationId: buyer.id, role: UserRole.BUYER_PROCUREMENT } }) : null;
  const approver = buyer ? await prisma.user.findFirst({ where: { organizationId: buyer.id, role: UserRole.BUYER_APPROVER } }) : null;
  if (!buyer || !buyerUser || !approver) throw new Error('Run the main seed first (npm run db:seed): Northbridge and its users are missing.');

  const password = await argon2.hash(PASSWORD);
  for (const spec of suppliers()) {
    if (await prisma.organization.findFirst({ where: { name: spec.name, type: OrganizationType.SUPPLIER } })) {
      console.log(`· ${spec.name} already exists, skipped`);
      continue;
    }
    const org = await prisma.organization.create({ data: { type: OrganizationType.SUPPLIER, name: spec.name, registrationNo: spec.registrationNo, settings: {}, createdAt: daysAgo(400) } });
    const owner = await prisma.user.create({ data: { organizationId: org.id, name: spec.owner.name, email: spec.owner.email, password, role: UserRole.SUPPLIER_OWNER, emailVerifiedAt: NOW } });

    const ruleDocs: RuleDocument[] = [];
    for (const d of spec.docs) {
      const def = DOC_TYPE_DEFINITIONS[d.type];
      const id = uuid();
      const fileName = `${def.shortLabel.toLowerCase()}-${spec.name.split(' ')[0].toLowerCase()}.pdf`;
      const bytes = await renderPdf(def.label, spec.name, Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [def.fields.find((f) => f.key === k)?.label ?? k, v])));
      const fileKey = `suppliers/${org.id}/documents/${id}/${fileName}`;
      await putObject(fileKey, bytes, 'application/pdf');
      const fields = Object.entries(d.fields).map(([key, raw]) => {
        const kind = def.fields.find((f) => f.key === key)?.kind ?? 'text';
        return { key, rawValue: raw, normalizedValue: normalizeValue(kind, raw), confidence: 0.97 };
      });
      const byKey = Object.fromEntries(fields.map((f) => [f.key, f.normalizedValue]));
      const expiresAt = def.hasExpiry && byKey.expiry_date ? new Date(`${byKey.expiry_date}T00:00:00Z`) : null;
      const issued = byKey.issue_date ?? byKey.incorporation_date ?? null;
      const createdAt = daysAgo(30);
      await prisma.document.create({
        data: {
          id,
          supplierId: org.id,
          uploadedById: owner.id,
          fileKey,
          fileName,
          mimeType: 'application/pdf',
          size: bytes.length,
          pageCount: 1,
          sha256: sha256(bytes),
          docType: d.type as PrismaDocType,
          classificationConfidence: 0.98,
          status: DocumentStatus.VERIFIED,
          progress: 100,
          attempts: 1,
          issuedAt: issued ? new Date(`${issued}T00:00:00Z`) : null,
          expiresAt,
          extractedBy: 'mock',
          createdAt,
          updatedAt: createdAt,
          fields: { create: fields.map((f) => ({ key: f.key, rawValue: f.rawValue, normalizedValue: f.normalizedValue, confidence: f.confidence, page: 1 })) },
        },
      });
      ruleDocs.push({
        id,
        docType: d.type,
        status: DocumentStatus.VERIFIED as never,
        fileName,
        issuedAt: issued,
        expiresAt: expiresAt ? iso(expiresAt) : null,
        supersededById: null,
        fields: Object.fromEntries(fields.map((f) => [f.key, { value: f.normalizedValue, confidence: f.confidence, confirmed: false }])),
      });
    }

    const result = evaluate({ documents: ruleDocs, now: NOW });
    if (result.findings.length) {
      await prisma.finding.createMany({
        data: result.findings.map((f) => ({ supplierId: org.id, vendorCheckId: null, rule: f.rule, severity: f.severity as Severity, message: f.message, deduction: f.deduction, documentIds: f.documentIds, meta: (f.meta ?? undefined) as Prisma.InputJsonValue | undefined })),
      });
    }
    const verified = !result.findings.some((f) => f.severity === 'CRITICAL');
    await prisma.passport.create({ data: { supplierId: org.id, trustScore: result.score, status: verified ? PassportStatus.VERIFIED : PassportStatus.DRAFT, verifiedAt: verified ? daysAgo(25) : null } });

    for (const job of spec.pastJobs) {
      const decidedAt = new Date(NOW.getTime() - job.monthsAgo * 30 * DAY);
      const check = await prisma.vendorCheck.create({
        data: {
          buyerId: buyer.id,
          supplierId: org.id,
          tenderTitle: job.title,
          contractValue: new Prisma.Decimal(job.value),
          requiredDocTypes: DEFAULT_REQUIRED_DOC_TYPES as PrismaDocType[],
          trustScore: result.score,
          status: VendorCheckStatus.APPROVED,
          decidedById: approver.id,
          decidedAt,
          decisionNote: 'All documents verified. Approved for award.',
          createdById: buyerUser.id,
          createdAt: new Date(decidedAt.getTime() - 7 * DAY),
          updatedAt: decidedAt,
        },
      });
      await prisma.vendorRating.create({
        data: { vendorCheckId: check.id, buyerId: buyer.id, supplierId: org.id, score: job.score, comment: job.comment, ratedById: buyerUser.id, createdAt: new Date(decidedAt.getTime() + 60 * DAY) },
      });
    }
    console.log(`+ ${spec.name}: ${spec.docs.length} documents, score ${result.score}, ${spec.pastJobs.length} rated past jobs`);
  }
  console.log(`\nSupplier logins use password ${PASSWORD}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
