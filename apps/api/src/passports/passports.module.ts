import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CrossCheckModule } from '../cross-check/cross-check.module';
import { DocumentsModule } from '../documents/documents.module';
import { PassportsController, PublicPassportController } from './passports.controller';
import { PassportsService } from './passports.service';

@Module({
  imports: [AuthModule, CrossCheckModule, DocumentsModule],
  providers: [PassportsService],
  controllers: [PassportsController, PublicPassportController],
  exports: [PassportsService],
})
export class PassportsModule {}
