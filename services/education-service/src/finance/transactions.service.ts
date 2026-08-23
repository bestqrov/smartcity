import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

interface FindAllParams {
  page: number;
  limit: number;
  type?: string;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        tenantId,
        type: dto.type,
        amount: dto.amount,
        category: dto.category,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : new Date(),
      },
    });
  }

  async findAll(tenantId: string, params: FindAllParams) {
    const { page, limit, type } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStats(tenantId: string) {
    const [incomeAgg, expenseAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'INCOME' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = incomeAgg._sum.amount ?? 0;
    const totalExpense = expenseAgg._sum.amount ?? 0;

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  }
}
