import { Module } from '@nestjs/common';
import { GuardiansController } from './guardians.controller';
import { GuardiansService } from './guardians.service';
import { StudentGuardiansController } from './student-guardians.controller';
import { StudentGuardiansService } from './student-guardians.service';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GuardiansController, StudentGuardiansController],
  providers: [GuardiansService, StudentGuardiansService, PrismaService],
  exports: [GuardiansService, StudentGuardiansService],
})
export class GuardiansModule {}
