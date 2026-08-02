import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { SearchExpenseDto } from './dto/search-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, createdById: string, dto: CreateExpenseDto) {
    await this.assertCategoryOwnership(tenantId, dto.categoryId);
    if (dto.hotelId) {
      await this.assertHotelOwnership(tenantId, dto.hotelId);
    }
    const currency = dto.currency || (await this.getTenantCurrency(tenantId));

    return this.prisma.expense.create({
      data: {
        tenantId,
        hotelId: dto.hotelId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        currency,
        description: dto.description,
        receiptUrl: dto.receiptUrl,
        date: new Date(dto.date),
        createdById,
      },
    });
  }

  async findAll(tenantId: string, query: SearchExpenseDto) {
    const { categoryId, hotelId, from, to, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { tenantId };
    if (categoryId) where.categoryId = categoryId;
    if (hotelId) where.hotelId = hotelId;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    return this.findOwned(tenantId, id);
  }

  async update(tenantId: string, id: string, dto: UpdateExpenseDto) {
    const expense = await this.findOwned(tenantId, id);

    if (dto.categoryId) {
      await this.assertCategoryOwnership(tenantId, dto.categoryId);
    }
    if (dto.hotelId) {
      await this.assertHotelOwnership(tenantId, dto.hotelId);
    }

    return this.prisma.expense.update({
      where: { id: expense.id },
      data: {
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.hotelId !== undefined && { hotelId: dto.hotelId }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.receiptUrl !== undefined && { receiptUrl: dto.receiptUrl }),
        ...(dto.date && { date: new Date(dto.date) }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const expense = await this.findOwned(tenantId, id);
    return this.prisma.expense.delete({ where: { id: expense.id } });
  }

  async summary(tenantId: string, month: string) {
    const [year, monthIndex] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, monthIndex - 1, 1));
    const end = new Date(Date.UTC(year, monthIndex, 1));

    const expenses = await this.prisma.expense.findMany({
      where: { tenantId, date: { gte: start, lt: end } },
      select: { amount: true, categoryId: true },
    });

    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const expense of expenses) {
      total += expense.amount;
      byCategory[expense.categoryId] = (byCategory[expense.categoryId] || 0) + expense.amount;
    }

    return { month, total, byCategory };
  }

  private async findOwned(tenantId: string, id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    if (expense.tenantId !== tenantId) {
      throw new ForbiddenException('You do not have access to this expense');
    }
    return expense;
  }

  private async assertCategoryOwnership(tenantId: string, categoryId: string) {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.tenantId !== tenantId) {
      throw new NotFoundException('Category not found');
    }
  }

  private async assertHotelOwnership(tenantId: string, hotelId: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel || hotel.tenantId !== tenantId) {
      throw new NotFoundException('Hotel not found');
    }
  }

  private async getTenantCurrency(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { currency: true },
    });
    return tenant?.currency || 'MAD';
  }
}
