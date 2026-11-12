/**
 * Demo seed. WIPES ALL DATA, then creates the organisations, users, documents, checks and
 * passports described in docs/conventions.md. All data is fictional.
 *
 *   npm run db:seed            (from the repo root)
 *
 * Reads apps/api/.env. Uploads Mega Wira's fixture documents to object storage so the viewer works.
 */
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  AccessRequestStatus,
  DocType as PrismaDocType,
  DocumentStatus,
  OrganizationType,
  PassportStatus,
  Prisma,
  PrismaClient,
  ReminderKind,
  Severity,
  UserRole,
  VendorCheckStatus,
} from '@prisma/client';
import argon2 from 'argon2';
import { PDFDocument } from 'pdf-lib';
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_EXPIRY_WARNING_DAYS,
  DEFAULT_REQUIRED_DOC_TYPES,
  DEFAULT_RULE_WEIGHTS,
  DOC_TYPE_DEFINITIONS,
  type DocType,
  type ExtractionRecording,
  type Finding,
} from '@vp/shared';
import { evaluate, normalizeValue, type RuleDocument } from '@vp/rules';
import { resolveDateTokens } from '../../../fixtures/relative-dates';

/* ------------------------------------------------------------------ env */
const API_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(API_DIR, '../..');

async function loadEnv(): Promise<void> {
  const file = path.join(API_DIR, '.env');
  try {
    const text = await fs.readFile(file, 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (!m || line.trim().startsWith('#')) continue;
      const value = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      if (process.env[m[1]] === undefined) process.env[m[1]] = value;
    }
  } catch {
    console.warn(`No ${file}; relying on process.env`);
  }
}

const env = (key: string, fallback = ''): string => process.env[key] ?? fallback;

/* ------------------------------------------------------------------ storage */
let s3: S3Client | null = null;
let sseDisabled = false;

async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if (env('STORAGE_DRIVER', 's3') === 'blob') {
    // Private Vercel Blob store, same key as the API uses. Needs BLOB_READ_WRITE_TOKEN when run from a laptop.
    const { put } = await import('@vercel/blob');
    await put(key, body, { access: 'private', contentType, addRandomSuffix: false, allowOverwrite: true, token: env('BLOB_READ_WRITE_TOKEN') || undefined });
    return;
  }
  if (env('STORAGE_DRIVER', 's3') === 's3') {
    s3 ??= new S3Client({
      region: env('S3_REGION', 'us-east-1'),
      endpoint: env('S3_ENDPOINT') || undefined,
      forcePathStyle: env('S3_FORCE_PATH_STYLE', 'true') === 'true',
      credentials: { accessKeyId: env('S3_ACCESS_KEY'), secretAccessKey: env('S3_SECRET_KEY') },
    });
    const sse = sseDisabled ? '' : env('S3_SSE');
    const put = (withSse: boolean) =>
      s3!.send(
        new PutObjectCommand({
          Bucket: env('S3_BUCKET', 'vendor-passport'),
          Key: key,
          Body: body,
          ContentType: contentType,
          ...(withSse && sse ? { ServerSideEncryption: sse as 'AES256' } : {}),
        }),
      );
    try {
      await put(true);
    } catch (e) {
      // MinIO without a KMS answers 501 NotImplemented to SSE requests; fall back to plain uploads locally.
      if (sse && (e as { Code?: string }).Code === 'NotImplemented') {
        if (!sseDisabled) console.warn(`Storage does not support S3_SSE=${sse} (no KMS); uploading without server-side encryption.`);
        sseDisabled = true;
        await put(false);
      } else {
        throw e;
      }
    }
    return;
  }
  const full = path.resolve(API_DIR, env('LOCAL_STORAGE_DIR', './uploads'), key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
}

/* ------------------------------------------------------------------ helpers */
const prisma = new PrismaClient();
const NOW = new Date();
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * DAY);
const PASSWORD = 'Password123!';
const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const isoToDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

const MIME: Record<string, string> = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

async function loadRecording(fileName: string): Promise<ExtractionRecording> {
  const file = path.join(ROOT_DIR, 'fixtures', 'extractions', `${fileName}.json`);
  return JSON.parse(await fs.readFile(file, 'utf8')) as ExtractionRecording;
}

function toSeverity(s: Finding['severity']): Severity {
  return s as Severity;
}

async function hashPassword(): Promise<string> {
  return argon2.hash(PASSWORD);
}

/* ------------------------------------------------------------------ wipe */
async function wipe(): Promise<void> {
  const tables = [
    'audit_logs',
    'ai_usage',
    'notifications',
    'reminders',
    'access_requests',
    'passport_share_views',
    'passport_shares',
    'passports',
    'findings',
    'vendor_checks',
    'document_fields',
    'documents',
    'invites',
    'refresh_tokens',
    'users',
    'organizations',
    'system_settings',
  ];
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

/* ------------------------------------------------------------------ documents */
interface SeededDoc {
  id: string;
  rule: RuleDocument;
}

async function seedDocument(opts: {
  supplierId: string;
  uploadedById: string;
  folder: string;
  fileName: string;
  threshold: number;
  createdAt: Date;
}): Promise<SeededDoc> {
  const filePath = path.join(ROOT_DIR, 'fixtures', 'documents', opts.folder, opts.fileName);
  const bytes = await fs.readFile(filePath);
  const ext = path.extname(opts.fileName).toLowerCase();
  const mimeType = MIME[ext] ?? 'application/octet-stream';
  const pageCount = ext === '.pdf' ? (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount() : 1;
  const rec = await loadRecording(opts.fileName);
  const docType = rec.classification.docType;
  const def = DOC_TYPE_DEFINITIONS[docType];

  const fields = rec.fields.map((f) => {
    const raw = f.rawValue === null ? null : resolveDateTokens(f.rawValue, NOW);
    const kind = def.fields.find((d) => d.key === f.key)?.kind ?? 'text';
    return { ...f, rawValue: raw, normalizedValue: normalizeValue(kind, raw) };
  });
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
  const issuedAt = isoToDate(byKey.issue_date?.normalizedValue ?? byKey.incorporation_date?.normalizedValue ?? null);
  const expiresAt = def.hasExpiry ? isoToDate(byKey.expiry_date?.normalizedValue ?? null) : null;
  const needsReview = fields.some((f) => f.confidence < opts.threshold);
  const status = needsReview ? DocumentStatus.NEEDS_REVIEW : DocumentStatus.VERIFIED;

  const id = randomBytes(16).toString('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  const fileKey = `suppliers/${opts.supplierId}/documents/${id}/${opts.fileName}`;
  await putObject(fileKey, bytes, mimeType);

  await prisma.document.create({
    data: {
      id,
      supplierId: opts.supplierId,
      uploadedById: opts.uploadedById,
      fileKey,
      fileName: opts.fileName,
      mimeType,
      size: bytes.length,
      pageCount,
      sha256: sha256(bytes),
      docType: docType as PrismaDocType,
      classificationConfidence: rec.classification.confidence,
      status,
      progress: 100,
      attempts: 1,
      issuedAt,
      expiresAt,
      createdAt: opts.createdAt,
      updatedAt: opts.createdAt,
      fields: {
        create: fields.map((f) => ({
          key: f.key,
          rawValue: f.rawValue,
          normalizedValue: f.normalizedValue,
          confidence: f.confidence,
          page: f.page,
          bboxX: f.bbox?.x ?? null,
          bboxY: f.bbox?.y ?? null,
          bboxWidth: f.bbox?.width ?? null,
          bboxHeight: f.bbox?.height ?? null,
        })),
      },
      aiUsage: {
        create: [
          { supplierId: opts.supplierId, operation: 'classify', model: 'mock', inputTokens: 1800 * pageCount, outputTokens: 60, costUsd: 0, durationMs: 420, createdAt: opts.createdAt },
          { supplierId: opts.supplierId, operation: 'extract', model: 'mock', inputTokens: 2100 * pageCount, outputTokens: 520, costUsd: 0, durationMs: 1340, createdAt: opts.createdAt },
        ],
      },
    },
  });

  if (expiresAt) {
    const kinds: Array<[ReminderKind, number]> = [
      [ReminderKind.D60, 60],
      [ReminderKind.D30, 30],
      [ReminderKind.D7, 7],
      [ReminderKind.EXPIRED, 0],
    ];
    await prisma.reminder.createMany({
      data: kinds.map(([kind, days]) => {
        const dueAt = new Date(expiresAt.getTime() - days * DAY);
        return { documentId: id, kind, dueAt, sentAt: dueAt < NOW ? dueAt : null };
      }),
    });
  }

  return {
    id,
    rule: {
      id,
      docType: docType as DocType,
      status: status as unknown as RuleDocument['status'],
      fileName: opts.fileName,
      issuedAt: issuedAt ? issuedAt.toISOString().slice(0, 10) : null,
      expiresAt: expiresAt ? expiresAt.toISOString().slice(0, 10) : null,
      supersededById: null,
      fields: Object.fromEntries(fields.map((f) => [f.key, { value: f.normalizedValue, confidence: f.confidence, confirmed: false }])),
    },
  };
}

async function storeFindings(supplierId: string, vendorCheckId: string | null, findings: Finding[], createdAt = NOW): Promise<void> {
  if (findings.length === 0) return;
  await prisma.finding.createMany({
    data: findings.map((f) => ({
      supplierId,
      vendorCheckId,
      rule: f.rule,
      severity: toSeverity(f.severity),
      message: f.message,
      deduction: f.deduction,
      documentIds: f.documentIds,
      meta: (f.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      createdAt,
    })),
  });
}

/* ------------------------------------------------------------------ main */
async function main(): Promise<void> {
  await loadEnv();
  const webUrl = env('WEB_URL', 'http://localhost:8888');
  const threshold = Number(env('CONFIDENCE_THRESHOLD', String(DEFAULT_CONFIDENCE_THRESHOLD)));
  const warningDays = Number(env('EXPIRY_WARNING_DAYS', String(DEFAULT_EXPIRY_WARNING_DAYS)));

  console.log('Wiping existing data...');
  await wipe();
  const password = await hashPassword();

  console.log('Creating organisations and users...');
  const adminOrg = await prisma.organization.create({
    data: { type: OrganizationType.ADMIN, name: 'Vendor Passport Admin', settings: {} },
  });
  const admin = await prisma.user.create({
    data: { organizationId: adminOrg.id, name: 'Platform Admin', email: 'admin@vp.local', password, role: UserRole.ADMIN, emailVerifiedAt: NOW },
  });

  const binaJaya = await prisma.organization.create({
    data: { type: OrganizationType.SUPPLIER, name: 'Bina Jaya Sdn Bhd', registrationNo: '201501023456 (1156789-K)', settings: {}, createdAt: daysAgo(3) },
  });
  const binaOwner = await prisma.user.create({
    data: { organizationId: binaJaya.id, name: 'Ahmad Farid', email: 'supplier@binajaya.local', password, role: UserRole.SUPPLIER_OWNER, emailVerifiedAt: NOW },
  });
  await prisma.user.create({
    data: { organizationId: binaJaya.id, name: 'Tan Mei Ling', email: 'meiling@binajaya.local', password, role: UserRole.SUPPLIER_MEMBER, emailVerifiedAt: NOW },
  });

  const megaWira = await prisma.organization.create({
    data: { type: OrganizationType.SUPPLIER, name: 'Mega Wira Construction Sdn Bhd', registrationNo: '201801034567 (1287654-A)', settings: {}, createdAt: daysAgo(45) },
  });
  const megaOwner = await prisma.user.create({
    data: { organizationId: megaWira.id, name: 'Nurul Huda', email: 'supplier@megawira.local', password, role: UserRole.SUPPLIER_OWNER, emailVerifiedAt: NOW },
  });

  const northbridge = await prisma.organization.create({
    data: {
      type: OrganizationType.BUYER,
      name: 'Northbridge Infrastructure Bhd',
      registrationNo: '199901012345 (0498765-T)',
      settings: { approverThreshold: 5_000_000, minLiabilityCoverage: 1_000_000 },
      createdAt: daysAgo(60),
    },
  });
  const buyer = await prisma.user.create({
    data: { organizationId: northbridge.id, name: 'Siti Aminah', email: 'buyer@procurement.local', password, role: UserRole.BUYER_PROCUREMENT, emailVerifiedAt: NOW },
  });
  const approver = await prisma.user.create({
    data: { organizationId: northbridge.id, name: 'David Lim', email: 'approver@procurement.local', password, role: UserRole.BUYER_APPROVER, emailVerifiedAt: NOW },
  });
  await prisma.user.create({
    data: { organizationId: northbridge.id, name: 'Priya Nair', email: 'contracts@procurement.local', password, role: UserRole.BUYER_CONTRACTS, emailVerifiedAt: NOW },
  });

  await prisma.systemSetting.create({
    data: { key: 'rules', value: { ruleWeights: DEFAULT_RULE_WEIGHTS, confidenceThreshold: threshold, expiryWarningDays: warningDays } },
  });

  /* ---- Bina Jaya: empty passport, waiting for the demo upload */
  await prisma.passport.create({ data: { supplierId: binaJaya.id, trustScore: 100, status: PassportStatus.DRAFT } });

  /* ---- Mega Wira: fully processed documents */
  console.log('Uploading and seeding Mega Wira documents...');
  const megaFiles = [
    'mw-01-ssm-form9.pdf',
    'mw-02-cidb-certificate.pdf',
    'mw-03-public-liability-policy.pdf',
    'mw-04-socso-coverage.pdf',
    'mw-05-lhdn-tax-clearance.pdf',
    'mw-06-iso14001.pdf',
  ];
  const megaDocs: SeededDoc[] = [];
  for (const [i, fileName] of megaFiles.entries()) {
    megaDocs.push(await seedDocument({ supplierId: megaWira.id, uploadedById: megaOwner.id, folder: 'mega-wira', fileName, threshold, createdAt: daysAgo(40 - i) }));
  }
  const megaRuleDocs = megaDocs.map((d) => d.rule);
  const megaEval = evaluate({ documents: megaRuleDocs, now: NOW, confidenceThreshold: threshold, expiryWarningDays: warningDays });
  await storeFindings(megaWira.id, null, megaEval.findings, daysAgo(35));
  const megaVerified = !megaEval.findings.some((f) => f.severity === 'CRITICAL');
  const megaPassport = await prisma.passport.create({
    data: {
      supplierId: megaWira.id,
      trustScore: megaEval.score,
      status: megaVerified ? PassportStatus.VERIFIED : PassportStatus.DRAFT,
      verifiedAt: megaVerified ? daysAgo(35) : null,
      createdAt: daysAgo(45),
    },
  });

  /* ---- Vendor checks */
  console.log('Creating vendor checks...');
  const binaCheckEval = evaluate({
    documents: [],
    now: NOW,
    contractValue: 8_000_000,
    requiredDocTypes: DEFAULT_REQUIRED_DOC_TYPES,
    minLiabilityCoverage: 1_000_000,
    confidenceThreshold: threshold,
    expiryWarningDays: warningDays,
  });
  const binaCheck = await prisma.vendorCheck.create({
    data: {
      buyerId: northbridge.id,
      supplierId: binaJaya.id,
      tenderTitle: 'Package 3B: Earthworks and drainage, Sungai Buloh',
      contractValue: new Prisma.Decimal(8_000_000),
      requiredDocTypes: DEFAULT_REQUIRED_DOC_TYPES as PrismaDocType[],
      trustScore: binaCheckEval.score,
      status: VendorCheckStatus.IN_REVIEW,
      createdById: buyer.id,
      createdAt: daysAgo(2),
    },
  });
  await storeFindings(binaJaya.id, binaCheck.id, binaCheckEval.findings, daysAgo(2));

  const megaCheckEval = evaluate({
    documents: megaRuleDocs,
    now: NOW,
    contractValue: 1_800_000,
    requiredDocTypes: DEFAULT_REQUIRED_DOC_TYPES,
    minLiabilityCoverage: 1_000_000,
    confidenceThreshold: threshold,
    expiryWarningDays: warningDays,
  });
  const megaCheck = await prisma.vendorCheck.create({
    data: {
      buyerId: northbridge.id,
      supplierId: megaWira.id,
      tenderTitle: 'Site office fit-out, Kota Kemuning',
      contractValue: new Prisma.Decimal(1_800_000),
      requiredDocTypes: DEFAULT_REQUIRED_DOC_TYPES as PrismaDocType[],
      trustScore: megaCheckEval.score,
      status: VendorCheckStatus.IN_REVIEW,
      createdById: buyer.id,
      createdAt: daysAgo(1),
    },
  });
  await storeFindings(megaWira.id, megaCheck.id, megaCheckEval.findings, daysAgo(1));

  const historicEval = evaluate({
    documents: megaRuleDocs,
    now: daysAgo(20),
    contractValue: 950_000,
    requiredDocTypes: DEFAULT_REQUIRED_DOC_TYPES,
    minLiabilityCoverage: 1_000_000,
    confidenceThreshold: threshold,
    expiryWarningDays: warningDays,
  });
  const historicCheck = await prisma.vendorCheck.create({
    data: {
      buyerId: northbridge.id,
      supplierId: megaWira.id,
      tenderTitle: 'Drainage upgrade, Section 7 Shah Alam',
      contractValue: new Prisma.Decimal(950_000),
      requiredDocTypes: DEFAULT_REQUIRED_DOC_TYPES as PrismaDocType[],
      trustScore: historicEval.score,
      status: VendorCheckStatus.APPROVED,
      decidedById: approver.id,
      decidedAt: daysAgo(20),
      decisionNote: 'All documents verified. Approved for award.',
      createdById: buyer.id,
      createdAt: daysAgo(28),
      updatedAt: daysAgo(20),
    },
  });
  await storeFindings(megaWira.id, historicCheck.id, historicEval.findings, daysAgo(28));

  /* ---- Passport share for Mega Wira */
  const shareToken = randomBytes(24).toString('base64url');
  const share = await prisma.passportShare.create({
    data: {
      passportId: megaPassport.id,
      tokenHash: sha256(shareToken),
      buyerId: northbridge.id,
      label: 'Northbridge Infrastructure tender desk',
      createdById: megaOwner.id,
      expiresAt: daysAhead(90),
      viewCount: 3,
      lastViewedAt: daysAgo(1),
      createdAt: daysAgo(10),
      views: {
        create: [
          { viewerUserId: buyer.id, viewerIp: '10.20.1.15', userAgent: 'Mozilla/5.0 (demo)', viewedAt: daysAgo(9) },
          { viewerIp: '10.20.1.22', userAgent: 'Mozilla/5.0 (demo)', viewedAt: daysAgo(4) },
          { viewerUserId: buyer.id, viewerIp: '10.20.1.15', userAgent: 'Mozilla/5.0 (demo)', viewedAt: daysAgo(1) },
        ],
      },
    },
  });

  /* ---- Access request from Northbridge to Bina Jaya */
  await prisma.accessRequest.create({
    data: {
      buyerId: northbridge.id,
      supplierId: binaJaya.id,
      requestedById: buyer.id,
      message: 'Please share your Vendor Passport for the Sungai Buloh Package 3B tender.',
      status: AccessRequestStatus.PENDING,
      createdAt: daysAgo(2),
    },
  });

  /* ---- Notifications */
  await prisma.notification.createMany({
    data: [
      {
        userId: binaOwner.id,
        type: 'vendor_check.started',
        title: 'Northbridge Infrastructure Bhd started a vendor check',
        message: 'Upload your company documents so the Package 3B review can proceed.',
        link: '/supplier/documents',
        createdAt: daysAgo(2),
      },
      {
        userId: binaOwner.id,
        type: 'access_request.received',
        title: 'Passport access requested',
        message: 'Northbridge Infrastructure Bhd asked for a link to your Vendor Passport.',
        link: '/supplier/passport',
        createdAt: daysAgo(2),
      },
      {
        userId: megaOwner.id,
        type: 'passport.viewed',
        title: 'Your passport was viewed',
        message: 'Northbridge Infrastructure Bhd opened your Vendor Passport link.',
        link: '/supplier/passport',
        readAt: daysAgo(1),
        createdAt: daysAgo(1),
      },
      {
        userId: buyer.id,
        type: 'vendor_check.waiting',
        title: 'Waiting for supplier documents',
        message: 'Bina Jaya Sdn Bhd has not uploaded documents for Package 3B yet.',
        link: `/buyer/checks/${binaCheck.id}`,
        createdAt: daysAgo(1),
      },
      {
        userId: buyer.id,
        type: 'vendor_check.approved',
        title: 'Vendor check approved',
        message: 'David Lim approved Mega Wira Construction Sdn Bhd for Drainage upgrade, Section 7 Shah Alam.',
        link: `/buyer/checks/${historicCheck.id}`,
        readAt: daysAgo(19),
        createdAt: daysAgo(20),
      },
    ],
  });

  /* ---- Audit log */
  await prisma.auditLog.createMany({
    data: [
      { actorId: megaOwner.id, organizationId: megaWira.id, action: 'document.upload', entity: 'document', entityId: megaDocs[0].id, metadata: { fileName: megaFiles[0] }, createdAt: daysAgo(40) },
      { actorId: buyer.id, organizationId: northbridge.id, action: 'vendor_check.create', entity: 'vendor_check', entityId: historicCheck.id, metadata: { contractValue: 950_000 }, createdAt: daysAgo(28) },
      { actorId: approver.id, organizationId: northbridge.id, action: 'vendor_check.approve', entity: 'vendor_check', entityId: historicCheck.id, metadata: { trustScore: historicEval.score }, createdAt: daysAgo(20) },
      { actorId: megaOwner.id, organizationId: megaWira.id, action: 'passport.share.create', entity: 'passport_share', entityId: share.id, metadata: { label: share.label }, createdAt: daysAgo(10) },
      { actorId: buyer.id, organizationId: northbridge.id, action: 'passport.view', entity: 'passport_share', entityId: share.id, metadata: { via: 'link' }, createdAt: daysAgo(9) },
      { actorId: buyer.id, organizationId: northbridge.id, action: 'vendor_check.create', entity: 'vendor_check', entityId: binaCheck.id, metadata: { contractValue: 8_000_000 }, createdAt: daysAgo(2) },
      { actorId: buyer.id, organizationId: northbridge.id, action: 'access_request.create', entity: 'organization', entityId: binaJaya.id, metadata: {}, createdAt: daysAgo(2) },
      { actorId: admin.id, organizationId: adminOrg.id, action: 'auth.login', entity: 'user', entityId: admin.id, metadata: {}, createdAt: daysAgo(1) },
    ],
  });

  /* ---- Summary */
  const counts = {
    organizations: await prisma.organization.count(),
    users: await prisma.user.count(),
    documents: await prisma.document.count(),
    fields: await prisma.documentField.count(),
    findings: await prisma.finding.count(),
    vendorChecks: await prisma.vendorCheck.count(),
    reminders: await prisma.reminder.count(),
  };
  console.log('\nSeed complete.', counts);
  console.log(`Mega Wira passport: score ${megaEval.score} (${megaEval.band}), ${megaEval.findings.length} findings`);
  console.log(`Bina Jaya check (RM8,000,000): score ${binaCheckEval.score}, findings: ${binaCheckEval.findings.map((f) => f.rule).join(', ')}`);
  console.log(`\nAccounts (password ${PASSWORD}):`);
  console.log('  admin@vp.local               admin');
  console.log('  supplier@binajaya.local      supplier owner, Bina Jaya Sdn Bhd (no documents yet: drop fixtures/documents/bina-jaya/)');
  console.log('  supplier@megawira.local      supplier owner, Mega Wira Construction Sdn Bhd (verified passport)');
  console.log('  buyer@procurement.local      buyer procurement officer, Northbridge Infrastructure Bhd');
  console.log('  approver@procurement.local   buyer approver, Northbridge Infrastructure Bhd');
  console.log(`\nMega Wira share link (shown once): ${webUrl}/p/${shareToken}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
