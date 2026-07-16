import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [RoomsController],
  providers: [RoomsService, PrismaService],
  exports: [RoomsService],
})
export class RoomsModule {}
