import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@vp/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQuery } from '../common/dto/pagination';
import type { RequestUser } from '../common/types';
import { AdminService } from './admin.service';
import { SuspendUserDto, UpdateRulesDto } from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('organizations')
  organizations(@Query() query: PaginationQuery) {
    return this.admin.organizations_(query);
  }

  @Patch('users/:id/suspend')
  suspend(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SuspendUserDto) {
    return this.admin.suspendUser(user, id, dto.suspended ?? true);
  }

  @Delete('users/:id')
  deleteUser(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.deleteUser(user, id);
  }

  @Get('document-types')
  documentTypes() {
    return this.admin.documentTypes();
  }

  @Get('rules')
  rules() {
    return this.admin.rules();
  }

  @Put('rules')
  updateRules(@CurrentUser() user: RequestUser, @Body() dto: UpdateRulesDto) {
    return this.admin.updateRules(user, dto);
  }

  @Get('queue')
  queue() {
    return this.admin.queue_();
  }

  @Post('reminders/run')
  runReminders() {
    return this.admin.runReminders();
  }
}
