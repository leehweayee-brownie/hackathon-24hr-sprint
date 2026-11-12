import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../database/redis.provider';

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
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async publish(rooms: string[], event: string, payload: unknown): Promise<void> {
    const message: RealtimeMessage = { rooms, event, payload };
    await this.redis.publish(REALTIME_CHANNEL, JSON.stringify(message));
  }

  /** Convenience: supplier users and any buyer subscribed to that supplier. */
  toSupplier(supplierId: string, event: string, payload: unknown): Promise<void> {
    return this.publish([orgRoom(supplierId), supplierRoom(supplierId)], event, payload);
  }
}
