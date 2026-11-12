import { Module } from '@nestjs/common';
import { CrossCheckModule } from '../cross-check/cross-check.module';
import { ExtractionModule } from '../extraction/extraction.module';
import { PassportsModule } from '../passports/passports.module';
import { VendorMatchController } from '../vendor-match/vendor-match.controller';
import { VendorMatchService } from '../vendor-match/vendor-match.service';
import { AccessRequestsService } from './access-requests.service';
import { AccessRequestsController, SuppliersController, VendorChecksController } from './vendor-checks.controller';
import { VendorChecksService } from './vendor-checks.service';

@Module({
  imports: [CrossCheckModule, PassportsModule, ExtractionModule],
  providers: [VendorChecksService, AccessRequestsService, VendorMatchService],
  controllers: [VendorChecksController, SuppliersController, AccessRequestsController, VendorMatchController],
})
export class VendorChecksModule {}
