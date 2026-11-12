import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthTokens, BUYER_ROLES, ErrorCode, OrganizationType, SUPPLIER_ROLES, UserRole, UserView } from '@vp/shared';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import type { JwtPayload, RequestUser } from '../common/types';
import { randomToken, sha256 } from '../common/utils/crypto';
import { addDays } from '../common/utils/dates';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../notifications/mail.service';
import { UsersService, UserWithOrg } from '../users/users.service';
import type { AcceptInviteDto, InviteDto, LoginDto, RegisterDto } from './dto/auth.dto';

export interface AuthResult {
  user: UserView;
  tokens: AuthTokens;
}

const INVITE_TTL_DAYS = 7;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, ip?: string): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    if (await this.users.findByEmail(email)) {
      throw new AppException(ErrorCode.EMAIL_ALREADY_REGISTERED, 'This email is already registered', HttpStatus.CONFLICT);
    }
    const verificationToken = randomToken(24);
    const role = dto.organizationType === 'SUPPLIER' ? UserRole.SUPPLIER_OWNER : UserRole.BUYER_APPROVER;
    const user = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { type: dto.organizationType, name: dto.organizationName.trim(), registrationNo: dto.registrationNo?.trim() ?? null },
      });
      if (org.type === 'SUPPLIER') await tx.passport.create({ data: { supplierId: org.id } });
      return tx.user.create({
        data: {
          organizationId: org.id,
          name: dto.name.trim(),
          email,
          password: await argon2.hash(dto.password),
          role,
          verificationTokenHash: sha256(verificationToken),
        },
        include: { organization: true },
      });
    });
    await this.mail.send({
      to: email,
      subject: 'Verify your Vendor Passport email',
      text: `Welcome ${user.name}. Verify your email: ${this.config.get('WEB_URL')}/verify-email?token=${verificationToken}`,
    });
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'auth.register', entity: 'user', entityId: user.id, ip });
    return { user: this.users.toView(user), tokens: await this.issueTokens(user) };
  }

  async login(dto: LoginDto, ip?: string): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email);
    const valid = user ? await argon2.verify(user.password, dto.password) : false;
    if (!user || !valid) {
      throw new AppException(ErrorCode.INVALID_CREDENTIALS, 'Email or password is incorrect', HttpStatus.UNAUTHORIZED);
    }
    if (user.suspendedAt) throw AppException.forbidden('Account suspended');
    if (this.config.isProduction && !user.emailVerifiedAt) {
      throw new AppException(ErrorCode.EMAIL_NOT_VERIFIED, 'Please verify your email before signing in', HttpStatus.FORBIDDEN);
    }
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'auth.login', entity: 'user', entityId: user.id, ip });
    return { user: this.users.toView(user), tokens: await this.issueTokens(user) };
  }

  /** Rotates a refresh token. Reusing a revoked token revokes the whole family (all of the user's sessions). */
  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: { include: { organization: true } } } });
    if (!stored) throw new AppException(ErrorCode.INVALID_TOKEN, 'Refresh token is invalid', HttpStatus.UNAUTHORIZED);
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId}; all sessions revoked`);
      throw new AppException(ErrorCode.INVALID_TOKEN, 'Refresh token has been revoked', HttpStatus.UNAUTHORIZED);
    }
    if (stored.expiresAt < new Date()) throw new AppException(ErrorCode.INVALID_TOKEN, 'Refresh token has expired', HttpStatus.UNAUTHORIZED);
    if (stored.user.suspendedAt) throw AppException.forbidden('Account suspended');
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return { user: this.users.toView(stored.user), tokens: await this.issueTokens(stored.user) };
  }

  async logout(refreshToken: string | undefined, user: RequestUser): Promise<{ loggedOut: true }> {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha256(refreshToken), userId: user.id }, data: { revokedAt: new Date() } });
    } else {
      await this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.log({ actorId: user.id, organizationId: user.organizationId, action: 'auth.logout', entity: 'user', entityId: user.id });
    return { loggedOut: true };
  }

  async verifyEmail(token: string): Promise<{ verified: true }> {
    const user = await this.prisma.user.findFirst({ where: { verificationTokenHash: sha256(token) } });
    if (!user) throw new AppException(ErrorCode.INVALID_TOKEN, 'Verification link is invalid or already used');
    await this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date(), verificationTokenHash: null } });
    return { verified: true };
  }

  async invite(inviter: RequestUser, dto: InviteDto): Promise<{ invited: string; expiresAt: string; inviteUrl?: string }> {
    const allowedRoles = inviter.organizationType === OrganizationType.SUPPLIER ? SUPPLIER_ROLES : inviter.organizationType === OrganizationType.BUYER ? BUYER_ROLES : [UserRole.ADMIN];
    if (!allowedRoles.includes(dto.role)) throw new AppException(ErrorCode.VALIDATION_FAILED, `Role ${dto.role} does not belong to a ${inviter.organizationType.toLowerCase()} organization`);
    const canInvite = [UserRole.SUPPLIER_OWNER, UserRole.BUYER_APPROVER, UserRole.BUYER_PROCUREMENT, UserRole.ADMIN].includes(inviter.role);
    if (!canInvite) throw AppException.forbidden('Only owners, procurement officers and approvers can invite teammates');
    const email = dto.email.toLowerCase();
    if (await this.users.findByEmail(email)) throw new AppException(ErrorCode.EMAIL_ALREADY_REGISTERED, 'This email already has an account', HttpStatus.CONFLICT);
    const token = randomToken(24);
    const expiresAt = addDays(new Date(), INVITE_TTL_DAYS);
    await this.prisma.invite.create({
      data: { organizationId: inviter.organizationId, email, role: dto.role, tokenHash: sha256(token), invitedById: inviter.id, expiresAt },
    });
    const inviteUrl = `${this.config.get('WEB_URL')}/accept-invite?token=${token}`;
    await this.mail.send({
      to: email,
      subject: `${inviter.name} invited you to ${inviter.organizationName} on Vendor Passport`,
      text: `Accept the invitation: ${inviteUrl}`,
    });
    await this.audit.log({ actorId: inviter.id, organizationId: inviter.organizationId, action: 'auth.invite', entity: 'invite', metadata: { email, role: dto.role } });
    // The link is returned in development so teammates can be added without an email service.
    return { invited: email, expiresAt: expiresAt.toISOString(), ...(this.config.isProduction ? {} : { inviteUrl }) };
  }

  async acceptInvite(dto: AcceptInviteDto): Promise<AuthResult> {
    const invite = await this.prisma.invite.findUnique({ where: { tokenHash: sha256(dto.token) } });
    if (!invite || invite.acceptedAt) throw new AppException(ErrorCode.INVALID_TOKEN, 'Invitation is invalid or already used');
    if (invite.expiresAt < new Date()) throw new AppException(ErrorCode.INVALID_TOKEN, 'Invitation has expired');
    if (await this.users.findByEmail(invite.email)) throw new AppException(ErrorCode.EMAIL_ALREADY_REGISTERED, 'This email already has an account', HttpStatus.CONFLICT);
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      return tx.user.create({
        data: {
          organizationId: invite.organizationId,
          name: dto.name.trim(),
          email: invite.email,
          password: await argon2.hash(dto.password),
          role: invite.role,
          emailVerifiedAt: new Date(),
        },
        include: { organization: true },
      });
    });
    return { user: this.users.toView(user), tokens: await this.issueTokens(user) };
  }

  async me(user: RequestUser): Promise<UserView> {
    const full = await this.users.findById(user.id);
    if (!full) throw AppException.unauthorized();
    return this.users.toView(full);
  }

  async issueTokens(user: UserWithOrg): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      organizationId: user.organizationId,
      organizationType: user.organization.type as OrganizationType,
    };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomToken(48);
    const data: Prisma.RefreshTokenCreateInput = {
      user: { connect: { id: user.id } },
      tokenHash: sha256(refreshToken),
      expiresAt: addDays(new Date(), this.config.get('REFRESH_TOKEN_TTL_DAYS')),
    };
    await this.prisma.refreshToken.create({ data });
    return { accessToken, refreshToken, expiresIn: parseDuration(this.config.get('JWT_EXPIRES_IN')) };
  }
}

/** "15m" → 900 seconds. */
export function parseDuration(value: string): number {
  const m = value.match(/^(\d+)\s*([smhd]?)$/);
  if (!m) return 900;
  const n = Number(m[1]);
  return { '': n, s: n, m: n * 60, h: n * 3600, d: n * 86400 }[m[2]] ?? 900;
}
