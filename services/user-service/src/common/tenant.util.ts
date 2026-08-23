import { ForbiddenException } from '@nestjs/common';
import type { CurrentUserDto } from '../auth/jwt.strategy';

/**
 * Returns the authenticated user's tenantId, or throws if the token carries
 * none. Every tenant-scoped user-service method must scope its Prisma
 * queries with the value this returns — never with a tenantId taken from
 * client input (query params, body fields, etc).
 */
export function requireTenantId(user: CurrentUserDto): string {
  if (!user.tenantId) {
    throw new ForbiddenException('Tenant context required');
  }
  return user.tenantId;
}
