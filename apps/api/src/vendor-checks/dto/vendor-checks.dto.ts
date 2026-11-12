import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocType } from '@vp/shared';
import { ArrayUnique, IsArray, IsEnum, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination';

export class CreateVendorCheckDto {
  @ApiProperty() @IsUUID()
  supplierId: string;

  @ApiProperty({ example: 'Package 3B: Earthworks and drainage, Sungai Buloh' }) @IsString() @MinLength(3) @MaxLength(200)
  tenderTitle: string;

  @ApiProperty({ example: 8000000 }) @IsNumber() @Min(0)
  contractValue: number;

  @ApiPropertyOptional({ enum: DocType, isArray: true }) @IsOptional() @IsArray() @ArrayUnique() @IsEnum(DocType, { each: true })
  requiredDocTypes?: DocType[];
}

export class UpdateVendorCheckDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(200)
  tenderTitle?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  contractValue?: number;

  @ApiPropertyOptional({ enum: DocType, isArray: true }) @IsOptional() @IsArray() @ArrayUnique() @IsEnum(DocType, { each: true })
  requiredDocTypes?: DocType[];
}

export class DecisionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}

export class RequestInfoDto {
  @ApiPropertyOptional({ example: 'Please upload your renewed public liability policy.' }) @IsOptional() @IsString() @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({ description: 'Alias of message' }) @IsOptional() @IsString() @MaxLength(1000)
  note?: string;

  get text(): string {
    return (this.message ?? this.note ?? '').trim();
  }
}

export class ListSuppliersQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  q?: string;
}

export class ListVendorChecksQuery extends PaginationQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  supplierId?: string;
}

export class RespondAccessRequestDto {
  @ApiProperty({ enum: ['grant', 'decline'] }) @IsIn(['grant', 'decline'])
  action: 'grant' | 'decline';
}

export class CreateAccessRequestDto {
  @ApiProperty() @IsUUID()
  supplierId: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  message?: string;
}
