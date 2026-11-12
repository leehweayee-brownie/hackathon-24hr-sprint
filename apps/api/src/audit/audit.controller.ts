import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@vp/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQuery } from '../common/dto/pagination';
import type { RequestUser } from '../common/types';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.BUYER_APPROVER,
    UserRole.BUYER_PROCUREMENT,
    UserRole.BUYER_CONTRACTS,
    UserRole.BUYER_FINANCE,
    UserRole.BUYER_PROJECT,
    UserRole.SUPPLIER_OWNER,
  )
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: PaginationQuery,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
  ) {
    const organizationId = user.role === UserRole.ADMIN ? undefined : user.organizationId;
    return this.audit.list({ organizationId, entity, entityId }, query);
  }
}
