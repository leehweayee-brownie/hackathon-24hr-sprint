import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocType } from '@vp/shared';
import { ArrayMaxSize, IsArray, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ParseBriefDto {
  @ApiPropertyOptional({ description: 'Pasted brief, or the quick fields joined into text' }) @IsOptional() @IsString() @MaxLength(20_000)
  text?: string;
}

/** Requirements are validated in the service with the same schema the AI output goes through. */
export class ShortlistDto {
  @ApiProperty({ type: 'object', additionalProperties: true }) @IsObject()
  requirements: Record<string, unknown>;
}

export class InviteDto extends ShortlistDto {
  @ApiProperty() @IsUUID()
  supplierId: string;
}

export class RequestDocumentsDto extends InviteDto {
  @ApiProperty({ enum: DocType, isArray: true }) @IsArray() @ArrayMaxSize(10) @IsEnum(DocType, { each: true })
  docTypes: DocType[];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}
