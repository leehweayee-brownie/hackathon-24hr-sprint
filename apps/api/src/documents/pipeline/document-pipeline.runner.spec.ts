import { ErrorCode } from '@vp/shared';
import { AppException } from '../../common/errors/app.exception';
import type { AppConfigService } from '../../config/config.service';
import type { PrismaService } from '../../database/prisma.service';
import { DocumentPipelineRunner, MAX_ATTEMPTS } from './document-pipeline.runner';
import type { DocumentPipelineService } from './document-pipeline.service';

type ProcessFn = (id: string, lastAttempt: boolean) => Promise<boolean>;

function setup(process: ProcessFn, opts: { concurrency?: number; stranded?: string[] } = {}) {
  const calls: Array<{ id: string; lastAttempt: boolean }> = [];
  const pipeline = {
    process: jest.fn(async (id: string, lastAttempt: boolean) => {
      calls.push({ id, lastAttempt });
      return process(id, lastAttempt);
    }),
  } as unknown as DocumentPipelineService;
  const prisma = {
    document: { findMany: jest.fn(async () => (opts.stranded ?? []).map((id) => ({ id }))) },
  } as unknown as PrismaService;
  const config = { get: () => opts.concurrency ?? 4 } as unknown as AppConfigService;
  const runner = new DocumentPipelineRunner(pipeline, prisma, config, [0, 0]);
  return { runner, calls };
}

describe('DocumentPipelineRunner', () => {
  it('processes scheduled documents in the background', async () => {
    const { runner, calls } = setup(async () => true);
    runner.schedule('a');
    runner.schedule('b');
    await runner.idle();
    expect(calls.map((c) => c.id)).toEqual(['a', 'b']);
    expect(runner.stats()).toMatchObject({ pending: 0, running: 0 });
  });

  it('never runs more documents at once than the concurrency limit', async () => {
    let active = 0;
    let peak = 0;
    const { runner } = setup(
      async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
        return true;
      },
      { concurrency: 2 },
    );
    for (const id of ['a', 'b', 'c', 'd', 'e']) runner.schedule(id);
    expect(runner.stats()).toMatchObject({ running: 2, pending: 3 });
    await runner.idle();
    expect(peak).toBe(2);
  });

  it('ignores a document that is already queued or running', async () => {
    const { runner, calls } = setup(async () => true);
    runner.schedule('a');
    runner.schedule('a');
    await runner.idle();
    expect(calls).toHaveLength(1);
  });

  it('retries a failing document and flags only the last attempt as final', async () => {
    const { runner, calls } = setup(async () => {
      throw new Error('Odin timed out');
    });
    runner.schedule('a');
    await runner.idle();
    expect(calls).toHaveLength(MAX_ATTEMPTS);
    expect(calls.map((c) => c.lastAttempt)).toEqual([false, false, true]);
  });

  it('stops after a success on a later attempt', async () => {
    let n = 0;
    const { runner, calls } = setup(async () => {
      n += 1;
      if (n === 1) throw new Error('flaky');
      return true;
    });
    runner.schedule('a');
    await runner.idle();
    expect(calls).toHaveLength(2);
  });

  it('does not retry an AppException', async () => {
    const { runner, calls } = setup(async () => {
      throw new AppException(ErrorCode.UNSUPPORTED_FILE_TYPE, 'Unsupported file', 415);
    });
    runner.schedule('a');
    await runner.idle();
    expect(calls).toHaveLength(1);
  });

  it('resumes documents left in progress when the API starts', async () => {
    const { runner, calls } = setup(async () => true, { stranded: ['x', 'y'] });
    await runner.onApplicationBootstrap();
    await runner.idle();
    expect(calls.map((c) => c.id)).toEqual(['x', 'y']);
  });
});
