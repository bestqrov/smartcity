import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BranchesController],
  providers: [BranchesService, PrismaService],
  exports: [BranchesService],
})
export class BranchesModule {}
