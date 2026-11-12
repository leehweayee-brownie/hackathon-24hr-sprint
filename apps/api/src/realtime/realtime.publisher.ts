import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT, withTimeout } from '../database/redis.provider';

/** Live updates are best-effort: never hold up document processing waiting for Redis. */
const PUBLISH_TIMEOUT_MS = 2_000;

export const REALTIME_CHANNEL = 'vp:realtime';

export interface RealtimeMessage {
  rooms: string[];
  event: string;
  payload: unknown;
}

export const orgRoom = (organizationId: string) => `org:${organizationId}`;
export const supplierRoom = (supplierId: string) => `supplier:${supplierId}`;

/** Publishes socket events through Redis so any API instance can deliver them. */
@Injectable()
export class RealtimePublisher {
  private readonly logger = new Logger(RealtimePublisher.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** Sends a live update. Never throws and never waits more than 2 s: a missed update only means the browser refreshes later. */
  async publish(rooms: string[], event: string, payload: unknown): Promise<void> {
    const message: RealtimeMessage = { rooms, event, payload };
    try {
      await withTimeout(this.redis.publish(REALTIME_CHANNEL, JSON.stringify(message)), PUBLISH_TIMEOUT_MS, 'Realtime publish');
    } catch (err) {
      this.logger.warn(`Live update "${event}" not sent: ${(err as Error).message}`);
    }
  }

  /** Convenience: supplier users and any buyer subscribed to that supplier. */
  toSupplier(supplierId: string, event: string, payload: unknown): Promise<void> {
    return this.publish([orgRoom(supplierId), supplierRoom(supplierId)], event, payload);
  }
}
