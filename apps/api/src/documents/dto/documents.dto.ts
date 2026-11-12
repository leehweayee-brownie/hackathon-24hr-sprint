import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocType, DocumentStatus } from '@vp/shared';
import { IsBooleanString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination';

export class ListDocumentsQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: DocumentStatus }) @IsOptional() @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiPropertyOptional({ enum: DocType }) @IsOptional() @IsEnum(DocType)
  docType?: DocType;

  @ApiPropertyOptional({ description: 'Buyers must pass the supplier they are looking at' }) @IsOptional() @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Include superseded documents (default false)' }) @IsOptional() @IsBooleanString()
  includeSuperseded?: string;
}
