/**
 * End-to-end: register → login → upload a PNG (AI_PROVIDER=mock) → documents list → passport.
 * Needs the local Postgres, Redis and object store from docker compose (apps/api/.env).
 * The pipeline runs inside the API in the background after upload; the test waits for it before asserting and cleaning up.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { DocumentPipelineRunner } from '../src/documents/pipeline/document-pipeline.runner';

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

describe('Vendor Passport API (e2e)', () => {
  let app: INestApplication;
  const email = `e2e-${Date.now()}@test.local`;
  let accessToken = '';
  let refreshToken = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // Filter, interceptor and guards are registered by AppModule; the prefix and pipe live in main.ts.
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    // Let background processing finish before deleting what it writes to.
    await app.get(DocumentPipelineRunner).idle();
    // Leave no trace in the shared development database.
    const prisma = app.get(PrismaService);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) await prisma.organization.delete({ where: { id: user.organizationId } });
    await app.close();
  });

  it('reports health', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.db).toBe('up');
  });

  it('registers a supplier and logs in', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ organizationName: 'E2E Supplier Sdn Bhd', organizationType: 'SUPPLIER', name: 'E2E', email, password: 'Password123!' })
      .expect(201);
    expect(reg.body.data.user.role).toBe('SUPPLIER_OWNER');
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: 'Password123!' }).expect(200);
    accessToken = login.body.data.tokens.accessToken;
    refreshToken = login.body.data.tokens.refreshToken;
    expect(accessToken).toBeTruthy();
  });

  it('rejects requests without a token with the error envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/documents').expect(401);
    expect(res.body).toMatchObject({ success: false, code: 'UNAUTHORIZED' });
  });

  it('rotates refresh tokens', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken }).expect(200);
    expect(res.body.data.tokens.refreshToken).not.toBe(refreshToken);
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('uploads a PNG and lists it', async () => {
    const up = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('authorization', `Bearer ${accessToken}`)
      .attach('files', PNG, 'site-photo.png')
      .expect(201);
    expect(up.body.data).toHaveLength(1);
    expect(up.body.data[0]).toMatchObject({ fileName: 'site-photo.png', mimeType: 'image/png' });

    const list = await request(app.getHttpServer()).get('/api/v1/documents').set('authorization', `Bearer ${accessToken}`).expect(200);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(list.body.data.some((d: { fileName: string }) => d.fileName === 'site-photo.png')).toBe(true);

    const file = await request(app.getHttpServer()).get(`/api/v1/documents/${up.body.data[0].id}/file`).set('authorization', `Bearer ${accessToken}`).expect(200);
    expect(file.body.data.url).toMatch(/^https?:\/\//);
  });

  it('processes the upload in the API without a worker', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/documents').set('authorization', `Bearer ${accessToken}`).expect(200);
    const id = list.body.data.find((d: { fileName: string }) => d.fileName === 'site-photo.png').id as string;
    await app.get(DocumentPipelineRunner).idle();
    const doc = await request(app.getHttpServer()).get(`/api/v1/documents/${id}`).set('authorization', `Bearer ${accessToken}`).expect(200);
    // The mock provider has no recording for this file, so it is kept as OTHER and not scored.
    expect(doc.body.data.status).toBe('VERIFIED');
    expect(doc.body.data.docType).toBe('OTHER');
    expect(doc.body.data.progress).toBe(100);
  });

  it('copies a duplicate only when the current model read the original', async () => {
    const server = app.getHttpServer();
    const auth = { authorization: `Bearer ${accessToken}` };
    const upload = async () => {
      const res = await request(server).post('/api/v1/documents').set(auth).attach('files', PNG, 'site-photo.png').expect(201);
      await app.get(DocumentPipelineRunner).idle();
      return (await request(server).get(`/api/v1/documents/${res.body.data[0].id}`).set(auth).expect(200)).body.data;
    };

    // Same model (mock) read the original: the duplicate is copied, not read again.
    const copy = await upload();
    expect(copy.duplicateOfId).toBeTruthy();
    expect(copy.status).toBe('VERIFIED');

    // Pretend every earlier copy was read by another model: the file must be read again.
    const prisma = app.get(PrismaService);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.document.updateMany({ where: { supplierId: user.organizationId }, data: { extractedBy: 'some-other-model' } });
    const reread = await upload();
    expect(reread.duplicateOfId).toBeNull();
    expect(reread.status).toBe('VERIFIED');
    const fresh = await prisma.document.findUniqueOrThrow({ where: { id: reread.id } });
    expect(fresh.extractedBy).toBe('mock');
  });

  it('rejects unsupported files on content, not extension', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('authorization', `Bearer ${accessToken}`)
      .attach('files', Buffer.from('not really a pdf'), 'fake.pdf')
      .expect(415);
    expect(res.body.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('serves the passport and a public share link', async () => {
    const passport = await request(app.getHttpServer()).get('/api/v1/passport').set('authorization', `Bearer ${accessToken}`).expect(200);
    expect(passport.body.data.supplierName).toBe('E2E Supplier Sdn Bhd');
    const share = await request(app.getHttpServer()).post('/api/v1/passport/shares').set('authorization', `Bearer ${accessToken}`).send({ label: 'e2e' }).expect(201);
    expect(share.body.data.token).toBeTruthy();
    const pub = await request(app.getHttpServer()).get(`/api/v1/p/${share.body.data.token}`).expect(200);
    expect(pub.body.data.supplierId).toBe(passport.body.data.supplierId);
    await request(app.getHttpServer()).delete(`/api/v1/passport/shares/${share.body.data.id}`).set('authorization', `Bearer ${accessToken}`).expect(200);
    const gone = await request(app.getHttpServer()).get(`/api/v1/p/${share.body.data.token}`).expect(410);
    expect(gone.body.code).toBe('SHARE_LINK_REVOKED');
  });
});
