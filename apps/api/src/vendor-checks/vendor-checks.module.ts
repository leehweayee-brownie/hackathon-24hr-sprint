import { Module } from '@nestjs/common';
import { CrossCheckModule } from '../cross-check/cross-check.module';
import { PassportsModule } from '../passports/passports.module';
import { AccessRequestsService } from './access-requests.service';
import { AccessRequestsController, SuppliersController, VendorChecksController } from './vendor-checks.controller';
import { VendorChecksService } from './vendor-checks.service';

@Module({
  imports: [CrossCheckModule, PassportsModule],
  providers: [VendorChecksService, AccessRequestsService],
  controllers: [VendorChecksController, SuppliersController, AccessRequestsController],
})
export class VendorChecksModule {}
