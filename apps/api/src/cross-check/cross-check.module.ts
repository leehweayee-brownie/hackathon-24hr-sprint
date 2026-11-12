import { Module } from '@nestjs/common';
import { TrustScoreModule } from '../trust-score/trust-score.module';
import { CrossCheckService } from './cross-check.service';

@Module({
  imports: [TrustScoreModule],
  providers: [CrossCheckService],
  exports: [CrossCheckService, TrustScoreModule],
})
export class CrossCheckModule {}
