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
import { StudentGuardiansService } from './student-guardians.service';
import { CreateStudentGuardianDto } from './dto/create-student-guardian.dto';
import { UpdateStudentGuardianDto } from './dto/update-student-guardian.dto';
import { FindStudentGuardiansQueryDto } from './dto/find-student-guardians-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('student-guardians')
export class StudentGuardiansController {
  constructor(private readonly studentGuardiansService: StudentGuardiansService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async create(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: CreateStudentGuardianDto,
  ) {
    return this.studentGuardiansService.create(requireTenantId(user), dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query() query: FindStudentGuardiansQueryDto,
  ) {
    return this.studentGuardiansService.findAll(requireTenantId(user), {
      studentId: query.studentId,
      guardianId: query.guardianId,
    });
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async update(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() dto: UpdateStudentGuardianDto,
  ) {
    return this.studentGuardiansService.update(requireTenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async remove(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.studentGuardiansService.remove(requireTenantId(user), id);
  }
}
