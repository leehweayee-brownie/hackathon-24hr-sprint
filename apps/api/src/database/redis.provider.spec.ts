import { redisConnectionOptions } from './redis.provider';

describe('redisConnectionOptions', () => {
  it('sends the hostname as TLS servername for rediss:// URLs', () => {
    expect(redisConnectionOptions('rediss://default:secret@cache.example.dev:6379').tls).toEqual({ servername: 'cache.example.dev' });
    expect(redisConnectionOptions('rediss://default:secret@cache.example.dev').tls).toEqual({ servername: 'cache.example.dev' });
  });

  it('uses no TLS for plain redis:// URLs', () => {
    expect(redisConnectionOptions('redis://localhost:6380').tls).toBeUndefined();
  });
});
