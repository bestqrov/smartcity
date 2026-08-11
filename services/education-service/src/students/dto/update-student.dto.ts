import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { StudentStatus } from '@prisma/client';
import { CreateStudentDto } from './create-student.dto';

export class UpdateStudentDto extends PartialType(CreateStudentDto) {
  @IsEnum(StudentStatus)
  @IsOptional()
  status?: StudentStatus;
}
