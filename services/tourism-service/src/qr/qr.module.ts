import { Module } from '@nestjs/common';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [QrController],
  providers: [QrService, PrismaService],
  exports: [QrService],
})
export class QrModule {}
