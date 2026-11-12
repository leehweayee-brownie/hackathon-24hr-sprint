import { Injectable } from '@nestjs/common';
import { Finding, PassportStatus, ScoreBand, Severity, scoreBand } from '@vp/shared';
import { PrismaService } from '../database/prisma.service';

/** Owns the passport's trust score and verification status. */
@Injectable()
export class TrustScoreService {
  constructor(private readonly prisma: PrismaService) {}

  band(score: number): ScoreBand {
    return scoreBand(score);
  }

  /** VERIFIED when at least one document is verified and nothing critical is open. */
  async applyToPassport(supplierId: string, score: number, findings: Finding[], verifiedDocuments: number): Promise<void> {
    const critical = findings.some((f) => f.severity === Severity.CRITICAL);
    const status = verifiedDocuments > 0 && !critical ? PassportStatus.VERIFIED : PassportStatus.DRAFT;
    const existing = await this.prisma.passport.findUnique({ where: { supplierId } });
    const verifiedAt = status === PassportStatus.VERIFIED ? (existing?.verifiedAt ?? new Date()) : null;
    await this.prisma.passport.upsert({
      where: { supplierId },
      create: { supplierId, trustScore: score, status, verifiedAt },
      update: { trustScore: score, status, verifiedAt },
    });
  }
}
