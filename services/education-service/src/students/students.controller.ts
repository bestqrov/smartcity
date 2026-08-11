import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async create(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateStudentDto) {
    return this.studentsService.create(requireTenantId(user), dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    return this.studentsService.findAll(requireTenantId(user), {
      page: page || 1,
      limit: limit || 20,
      branchId,
      status,
    });
  }

  @Get(':id')
  async findOne(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.studentsService.findById(requireTenantId(user), id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async update(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(requireTenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async remove(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.studentsService.withdraw(requireTenantId(user), id);
  }
}
