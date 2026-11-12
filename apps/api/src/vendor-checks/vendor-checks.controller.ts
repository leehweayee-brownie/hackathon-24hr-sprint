import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types';
import { AccessRequestsService } from './access-requests.service';
import { CreateAccessRequestDto, CreateVendorCheckDto, DecisionDto, ListSuppliersQuery, ListVendorChecksQuery, RequestInfoDto, RespondAccessRequestDto, UpdateVendorCheckDto } from './dto/vendor-checks.dto';
import { VendorChecksService } from './vendor-checks.service';

@ApiTags('vendor-checks')
@ApiBearerAuth()
@Controller('vendor-checks')
export class VendorChecksController {
  constructor(private readonly checks: VendorChecksService) {}

  @Post()
  @ApiOperation({ summary: 'Start a check for a supplier against a tender or contract' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateVendorCheckDto) {
    return this.checks.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() query: ListVendorChecksQuery) {
    return this.checks.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Findings, score, timeline, documents and fields needing confirmation' })
  get(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.checks.get(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVendorCheckDto) {
    return this.checks.update(user, id, dto);
  }

  @Post(':id/request-info')
  requestInfo(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RequestInfoDto) {
    return this.checks.requestInfo(user, id, dto);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) {
    return this.checks.approve(user, id, dto);
  }

  @Post(':id/reject')
  reject(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) {
    return this.checks.reject(user, id, dto);
  }
}

@ApiTags('vendor-checks')
@ApiBearerAuth()
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly checks: VendorChecksService) {}

  @Get()
  @ApiOperation({ summary: 'Supplier organizations a buyer can start a check for' })
  list(@CurrentUser() user: RequestUser, @Query() query: ListSuppliersQuery) {
    return this.checks.suppliers(user, query.q);
  }
}

@ApiTags('vendor-checks')
@ApiBearerAuth()
@Controller('access-requests')
export class AccessRequestsController {
  constructor(private readonly requests: AccessRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Ask a supplier for their passport' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAccessRequestDto) {
    return this.requests.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser, @Query('status') status?: string) {
    return this.requests.list(user, status);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Supplier grants or declines a request' })
  respond(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RespondAccessRequestDto) {
    return dto.action === 'grant' ? this.requests.grant(user, id) : this.requests.decline(user, id);
  }

  @Post(':id/grant')
  grant(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.grant(user, id);
  }

  @Post(':id/decline')
  decline(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.decline(user, id);
  }
}
