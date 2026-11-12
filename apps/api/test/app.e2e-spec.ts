/**
 * End-to-end: register → login → upload a PNG (AI_PROVIDER=mock) → documents list → passport.
 * Needs the local Postgres, Redis and object store from docker compose (apps/api/.env).
 * The pipeline runs when a worker is up; without one the upload still succeeds and the document stays UPLOADED.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

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
