import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { StorageService } from './storage.service';

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

/** Serves stored files through short-lived signed links (STORAGE_DRIVER=local or blob). Streams, so size limits do not apply. */
@ApiExcludeController()
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get(':token')
  async serve(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const payload = this.storage.verifyFileToken(token);
    if (!payload) throw new NotFoundException('File link is invalid or has expired');
    const file = await this.storage.getStream(payload.key).catch(() => null);
    if (!file) throw new NotFoundException('File not found');
    const ext = (payload.name ?? payload.key).split('.').pop()?.toLowerCase() ?? '';
    res.setHeader('Content-Type', MIME_BY_EXT[ext] ?? file.contentType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${(payload.name ?? 'file').replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'private, max-age=60');
    if (file.size !== undefined) res.setHeader('Content-Length', String(file.size));
    file.stream.on('error', () => res.destroy());
    file.stream.pipe(res);
  }
}
