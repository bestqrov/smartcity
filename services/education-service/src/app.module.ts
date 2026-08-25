import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { StudentsModule } from './students/students.module';
import { GuardiansModule } from './guardians/guardians.module';
import { TeachersModule } from './teachers/teachers.module';
import { GroupsModule } from './groups/groups.module';
import { AttendanceModule } from './attendance/attendance.module';
import { FinanceModule } from './finance/finance.module';
import { InscriptionsModule } from './inscriptions/inscriptions.module';
import { FormationsModule } from './formations/formations.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    AuthModule,
    BranchesModule,
    StudentsModule,
    GuardiansModule,
    TeachersModule,
    GroupsModule,
    AttendanceModule,
    FinanceModule,
    InscriptionsModule,
    FormationsModule,
    HealthModule,
  ],
})
export class AppModule {}
