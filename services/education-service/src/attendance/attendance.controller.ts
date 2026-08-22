import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { FindAttendanceQueryDto } from './dto/find-attendance-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('bulk')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async bulkMark(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: BulkMarkAttendanceDto,
  ) {
    return this.attendanceService.bulkMark(requireTenantId(user), dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query() query: FindAttendanceQueryDto,
  ) {
    const tenantId = requireTenantId(user);

    if (query.studentId) {
      return this.attendanceService.findByStudent(tenantId, query.studentId);
    }

    if (query.groupId && query.date) {
      return this.attendanceService.findByGroupAndDate(tenantId, query.groupId, query.date);
    }

    return [];
  }

  @Get('stats/:groupId')
  async getStats(
    @CurrentUser() user: CurrentUserDto,
    @Param('groupId') groupId: string,
  ) {
    return this.attendanceService.getGroupStats(requireTenantId(user), groupId);
  }
}
