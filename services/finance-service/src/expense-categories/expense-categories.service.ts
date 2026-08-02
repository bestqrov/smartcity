import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

const DEFAULT_CATEGORY_NAMES = [
  'Utilities',
  'Maintenance',
  'Cleaning',
  'Marketing',
  'Salaries',
  'Supplies',
  'Other',
];

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const existing = await this.prisma.expenseCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    if (existing.length > 0) {
      return existing;
    }

    await this.prisma.expenseCategory.createMany({
      data: DEFAULT_CATEGORY_NAMES.map((name) => ({
        tenantId,
        name,
        isDefault: true,
      })),
    });

    return this.prisma.expenseCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateExpenseCategoryDto) {
    const existing = await this.prisma.expenseCategory.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('A category with this name already exists');
    }

    return this.prisma.expenseCategory.create({
      data: { tenantId, name: dto.name },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateExpenseCategoryDto) {
    const category = await this.findOwned(tenantId, id);

    return this.prisma.expenseCategory.update({
      where: { id: category.id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string) {
    const category = await this.findOwned(tenantId, id);

    const inUse = await this.prisma.expense.findFirst({
      where: { categoryId: category.id },
    });
    if (inUse) {
      throw new ConflictException(
        'This category is used by existing expenses and cannot be deleted',
      );
    }

    return this.prisma.expenseCategory.delete({ where: { id: category.id } });
  }

  private async findOwned(tenantId: string, id: string) {
    const category = await this.prisma.expenseCategory.findUnique({ where: { id } });
    if (!category || category.tenantId !== tenantId) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }
}
