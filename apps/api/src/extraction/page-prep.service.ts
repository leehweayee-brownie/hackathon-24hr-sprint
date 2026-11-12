import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '@vp/shared';
import convertHeic from 'heic-convert';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { AppException } from '../common/errors/app.exception';
import { AppConfigService } from '../config/config.service';
import type { DocumentInput } from './extraction-provider.interface';

const MAX_EDGE = 1600;

/** Converts an uploaded file into what the vision model needs: a PDF buffer or downscaled JPEG pages. */
@Injectable()
export class PagePrepService {
  constructor(private readonly config: AppConfigService) {}

  async pageCount(buffer: Buffer, mimeType: string): Promise<number> {
    if (mimeType !== 'application/pdf') return 1;
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
    return pdf.getPageCount();
  }

  async prepare(buffer: Buffer, mimeType: string, fileName: string, sha256: string): Promise<DocumentInput> {
    const maxPages = Math.min(this.config.get('MAX_PAGES'), this.config.get('AI_MAX_PAGES'));
    if (mimeType === 'application/pdf') {
      const pageCount = await this.pageCount(buffer, mimeType);
      if (pageCount > maxPages) {
        throw new AppException(ErrorCode.TOO_MANY_PAGES, `Document has ${pageCount} pages; the limit is ${maxPages}`, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      return { fileName, sha256, mimeType, pageCount, pdf: buffer };
    }
    let image = buffer;
    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      image = Buffer.from(await convertHeic({ buffer: new Uint8Array(image), format: 'JPEG', quality: 0.9 }));
    }
    const jpeg = await sharp(image).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    return { fileName, sha256, mimeType, pageCount: 1, images: [jpeg] };
  }
}
