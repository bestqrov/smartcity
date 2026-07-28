import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubscriptionDto) {
    const existing = await this.prisma.subscription.findUnique({
      where: { tenantId: dto.tenantId },
    });
    if (existing) {
      throw new ConflictException('This tenant already has a subscription');
    }

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const defaultDays = plan.billingPeriod === 'YEARLY' ? 365 : 30;
    const currentPeriodEnd = dto.currentPeriodEnd
      ? new Date(dto.currentPeriodEnd)
      : new Date(Date.now() + defaultDays * MS_PER_DAY);

    return this.prisma.subscription.create({
      data: {
        tenantId: dto.tenantId,
        planId: dto.planId,
        status: 'ACTIVE',
        currentPeriodEnd,
      },
      include: { plan: true, tenant: true },
    });
  }

  async findAll() {
    return this.prisma.subscription.findMany({
      include: { plan: true, tenant: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByTenant(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found for this tenant');
    }
    return subscription;
  }

  async update(id: string, dto: UpdateSubscriptionDto) {
    const existing = await this.prisma.subscription.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Subscription not found');
    }

    return this.prisma.subscription.update({
      where: { id },
      data: {
        ...(dto.planId && { planId: dto.planId }),
        ...(dto.status && { status: dto.status }),
        ...(dto.currentPeriodEnd && { currentPeriodEnd: new Date(dto.currentPeriodEnd) }),
        ...(dto.cancelAtPeriodEnd !== undefined && {
          cancelAtPeriodEnd: dto.cancelAtPeriodEnd,
        }),
      },
      include: { plan: true, tenant: true },
    });
  }

  async cancel(id: string) {
    const existing = await this.prisma.subscription.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Subscription not found');
    }

    return this.prisma.subscription.update({
      where: { id },
      data: { status: 'CANCELLED', cancelAtPeriodEnd: true },
    });
  }
}
