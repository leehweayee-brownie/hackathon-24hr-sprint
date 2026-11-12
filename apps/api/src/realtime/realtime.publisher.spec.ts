import type { Redis } from 'ioredis';
import { RealtimePublisher } from './realtime.publisher';

describe('RealtimePublisher', () => {
  it('publishes to the realtime channel', async () => {
    const redis = { publish: jest.fn(async () => 1) } as unknown as Redis;
    await new RealtimePublisher(redis).toSupplier('s1', 'document:status', { progress: 10 });
    expect(redis.publish).toHaveBeenCalledWith('vp:realtime', JSON.stringify({ rooms: ['org:s1', 'supplier:s1'], event: 'document:status', payload: { progress: 10 } }));
  });

  it('never throws when Redis fails', async () => {
    const redis = { publish: jest.fn(async () => { throw new Error('ETIMEDOUT'); }) } as unknown as Redis;
    await expect(new RealtimePublisher(redis).publish(['org:s1'], 'x', {})).resolves.toBeUndefined();
  });

  it('gives up after 2 s instead of waiting for Redis to come back', async () => {
    jest.useFakeTimers();
    const redis = { publish: jest.fn(() => new Promise(() => undefined)) } as unknown as Redis;
    const done = new RealtimePublisher(redis).publish(['org:s1'], 'x', {});
    jest.advanceTimersByTime(2_000);
    await expect(done).resolves.toBeUndefined();
    jest.useRealTimers();
  });
});
