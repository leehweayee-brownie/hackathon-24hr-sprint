import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { ErrorCode } from '@vp/shared';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { sha256 } from '../common/utils/crypto';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../notifications/mail.service';
import { UsersService } from '../users/users.service';
import { AuthService, parseDuration } from './auth.service';

const org = { id: 'org-1', type: 'SUPPLIER', name: 'Bina Jaya Sdn Bhd', registrationNo: null, settings: {}, createdAt: new Date(), updatedAt: new Date() };
const baseUser = {
  id: 'user-1', organizationId: 'org-1', name: 'Aisyah', email: 'a@b.local', password: '', role: 'SUPPLIER_OWNER',
  emailVerifiedAt: new Date(), verificationTokenHash: null, suspendedAt: null, createdAt: new Date(), updatedAt: new Date(), organization: org,
};

describe('AuthService', () => {
  let service: AuthService;
  const tokens = new Map<string, { id: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null; user: typeof baseUser }>();
  const prisma = {
    refreshToken: {
      create: jest.fn(async ({ data }: { data: { tokenHash: string; expiresAt: Date; user: { connect: { id: string } } } }) => {
        const row = { id: `rt-${tokens.size + 1}`, userId: data.user.connect.id, tokenHash: data.tokenHash, expiresAt: data.expiresAt, revokedAt: null, user: baseUser };
        tokens.set(data.tokenHash, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { tokenHash: string } }) => tokens.get(where.tokenHash) ?? null),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: { revokedAt: Date } }) => {
        const row = Array.from(tokens.values()).find((t) => t.id === where.id)!;
        row.revokedAt = data.revokedAt;
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: { userId: string }; data: { revokedAt: Date } }) => {
        let count = 0;
        for (const t of tokens.values()) if (t.userId === where.userId && !t.revokedAt) { t.revokedAt = data.revokedAt; count += 1; }
        return { count };
      }),
    },
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  };
  const users = { findByEmail: jest.fn(), findById: jest.fn(), toView: (u: typeof baseUser) => ({ id: u.id, email: u.email }), toRequestUser: jest.fn() };

  beforeEach(async () => {
    tokens.clear();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { signAsync: jest.fn(async () => 'access-token') } },
        { provide: AppConfigService, useValue: { get: (k: string) => ({ REFRESH_TOKEN_TTL_DAYS: 7, JWT_EXPIRES_IN: '15m', WEB_URL: 'http://web' })[k], isProduction: false } },
        { provide: UsersService, useValue: users },
        { provide: MailService, useValue: { send: jest.fn() } },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('logs in with a correct password and rejects a wrong one', async () => {
    users.findByEmail.mockResolvedValue({ ...baseUser, password: await argon2.hash('Password123!') });
    const result = await service.login({ email: 'a@b.local', password: 'Password123!' });
    expect(result.tokens.accessToken).toBe('access-token');
    expect(result.tokens.expiresIn).toBe(900);
    await expect(service.login({ email: 'a@b.local', password: 'nope' })).rejects.toMatchObject({ code: ErrorCode.INVALID_CREDENTIALS });
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const first = await service.issueTokens(baseUser as never);
    expect(tokens.get(sha256(first.refreshToken))?.revokedAt).toBeNull();

    const second = await service.refresh(first.refreshToken);
    expect(second.tokens.refreshToken).not.toBe(first.refreshToken);
    expect(tokens.get(sha256(first.refreshToken))?.revokedAt).toBeInstanceOf(Date);
    expect(tokens.get(sha256(second.tokens.refreshToken))?.revokedAt).toBeNull();

    // Reusing the old token is an attack signal: every session is revoked.
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(AppException);
    expect(tokens.get(sha256(second.tokens.refreshToken))?.revokedAt).toBeInstanceOf(Date);
    await expect(service.refresh(second.tokens.refreshToken)).rejects.toMatchObject({ code: ErrorCode.INVALID_TOKEN });
  });

  it('rejects unknown and expired refresh tokens', async () => {
    await expect(service.refresh('nonsense')).rejects.toMatchObject({ code: ErrorCode.INVALID_TOKEN });
    const t = await service.issueTokens(baseUser as never);
    tokens.get(sha256(t.refreshToken))!.expiresAt = new Date(Date.now() - 1000);
    await expect(service.refresh(t.refreshToken)).rejects.toMatchObject({ code: ErrorCode.INVALID_TOKEN });
  });

  it('parses JWT durations', () => {
    expect(parseDuration('15m')).toBe(900);
    expect(parseDuration('2h')).toBe(7200);
    expect(parseDuration('30')).toBe(30);
    expect(parseDuration('weird')).toBe(900);
  });
});
