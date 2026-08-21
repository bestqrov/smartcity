import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { GroupStudentsService } from './group-students.service';
import { CreateGroupStudentDto } from './dto/create-group-student.dto';
import { FindGroupStudentsQueryDto } from './dto/find-group-students-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('group-students')
export class GroupStudentsController {
  constructor(private readonly groupStudentsService: GroupStudentsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async create(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: CreateGroupStudentDto,
  ) {
    return this.groupStudentsService.create(requireTenantId(user), dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query() query: FindGroupStudentsQueryDto,
  ) {
    return this.groupStudentsService.findAll(requireTenantId(user), {
      groupId: query.groupId,
      studentId: query.studentId,
    });
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async remove(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.groupStudentsService.remove(requireTenantId(user), id);
  }
}
