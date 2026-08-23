import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PaymentsService } from '../finance/payments.service';
import { CreateInscriptionDto } from './dto/create-inscription.dto';

interface FindAllParams {
  page: number;
  limit: number;
  studentId?: string;
  type?: string;
}

const INCLUDE_RELATIONS = {
  student: true,
  offering: { include: { teacher: true } },
} as const;

@Injectable()
export class InscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async create(tenantId: string, dto: CreateInscriptionDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId },
    });
    if (!student) {
      throw new BadRequestException('studentId does not belong to this tenant');
    }

    const offering = await this.prisma.offering.findFirst({
      where: { id: dto.offeringId, tenantId, isActive: true },
    });
    if (!offering) {
      throw new BadRequestException('offeringId does not belong to this tenant or is inactive');
    }

    const date = dto.date ? new Date(dto.date) : new Date();
    const typeLabel = offering.type === 'SOUTIEN' ? 'soutien' : 'formation';

    const payment = await this.paymentsService.create(tenantId, {
      studentId: dto.studentId,
      amount: dto.amount,
      method: dto.method,
      category: offering.name,
      description: `Inscription ${typeLabel}: ${offering.name} — ${student.firstName} ${student.lastName}`,
      date: date.toISOString(),
    });

    const inscription = await this.prisma.inscription.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        offeringId: dto.offeringId,
        paymentId: payment.id,
        amount: dto.amount,
        date,
        note: dto.note,
      },
      include: INCLUDE_RELATIONS,
    });

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true },
    });

    return { ...inscription, tenantName: tenant?.name ?? '', method: dto.method };
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit, studentId, type } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { tenantId };
    if (studentId) where.studentId = studentId;
    if (type) where.offering = { type };

    const [inscriptions, total] = await Promise.all([
      this.prisma.inscription.findMany({
        where,
        skip,
        take: limit,
        include: INCLUDE_RELATIONS,
        orderBy: { date: 'desc' },
      }),
      this.prisma.inscription.count({ where }),
    ]);

    return {
      data: inscriptions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
