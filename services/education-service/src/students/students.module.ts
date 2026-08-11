import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StudentsController],
  providers: [StudentsService, PrismaService],
  exports: [StudentsService],
})
export class StudentsModule {}
