import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DEFAULT_APPROVER_THRESHOLD, DEFAULT_CONFIDENCE_THRESHOLD, DEFAULT_EXPIRY_WARNING_DAYS, DEFAULT_RULE_WEIGHTS, OrganizationSettings, RuleCode, RuleWeights } from '@vp/shared';
import { AppException } from '../common/errors/app.exception';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../database/prisma.service';
import type { UpdateOrganizationDto } from './dto/settings.dto';

export interface ResolvedSettings {
  confidenceThreshold: number;
  expiryWarningDays: number;
  minLiabilityCoverage: number | null;
  approverThreshold: number;
  ruleWeights: RuleWeights;
}

export const SYSTEM_RULES_KEY = 'rules';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async get(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!org) throw AppException.notFound('Organization');
    return this.toView(org);
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw AppException.notFound('Organization');
    const { name, registrationNo, ...settings } = dto;
    const current = (org.settings ?? {}) as OrganizationSettings;
    const merged: OrganizationSettings = { ...current, ...stripUndefined(settings) };
    if (settings.ruleWeights) {
      merged.ruleWeights = { ...(current.ruleWeights ?? {}), ...sanitizeWeights(settings.ruleWeights) };
    }
    const updated = await this.prisma.organization.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(registrationNo !== undefined ? { registrationNo: registrationNo.trim() || null } : {}),
        settings: merged as Prisma.InputJsonValue,
      },
      include: { _count: { select: { users: true } } },
    });
    return this.toView(updated);
  }

  /** System defaults (admin PUT /admin/rules) under env defaults. */
  async systemDefaults(): Promise<ResolvedSettings> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: SYSTEM_RULES_KEY } });
    const sys = (row?.value ?? {}) as OrganizationSettings;
    return {
      confidenceThreshold: sys.confidenceThreshold ?? this.config.get('CONFIDENCE_THRESHOLD') ?? DEFAULT_CONFIDENCE_THRESHOLD,
      expiryWarningDays: sys.expiryWarningDays ?? this.config.get('EXPIRY_WARNING_DAYS') ?? DEFAULT_EXPIRY_WARNING_DAYS,
      minLiabilityCoverage: sys.minLiabilityCoverage ?? null,
      approverThreshold: sys.approverThreshold ?? DEFAULT_APPROVER_THRESHOLD,
      ruleWeights: { ...DEFAULT_RULE_WEIGHTS, ...sanitizeWeights(sys.ruleWeights ?? {}) },
    };
  }

  /** Effective settings for an organization: org overrides on top of system defaults. */
  async resolveSettings(organizationId: string | null | undefined): Promise<ResolvedSettings> {
    const base = await this.systemDefaults();
    if (!organizationId) return base;
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { settings: true } });
    const s = (org?.settings ?? {}) as OrganizationSettings;
    return {
      confidenceThreshold: s.confidenceThreshold ?? base.confidenceThreshold,
      expiryWarningDays: s.expiryWarningDays ?? base.expiryWarningDays,
      minLiabilityCoverage: s.minLiabilityCoverage ?? base.minLiabilityCoverage,
      approverThreshold: s.approverThreshold ?? base.approverThreshold,
      ruleWeights: { ...base.ruleWeights, ...sanitizeWeights(s.ruleWeights ?? {}) },
    };
  }

  private toView(org: { id: string; type: string; name: string; registrationNo: string | null; settings: unknown; createdAt: Date; _count: { users: number } }) {
    return {
      id: org.id,
      type: org.type,
      name: org.name,
      registrationNo: org.registrationNo,
      settings: org.settings as OrganizationSettings,
      userCount: org._count.users,
      createdAt: org.createdAt.toISOString(),
    };
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function sanitizeWeights(weights: Partial<Record<string, unknown>>): Partial<RuleWeights> {
  const out: Partial<RuleWeights> = {};
  for (const code of Object.values(RuleCode)) {
    const v = weights[code];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100) out[code] = Math.round(v);
  }
  return out;
}
