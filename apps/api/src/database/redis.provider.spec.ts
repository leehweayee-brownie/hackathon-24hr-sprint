import { redisConnectionOptions, withTimeout } from './redis.provider';

describe('redisConnectionOptions', () => {
  it('sends the hostname as TLS servername for rediss:// URLs', () => {
    expect(redisConnectionOptions('rediss://default:secret@cache.example.dev:6379').tls).toEqual({ servername: 'cache.example.dev' });
    expect(redisConnectionOptions('rediss://default:secret@cache.example.dev').tls).toEqual({ servername: 'cache.example.dev' });
  });

  it('uses no TLS for plain redis:// URLs', () => {
    expect(redisConnectionOptions('redis://localhost:6380').tls).toBeUndefined();
  });

  it('is tuned for cold starts and idle serverless instances', () => {
    const o = redisConnectionOptions('redis://localhost:6380');
    expect(o.connectTimeout).toBe(20_000);
    expect(o.keepAlive).toBe(30_000);
    expect(o.retryStrategy?.(1)).toBe(500);
    expect(o.retryStrategy?.(100)).toBe(5_000);
  });
});

describe('withTimeout', () => {
  it('passes results through', async () => {
    await expect(withTimeout(Promise.resolve('PONG'), 50)).resolves.toBe('PONG');
  });
  it('rejects a call that hangs', async () => {
    await expect(withTimeout(new Promise(() => undefined), 20, 'Redis ping')).rejects.toThrow('Redis ping timed out after 20 ms');
  });
});
