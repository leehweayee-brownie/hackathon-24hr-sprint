import { ApiPropertyOptional } from '@nestjs/swagger';
import { RuleCode } from '@vp/shared';
import { IsInt, IsNumber, IsObject, IsOptional, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 1 }) @IsOptional() @IsNumber() @Min(0) @Max(1)
  confidenceThreshold?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(365)
  expiryWarningDays?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  minLiabilityCoverage?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  approverThreshold?: number;

  @ApiPropertyOptional({ description: 'Deduction per rule, e.g. { COMPANY_NAME_MISMATCH: 20 }' }) @IsOptional() @IsObject()
  ruleWeights?: Partial<Record<RuleCode, number>>;
}

export class UpdateOrganizationDto extends UpdateSettingsDto {
  @ApiPropertyOptional() @IsOptional()
  name?: string;

  @ApiPropertyOptional() @IsOptional()
  registrationNo?: string;
}
