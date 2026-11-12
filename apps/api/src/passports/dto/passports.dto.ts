import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateShareDto {
  @ApiPropertyOptional({ example: 'Northbridge tender 3B' }) @IsOptional() @IsString() @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ example: 30, description: 'Days until the link expires; omit for no expiry' }) @IsOptional() @IsInt() @Min(1) @Max(365)
  expiresInDays?: number;

  @ApiPropertyOptional({ description: 'Absolute expiry (ISO 8601); alternative to expiresInDays' }) @IsOptional() @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional({ description: 'Buyer organization the link is meant for' }) @IsOptional() @IsUUID()
  buyerId?: string | null;
}
