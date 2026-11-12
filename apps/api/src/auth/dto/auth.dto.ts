import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@vp/shared';
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Bina Jaya Sdn Bhd' }) @IsString() @MinLength(2) @MaxLength(160)
  organizationName: string;

  @ApiProperty({ enum: ['SUPPLIER', 'BUYER'] }) @IsIn(['SUPPLIER', 'BUYER'])
  organizationType: 'SUPPLIER' | 'BUYER';

  @ApiPropertyOptional({ example: '201501023456 (1156789-K)' }) @IsOptional() @IsString() @MaxLength(64)
  registrationNo?: string;

  @ApiProperty({ example: 'Aisyah Rahman' }) @IsString() @MinLength(2) @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'owner@binajaya.local' }) @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' }) @IsString() @MinLength(8) @MaxLength(128)
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'supplier@binajaya.local' }) @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' }) @IsString() @MinLength(1)
  password: string;
}

export class RefreshDto {
  @ApiProperty() @IsString() @MinLength(10)
  refreshToken: string;
}

export class VerifyEmailDto {
  @ApiProperty() @IsString() @MinLength(10)
  token: string;
}

export class InviteDto {
  @ApiProperty({ example: 'colleague@binajaya.local' }) @IsEmail()
  email: string;

  @ApiProperty({ enum: UserRole }) @IsEnum(UserRole)
  role: UserRole;
}

export class AcceptInviteDto {
  @ApiProperty() @IsString() @MinLength(10)
  token: string;

  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120)
  name: string;

  @ApiProperty() @IsString() @MinLength(8) @MaxLength(128)
  password: string;
}
