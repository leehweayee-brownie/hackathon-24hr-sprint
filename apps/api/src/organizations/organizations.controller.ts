import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@vp/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { RequestUser } from '../common/types';
import { UpdateOrganizationDto } from './dto/settings.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.organizations.get(user.organizationId);
  }

  @Patch('me')
  @Roles(UserRole.SUPPLIER_OWNER, UserRole.BUYER_APPROVER, UserRole.BUYER_PROCUREMENT, UserRole.ADMIN)
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateOrganizationDto) {
    return this.organizations.update(user.organizationId, dto);
  }
}
