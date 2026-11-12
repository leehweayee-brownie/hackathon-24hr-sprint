import { Global, Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [StorageService],
  controllers: [FilesController],
  exports: [StorageService],
})
export class StorageModule {}
