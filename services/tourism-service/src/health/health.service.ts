import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    const start = Date.now();
    let database = 'down';

    try {
      await this.prisma.$runCommandRaw({ ping: 1 });
      database = 'up';
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTimeMs: Date.now() - start,
      services: {
        database,
        tourism: 'up',
      },
    };
  }
}
