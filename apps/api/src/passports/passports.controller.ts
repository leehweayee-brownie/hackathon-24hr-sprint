import { Body, Controller, Delete, Get, Headers, Ip, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { JwtPayload, RequestUser } from '../common/types';
import { CreateShareDto } from './dto/passports.dto';
import { PassportsService } from './passports.service';

@ApiTags('passport')
@ApiBearerAuth()
@Controller('passport')
export class PassportsController {
  constructor(private readonly passports: PassportsService) {}

  @Get()
  @ApiOperation({ summary: 'Own passport (supplier)' })
  own(@CurrentUser() user: RequestUser) {
    return this.passports.own(user);
  }

  @Get('supplier/:supplierId')
  @ApiOperation({ summary: 'A supplier passport the caller has access to (buyer with a check or share)' })
  bySupplier(@CurrentUser() user: RequestUser, @Param('supplierId', ParseUUIDPipe) supplierId: string) {
    return this.passports.viewAsBuyer(user, supplierId);
  }

  @Post('shares')
  createShare(@CurrentUser() user: RequestUser, @Body() dto: CreateShareDto) {
    return this.passports.createShare(user, dto);
  }

  @Get('shares')
  listShares(@CurrentUser() user: RequestUser) {
    return this.passports.listShares(user);
  }

  @Delete('shares/:id')
  revoke(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.passports.revokeShare(user, id);
  }

  @Get('shares/:id/views')
  views(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.passports.shareViews(user, id);
  }
}

@ApiTags('passport')
@Controller('p')
export class PublicPassportController {
  constructor(
    private readonly passports: PassportsService,
    private readonly jwt: JwtService,
  ) {}

  @Public()
  @Get(':token')
  @ApiOperation({ summary: 'Public read-only passport view through a share link' })
  async view(@Param('token') token: string, @Ip() ip: string, @Headers('user-agent') userAgent?: string, @Req() req?: { headers: { authorization?: string } }) {
    const viewerUserId = await this.optionalUserId(req?.headers.authorization);
    return this.passports.viewByToken(token, { ip, userAgent, viewerUserId });
  }

  @Public()
  @Get(':token/documents/:id/file')
  file(@Param('token') token: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.passports.fileByToken(token, id);
  }

  private async optionalUserId(authorization?: string): Promise<string | null> {
    if (!authorization?.startsWith('Bearer ')) return null;
    try {
      return (await this.jwt.verifyAsync<JwtPayload>(authorization.slice(7))).sub;
    } catch {
      return null;
    }
  }
}
