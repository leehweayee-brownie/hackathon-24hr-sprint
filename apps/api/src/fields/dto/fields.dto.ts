import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFieldDto {
  @ApiProperty({ enum: ['confirm', 'correct'] }) @IsIn(['confirm', 'correct'])
  action: 'confirm' | 'correct';

  @ApiPropertyOptional({ description: 'Required when action is correct' }) @IsOptional() @IsString() @MaxLength(500)
  value?: string;
}
