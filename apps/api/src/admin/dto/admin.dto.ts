import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';
import { UpdateSettingsDto } from '../../organizations/dto/settings.dto';

export class UpdateRulesDto extends UpdateSettingsDto {
  @ApiPropertyOptional({ description: 'Alias of ruleWeights' }) @IsOptional() @IsObject()
  weights?: Partial<Record<string, number>>;
}

export class SuspendUserDto {
  @ApiPropertyOptional({ description: 'false to lift the suspension', default: true }) @IsOptional() @IsBoolean()
  suspended?: boolean;
}
