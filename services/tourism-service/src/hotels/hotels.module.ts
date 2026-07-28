import { Module } from '@nestjs/common';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [HotelsController],
  providers: [HotelsService, PrismaService],
  exports: [HotelsService],
})
export class HotelsModule {}
