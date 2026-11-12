import { Body, Controller, Post, UploadedFile as UploadedFileParam, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MAX_FILE_SIZE_BYTES } from '@vp/shared';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types';
import type { UploadedFile } from '../documents/documents.service';
import { InviteDto, ParseBriefDto, RequestDocumentsDto, ShortlistDto } from './vendor-match.dto';
import { VendorMatchService } from './vendor-match.service';

@ApiTags('vendor-match')
@ApiBearerAuth()
@Controller('vendor-match')
export class VendorMatchController {
  constructor(private readonly match: VendorMatchService) {}

  @Post('brief')
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Draft tender requirements from a pasted brief, quick fields or an uploaded RFQ' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  brief(@CurrentUser() user: RequestUser, @Body() dto: ParseBriefDto, @UploadedFileParam() file?: UploadedFile) {
    return this.match.parseBrief(user, dto.text, file);
  }

  @Post('shortlist')
  @ApiOperation({ summary: 'Rank verified suppliers against confirmed requirements, with reasons for every fit and gap' })
  shortlist(@CurrentUser() user: RequestUser, @Body() dto: ShortlistDto) {
    return this.match.shortlist(user, dto.requirements);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite a supplier to tender: opens a vendor check and notifies them' })
  invite(@CurrentUser() user: RequestUser, @Body() dto: InviteDto) {
    return this.match.invite(user, dto.supplierId, dto.requirements);
  }

  @Post('request-documents')
  @ApiOperation({ summary: 'Ask a conditional supplier for the documents that would make them qualify' })
  requestDocuments(@CurrentUser() user: RequestUser, @Body() dto: RequestDocumentsDto) {
    return this.match.requestDocuments(user, dto.supplierId, dto.requirements, dto.docTypes, dto.note);
  }
}
