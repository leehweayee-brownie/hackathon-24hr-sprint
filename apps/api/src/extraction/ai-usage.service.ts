import { Injectable } from '@nestjs/common';
import type { TokenUsage } from '@vp/shared';
import { PrismaService } from '../database/prisma.service';
import { estimateCostUsd } from './providers/anthropic.provider';

@Injectable()
export class AiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    documentId: string;
    supplierId: string;
    operation: 'classify' | 'extract';
    model: string;
    usage: TokenUsage | undefined;
    durationMs: number;
    cached?: boolean;
  }): Promise<void> {
    const usage = input.usage ?? { inputTokens: 0, outputTokens: 0 };
    await this.prisma.aiUsage.create({
      data: {
        documentId: input.documentId,
        supplierId: input.supplierId,
        operation: input.operation,
        model: input.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: input.cached ? 0 : estimateCostUsd(input.model, usage),
        durationMs: input.durationMs,
        cached: input.cached ?? false,
      },
    });
  }
}
