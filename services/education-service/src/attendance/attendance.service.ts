import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';

function toUtcMidnight(dateInput: string | Date): Date {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertGroupInTenant(tenantId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
    });

    if (!group) {
      throw new BadRequestException('groupId does not belong to this tenant');
    }
  }

  private async assertStudentEnrolledInGroup(
    tenantId: string,
    groupId: string,
    studentId: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
    });

    if (!student) {
      throw new BadRequestException('studentId does not belong to this tenant');
    }

    const enrollment = await this.prisma.groupStudent.findFirst({
      where: { tenantId, groupId, studentId },
    });

    if (!enrollment) {
      throw new BadRequestException('studentId is not enrolled in this group');
    }
  }

  async bulkMark(tenantId: string, dto: BulkMarkAttendanceDto) {
    await this.assertGroupInTenant(tenantId, dto.groupId);

    const date = toUtcMidnight(dto.date);

    for (const entry of dto.entries) {
      await this.assertStudentEnrolledInGroup(tenantId, dto.groupId, entry.studentId);
    }

    const results = await Promise.all(
      dto.entries.map((entry) =>
        this.prisma.attendance.upsert({
          where: {
            groupId_studentId_date: {
              groupId: dto.groupId,
              studentId: entry.studentId,
              date,
            },
          },
          create: {
            tenantId,
            groupId: dto.groupId,
            studentId: entry.studentId,
            date,
            status: entry.status,
            notes: entry.notes,
          },
          update: {
            status: entry.status,
            notes: entry.notes ?? null,
          },
        }),
      ),
    );

    return results;
  }

  async findByGroupAndDate(tenantId: string, groupId: string, date: string) {
    await this.assertGroupInTenant(tenantId, groupId);

    return this.prisma.attendance.findMany({
      where: { tenantId, groupId, date: toUtcMidnight(date) },
    });
  }

  async findByStudent(tenantId: string, studentId: string) {
    return this.prisma.attendance.findMany({
      where: { tenantId, studentId },
      include: { group: true },
      orderBy: { date: 'desc' },
    });
  }

  async getGroupStats(tenantId: string, groupId: string) {
    await this.assertGroupInTenant(tenantId, groupId);

    const [totalRecords, presentCount] = await Promise.all([
      this.prisma.attendance.count({ where: { tenantId, groupId } }),
      this.prisma.attendance.count({
        where: { tenantId, groupId, status: 'PRESENT' },
      }),
    ]);

    const attendanceRate =
      totalRecords === 0 ? 0 : Math.round((presentCount / totalRecords) * 100);

    return { totalRecords, presentCount, attendanceRate };
  }
}
