import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimePublisher } from './realtime.publisher';

/** Socket.IO gateway plus the publisher that services use to emit through Redis. */
@Global()
@Module({
  imports: [AuthModule],
  providers: [RealtimePublisher, RealtimeGateway],
  exports: [RealtimePublisher],
})
export class RealtimeModule {}
