import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { OrganizationType, SOCKET_EVENTS } from '@vp/shared';
import type { Redis } from 'ioredis';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../common/types';
import { PrismaService } from '../database/prisma.service';
import { REDIS_SUBSCRIBER } from '../database/redis.provider';
import { REALTIME_CHANNEL, RealtimeMessage, orgRoom, supplierRoom } from './realtime.publisher';

interface SocketData {
  user?: JwtPayload;
}

@WebSocketGateway({ namespace: '/intake', cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnModuleInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis,
  ) {}

  onModuleInit(): void {
    // Not awaited: a slow or unreachable Redis must not hold up startup. ioredis resubscribes after reconnecting.
    this.subscriber.subscribe(REALTIME_CHANNEL).catch((err: Error) => this.logger.warn(`Subscribe to live updates failed: ${err.message}`));
    this.subscriber.on('message', (_channel: string, raw: string) => {
      try {
        const msg = JSON.parse(raw) as RealtimeMessage;
        if (!this.server) return;
        this.server.to(msg.rooms).emit(msg.event, msg.payload);
      } catch (err) {
        this.logger.warn(`Dropped malformed realtime message: ${(err as Error).message}`);
      }
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = (client.handshake.auth?.token as string | undefined) ?? bearer(client.handshake.headers.authorization);
    try {
      if (!token) throw new Error('missing token');
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      (client.data as SocketData).user = payload;
      await client.join(orgRoom(payload.organizationId));
      if (payload.organizationType === OrganizationType.SUPPLIER) await client.join(supplierRoom(payload.organizationId));
    } catch {
      client.emit(SOCKET_EVENTS.error, { code: 'UNAUTHORIZED', message: 'Invalid or missing token' });
      client.disconnect(true);
    }
  }

  /** Buyers subscribe to a supplier they are checking (or whose passport is shared with them). */
  @SubscribeMessage('subscribe:supplier')
  async subscribeSupplier(@ConnectedSocket() client: Socket, @MessageBody() body: { supplierId?: string }) {
    const user = (client.data as SocketData).user;
    const supplierId = body?.supplierId;
    if (!user || !supplierId) return { ok: false };
    if (user.organizationId === supplierId || user.organizationType === OrganizationType.ADMIN) {
      await client.join(supplierRoom(supplierId));
      return { ok: true };
    }
    const [check, share] = await Promise.all([
      this.prisma.vendorCheck.findFirst({ where: { buyerId: user.organizationId, supplierId }, select: { id: true } }),
      this.prisma.passportShare.findFirst({ where: { buyerId: user.organizationId, revokedAt: null, passport: { supplierId } }, select: { id: true } }),
    ]);
    if (!check && !share) {
      client.emit(SOCKET_EVENTS.error, { code: 'FORBIDDEN', message: 'No vendor check or share with this vendor' });
      return { ok: false };
    }
    await client.join(supplierRoom(supplierId));
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe:supplier')
  async unsubscribeSupplier(@ConnectedSocket() client: Socket, @MessageBody() body: { supplierId?: string }) {
    if (body?.supplierId) await client.leave(supplierRoom(body.supplierId));
    return { ok: true };
  }
}

function bearer(header: string | undefined): string | undefined {
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}
