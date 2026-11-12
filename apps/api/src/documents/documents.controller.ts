import { Controller, Delete, Get, Ip, Param, ParseUUIDPipe, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MAX_FILES_PER_UPLOAD, MAX_FILE_SIZE_BYTES } from '@vp/shared';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types';
import { DocumentsService, UploadedFile } from './documents.service';
import { ListDocumentsQuery } from './dto/documents.dto';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @ApiOperation({ summary: 'Upload one or more files (PDF, JPG, PNG, HEIC). Processing is asynchronous.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } } } })
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { storage: memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  upload(@CurrentUser() user: RequestUser, @UploadedFiles() files: UploadedFile[], @Ip() ip: string) {
    return this.documents.upload(user, files, ip);
  }

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() query: ListDocumentsQuery) {
    return this.documents.list(user, query);
  }

  @Get(':id')
  get(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.get(user, id);
  }

  @Get(':id/file')
  @ApiOperation({ summary: 'Short-lived signed URL for the original file' })
  file(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.fileUrl(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.remove(user, id);
  }

  @Post(':id/reprocess')
  reprocess(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.reprocess(user, id);
  }
}
