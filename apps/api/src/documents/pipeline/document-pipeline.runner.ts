import { Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { DocumentStatus } from '@vp/shared';
import { AppException } from '../../common/errors/app.exception';
import { AppConfigService } from '../../config/config.service';
import { PrismaService } from '../../database/prisma.service';
import { DocumentPipelineService } from './document-pipeline.service';

/** Statuses a document is in while it waits for, or is inside, the pipeline. */
export const IN_PIPELINE_STATUSES: DocumentStatus[] = [DocumentStatus.UPLOADED, DocumentStatus.CONVERTING, DocumentStatus.CLASSIFYING, DocumentStatus.EXTRACTING];

export const MAX_ATTEMPTS = 3;
/** Delay before attempt n+1 (ms): 2 s, then 4 s. */
export const RETRY_DELAYS_MS = [2_000, 4_000];

/**
 * Runs the document pipeline in the API process, in the background after upload.
 * A small FIFO with a concurrency limit replaces the old queue and worker: no Redis jobs, nothing else to start.
 * Documents left mid-pipeline by a restart are picked up again on boot.
 */
@Injectable()
export class DocumentPipelineRunner implements OnApplicationBootstrap {
  private readonly logger = new Logger(DocumentPipelineRunner.name);
  private readonly pending: string[] = [];
  private readonly queued = new Set<string>();
  private running = 0;
  private waiters: Array<() => void> = [];
  private readonly concurrency: number;
  private readonly delays: number[];

  constructor(
    private readonly pipeline: DocumentPipelineService,
    private readonly prisma: PrismaService,
    config: AppConfigService,
    @Optional() retryDelaysMs?: number[],
  ) {
    this.concurrency = Math.max(1, config.get('PIPELINE_CONCURRENCY'));
    this.delays = retryDelaysMs ?? RETRY_DELAYS_MS;
  }

  async onApplicationBootstrap(): Promise<void> {
    const stranded = await this.prisma.document.findMany({
      where: { status: { in: IN_PIPELINE_STATUSES } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (stranded.length > 0) this.logger.log(`Resuming ${stranded.length} document(s) left in progress`);
    for (const d of stranded) this.schedule(d.id);
  }

  /** Queues a document for processing. Never throws; a document already queued or running is ignored. */
  schedule(documentId: string): void {
    if (this.queued.has(documentId)) return;
    this.queued.add(documentId);
    this.pending.push(documentId);
    this.pump();
  }

  stats(): { pending: number; running: number; concurrency: number } {
    return { pending: this.pending.length, running: this.running, concurrency: this.concurrency };
  }

  /** Resolves once nothing is pending or running. */
  idle(): Promise<void> {
    if (this.running === 0 && this.pending.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private pump(): void {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const id = this.pending.shift()!;
      this.running += 1;
      void this.runWithRetries(id).finally(() => {
        this.running -= 1;
        this.queued.delete(id);
        this.pump();
        if (this.running === 0 && this.pending.length === 0) {
          const waiters = this.waiters;
          this.waiters = [];
          for (const w of waiters) w();
        }
      });
    }
  }

  private async runWithRetries(documentId: string): Promise<void> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        await this.pipeline.process(documentId, attempt === MAX_ATTEMPTS);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Document ${documentId} failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${message}`);
        // An AppException (bad input) is final at once; the pipeline has already marked it FAILED.
        if (err instanceof AppException || attempt === MAX_ATTEMPTS) return;
        await sleep(this.delays[attempt - 1] ?? this.delays[this.delays.length - 1] ?? 0);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
