import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

interface FindAllParams {
  page: number;
  limit: number;
  studentId?: string;
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreatePaymentDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId },
    });

    if (!student) {
      throw new BadRequestException('studentId does not belong to this tenant');
    }

    const date = dto.date ? new Date(dto.date) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          tenantId,
          type: 'INCOME',
          amount: dto.amount,
          category: dto.category ?? 'Tuition Payment',
          description:
            dto.description ??
            `Payment from ${student.firstName} ${student.lastName} (${dto.method})`,
          date,
        },
      });

      return tx.payment.create({
        data: {
          tenantId,
          studentId: dto.studentId,
          transactionId: transaction.id,
          amount: dto.amount,
          method: dto.method,
          notes: dto.notes,
          date,
        },
        include: { student: true },
      });
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit, studentId } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (studentId) where.studentId = studentId;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: { student: true },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

}
