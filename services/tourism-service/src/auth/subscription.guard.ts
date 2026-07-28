import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserDto } from './jwt.strategy';

const INACTIVE_STATUSES = ['CANCELLED', 'EXPIRED'];

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest<{ user: CurrentUserDto }>();

    if (!user?.tenantId) {
      return true;
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!subscription) {
      return true;
    }

    const expired =
      INACTIVE_STATUSES.includes(subscription.status) ||
      subscription.currentPeriodEnd < new Date();

    if (expired) {
      throw new ForbiddenException(
        'Your subscription is inactive. Please renew it to manage your property.',
      );
    }

    return true;
  }
}
