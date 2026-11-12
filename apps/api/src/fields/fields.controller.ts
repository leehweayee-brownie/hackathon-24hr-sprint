import { Body, Controller, Ip, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types';
import { UpdateFieldDto } from './dto/fields.dto';
import { FieldsService } from './fields.service';

@ApiTags('fields')
@ApiBearerAuth()
@Controller('fields')
export class FieldsController {
  constructor(private readonly fields: FieldsService) {}

  @Patch(':id')
  @ApiOperation({ summary: 'Confirm or correct an extracted value' })
  update(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFieldDto, @Ip() ip: string) {
    return this.fields.update(user, id, dto, ip);
  }
}
