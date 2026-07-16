import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

interface FindAllParams {
  page: number;
  limit: number;
}

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Record<string, any>) {
    // Check for duplicate slug
    if (data.slug) {
      const existing = await this.prisma.tenant.findUnique({
        where: { slug: data.slug },
      });
      if (existing) {
        throw new ConflictException('Tenant with this slug already exists');
      }
    }

    return this.prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        domain: data.domain,
        logo: data.logo,
        type: data.type,
        currency: data.currency,
        defaultLocale: data.defaultLocale,
        timezone: data.timezone,
        features: data.features,
      },
    });
  }

  async findAll(params: FindAllParams) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const where = { isActive: true };

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: tenants,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(id: string, data: Record<string, any>) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Check slug uniqueness if changing
    if (data.slug && data.slug !== tenant.slug) {
      const existing = await this.prisma.tenant.findUnique({
        where: { slug: data.slug },
      });
      if (existing) {
        throw new ConflictException('Tenant with this slug already exists');
      }
    }

    return this.prisma.tenant.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        domain: data.domain,
        logo: data.logo,
        type: data.type,
        currency: data.currency,
        defaultLocale: data.defaultLocale,
        timezone: data.timezone,
        features: data.features,
        isActive: data.isActive,
      },
    });
  }

  async softDelete(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    await this.prisma.tenant.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Tenant deactivated successfully' };
  }
}
