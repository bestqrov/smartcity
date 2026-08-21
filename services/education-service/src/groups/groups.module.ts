import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { GroupStudentsController } from './group-students.controller';
import { GroupStudentsService } from './group-students.service';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GroupsController, GroupStudentsController],
  providers: [GroupsService, GroupStudentsService, PrismaService],
  exports: [GroupsService, GroupStudentsService],
})
export class GroupsModule {}
